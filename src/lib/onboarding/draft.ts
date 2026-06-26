// ─────────────────────────────────────────────────────────────────────────────
// onboardingDrafts/{uid} — per-step onboarding save.
//
// Mirrors Android src/services/onboardingService.ts. Each step writes only the
// fields it owns via setDoc(merge), so a partially-completed onboarding can be
// resumed (here: when the user returns to /onboarding in the same browser).
// Deleted on completion. Owner-only per Security Rules.
// ─────────────────────────────────────────────────────────────────────────────

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { OnboardingData } from './data';

const DRAFTS = 'onboardingDrafts';

export interface OnboardingDraft extends Partial<OnboardingData> {
  uid: string;
  completedStep: number;
  updatedAt: number;
  lookingForGender?: string;
  lookingForAgeRange?: string;
}

export async function saveOnboardingDraft(
  uid: string,
  data: OnboardingData,
  completedStep: number,
): Promise<void> {
  const draft: Record<string, unknown> = { uid, completedStep, updatedAt: Date.now() };

  // Only persist fields that hold a value — matches Android's merge semantics so
  // a later step never overwrites an earlier field with an empty value.
  if (data.creatingFor) draft.creatingFor = data.creatingFor;
  if (data.name) draft.name = data.name;
  if (data.dob) draft.dob = data.dob;
  if (data.age) draft.age = data.age;
  if (data.height) draft.height = data.height;
  if (data.maritalStatus) draft.maritalStatus = data.maritalStatus;
  if (data.motherTongue) draft.motherTongue = data.motherTongue;
  if (data.subcaste) draft.subcaste = data.subcaste;
  if (data.star) draft.star = data.star;
  if (data.horoscopePreference) draft.horoscopePreference = data.horoscopePreference;
  if (data.state) draft.state = data.state;
  if (data.city) draft.city = data.city;
  if (data.education) draft.education = data.education;
  if (data.employmentType) draft.employmentType = data.employmentType;
  if (data.profession) draft.profession = data.profession;
  if (data.income) draft.income = data.income;
  if (data.familyType) draft.familyType = data.familyType;
  if (data.familyDescription) draft.familyDescription = data.familyDescription;
  if (data.fatherOccupation) draft.fatherOccupation = data.fatherOccupation;
  if (data.motherOccupation) draft.motherOccupation = data.motherOccupation;
  if (data.brothers) draft.brothers = data.brothers;
  if (data.sisters) draft.sisters = data.sisters;
  if (data.bio) draft.bio = data.bio;
  if (data.promptQuestion) draft.promptQuestion = data.promptQuestion;
  if (data.promptAnswer) draft.promptAnswer = data.promptAnswer;
  if (data.photos?.length) draft.photos = data.photos;
  if (data.gender) draft.gender = data.gender;
  if (data.religion) draft.religion = data.religion;
  draft.lookingForGender = data.lookingFor.gender;
  draft.lookingForAgeRange = data.lookingFor.ageRange;

  await setDoc(doc(db, DRAFTS, uid), draft, { merge: true });
}

export async function loadOnboardingDraft(uid: string): Promise<OnboardingDraft | null> {
  const snap = await getDoc(doc(db, DRAFTS, uid));
  if (!snap.exists()) return null;
  return snap.data() as OnboardingDraft;
}

export async function deleteOnboardingDraft(uid: string): Promise<void> {
  await deleteDoc(doc(db, DRAFTS, uid));
}
