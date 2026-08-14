import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countMemberVisibleIntroductions,
  countVisibleSentActivity,
  filterMemberVisibleIntroductions,
  isMemberVisibleIntroduction,
  isRespondableReceivedIntroduction,
  type MemberVisibleRow,
} from '@/lib/memberIntroductionVisibility';
import type { IntroItem } from '@/hooks/useIntroductions';
import type { Introduction } from '@/lib/introductions';

function makeIntro(overrides: Partial<Introduction> = {}): Introduction {
  return {
    id: 'intro-1',
    senderId: 'sender-1',
    recipientId: 'recipient-1',
    status: 'pending',
    sentAt: 1,
    seenByRecipient: false,
    ...overrides,
  };
}

function makeItem(overrides: Partial<IntroItem> = {}): IntroItem {
  return {
    intro: makeIntro(),
    profile: null,
    profileStatus: 'loading',
    ...overrides,
  };
}

test('unavailable profile introduction is excluded while valid and loading intros remain visible', () => {
  const valid = makeItem({ profileStatus: 'loaded', profile: { id: 'p1', name: 'Asha', age: 28, city: 'Kochi', profession: 'Designer', bio: '', photos: [], photo: '', education: '', religion: '', lookingFor: '', family: '', traits: [], lifestyle: [], verifiedFields: [], activityStatus: 'active-this-week', isPremium: false, createdAt: 1 } });
  const loading = makeItem({ intro: makeIntro({ id: 'intro-2' }), profileStatus: 'loading' });
  const unavailable = makeItem({ intro: makeIntro({ id: 'intro-3' }), profileStatus: 'unavailable' });

  assert.equal(isMemberVisibleIntroduction(valid), true);
  assert.equal(isMemberVisibleIntroduction(loading), true);
  assert.equal(isMemberVisibleIntroduction(unavailable), false);
  assert.deepEqual(
    filterMemberVisibleIntroductions([valid, loading, unavailable]).map((item) => item.intro.id),
    ['intro-1', 'intro-2'],
  );
});

test('all, received, sent, accepted, and activity counts exclude unavailable introductions only', () => {
  const rows: MemberVisibleRow[] = [
    { side: 'received', item: makeItem({ intro: makeIntro({ id: 'recv-live', status: 'pending' }), profileStatus: 'loaded' }) },
    { side: 'received', item: makeItem({ intro: makeIntro({ id: 'recv-missing', status: 'pending' }), profileStatus: 'unavailable' }) },
    { side: 'sent', item: makeItem({ intro: makeIntro({ id: 'sent-live', status: 'pending' }), profileStatus: 'loading' }) },
    { side: 'sent', item: makeItem({ intro: makeIntro({ id: 'sent-accepted-live', status: 'accepted' }), profileStatus: 'loaded' }) },
    { side: 'received', item: makeItem({ intro: makeIntro({ id: 'recv-accepted-missing', status: 'accepted' }), profileStatus: 'unavailable' }) },
  ];

  const visibleRows = rows.filter((row) => isMemberVisibleIntroduction(row.item));
  assert.deepEqual(countMemberVisibleIntroductions(visibleRows), {
    all: 3,
    received: 1,
    sent: 1,
    accepted: 1,
  });

  const visibleSent = visibleRows.filter((row) => row.side === 'sent').map((row) => row.item);
  assert.deepEqual(countVisibleSentActivity(visibleSent), {
    sentTotal: 2,
    sentAccepted: 1,
  });
});

test('received introduction controls appear only for the current pending recipient', () => {
  assert.equal(isRespondableReceivedIntroduction(null, 'me'), false);
  assert.equal(isRespondableReceivedIntroduction({
    status: 'pending',
    senderId: 'other',
    recipientId: 'me',
  }, 'me'), true);
  assert.equal(isRespondableReceivedIntroduction({
    status: 'pending',
    senderId: 'me',
    recipientId: 'other',
  }, 'me'), false);
  assert.equal(isRespondableReceivedIntroduction({
    status: 'accepted',
    senderId: 'other',
    recipientId: 'me',
  }, 'me'), false);
});
