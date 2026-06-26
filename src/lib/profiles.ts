// Discover data layer — uses the SAME Firestore query as the Android app:
//   profiles where isVisible == true, orderBy createdAt desc, limit, startAfter
// (see Android discoverService.ts). Reads only; no writes in M1.
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import type { Profile } from './types';

const PROFILES = 'profiles';
export const PAGE_SIZE = 24;

export type Cursor = QueryDocumentSnapshot<DocumentData> | null;

// Firestore Security Rules require an authenticated request. The Android app
// signs in anonymously; the web client does the same until real auth (M-auth).
export function ensureAuth(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
    signInAnonymously(auth).catch((e) => {
      unsub();
      reject(e);
    });
  });
}

// Port of Android's dbProfileToMockProfile field mapping.
function mapProfile(id: string, p: DocumentData): Profile {
  return {
    id,
    name: p.name ?? '',
    age: p.age ?? 0,
    city: p.city ?? '',
    state: p.state,
    profession: p.profession ?? '',
    education: p.education ?? '',
    religion: p.religion ?? '',
    height: p.height,
    bio: p.bio ?? '',
    family: p.family ?? '',
    lookingFor: p.lookingFor ?? '',
    photo: p.photos?.[0] ?? '',
    photos: p.photos ?? [],
    traits: p.traits ?? [],
    lifestyle: p.lifestyle ?? [],
    verifiedFields: p.verifiedFields ?? [],
    activityStatus: p.activityStatus ?? 'active-this-week',
    maritalStatus: p.maritalStatus,
    motherTongue: p.motherTongue,
    subcaste: p.subcaste,
    isPremium: p.isPremium ?? false,
    prompt: p.prompt,
    createdAt: p.createdAt ?? 0,
  };
}

export interface DiscoverPage {
  profiles: Profile[];
  cursor: Cursor;
  hasMore: boolean;
}

export async function fetchDiscoverPage(cursor: Cursor): Promise<DiscoverPage> {
  const user = await ensureAuth();

  const constraints: QueryConstraint[] = [
    where('isVisible', '==', true),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE),
  ];
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, PROFILES), ...constraints));

  // Parity with Android excludeFilter: never show the viewer their own card.
  // (blocked/hidden filtering arrives with real auth + users/{uid} meta.)
  const profiles = snap.docs
    .filter((d) => d.id !== user.uid)
    .map((d) => mapProfile(d.id, d.data()));

  return {
    profiles,
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  await ensureAuth();
  const snap = await getDoc(doc(db, PROFILES, id));
  if (!snap.exists()) return null;
  return mapProfile(snap.id, snap.data());
}
