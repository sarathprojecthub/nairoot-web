'use client';

// Browser-side client for the dev-admin API. Holds the developer secret in
// sessionStorage (cleared on tab close) and attaches it to every request.

const KEY = 'dev_admin_secret';

export type DevDoc = { id: string; data: Record<string, unknown> };

export function getSecret(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(KEY);
}
export function setSecret(s: string): void {
  sessionStorage.setItem(KEY, s);
}
export function clearSecret(): void {
  sessionStorage.removeItem(KEY);
}

export async function devApi<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch('/api/dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dev-secret': getSecret() ?? '' },
    body: JSON.stringify({ action, payload }),
  });
  const json = (await res.json()) as { ok: boolean; data?: T; error?: string };
  if (!res.ok || !json.ok) {
    const err = new Error(json.error || `Request failed (HTTP ${res.status})`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return json.data as T;
}
