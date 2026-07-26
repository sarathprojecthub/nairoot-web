// ─────────────────────────────────────────────────────────────────────────────
// Onboarding field enums + option lists.
//
// Ported verbatim from the Android onboarding screens so the website collects
// the SAME fields with the SAME allowed values. Do not diverge from Android
// without updating both clients (shared Firestore schema).
//   Android sources: src/types/user.ts and app/(onboarding)/*.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { INDIA_DISTRICTS_BY_STATE } from './indiaDistricts';
import { DISTRICT_ALIASES } from './districtAliases';

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
export const BIO_MAX_CHARS = 500;
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
export const MAX_PHOTOS = 4;

export interface ProfileOption<T extends string = string> {
  value: T;
  label: string;
  search?: string;
  manual?: boolean;
}

export const MANUAL_OPTION_VALUE = '__other__';
const manualOption: ProfileOption = {
  value: MANUAL_OPTION_VALUE,
  label: 'Other — enter manually',
  manual: true,
};

export const MOTHER_TONGUE_OPTIONS: ProfileOption[] = [
  'Malayalam', 'Assamese', 'Bengali', 'Bhojpuri', 'Bodo', 'Dogri', 'English',
  'Garhwali', 'Gujarati', 'Haryanvi', 'Hindi', 'Kannada', 'Kashmiri', 'Kodava',
  'Konkani', 'Kumaoni', 'Maithili', 'Manipuri / Meitei', 'Marathi', 'Nepali',
  'Odia', 'Punjabi', 'Rajasthani', 'Santali', 'Sanskrit', 'Sindhi', 'Tamil',
  'Telugu', 'Tulu', 'Urdu',
].map((label) => ({ value: label, label })).concat(manualOption);

export const SUBCASTE_OPTIONS: ProfileOption[] = [
  'Kiriyathil Nair', 'Illathu Nair', 'Swaroopathil Nair', 'Veluthedathu Nair',
  'Menon', 'Pillai', 'Kurup', 'Nambiar', 'Panicker', 'Kaimal', 'Kartha',
  'Marar', 'Unnithan', 'Thampi', 'Nedungadi', 'Prefer not to say',
].map((label) => ({ value: label, label })).concat(manualOption);

export const NAKSHATRA_OPTIONS: ProfileOption[] = [
  ['Aswathi', 'Ashwini'], ['Bharani'], ['Karthika', 'Krittika'], ['Rohini'],
  ['Makayiram', 'Mrigashira'], ['Thiruvathira', 'Ardra'], ['Punartham', 'Punarvasu'],
  ['Pooyam', 'Pushya'], ['Ayilyam', 'Ashlesha'], ['Makam', 'Magha'],
  ['Pooram', 'Purva Phalguni'], ['Uthram', 'Uttara Phalguni'], ['Atham', 'Hasta'],
  ['Chithira', 'Chitra'], ['Chothi', 'Swati'], ['Vishakham'], ['Anizham', 'Anuradha'],
  ['Thrikketta', 'Jyeshtha'], ['Moolam', 'Mula'], ['Pooradam', 'Purva Ashadha'],
  ['Uthradam', 'Uttara Ashadha'], ['Thiruvonam', 'Shravana'], ['Avittam', 'Dhanishta'],
  ['Chathayam', 'Shatabhisha'], ['Pooruruttathi', 'Purva Bhadrapada'],
  ['Uthrattathi', 'Uttara Bhadrapada'], ['Revathi', 'Revati'], ["Don't know"],
  ['Prefer not to say'],
].map(([value, secondary]) => ({
  value,
  label: secondary ? `${value} — ${secondary}` : value,
  search: `${value} ${secondary ?? ''}`,
}));

export const HEIGHT_OPTIONS: ProfileOption[] = Array.from({ length: 101 }, (_, index) => {
  const cm = 120 + index;
  const totalInches = Math.round(cm / 2.54);
  return {
    value: `${cm} cm`,
    label: `${cm} cm · ${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`,
  };
});

export const STATE_OPTIONS: ProfileOption[] = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam',
  'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
].map((label) => ({ value: label, label }));

export const CITY_OPTIONS_BY_STATE: Record<string, ProfileOption[]> = Object.fromEntries(
  Object.entries(INDIA_DISTRICTS_BY_STATE).map(([state, districts]) => [
    state,
    districts.map((label) => {
      const aliases = DISTRICT_ALIASES[state]?.[label];
      return { value: label, label, search: aliases?.join(' ') };
    }),
  ]),
);

export const EDUCATION_PROFILE_OPTIONS: ProfileOption[] = [
  'Higher Secondary / Plus Two', 'ITI', 'Vocational Diploma', 'Polytechnic Diploma',
  'B.A.', 'B.Sc.', 'B.Com.', 'BBA', 'BCA', 'B.Tech.', 'B.E.', 'B.Arch.', 'B.Pharm.',
  'B.Ed.', 'BSW', 'BFA', 'LLB', 'MBBS', 'BDS', 'BAMS', 'BHMS', 'B.V.Sc.',
  'B.Sc. Nursing', "Other Bachelor's", 'M.A.', 'M.Sc.', 'M.Com.', 'MBA', 'MCA',
  'M.Tech.', 'M.E.', 'M.Arch.', 'M.Pharm.', 'M.Ed.', 'MSW', 'LLM', 'MPH', 'MD',
  'MS', 'MDS', "Other Master's", 'Ph.D.', 'CA', 'CMA', 'CS', 'CFA', 'FRM', 'CPA',
  'Other Professional Qualification',
].map((label) => ({ value: label, label })).concat(manualOption);

export const OCCUPATION_PROFILE_OPTIONS: ProfileOption[] = [
  'Software Engineer', 'Data Analyst', 'Data Scientist', 'Product Manager', 'Designer',
  'Doctor', 'Dentist', 'Nurse', 'Pharmacist', 'Healthcare Professional',
  'Chartered Accountant', 'Accountant', 'Banker', 'Investment Professional', 'Lawyer',
  'Architect', 'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Teacher',
  'Professor', 'Researcher', 'Civil Servant', 'Government Employee', 'Defence Professional',
  'Police', 'Entrepreneur', 'Business Owner', 'Consultant', 'Freelancer',
  'Sales Professional', 'Marketing Professional', 'HR Professional', 'Media Professional',
  'Writer', 'Artist', 'Hospitality Professional', 'Aviation Professional', 'Merchant Navy',
  'Farmer', 'Homemaker', 'Student', 'Retired',
].map((label) => ({ value: label, label })).concat(manualOption);

export const PARENT_OCCUPATION_OPTIONS: ProfileOption[] = [
  'Homemaker', 'Business Owner', 'Self-Employed', 'Private Sector', 'Government Service',
  'Public Sector / PSU', 'Civil Services', 'Defence', 'Professional',
  'Teacher / Professor', 'Doctor / Healthcare', 'Farmer', 'Retired', 'Passed Away',
  'Prefer not to say',
].map((label) => ({ value: label, label })).concat(manualOption);

// Web has historically stored the displayed rupee labels. Keep those values
// stable while expanding the bands to semantic parity with Android.
export const INCOME_PROFILE_OPTIONS: ProfileOption[] = [
  'Below ₹1 Lakh', '₹1–3 Lakhs', '₹3–5 Lakhs', '₹5–7.5 Lakhs',
  '₹7.5–10 Lakhs', '₹10–15 Lakhs', '₹15–25 Lakhs', '₹25–50 Lakhs',
  '₹50 Lakhs–₹1 Crore', 'Above ₹1 Crore', 'Prefer not to say',
].map((label) => ({ value: label, label }));
