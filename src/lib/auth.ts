// ─────────────────────────────────────────────────────────────────────────────
// Website authentication — Firebase Email + Password.
//
// Beta runs on the Firebase Spark (free) plan, which does not include Phone Auth
// SMS. Email/Password needs no billing. It preserves the SAME uid-based
// architecture: createUser…/signIn… return a normal Firebase Auth user whose
// `uid` owns users/{uid} + profiles/{uid} exactly as before. Session persistence
// is the SDK default (getAuth → IndexedDB), so login survives refresh/close.
//
// No Firestore schema or rule changes: the resulting `request.auth.uid` is an
// ordinary uid, so Discover / Introductions / Matches / Chats / Profile-editing
// and Android interop are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { auth } from './firebase';
import { createUserDoc } from './user';
import { setAuthMutationPending } from './authMutation';
import { normalizeIndianPhone, releasePhoneNumber } from './phoneIndex';

/**
 * Create a new account, then ensure the private users/{uid} doc exists.
 * `phone` (already normalised, e.g. +91XXXXXXXXXX) is stored on the PRIVATE
 * users/{uid} doc only — never on the public profiles/{uid} doc — so it is not
 * exposed on Discover/profile pages. Optional for backward compatibility.
 */
export async function signUpWithEmail(email: string, password: string, phone = ''): Promise<string> {
  setAuthMutationPending(true);
  let cred: Awaited<ReturnType<typeof createUserWithEmailAndPassword>> | null = null;
  const normalizedPhone = phone ? normalizeIndianPhone(phone) : null;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
    await createUserDoc(
      cred.user.uid,
      normalizedPhone?.phone ?? '',
      phone ? { phoneVerified: false, phoneCountryCode: '+91' } : undefined,
    );
    return cred.user.uid;
  } catch (error) {
    if (cred?.user) {
      await releasePhoneNumber(cred.user.uid, normalizedPhone?.phoneKey).catch(() => {});
      try {
        await deleteUser(cred.user);
      } catch {
        try {
          await signOut(auth);
        } catch {
          // Best effort cleanup only; preserve the original signup error.
        }
      }
    }
    throw error;
  } finally {
    setAuthMutationPending(false);
  }
}

/** Sign in an existing account. createUserDoc is idempotent (no-op if present). */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await createUserDoc(cred.user.uid, '');
  return cred.user.uid;
}

/** Sign out. */
export async function logout(): Promise<void> {
  await signOut(auth);
}
