// Chat data layer — a verbatim mirror of the Android conversationService
// (which already uses the JS modular SDK). Same collections, same document
// shapes, same writes. No new chat model.
import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  writeBatch,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Conversation, Message } from './types';

const CONVERSATIONS = 'conversations';
const MESSAGES = 'messages';

export function subscribeConversations(
  uid: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, CONVERSATIONS),
      where('participants', 'array-contains', uid),
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc'),
    ),
    (snap) => onUpdate(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Conversation))),
    (err) => onError?.(err),
  );
}

export function subscribeMessages(
  convId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, CONVERSATIONS, convId, MESSAGES), orderBy('createdAt', 'asc')),
    (snap) => onUpdate(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Message))),
    (err) => onError?.(err),
  );
}

export async function fetchConversation(convId: string): Promise<Conversation | null> {
  const snap = await getDoc(doc(db, CONVERSATIONS, convId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as object), id: snap.id } as Conversation;
}

// Exact mirror of Android sendMessage: batch { set message, update conversation }.
export async function sendMessage(
  convId: string,
  senderId: string,
  text: string,
  participants: string[],
): Promise<string> {
  const now = Date.now();
  const otherUid = participants.find((p) => p !== senderId)!;

  const batch = writeBatch(db);

  const msgRef = doc(collection(db, CONVERSATIONS, convId, MESSAGES));
  batch.set(msgRef, {
    id: msgRef.id,
    senderId,
    text,
    createdAt: now,
    readBy: [senderId],
    deleted: false,
  });

  batch.update(doc(db, CONVERSATIONS, convId), {
    lastMessage: { text, senderId, sentAt: now },
    updatedAt: now,
    [`unreadCounts.${otherUid}`]: increment(1),
  });

  await batch.commit();
  return msgRef.id;
}

export async function markConversationRead(convId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, CONVERSATIONS, convId), { [`unreadCounts.${uid}`]: 0 });
}
