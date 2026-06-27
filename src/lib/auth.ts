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
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { auth } from './firebase';
import { createUserDoc } from './user';

/** Create a new account, then ensure the private users/{uid} doc exists. */
export async function signUpWithEmail(email: string, password: string): Promise<string> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Email accounts have no phone number; the `phone` field stays empty (schema
  // unchanged). createUserDoc is idempotent.
  await createUserDoc(cred.user.uid, '');
  return cred.user.uid;
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
