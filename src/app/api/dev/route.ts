// ─────────────────────────────────────────────────────────────────────────────
// Internal dev-admin API. Single POST dispatcher, server-only (Node runtime).
//
// Gated by the DEV_ADMIN_SECRET header on EVERY call. Privileged Firestore work
// runs via the rules-bypassing REST client, which only functions on a developer
// machine that is `firebase login`-ed (inert in any public deploy). Not linked
// from anywhere; production user flows never touch this route.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import {
  assertDevSecret, DevUnauthorizedError,
  listProfiles, getProfile, createProfile, updateProfile, deleteProfile,
  setVisibility, setPhotos, listUsers, resetDiscoverState, createIntroduction,
  createMatch, listConversations, createConversation, listMessages, sendMessage,
  deleteUserCascade,
} from '@/lib/server/devAdmin';
import { AdminUnavailableError } from '@/lib/server/firestoreRest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { action?: string; payload?: Record<string, unknown> };

// The dev-admin API is enabled ONLY when DEV_ADMIN_ENABLED=true is present in the
// environment (set in local .env.local; intentionally absent on production hosts).
// In production the route responds 404, as if it does not exist.
function devAdminEnabled(): boolean {
  return process.env.DEV_ADMIN_ENABLED === 'true';
}

export async function POST(req: Request) {
  if (!devAdminEnabled()) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  try {
    assertDevSecret(req.headers.get('x-dev-secret'));

    const { action, payload = {} } = (await req.json()) as Body;
    const p = payload as Record<string, unknown>;
    const str = (k: string) => String(p[k] ?? '');

    let data: unknown;
    switch (action) {
      case 'listProfiles': data = await listProfiles(str('search')); break;
      case 'getProfile': data = await getProfile(str('uid')); break;
      case 'createProfile': data = { uid: await createProfile((p.input as Record<string, unknown>) ?? {}) }; break;
      case 'updateProfile': await updateProfile(str('uid'), (p.patch as Record<string, unknown>) ?? {}); data = { ok: true }; break;
      case 'deleteProfile': await deleteProfile(str('uid')); data = { ok: true }; break;
      case 'setVisibility': await setVisibility(str('uid'), Boolean(p.isVisible)); data = { ok: true }; break;
      case 'setPhotos': await setPhotos(str('uid'), (p.photos as string[]) ?? []); data = { ok: true }; break;
      case 'listUsers': data = await listUsers(str('search')); break;
      case 'resetDiscover': await resetDiscoverState(str('uid')); data = { ok: true }; break;
      case 'createIntroduction':
        data = { id: await createIntroduction(str('senderId'), str('recipientId'), str('status') || 'pending') };
        break;
      case 'createMatch': data = await createMatch(str('userA'), str('userB')); break;
      case 'listConversations': data = await listConversations(p.uid ? str('uid') : undefined); break;
      case 'createConversation':
        data = { id: await createConversation((p.participants as string[]) ?? [], str('introductionId') || 'admin') };
        break;
      case 'listMessages': data = await listMessages(str('conversationId')); break;
      case 'sendMessage':
        data = { id: await sendMessage(str('conversationId'), str('senderId'), str('text')) };
        break;
      case 'deleteUserCascade': data = await deleteUserCascade(str('uid')); break;
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof DevUnauthorizedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
