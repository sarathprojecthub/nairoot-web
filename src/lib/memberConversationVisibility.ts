export type MemberConversationProfileStatus = 'loading' | 'loaded' | 'unavailable';

export interface MemberVisibleConversation<TConversation = { id: string }> {
  conversation: TConversation | null;
  profileStatus: MemberConversationProfileStatus;
}

export function isMemberVisibleConversation<T extends Pick<MemberVisibleConversation, 'conversation'>>(
  item: T,
): boolean {
  return item.conversation !== null;
}

export function filterMemberVisibleConversations<T extends Pick<MemberVisibleConversation, 'conversation'>>(
  items: T[],
): T[] {
  return items.filter(isMemberVisibleConversation);
}

export function getMemberConversationFallback(profileStatus: MemberConversationProfileStatus): {
  name: string;
  meta: string;
} {
  if (profileStatus === 'unavailable') {
    return {
      name: 'Deleted account',
      meta: 'Member profile no longer available',
    };
  }

  return {
    name: 'Conversation',
    meta: 'Private conversation',
  };
}
