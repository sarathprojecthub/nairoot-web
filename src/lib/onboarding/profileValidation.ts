import type { OnboardingData } from './data';
import { BIO_MAX_CHARS, BIO_MIN_CHARS, MANUAL_OPTION_VALUE, MAX_AGE, MIN_AGE } from './options';

export type ProfileSectionId = 'photos' | 'about' | 'background' | 'location' | 'work' | 'family' | 'bio';
export type RequiredField =
  | 'photos' | 'creatingFor' | 'name' | 'dob' | 'height' | 'maritalStatus'
  | 'motherTongue' | 'state' | 'city' | 'education' | 'employmentType'
  | 'profession' | 'familyType' | 'bio';

export interface ProfileValidationError {
  field: RequiredField;
  section: ProfileSectionId;
  message: string;
}

export const REQUIRED_PROFILE_FIELDS: RequiredField[] = [
  'photos', 'creatingFor', 'name', 'dob', 'height', 'maritalStatus',
  'motherTongue', 'state', 'city', 'education', 'employmentType',
  'profession', 'familyType', 'bio',
];

export function compactProfileText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function isManualPlaceholder(value: string): boolean {
  const compact = compactProfileText(value);
  return compact === MANUAL_OPTION_VALUE || /^other(?:\s*[—-]\s*enter manually)?$/i.test(compact);
}

export function ageFromIso(iso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 0;
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDifference = today.getMonth() - date.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
}

export function validateProfile(data: OnboardingData): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];
  const age = ageFromIso(data.dob);
  if (!data.photos.length) errors.push({ field: 'photos', section: 'photos', message: 'Add at least one profile photo.' });
  if (!data.creatingFor) errors.push({ field: 'creatingFor', section: 'about', message: 'Choose who this profile is for.' });
  if (compactProfileText(data.name).length < 2) errors.push({ field: 'name', section: 'about', message: 'Enter the full name.' });
  if (!data.dob || age < MIN_AGE || age > MAX_AGE) errors.push({ field: 'dob', section: 'about', message: 'You must be between 18 and 65 years old.' });
  if (!data.height) errors.push({ field: 'height', section: 'about', message: 'Select height.' });
  if (!data.maritalStatus) errors.push({ field: 'maritalStatus', section: 'about', message: 'Select marital status.' });
  if (!data.motherTongue || isManualPlaceholder(data.motherTongue)) errors.push({ field: 'motherTongue', section: 'about', message: 'Select or enter a mother tongue.' });
  if (!data.state) errors.push({ field: 'state', section: 'location', message: 'Select state.' });
  if (compactProfileText(data.city).length < 2 || isManualPlaceholder(data.city)) errors.push({ field: 'city', section: 'location', message: 'Enter city or district.' });
  if (!data.education || isManualPlaceholder(data.education)) errors.push({ field: 'education', section: 'work', message: 'Select or enter education.' });
  if (!data.employmentType) errors.push({ field: 'employmentType', section: 'work', message: 'Select employment type.' });
  if (compactProfileText(data.profession).length < 2 || isManualPlaceholder(data.profession)) errors.push({ field: 'profession', section: 'work', message: 'Select or enter occupation.' });
  if (!data.familyType) errors.push({ field: 'familyType', section: 'family', message: 'Select family type.' });
  const bioLength = compactProfileText(data.bio).length;
  if (bioLength < BIO_MIN_CHARS || bioLength > BIO_MAX_CHARS) errors.push({ field: 'bio', section: 'bio', message: `Write between ${BIO_MIN_CHARS} and ${BIO_MAX_CHARS} characters.` });
  return errors;
}

export function profileCompletion(data: OnboardingData): number {
  const missing = validateProfile(data).length;
  return Math.round(((REQUIRED_PROFILE_FIELDS.length - missing) / REQUIRED_PROFILE_FIELDS.length) * 100);
}
