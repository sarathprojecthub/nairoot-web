// ─────────────────────────────────────────────────────────────────────────────
// Profile editing (web) — owner edits their own public profile + private user doc.
//
// Reuses the shared schema and the existing users-doc writer. Updates only the
// display fields a member may change; it deliberately never writes the
// trust/visibility-gated fields (profileQuality, verifiedFields, isPremium,
// isConcierge, moderationStatus) so it stays within the unchanged Security Rules.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { omitUndefined } from './onboarding/firestore';
import { updateUserProfile } from './user';

const PROFILES = 'profiles';

// Fields a member may edit on their public profile.
export interface EditableProfile {
  name: string;
  height: string;
  city: string;
  state: string;
  profession: string;
  education: string;
  bio: string;
  family: string;
  maritalStatus: string;
  motherTongue: string;
  income: string;
  photos: string[];
}

export interface LoadedProfile extends EditableProfile {
  age: number;
  gender: string;
  religion: string;
  isVisible: boolean;
}

export async function fetchEditableProfile(uid: string): Promise<LoadedProfile | null> {
  const snap = await getDoc(doc(db, PROFILES, uid));
  if (!snap.exists()) return null;
  const p = snap.data() as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
  return {
    name: str('name'),
    height: str('height'),
    city: str('city'),
    state: str('state'),
    profession: str('profession'),
    education: str('education'),
    bio: str('bio'),
    family: str('family'),
    maritalStatus: str('maritalStatus'),
    motherTongue: str('motherTongue'),
    income: str('income'),
    photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
    age: typeof p.age === 'number' ? (p.age as number) : 0,
    gender: str('gender'),
    religion: str('religion') || 'Hindu',
    isVisible: p.isVisible !== false,
  };
}

// Persist edits to the public profile + mirror the shared fields into the
// private user doc (parity with how onboarding writes both).
export async function saveProfileEdits(uid: string, edits: EditableProfile): Promise<void> {
  const now = Date.now();
  await updateDoc(doc(db, PROFILES, uid), omitUndefined({
    name: edits.name,
    height: edits.height,
    city: edits.city,
    state: edits.state,
    profession: edits.profession,
    education: edits.education,
    bio: edits.bio,
    family: edits.family,
    maritalStatus: edits.maritalStatus || undefined,
    motherTongue: edits.motherTongue,
    income: edits.income,
    photos: edits.photos,
    traits: [edits.profession, edits.city].filter(Boolean),
    updatedAt: now,
  }));

  await updateUserProfile(uid, {
    name: edits.name,
    city: edits.city,
    state: edits.state,
    profession: edits.profession,
    bio: edits.bio,
    photos: edits.photos,
    maritalStatus: edits.maritalStatus || undefined,
    motherTongue: edits.motherTongue,
    income: edits.income,
  });
}

export async function setProfileVisibility(uid: string, isVisible: boolean): Promise<void> {
  await updateDoc(doc(db, PROFILES, uid), { isVisible, updatedAt: Date.now() });
}
