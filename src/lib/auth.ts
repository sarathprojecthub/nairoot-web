// -----------------------------------------------------------------------------
// Website authentication - Firebase Email + Password.
//
// Beta runs on the Firebase Spark (free) plan, which does not include Phone Auth
// SMS. Email/Password needs no billing. It preserves the SAME uid-based
// architecture: createUser/signIn return a normal Firebase Auth user whose
// uid owns users/{uid} + profiles/{uid} exactly as before. Session persistence
// is the SDK default (getAuth -> IndexedDB), so login survives refresh/close.
//
// No Firestore schema or rule changes: the resulting request.auth.uid is an
// ordinary uid, so Discover / Introductions / Matches / Chats / Profile-editing
// and Android interop are unaffected.
// -----------------------------------------------------------------------------

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { auth } from './firebase';
import {
  completeSignInBootstrap,
  completeSignupBootstrap,
} from './authBootstrap';
import { createUserDoc } from './user';
import { setAuthMutationPending } from './authMutation';
import { normalizeIndianPhone } from './phoneIndex';
import { POLICY_VERSION } from './policyLinks';

/**
 * Create a new account, then ensure the private users/{uid} doc exists.
 * `phone` (already normalised, e.g. +91XXXXXXXXXX) is stored on the PRIVATE
 * users/{uid} doc only - never on the public profiles/{uid} doc - so it is not
 * exposed on Discover/profile pages. Optional for backward compatibility.
 *
 * Callers must gate this behind explicit Terms/Privacy/Community Guidelines
 * acceptance in the UI - by the time this runs, acceptance is assumed and
 * stamped with the current POLICY_VERSION.
 */
export async function signUpWithEmail(email: string, password: string, phone = ''): Promise<string> {
  setAuthMutationPending(true);
  const normalizedPhone = phone ? normalizeIndianPhone(phone) : null;
  try {
    const { uid } = await completeSignupBootstrap(
      {
        createAuthUser: () => createUserWithEmailAndPassword(auth, email, password),
        createUserDoc,
        signOut: () => signOut(auth),
        getUid: (user) => user.uid,
      },
      normalizedPhone?.phone ?? '',
      {
        ...(phone ? { phoneVerified: false, phoneCountryCode: '+91' } : {}),
        policyAcceptedVersion: POLICY_VERSION,
      },
    );
    return uid;
  } finally {
    setAuthMutationPending(false);
  }
}

/** Sign in an existing account. createUserDoc is idempotent (no-op if present). */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { uid } = await completeSignInBootstrap({
    signIn: () => signInWithEmailAndPassword(auth, email, password),
    createUserDoc,
    getUid: (user) => user.uid,
  });
  return uid;
}

/** Sign out. */
export async function logout(): Promise<void> {
  await signOut(auth);
}
