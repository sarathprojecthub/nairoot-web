// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY Firestore REST client (admin / rules-bypassing).
//
// Mirrors the project's established privileged-access pattern (see
// scripts/final-regression.mjs): mint an OAuth access token from the local
// firebase-tools refresh token and talk to the Firestore REST API as the
// developer's Google account (IAM access → bypasses Security Rules). This is
// what lets the admin console write across users, send messages "as" anyone, etc.
//
// NEVER import this from a client component. It reads the local token file and
// only works on a developer's logged-in machine — it is inert in any public
// deploy (no token file present → throws), which is the desired safety property.
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: importing node:fs/os below makes this module impossible to bundle into
// client code (the build would fail) — so it is effectively server-only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'nairoot-app';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Well-known PUBLIC firebase-tools OAuth client (same constants the CLI ships
// with and that scripts/final-regression.mjs already uses) — not a secret.
const FB_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FB_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

let cachedToken: { value: string; expiresAt: number } | null = null;

export class AdminUnavailableError extends Error {}

function readRefreshToken(): string {
  const file = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    throw new AdminUnavailableError(
      'Admin credentials unavailable — firebase-tools is not logged in on this machine. Run `firebase login`.',
    );
  }
  const parsed = JSON.parse(raw) as { tokens?: { refresh_token?: string } };
  const refresh = parsed.tokens?.refresh_token;
  if (!refresh) throw new AdminUnavailableError('Admin credentials unavailable — no firebase-tools refresh token.');
  return refresh;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const refresh_token = readRefreshToken();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FB_CLIENT_ID,
      client_secret: FB_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new AdminUnavailableError(`Token exchange failed (HTTP ${res.status}).`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new AdminUnavailableError('Token exchange returned no access_token.');
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

// ─── Firestore REST value encode/decode ───────────────────────────────────────
type FsValue = Record<string, unknown>;
type FsFields = Record<string, FsValue>;

function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

export function toFields(obj: Record<string, unknown>): FsFields {
  const out: FsFields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = encodeValue(v);
  }
  return out;
}

function decodeValue(val: FsValue): unknown {
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue as boolean;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue as number;
  if ('stringValue' in val) return val.stringValue as string;
  if ('timestampValue' in val) return val.timestampValue as string;
  if ('arrayValue' in val) {
    const values = (val.arrayValue as { values?: FsValue[] }).values ?? [];
    return values.map(decodeValue);
  }
  if ('mapValue' in val) {
    return fromFields((val.mapValue as { fields?: FsFields }).fields ?? {});
  }
  return null;
}

export function fromFields(fields: FsFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

export interface FsDoc {
  id: string;
  data: Record<string, unknown>;
}

function idFromName(name: string): string {
  return name.split('/').pop() ?? '';
}

// ─── Low-level REST operations ────────────────────────────────────────────────
async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export async function restGet(docPath: string): Promise<FsDoc | null> {
  const res = await authedFetch(`${BASE}/${docPath}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${docPath} failed (HTTP ${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { name: string; fields?: FsFields };
  return { id: idFromName(body.name), data: fromFields(body.fields ?? {}) };
}

// List a whole collection (paginated). Internal collections here are small
// (test data), so we page through fully and let callers filter in memory.
export async function restList(collection: string, pageSize = 300): Promise<FsDoc[]> {
  const out: FsDoc[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`${BASE}/${collection}`);
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await authedFetch(url.toString());
    if (!res.ok) throw new Error(`Firestore LIST ${collection} failed (HTTP ${res.status}): ${await res.text()}`);
    const body = (await res.json()) as { documents?: { name: string; fields?: FsFields }[]; nextPageToken?: string };
    for (const d of body.documents ?? []) out.push({ id: idFromName(d.name), data: fromFields(d.fields ?? {}) });
    pageToken = body.nextPageToken;
  } while (pageToken);
  return out;
}

// Create with an auto-id. Returns the new doc id.
export async function restCreate(collection: string, data: Record<string, unknown>): Promise<string> {
  const res = await authedFetch(`${BASE}/${collection}`, {
    method: 'POST',
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore CREATE ${collection} failed (HTTP ${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { name: string };
  return idFromName(body.name);
}

// Create or overwrite a doc at an explicit id.
export async function restSet(docPath: string, data: Record<string, unknown>): Promise<void> {
  const res = await authedFetch(`${BASE}/${docPath}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore SET ${docPath} failed (HTTP ${res.status}): ${await res.text()}`);
}

// Merge-update only the provided fields (others untouched).
export async function restUpdate(docPath: string, patch: Record<string, unknown>): Promise<void> {
  const fieldPaths = Object.keys(patch);
  if (fieldPaths.length === 0) return;
  const url = new URL(`${BASE}/${docPath}`);
  for (const fp of fieldPaths) url.searchParams.append('updateMask.fieldPaths', fp);
  const res = await authedFetch(url.toString(), {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields(patch) }),
  });
  if (!res.ok) throw new Error(`Firestore UPDATE ${docPath} failed (HTTP ${res.status}): ${await res.text()}`);
}

export async function restDelete(docPath: string): Promise<void> {
  const res = await authedFetch(`${BASE}/${docPath}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Firestore DELETE ${docPath} failed (HTTP ${res.status}): ${await res.text()}`);
  }
}
