import {
  doc,
  getDoc,
  runTransaction,
  type Transaction,
} from 'firebase/firestore';
import { db } from './firebase';

const PHONE_INDEX = 'phoneIndex';

export const DUPLICATE_PHONE_ERROR_CODE = 'phone/already-linked';
export const INVALID_PHONE_ERROR_CODE = 'phone/invalid-indian-mobile';
export const DUPLICATE_PHONE_MESSAGE =
  'This mobile number is already linked to another account. Please use a different number or contact support if this is yours.';
export const INVALID_PHONE_MESSAGE = 'Enter a valid 10-digit Indian mobile number.';

export type PhoneIndexSource =
  | 'web_signup'
  | 'android_onboarding'
  | 'android_profile_edit'
  | 'web_profile_edit';

export interface NormalizedPhone {
  phone: string;
  phoneKey: string;
  countryCode: '+91';
}

export class PhoneIndexError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PhoneIndexError';
    this.code = code;
  }
}

export function normalizeIndianPhone(input: string): NormalizedPhone {
  const compact = input.trim().replace(/[\s\-().]/g, '');
  const digits = compact.startsWith('+') ? compact.slice(1) : compact;

  let nationalNumber = '';
  if (/^[6-9]\d{9}$/.test(digits)) {
    nationalNumber = digits;
  } else if (/^91[6-9]\d{9}$/.test(digits)) {
    nationalNumber = digits.slice(2);
  }

  if (!nationalNumber) {
    throw new PhoneIndexError(INVALID_PHONE_ERROR_CODE, INVALID_PHONE_MESSAGE);
  }

  return {
    phone: `+91${nationalNumber}`,
    phoneKey: `91${nationalNumber}`,
    countryCode: '+91',
  };
}

export async function getPhoneIndex(phoneKey: string) {
  return getDoc(doc(db, PHONE_INDEX, phoneKey));
}

export async function assertPhoneAvailable(phoneKey: string, currentUid: string): Promise<void> {
  const snap = await getPhoneIndex(phoneKey);
  if (snap.exists() && snap.data().userId !== currentUid) {
    throw new PhoneIndexError(DUPLICATE_PHONE_ERROR_CODE, DUPLICATE_PHONE_MESSAGE);
  }
}

export function phoneIndexDoc(
  uid: string,
  normalized: NormalizedPhone,
  source: PhoneIndexSource,
  now = Date.now(),
) {
  return {
    userId: uid,
    phone: normalized.phone,
    phoneKey: normalized.phoneKey,
    countryCode: normalized.countryCode,
    createdAt: now,
    updatedAt: now,
    source,
  };
}

export async function claimPhoneNumber(
  uid: string,
  input: string,
  source: PhoneIndexSource,
): Promise<NormalizedPhone> {
  const normalized = normalizeIndianPhone(input);
  const ref = doc(db, PHONE_INDEX, normalized.phoneKey);

  await runTransaction(db, async (tx) => {
    await claimPhoneNumberInTransaction(tx, uid, normalized, source);
  });

  return normalized;
}

export async function releasePhoneNumber(uid: string, oldPhoneKey?: string): Promise<void> {
  if (!oldPhoneKey) return;
  const ref = doc(db, PHONE_INDEX, oldPhoneKey);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists() && snap.data().userId === uid) {
      tx.delete(ref);
    }
  });
}

export async function claimPhoneNumberInTransaction(
  tx: Transaction,
  uid: string,
  normalized: NormalizedPhone,
  source: PhoneIndexSource,
): Promise<void> {
  const ref = doc(db, PHONE_INDEX, normalized.phoneKey);
  const snap = await tx.get(ref);
  if (snap.exists() && snap.data().userId !== uid) {
    throw new PhoneIndexError(DUPLICATE_PHONE_ERROR_CODE, DUPLICATE_PHONE_MESSAGE);
  }

  const now = Date.now();
  tx.set(
    ref,
    {
      ...phoneIndexDoc(uid, normalized, source, now),
      createdAt: snap.exists() ? snap.data().createdAt ?? now : now,
    },
    { merge: true },
  );
}
