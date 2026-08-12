// Discover data layer — uses the SAME Firestore query as the Android app:
//   profiles where isVisible == true, gender == oppositeGender,
//   orderBy createdAt desc, limit, startAfter
// (see Android discoverService.ts / discoverStore.ts). Reads only; no writes in M1.
import { auth, db } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
const USERS    = 'users';
export const PAGE_SIZE = 24;

export type Cursor = QueryDocumentSnapshot<DocumentData> | null;

// Strict v1 male↔female matching — mirrors Android's discoverStore.ts exactly.
// 'other', missing, or any invalid value fails closed (null) rather than
// falling back to an unrestricted feed.
export type OppositeGender = 'male' | 'female';

function oppositeGenderOf(gender: unknown): OppositeGender | null {
  if (gender === 'male') return 'female';
  if (gender === 'female') return 'male';
  return null;
}

export interface DiscoverMeta {
  oppositeGender:   OppositeGender | null;
  blockedUids:      string[];
  hiddenProfileIds: string[];
}

// One-shot read of the signed-in user's own users/{uid} doc — resolves the
// gender filter plus their personal blocked/hidden lists. Mirrors Android's
// fetchUserDiscoverMeta. Call once per Discover session and reuse the result
// across loadInitial/loadMore (see useDiscover.ts) rather than re-fetching
// on every page.
export async function fetchDiscoverMeta(): Promise<DiscoverMeta> {
  const user = await ensureAuth();
  const snap = await getDoc(doc(db, USERS, user.uid));
  const data = snap.data();
  return {
    oppositeGender:   oppositeGenderOf(data?.gender),
    blockedUids:      (data?.blockedUids as string[] | undefined) ?? [],
    hiddenProfileIds: (data?.hiddenProfileIds as string[] | undefined) ?? [],
  };
}

// Firestore Security Rules require an authenticated request. Production web auth
// is Firebase Email + Password (see lib/auth.ts) — there is NO anonymous fallback.
// App pages are behind a login guard, so callers here always run signed-in; this
// resolves the current user (waiting once for the initial auth state) or rejects
// with 'not_authenticated' if somehow called while signed out.
export function ensureAuth(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (u) resolve(u);
      else reject(new Error('not_authenticated'));
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

export async function fetchDiscoverPage(cursor: Cursor, meta: DiscoverMeta): Promise<DiscoverPage> {
  // Fail closed: unresolvable gender ('other', missing, invalid) never falls
  // back to an unrestricted feed — no query is issued at all, empty page.
  if (!meta.oppositeGender) {
    return { profiles: [], cursor: null, hasMore: false };
  }

  const user = await ensureAuth();

  const constraints: QueryConstraint[] = [
    where('isVisible', '==', true),
    where('gender', '==', meta.oppositeGender),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE),
  ];
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, PROFILES), ...constraints));

  const blocked = new Set(meta.blockedUids);
  const hidden  = new Set(meta.hiddenProfileIds);

  // Parity with Android excludeFilter: never show the viewer their own card,
  // and exclude their personally blocked/hidden uids.
  //
  // moderationStatus === 'hidden' is ALSO excluded here client-side — verified
  // live (2026) that Firestore Security Rules do NOT filter this out of list()
  // query results the way they do for get(): a rule referencing resource.data
  // (profiles/{uid}'s `moderationStatus != 'hidden'` check) is enforced for
  // single-document get(), but a list() query matching isVisible==true +
  // gender==X can still return a document that separately has
  // moderationStatus=='hidden' if isVisible was left true — the rule does not
  // retroactively prune it from query results. In practice moderationStatus
  // is only ever set by setProfileModerationStatus() (src/lib/admin.ts), which
  // always pairs 'hidden' with isVisible:false in the same write, so this
  // exact combination cannot occur through normal app usage today — but nothing
  // enforces that invariant at the rules level, so this filter is the actual
  // safety net, not defense-in-depth. Do NOT remove it on the assumption rules
  // already handle this.
  const profiles = snap.docs
    .filter((d) => {
      const data = d.data();
      return d.id !== user.uid
        && !blocked.has(d.id)
        && !hidden.has(d.id)
        && data.moderationStatus !== 'hidden';
    })
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
