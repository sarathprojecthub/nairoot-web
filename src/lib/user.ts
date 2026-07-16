// ─────────────────────────────────────────────────────────────────────────────
// users/{uid} — private user document.
//
// Mirrors Android src/services/userService.ts. Same fields, same write shape, so
// a website-created user doc is indistinguishable from an Android-created one.
// Owner-only per Security Rules; membership fields must be ABSENT at creation.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { omitUndefined } from './onboarding/firestore';
import type { LookingForPreference } from './onboarding/options';
import {
  claimPhoneNumberInTransaction,
  normalizeIndianPhone,
} from './phoneIndex';

const USERS = 'users';

export interface DbUserLite {
  uid: string;
  phone: string;
  phoneKey?: string;
  phoneVerified?: boolean;
  phoneCountryCode?: string;
  isOnboarded: boolean;
  createdAt: number;
  lastActive: number;
}

/** Fetch the private user document by UID. Returns null if not found. */
export async function fetchUser(uid: string): Promise<DbUserLite | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  return snap.data() as DbUserLite;
}

/**
 * Create initial user doc after first auth. Idempotent — safe to call twice.
 * `extra` carries optional phone metadata collected at email+password signup.
 * omitUndefined keeps the doc shape identical for the sign-in safety-net path
 * (no extra), and never writes membership fields (Security Rule U1 forbids them).
 */
export async function createUserDoc(
  uid: string,
  phone: string,
  extra?: { phoneVerified?: boolean; phoneCountryCode?: string },
): Promise<void> {
  const ref = doc(db, USERS, uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;

    const now = Date.now();
    const payload: Record<string, unknown> = {
      uid,
      phone: '',
      isOnboarded: false,
      createdAt: now,
      lastActive: now,
    };

    if (phone) {
      const normalized = normalizeIndianPhone(phone);
      await claimPhoneNumberInTransaction(tx, uid, normalized, 'web_signup');
      payload.phone = normalized.phone;
      payload.phoneKey = normalized.phoneKey;
      payload.phoneVerified = extra?.phoneVerified ?? false;
      payload.phoneCountryCode = extra?.phoneCountryCode ?? normalized.countryCode;
    }

    tx.set(ref, omitUndefined(payload));
  });
}

// Subset of the private profile fields written during onboarding completion.
// Mirrors Android PartialUserProfile usage in preview.tsx.
export interface UserProfileUpdate {
  name?: string;
  dob?: string;
  age?: number;
  gender?: string;
  city?: string;
  state?: string;
  profession?: string;
  religion?: string;
  bio?: string;
  photos?: string[];
  lookingFor?: LookingForPreference;
  maritalStatus?: string;
  motherTongue?: string;
  income?: string;
  horoscopePreference?: string;
  creatingFor?: string;
}

/** Merge partial profile updates into users/{uid}. Adds lastActive, strips undefined. */
export async function updateUserProfile(uid: string, data: UserProfileUpdate): Promise<void> {
  const payload = omitUndefined({ ...data, lastActive: Date.now() });
  await setDoc(doc(db, USERS, uid), payload, { merge: true });
}

/** Mark onboarding as complete. */
export async function completeOnboarding(uid: string): Promise<void> {
  await setDoc(
    doc(db, USERS, uid),
    { isOnboarded: true, lastActive: Date.now() },
    { merge: true },
  );
}
