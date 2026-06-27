// ─────────────────────────────────────────────────────────────────────────────
// Website production authentication — Firebase Phone Auth (OTP).
//
// Replaces the previous anonymous-first model. A verified phone number maps to a
// STABLE Firebase Auth uid (Firebase guarantees the same uid for the same phone),
// so a returning member always reconnects to the same users/{uid} + profiles/{uid}
// — across browsers and devices. Session persistence is handled by the SDK
// (getAuth → IndexedDB), so login survives refresh/close.
//
// No Firestore schema/rule changes: the resulting uid is an ordinary
// `request.auth.uid`, identical in the rules to the anonymous uid it replaces, so
// Discover / Introductions / Matches / Chats / Profile-editing are unaffected and
// remain interoperable with the Android (anonymous-first) client.
// ─────────────────────────────────────────────────────────────────────────────

import {
  RecaptchaVerifier, signInWithPhoneNumber, signOut, type ConfirmationResult,
} from 'firebase/auth';
import { auth } from './firebase';
import { createUserDoc } from './user';

// Invisible reCAPTCHA — required by Firebase Phone Auth on web. Kept as a module
// singleton so re-renders don't create duplicate widgets.
let verifier: RecaptchaVerifier | null = null;

function getVerifier(containerId: string): RecaptchaVerifier {
  if (!verifier) {
    verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return verifier;
}

export function clearRecaptcha(): void {
  try { verifier?.clear(); } catch { /* ignore */ }
  verifier = null;
}

/** Step 1: send an OTP to the phone number (E.164, e.g. +9198…). */
export async function startPhoneSignIn(
  phoneE164: string,
  recaptchaContainerId: string,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneE164, getVerifier(recaptchaContainerId));
}

/**
 * Step 2: confirm the OTP. Returns the stable uid. Ensures the private
 * users/{uid} doc exists (idempotent — created on first login with the verified
 * phone, untouched for returning members).
 */
export async function confirmOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<string> {
  const cred = await confirmation.confirm(code);
  const uid = cred.user.uid;
  await createUserDoc(uid, cred.user.phoneNumber ?? '');
  return uid;
}

/** Sign out and tear down the reCAPTCHA widget. */
export async function logout(): Promise<void> {
  clearRecaptcha();
  await signOut(auth);
}
