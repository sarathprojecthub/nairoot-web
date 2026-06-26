// ─────────────────────────────────────────────────────────────────────────────
// Complete Profile — writes the SAME Firestore documents Android creates.
//
// Byte-for-byte mirror of the production write sequence in Android
// app/(onboarding)/preview.tsx handleComplete():
//   1. users/{uid}     — private doc (updateUserProfile)
//   2. profiles/{uid}  — public, discoverable doc (upsertProfile)
//   3. users/{uid}.isOnboarded = true (completeOnboarding)
//   4. delete onboardingDrafts/{uid}  (best-effort)
//
// The public profile sets isVisible:true + numeric age + createdAt, which is
// exactly what the shared Discover query (isVisible==true, orderBy createdAt)
// needs — so the profile appears immediately in BOTH Android and Website Discover.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { omitUndefined } from './firestore';
import { calculateProfileQuality } from './quality';
import { updateUserProfile, completeOnboarding } from '../user';
import { deleteOnboardingDraft } from './draft';
import type { OnboardingData } from './data';

const PROFILES = 'profiles';

// Build the "Looking for" sentence exactly as Android preview.tsx does.
function lookingForSentence(data: OnboardingData): string {
  if (data.lookingFor.gender === 'any') return 'Open to meeting anyone';
  const who = data.lookingFor.gender === 'male' ? 'A man' : 'A woman';
  const range = data.lookingFor.ageRange !== 'any'
    ? ` in the ${data.lookingFor.ageRange} age range`
    : '';
  return `${who}${range}`;
}

// Mirror of Android profileService.upsertProfile: create on first write
// (with uid/createdAt), update otherwise. Strips undefined fields.
async function upsertProfile(uid: string, data: Record<string, unknown>): Promise<void> {
  const ref = doc(db, PROFILES, uid);
  const snap = await getDoc(ref);
  const now = Date.now();

  const raw = snap.exists()
    ? { ...data, updatedAt: now }
    : { ...data, uid, createdAt: now, updatedAt: now };
  const payload = omitUndefined(raw);

  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
}

export async function completeProfile(uid: string, data: OnboardingData): Promise<void> {
  const photoURLs = data.photos;

  const profileQuality = calculateProfileQuality({
    photos: data.photos,
    bio: data.bio,
    profession: data.profession,
    education: data.education,
    city: data.city,
    height: data.height,
    familyType: data.familyType || undefined,
  });

  // Phase 1 + 2 mirror — write private user doc + public profile in parallel.
  await Promise.all([
    updateUserProfile(uid, {
      name: data.name,
      dob: data.dob,
      age: data.age,
      gender: data.gender || undefined,
      city: data.city,
      state: data.state,
      profession: data.profession,
      religion: data.religion,
      bio: data.bio,
      photos: photoURLs,
      lookingFor: data.lookingFor,
      maritalStatus: data.maritalStatus || undefined,
      motherTongue: data.motherTongue,
      income: data.income,
      horoscopePreference: data.horoscopePreference || undefined,
      creatingFor: data.creatingFor || undefined,
    }),
    upsertProfile(uid, {
      name: data.name,
      dob: data.dob,
      age: data.age,
      height: data.height,
      gender: data.gender,
      city: data.city,
      state: data.state,
      profession: data.profession,
      education: data.education,
      religion: data.religion,
      bio: data.bio,
      family: data.familyDescription || data.familyType,
      lifestyle: [],
      lookingFor: lookingForSentence(data),
      photos: photoURLs,
      traits: [data.profession, data.city].filter(Boolean),
      verifiedFields: [],
      activityStatus: 'active-this-week',
      isPremium: false,
      isConcierge: false,
      isVisible: true,
      profileQuality,
      maritalStatus: data.maritalStatus || undefined,
      motherTongue: data.motherTongue,
      subcaste: data.subcaste,
      star: data.star,
      horoscopePreference: data.horoscopePreference || undefined,
      employmentType: data.employmentType || undefined,
      income: data.income,
      familyType: data.familyType || undefined,
      fatherOccupation: data.fatherOccupation,
      motherOccupation: data.motherOccupation,
      brothers: data.brothers,
      sisters: data.sisters,
      prompt: data.promptQuestion
        ? { question: data.promptQuestion, answer: data.promptAnswer || '' }
        : undefined,
      creatingFor: data.creatingFor || undefined,
    }),
  ]);

  // Phase 3 mirror — mark onboarding complete + clean up the draft.
  await completeOnboarding(uid);
  await deleteOnboardingDraft(uid).catch(() => {});
}
