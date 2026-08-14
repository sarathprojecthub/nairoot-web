import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterMemberVisibleConversations,
  getMemberConversationFallback,
  isMemberVisibleConversation,
} from '@/lib/memberConversationVisibility';

test('member chat rows stay visible for deleted profiles but not missing conversations', () => {
  const visible = { conversation: { id: 'c1' }, profileStatus: 'loaded' };
  const deletedProfile = { conversation: { id: 'c2' }, profileStatus: 'unavailable' };
  const missingConversation = { conversation: null, profileStatus: 'loaded' };

  assert.equal(isMemberVisibleConversation(visible), true);
  assert.equal(isMemberVisibleConversation(deletedProfile), true);
  assert.equal(isMemberVisibleConversation(missingConversation), false);
  assert.deepEqual(
    filterMemberVisibleConversations([visible, deletedProfile, missingConversation]),
    [visible, deletedProfile],
  );
});

test('deleted-account fallback is distinct from loading state', () => {
  assert.deepEqual(getMemberConversationFallback('unavailable'), {
    name: 'Deleted account',
    meta: 'Member profile no longer available',
  });
  assert.deepEqual(getMemberConversationFallback('loading'), {
    name: 'Conversation',
    meta: 'Private conversation',
  });
});
