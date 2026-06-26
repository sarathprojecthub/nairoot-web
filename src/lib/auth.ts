// ─────────────────────────────────────────────────────────────────────────────
// Website authentication — reuses the EXISTING Android auth model:
//   anonymous-first session (signInAnonymously) + phone captured on the
//   users/{uid} document. No separate auth system.
//
// Mirrors Android src/services/authService.ts signInWithPhone():
//   ensure an anonymous Firebase Auth session → createUserDoc(uid, phone).
// The anonymous session persists in the browser (IndexedDB), so the uid is
// stable per-browser — the same uid that owns the profile, introductions, and
// conversations the user creates.
// ─────────────────────────────────────────────────────────────────────────────

import { ensureAuth } from './profiles';
import { createUserDoc } from './user';

/** Establish the session and write the private user doc with the phone number. */
export async function signInWithPhone(phone: string): Promise<string> {
  const user = await ensureAuth();
  await createUserDoc(user.uid, phone);
  return user.uid;
}
