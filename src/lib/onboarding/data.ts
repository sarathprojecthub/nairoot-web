// ─────────────────────────────────────────────────────────────────────────────
// OnboardingData — the flat shape collected across all onboarding steps.
//
// Mirrors the Android Zustand store (src/store/onboardingStore.ts) field-for-field
// so the same data feeds the same Firestore writes. Defaults match INITIAL.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CreatingFor, Gender, Religion, MaritalStatus, EmploymentType,
  FamilyType, HoroscopePreference, LookingForPreference,
} from './options';

export interface OnboardingData {
  // Step 1 — Create Profile
  creatingFor: CreatingFor | '';
  name: string;

  // Step 2 — Personal Details
  dob: string;          // YYYY-MM-DD (ISO)
  age: number;          // computed from dob
  height: string;
  maritalStatus: MaritalStatus | '';
  motherTongue: string;

  // Step 3 — Religious Details
  subcaste: string;
  star: string;
  horoscopePreference: HoroscopePreference | '';

  // Step 4 — Location
  state: string;
  city: string;

  // Step 5 — Professional Details
  education: string;
  employmentType: EmploymentType | '';
  profession: string;
  income: string;

  // Step 6 — Family Details
  familyType: FamilyType | '';
  familyDescription: string;
  fatherOccupation: string;
  motherOccupation: string;
  brothers: string;
  sisters: string;

  // Step 7 — About
  bio: string;
  promptQuestion: string;
  promptAnswer: string;

  // Step 8 — Photos (uploaded Cloudinary secure_urls)
  photos: string[];

  // Derived / compatibility
  gender: Gender | '';
  religion: Religion;
  lookingFor: LookingForPreference;
}

export const INITIAL_ONBOARDING_DATA: OnboardingData = {
  creatingFor: '',
  name: '',
  dob: '',
  age: 0,
  height: '',
  maritalStatus: '',
  motherTongue: 'Malayalam',
  subcaste: '',
  star: '',
  horoscopePreference: '',
  state: 'Kerala',
  city: '',
  education: '',
  employmentType: '',
  profession: '',
  income: '',
  familyType: '',
  familyDescription: '',
  fatherOccupation: '',
  motherOccupation: '',
  brothers: '0',
  sisters: '0',
  bio: '',
  promptQuestion: '',
  promptAnswer: '',
  photos: [],
  gender: '',
  religion: 'Hindu',
  lookingFor: { gender: 'any', ageRange: 'any' },
};

// ─── DOB validation helpers — ported from Android personal-details.tsx ────────

export function computeAge(y: number, m: number, d: number): number {
  const today = new Date();
  let age = today.getFullYear() - y;
  const md = today.getMonth() + 1 - m;
  if (md < 0 || (md === 0 && today.getDate() < d)) age--;
  return age;
}

export function isValidCalendarDate(d: number, m: number, y: number): boolean {
  if (m < 1 || m > 12) return false;
  const days = new Date(y, m, 0).getDate();
  return d >= 1 && d <= days;
}

// Derive gender + partner preference from the "creating for" choice,
// exactly as Android name.tsx selectOption() does.
export function deriveFromCreatingFor(gender: Gender): {
  gender: Gender;
  lookingFor: LookingForPreference;
} {
  return {
    gender,
    lookingFor: {
      gender: gender === 'male' ? 'female' : 'male',
      ageRange: 'any',
    },
  };
}
