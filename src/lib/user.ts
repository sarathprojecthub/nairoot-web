// ─────────────────────────────────────────────────────────────────────────────
// users/{uid} — private user document.
//
// Mirrors Android src/services/userService.ts. Same fields, same write shape, so
// a website-created user doc is indistinguishable from an Android-created one.
// Owner-only per Security Rules; membership fields must be ABSENT at creation.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { omitUndefined } from './onboarding/firestore';
import type { LookingForPreference } from './onboarding/options';

const USERS = 'users';

export interface DbUserLite {
  uid: string;
  phone: string;
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

/** Create initial user doc after first auth. Idempotent — safe to call twice. */
export async function createUserDoc(uid: string, phone: string): Promise<void> {
  const ref = doc(db, USERS, uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid,
    phone,
    isOnboarded: false,
    createdAt: Date.now(),
    lastActive: Date.now(),
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
