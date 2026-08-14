import test from 'node:test';
import assert from 'node:assert/strict';

import { selectRelationshipIntroduction } from '@/lib/introductionSelection';

type TestIntro = {
  id: string;
  senderId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'declined' | 'archived' | 'expired' | 'blocked';
  sentAt: number;
  seenByRecipient: boolean;
};

function intro(overrides: Partial<TestIntro> = {}): TestIntro {
  return {
    id: 'intro-1',
    senderId: 'me',
    recipientId: 'other',
    status: 'pending',
    sentAt: 1,
    seenByRecipient: false,
    ...overrides,
  };
}

test('old accepted intro + current pending received intro selects current pending received intro', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'accepted-old', senderId: 'other', recipientId: 'me', status: 'accepted', sentAt: 10 }),
    intro({ id: 'received-current', senderId: 'other', recipientId: 'me', status: 'pending', sentAt: 20 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'received-current');
});

test('old pending sent intro + current pending received intro selects current pending received intro', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'sent-old', senderId: 'me', recipientId: 'other', status: 'pending', sentAt: 10 }),
    intro({ id: 'received-current', senderId: 'other', recipientId: 'me', status: 'pending', sentAt: 20 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'received-current');
});

test('only pending sent intro is never treated as actionable received', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'sent-only', senderId: 'me', recipientId: 'other', status: 'pending', sentAt: 20 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'sent-only');
  assert.equal(selected?.senderId, 'me');
});

test('declined historical intro never beats a current pending received intro', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'declined-old', senderId: 'other', recipientId: 'me', status: 'declined', sentAt: 30 }),
    intro({ id: 'received-current', senderId: 'other', recipientId: 'me', status: 'pending', sentAt: 20 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'received-current');
});

test('accepted intro remains the fallback winner when there is no actionable received intro', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'accepted-old', senderId: 'other', recipientId: 'me', status: 'accepted', sentAt: 10 }),
    intro({ id: 'sent-current', senderId: 'me', recipientId: 'other', status: 'pending', sentAt: 20 }),
    intro({ id: 'declined-newer', senderId: 'other', recipientId: 'me', status: 'declined', sentAt: 30 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'accepted-old');
});

test('same-direction received history still selects the current pending received intro', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'accepted-old', senderId: 'other', recipientId: 'me', status: 'accepted', sentAt: 10 }),
    intro({ id: 'declined-old', senderId: 'other', recipientId: 'me', status: 'declined', sentAt: 20 }),
    intro({ id: 'received-current', senderId: 'other', recipientId: 'me', status: 'pending', sentAt: 30 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'received-current');
});

test('newest pending received intro wins deterministically within the same priority class', () => {
  const selected = selectRelationshipIntroduction([
    intro({ id: 'received-older', senderId: 'other', recipientId: 'me', status: 'pending', sentAt: 20 }),
    intro({ id: 'received-newer', senderId: 'other', recipientId: 'me', status: 'pending', sentAt: 30 }),
  ], 'me', 'other');

  assert.equal(selected?.id, 'received-newer');
});
