import type { IntroStatus } from '@/lib/introductions';

type IntroductionRelationshipRecord = {
  senderId: string;
  recipientId: string;
  status: IntroStatus;
  sentAt?: number;
};

function relationshipPriority(
  intro: Pick<IntroductionRelationshipRecord, 'status' | 'senderId' | 'recipientId'>,
  uid: string,
  otherUid: string,
): number {
  if (intro.status === 'pending' && intro.senderId === otherUid && intro.recipientId === uid) return 0;
  if (intro.status === 'accepted') return 1;
  if (intro.status === 'pending' && intro.senderId === uid && intro.recipientId === otherUid) return 2;
  if (intro.status === 'pending') return 3;
  return 4;
}

export function selectRelationshipIntroduction<
  T extends Pick<IntroductionRelationshipRecord, 'status' | 'senderId' | 'recipientId' | 'sentAt'>,
>(
  intros: T[],
  uid: string,
  otherUid: string,
): T | null {
  if (intros.length === 0) return null;
  return [...intros].sort((a, b) => {
    const priorityDiff = relationshipPriority(a, uid, otherUid) - relationshipPriority(b, uid, otherUid);
    if (priorityDiff !== 0) return priorityDiff;
    return (b.sentAt ?? 0) - (a.sentAt ?? 0);
  })[0] ?? null;
}
