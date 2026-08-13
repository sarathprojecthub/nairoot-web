import type { IntroItem } from '@/hooks/useIntroductions';

export type MemberVisibleRowSide = 'received' | 'sent';

export interface MemberVisibleRow {
  item: IntroItem;
  side: MemberVisibleRowSide;
}

export interface MemberIntroductionCounts {
  all: number;
  received: number;
  sent: number;
  accepted: number;
}

export function isMemberVisibleIntroduction(item: Pick<IntroItem, 'profileStatus'>): boolean {
  return item.profileStatus !== 'unavailable';
}

export function filterMemberVisibleIntroductions<T extends Pick<IntroItem, 'profileStatus'>>(items: T[]): T[] {
  return items.filter(isMemberVisibleIntroduction);
}

export function countMemberVisibleIntroductions(rows: MemberVisibleRow[]): MemberIntroductionCounts {
  return {
    all: rows.length,
    received: rows.filter((row) => row.side === 'received' && row.item.intro.status === 'pending').length,
    sent: rows.filter((row) => row.side === 'sent' && row.item.intro.status === 'pending').length,
    accepted: rows.filter((row) => row.item.intro.status === 'accepted').length,
  };
}

export function countVisibleSentActivity(items: IntroItem[]) {
  return {
    sentTotal: items.length,
    sentAccepted: items.filter((item) => item.intro.status === 'accepted').length,
  };
}
