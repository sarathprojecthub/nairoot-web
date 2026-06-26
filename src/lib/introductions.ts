// Introductions data layer — writes/reads the SHARED `introductions`,
// `conversations`, and `matches` collections, mirroring the Android
// introductionService exactly so Website ↔ Android interoperate.
import { db } from './firebase';
import { ensureAuth } from './profiles';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  runTransaction,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

const INTRODUCTIONS = 'introductions';
const CONVERSATIONS = 'conversations';
const MATCHES = 'matches';
const EXPIRY_DAYS = 7;

export type IntroStatus = 'pending' | 'accepted' | 'declined' | 'archived' | 'expired' | 'blocked';

export interface Introduction {
  id: string;
  senderId: string;
  recipientId: string;
  status: IntroStatus;
  sentAt: number;
  conversationId?: string;
  seenByRecipient: boolean;
}

function mapIntro(id: string, d: DocumentData): Introduction {
  return {
    id,
    senderId: d.senderId,
    recipientId: d.recipientId,
    status: d.status,
    sentAt: d.sentAt ?? 0,
    conversationId: d.conversationId,
    seenByRecipient: d.seenByRecipient ?? false,
  };
}

const statusPriority = (s: string) => (s === 'accepted' ? 0 : s === 'pending' ? 1 : 2);

// ─── Duplicate-prevention + send (M2) ────────────────────────────────────────

export async function fetchIntroductionBetween(
  uid: string,
  otherUid: string,
): Promise<Introduction | null> {
  const [sentSnap, recvSnap] = await Promise.all([
    getDocs(query(collection(db, INTRODUCTIONS), where('senderId', '==', uid), where('recipientId', '==', otherUid), limit(1))),
    getDocs(query(collection(db, INTRODUCTIONS), where('senderId', '==', otherUid), where('recipientId', '==', uid), limit(1))),
  ]);
  const docs = [...sentSnap.docs, ...recvSnap.docs].map((d) => mapIntro(d.id, d.data()));
  if (docs.length === 0) return null;
  docs.sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || b.sentAt - a.sentAt);
  return docs[0];
}

// `note` intentionally OMITTED (Android fix + isValidIntroduction rule).
export async function sendInterest(recipientId: string): Promise<string> {
  const user = await ensureAuth();
  const fromUid = user.uid;
  if (fromUid === recipientId) throw new Error('cannot_intro_self');

  const existing = await fetchIntroductionBetween(fromUid, recipientId);
  if (existing) {
    if (existing.status === 'accepted') throw new Error('already_matched');
    if (existing.status === 'pending' && existing.senderId === fromUid) throw new Error('interest_already_sent');
  }

  const now = Date.now();
  const ref = await addDoc(collection(db, INTRODUCTIONS), {
    senderId: fromUid,
    recipientId,
    status: 'pending',
    sentAt: now,
    expiresAt: now + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    seenByRecipient: false,
  });
  return ref.id;
}

export function subscribeSentInterests(uid: string, onUpdate: (recipientIds: string[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, INTRODUCTIONS), where('senderId', '==', uid), where('status', '==', 'pending'), orderBy('sentAt', 'desc')),
    (snap) => onUpdate(snap.docs.map((d) => d.data().recipientId as string)),
    () => {},
  );
}

// ─── Realtime listeners (M3) — mirror Android introductionStore ──────────────

export function subscribeReceived(uid: string, status: IntroStatus, cb: (intros: Introduction[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, INTRODUCTIONS), where('recipientId', '==', uid), where('status', '==', status), orderBy('sentAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => mapIntro(d.id, d.data()))),
    () => cb([]),
  );
}

export function subscribeSent(uid: string, status: IntroStatus, cb: (intros: Introduction[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, INTRODUCTIONS), where('senderId', '==', uid), where('status', '==', status), orderBy('sentAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => mapIntro(d.id, d.data()))),
    () => cb([]),
  );
}

// ─── Accept / Decline (M3) — exact mirror of Android acceptIntroduction ──────

// Atomically: create conversation + match, mark introduction accepted.
// Mirrors src/services/introductionService.ts acceptIntroduction byte-for-byte
// in shape so the documents are identical to what the Android app produces.
export async function acceptIntroduction(introId: string): Promise<string> {
  return runTransaction(db, async (tx) => {
    const introRef = doc(db, INTRODUCTIONS, introId);
    const convRef = doc(collection(db, CONVERSATIONS));
    const matchRef = doc(collection(db, MATCHES));

    const introSnap = await tx.get(introRef);
    if (!introSnap.exists()) throw new Error('introduction_not_found');
    const intro = introSnap.data() as DocumentData;

    if (intro.status !== 'pending') throw new Error('introduction_not_pending');
    if (intro.conversationId) throw new Error('conversation_already_exists');

    const now = Date.now();

    tx.set(convRef, {
      id: convRef.id,
      participants: [intro.senderId, intro.recipientId],
      introductionId: introId,
      status: 'active',
      unreadCounts: { [intro.senderId]: 0, [intro.recipientId]: 0 },
      createdAt: now,
      updatedAt: now,
    });
    tx.set(matchRef, {
      id: matchRef.id,
      userA: intro.senderId,
      userB: intro.recipientId,
      introductionId: introId,
      conversationId: convRef.id,
      createdAt: now,
    });
    tx.update(introRef, {
      status: 'accepted',
      conversationId: convRef.id,
      respondedAt: now,
    });

    return convRef.id;
  });
}

export async function declineIntroduction(introId: string): Promise<void> {
  await updateDoc(doc(db, INTRODUCTIONS, introId), {
    status: 'declined',
    respondedAt: Date.now(),
  });
}
