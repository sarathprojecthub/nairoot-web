// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY dev-admin operations.
//
// Privileged Firestore writes for the internal admin console. Reuses the EXISTING
// schema (profiles, users, introductions, conversations, messages, matches) —
// no new collections, no model changes. All writes go through the rules-bypassing
// REST client so the console can act across users (create intros between anyone,
// send messages as anyone, edit/delete any profile).
// ─────────────────────────────────────────────────────────────────────────────

// Server-only by transitivity: ./firestoreRest imports node:fs/os.
import {
  restGet, restList, restCreate, restSet, restUpdate, restDelete, type FsDoc,
} from './firestoreRest';

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Auth gate ────────────────────────────────────────────────────────────────
export class DevUnauthorizedError extends Error {}

export function assertDevSecret(provided: string | null): void {
  const expected = process.env.DEV_ADMIN_SECRET;
  if (!expected) {
    throw new DevUnauthorizedError('DEV_ADMIN_SECRET is not configured on the server.');
  }
  if (!provided || provided !== expected) {
    throw new DevUnauthorizedError('Invalid developer secret.');
  }
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
function matchesSearch(d: FsDoc, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const data = d.data;
  return [d.id, data.name, data.city, data.profession, data.uid]
    .some((v) => typeof v === 'string' && v.toLowerCase().includes(needle));
}

export async function listProfiles(search = ''): Promise<FsDoc[]> {
  const all = await restList('profiles');
  const filtered = all.filter((d) => matchesSearch(d, search));
  filtered.sort((a, b) => (Number(b.data.createdAt) || 0) - (Number(a.data.createdAt) || 0));
  return filtered;
}

export async function getProfile(uid: string): Promise<FsDoc | null> {
  return restGet(`profiles/${uid}`);
}

// Create a discoverable profile. Fills the discover-critical defaults so it
// behaves exactly like an onboarding-created profile.
export async function createProfile(input: Record<string, unknown>): Promise<string> {
  const now = Date.now();
  const uid = (input.uid as string)?.trim() || `dev-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const data: Record<string, unknown> = {
    uid,
    name: input.name ?? 'Test Profile',
    age: typeof input.age === 'number' ? input.age : Number(input.age) || 28,
    dob: input.dob ?? '',
    gender: input.gender ?? 'other',
    city: input.city ?? '',
    state: input.state ?? '',
    profession: input.profession ?? '',
    education: input.education ?? '',
    religion: input.religion ?? 'Hindu',
    height: input.height ?? '',
    bio: input.bio ?? '',
    family: input.family ?? '',
    lifestyle: [],
    lookingFor: input.lookingFor ?? 'Open to meeting anyone',
    photos: Array.isArray(input.photos) ? input.photos : [],
    traits: [],
    verifiedFields: [],
    activityStatus: 'active-this-week',
    isPremium: false,
    isConcierge: false,
    isVisible: input.isVisible === undefined ? true : Boolean(input.isVisible),
    profileQuality: typeof input.profileQuality === 'number' ? input.profileQuality : 50,
    createdAt: now,
    updatedAt: now,
  };
  await restSet(`profiles/${uid}`, data);
  return uid;
}

export async function updateProfile(uid: string, patch: Record<string, unknown>): Promise<void> {
  await restUpdate(`profiles/${uid}`, { ...patch, updatedAt: Date.now() });
}

export async function deleteProfile(uid: string): Promise<void> {
  await restDelete(`profiles/${uid}`);
}

export async function setVisibility(uid: string, isVisible: boolean): Promise<void> {
  await restUpdate(`profiles/${uid}`, { isVisible, updatedAt: Date.now() });
}

// Photos — stored as Cloudinary secure_url strings in profiles.photos[]
// (same as onboarding). Upload happens in the browser; here we just persist
// the resulting URL list.
export async function setPhotos(uid: string, photos: string[]): Promise<void> {
  await restUpdate(`profiles/${uid}`, { photos, updatedAt: Date.now() });
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function listUsers(search = ''): Promise<FsDoc[]> {
  const all = await restList('users');
  return all.filter((d) => {
    if (!search) return true;
    const n = search.toLowerCase();
    return [d.id, d.data.phone, d.data.name].some((v) => typeof v === 'string' && v.toLowerCase().includes(n));
  });
}

// Reset a user's Discover state: clear who they've hidden/blocked and ensure
// their own profile is visible again — gives a fresh feed for re-testing.
export async function resetDiscoverState(uid: string): Promise<void> {
  await restUpdate(`users/${uid}`, { hiddenProfileIds: [], blockedUids: [], lastActive: Date.now() });
  const profile = await restGet(`profiles/${uid}`);
  if (profile) await restUpdate(`profiles/${uid}`, { isVisible: true, updatedAt: Date.now() });
}

// ─── Introductions ────────────────────────────────────────────────────────────
export async function createIntroduction(
  senderId: string,
  recipientId: string,
  status: string = 'pending',
): Promise<string> {
  const now = Date.now();
  return restCreate('introductions', {
    senderId,
    recipientId,
    status,
    sentAt: now,
    expiresAt: now + EXPIRY_MS,
    seenByRecipient: status !== 'pending',
    ...(status === 'accepted' ? { respondedAt: now } : {}),
  });
}

// ─── Matches (full accepted chain: intro + conversation + match) ──────────────
export interface MatchResult {
  introductionId: string;
  conversationId: string;
  matchId: string;
}

export async function createMatch(userA: string, userB: string): Promise<MatchResult> {
  const now = Date.now();
  const introductionId = await restCreate('introductions', {
    senderId: userA,
    recipientId: userB,
    status: 'accepted',
    sentAt: now,
    expiresAt: now + EXPIRY_MS,
    seenByRecipient: true,
    respondedAt: now,
  });
  const conversationId = await restCreate('conversations', {
    participants: [userA, userB],
    introductionId,
    status: 'active',
    unreadCounts: { [userA]: 0, [userB]: 0 },
    createdAt: now,
    updatedAt: now,
  });
  await restUpdate(`introductions/${introductionId}`, { conversationId });
  const matchId = await restCreate('matches', {
    userA,
    userB,
    introductionId,
    conversationId,
    createdAt: now,
  });
  return { introductionId, conversationId, matchId };
}

// ─── Conversations + messages ─────────────────────────────────────────────────
export async function listConversations(uid?: string): Promise<FsDoc[]> {
  const all = await restList('conversations');
  const filtered = uid
    ? all.filter((d) => Array.isArray(d.data.participants) && (d.data.participants as string[]).includes(uid))
    : all;
  filtered.sort((a, b) => (Number(b.data.updatedAt) || 0) - (Number(a.data.updatedAt) || 0));
  return filtered;
}

export async function createConversation(participants: string[], introductionId = 'admin'): Promise<string> {
  const now = Date.now();
  return restCreate('conversations', {
    participants,
    introductionId,
    status: 'active',
    unreadCounts: Object.fromEntries(participants.map((p) => [p, 0])),
    createdAt: now,
    updatedAt: now,
  });
}

export async function listMessages(conversationId: string): Promise<FsDoc[]> {
  const all = await restList(`conversations/${conversationId}/messages`);
  all.sort((a, b) => (Number(a.data.createdAt) || 0) - (Number(b.data.createdAt) || 0));
  return all;
}

// Send a message AS an arbitrary user (rules-bypassing). Updates the
// conversation's lastMessage/updatedAt and bumps the other side's unread count.
export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<string> {
  const now = Date.now();
  const messageId = await restCreate(`conversations/${conversationId}/messages`, {
    senderId,
    text,
    createdAt: now,
    readBy: [senderId],
    deleted: false,
  });

  const conv = await restGet(`conversations/${conversationId}`);
  const patch: Record<string, unknown> = {
    lastMessage: { text, senderId, sentAt: now },
    updatedAt: now,
  };
  if (conv) {
    const participants = (conv.data.participants as string[]) ?? [];
    const counts = { ...((conv.data.unreadCounts as Record<string, number>) ?? {}) };
    for (const p of participants) {
      if (p !== senderId) counts[p] = (counts[p] ?? 0) + 1;
    }
    patch.unreadCounts = counts;
  }
  await restUpdate(`conversations/${conversationId}`, patch);
  return messageId;
}

// ─── Delete test data (cascade for one user) ──────────────────────────────────
export interface CascadeResult {
  profile: boolean;
  user: boolean;
  draft: boolean;
  introductions: number;
  matches: number;
  conversations: number;
}

export async function deleteUserCascade(uid: string): Promise<CascadeResult> {
  const result: CascadeResult = {
    profile: false, user: false, draft: false,
    introductions: 0, matches: 0, conversations: 0,
  };

  if (await restGet(`profiles/${uid}`)) { await restDelete(`profiles/${uid}`); result.profile = true; }
  if (await restGet(`users/${uid}`)) { await restDelete(`users/${uid}`); result.user = true; }
  if (await restGet(`onboardingDrafts/${uid}`)) { await restDelete(`onboardingDrafts/${uid}`); result.draft = true; }

  const intros = await restList('introductions');
  for (const d of intros) {
    if (d.data.senderId === uid || d.data.recipientId === uid) {
      await restDelete(`introductions/${d.id}`);
      result.introductions++;
    }
  }

  const matches = await restList('matches');
  for (const d of matches) {
    if (d.data.userA === uid || d.data.userB === uid) {
      await restDelete(`matches/${d.id}`);
      result.matches++;
    }
  }

  const convs = await restList('conversations');
  for (const d of convs) {
    const participants = (d.data.participants as string[]) ?? [];
    if (participants.includes(uid)) {
      const msgs = await restList(`conversations/${d.id}/messages`);
      for (const m of msgs) await restDelete(`conversations/${d.id}/messages/${m.id}`);
      await restDelete(`conversations/${d.id}`);
      result.conversations++;
    }
  }

  return result;
}
