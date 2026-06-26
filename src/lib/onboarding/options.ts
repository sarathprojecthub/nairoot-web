// ─────────────────────────────────────────────────────────────────────────────
// Onboarding field enums + option lists.
//
// Ported verbatim from the Android onboarding screens so the website collects
// the SAME fields with the SAME allowed values. Do not diverge from Android
// without updating both clients (shared Firestore schema).
//   Android sources: src/types/user.ts and app/(onboarding)/*.tsx
// ─────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other';
export type CreatingFor = 'bride' | 'groom' | 'daughter' | 'son' | 'sister' | 'brother';
export type MaritalStatus = 'never-married' | 'divorced' | 'widowed' | 'awaiting-divorce';
export type EmploymentType = 'private' | 'government' | 'business' | 'not-working';
export type FamilyType = 'nuclear' | 'joint' | 'extended';
export type HoroscopePreference = 'required' | 'preferred' | 'no-bar';
export type Religion = 'Hindu' | 'Muslim' | 'Christian' | 'Sikh' | 'Jain' | 'Buddhist' | 'Other';
export type AgeRangePreference = '20-27' | '25-32' | '28-35' | '32-40' | 'any';

export interface LookingForPreference {
  gender: Gender | 'any';
  ageRange: AgeRangePreference;
}

// ── Step 1 — Create Profile (name + who the profile is for) ───────────────────
export interface CreatingForOption {
  value: CreatingFor;
  label: string;
  sub: string;
  gender: Gender;
}

export const CREATING_FOR_OPTIONS: CreatingForOption[] = [
  { value: 'bride', label: 'Bride', sub: 'Myself — Woman', gender: 'female' },
  { value: 'groom', label: 'Groom', sub: 'Myself — Man', gender: 'male' },
  { value: 'daughter', label: 'Daughter', sub: 'Family', gender: 'female' },
  { value: 'son', label: 'Son', sub: 'Family', gender: 'male' },
  { value: 'sister', label: 'Sister', sub: 'Family', gender: 'female' },
  { value: 'brother', label: 'Brother', sub: 'Family', gender: 'male' },
];

// ── Step 2 — Personal Details ─────────────────────────────────────────────────
export const MIN_AGE = 18;
export const MAX_AGE = 65;

export const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: 'never-married', label: 'Never Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'awaiting-divorce', label: 'Awaiting Divorce' },
];

// ── Step 3 — Religious Details (religion + caste are fixed for this community) ──
export const HOROSCOPE_OPTIONS: { value: HoroscopePreference; label: string; sub: string }[] = [
  { value: 'required', label: 'Should match', sub: 'Horoscope match is important' },
  { value: 'preferred', label: 'Good to have', sub: 'Preferred but not mandatory' },
  { value: 'no-bar', label: 'Does not matter', sub: 'Open to all' },
];

export const NAIR_SUBCASTES = [
  'Kiriyathil', 'Kiryathil Nair', 'Veluthedathu', 'Karayalar', 'Illath',
  'Menon', 'Pillai', 'Kurup', 'Kaimal', 'Other',
];

// ── Step 4 — Location ─────────────────────────────────────────────────────────
export const STATES = [
  'Kerala', 'Karnataka', 'Tamil Nadu', 'Maharashtra',
  'Delhi', 'Telangana', 'Andhra Pradesh', 'Gujarat', 'Other',
];

export const KERALA_CITIES = [
  'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur',
  'Kollam', 'Kannur', 'Palakkad', 'Malappuram',
];

// ── Step 5 — Professional Details ─────────────────────────────────────────────
export const EDUCATION_OPTIONS = [
  'B.Tech / B.E', 'MBBS', 'MBA', 'B.Sc', 'B.Com', 'B.A',
  'M.Tech', 'MCA', 'M.Sc', 'M.A', 'Ph.D', 'Diploma', 'Other',
];

export const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'private', label: 'Private Sector' },
  { value: 'government', label: 'Government' },
  { value: 'business', label: 'Business / Self' },
  { value: 'not-working', label: 'Not Working' },
];

export const OCCUPATION_CHIPS = [
  'Software Engineer', 'Doctor', 'Lawyer', 'Chartered Accountant',
  'Entrepreneur', 'Architect', 'Professor', 'Civil Servant',
  'Business Owner', 'Nurse / Healthcare', 'Banker', 'Designer',
];

export const INCOME_OPTIONS = [
  'Below ₹1 Lakh', '₹1–3 Lakhs', '₹3–5 Lakhs', '₹5–7.5 Lakhs',
  '₹7.5–10 Lakhs', '₹10–15 Lakhs', '₹15–25 Lakhs', 'Above ₹25 Lakhs',
  'Prefer not to say',
];

// ── Step 6 — Family Details ───────────────────────────────────────────────────
export const MAX_FAMILY_DESC = 280;

export const FAMILY_TYPE_OPTIONS: { value: FamilyType; label: string; sub: string }[] = [
  { value: 'nuclear', label: 'Nuclear Family', sub: 'Parents and siblings' },
  { value: 'joint', label: 'Joint Family', sub: 'Extended family under one roof' },
  { value: 'extended', label: 'Extended Family', sub: 'Closely connected across homes' },
];

export const FATHER_OCCUPATIONS = [
  'Business Owner', 'Government Service', 'Private Sector',
  'Retired', 'Farmer', 'Passed Away',
];

export const MOTHER_OCCUPATIONS = [
  'Homemaker', 'Government Service', 'Private Sector',
  'Business Owner', 'Retired', 'Passed Away',
];

export const SIBLING_COUNTS = ['0', '1', '2', '3', '4', '5+'];

export const FAMILY_DESC_STARTERS = [
  { label: 'Close-knit', text: 'Close-knit family from Thrissur. Father is a retired civil servant. A household that values education, culture, and togetherness.' },
  { label: 'Academic home', text: 'Academic family from Kochi. Father is a professor; mother has taught in schools for over twenty years. A quiet, principled household.' },
  { label: 'Business roots', text: 'Business family from Ernakulam, third generation. Deep community ties and a household that takes both work and people seriously.' },
];

// ── Step 7 — About / Bio ──────────────────────────────────────────────────────
export const BIO_MIN_CHARS = 30;
export const BIO_MAX_CHARS = 300;
export const PROMPT_MAX_CHARS = 160;

export const BIO_STARTERS = [
  { label: 'Family & values', text: 'I value family bonds and believe in building a calm, purposeful home together. Family gatherings and shared traditions matter deeply to me.' },
  { label: 'Life & career', text: 'I am grounded in my work and equally invested in the people around me. I look forward to a partnership built on mutual respect and quiet strength.' },
  { label: 'What I am looking for', text: 'I am looking for someone who values family, has a gentle sense of humour, and wants to build something meaningful — not just a life, but a home.' },
];

export const PROMPT_QUESTIONS = [
  'A quiet Sunday usually looks like…',
  'One thing my family would say about me…',
  'I value relationships where…',
  'My idea of a good life is…',
  'A home feels complete when…',
  'One tradition I hope to carry forward…',
];

// ── Step 8 — Photos ───────────────────────────────────────────────────────────
export const MAX_PHOTOS = 3;
