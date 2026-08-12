import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeSignInBootstrap,
  completeSignupBootstrap,
  repairMissingBootstrapUserDoc,
} from '@/lib/authBootstrap';

test('signup bootstrap success returns the uid normally', async () => {
  const calls: string[] = [];

  const result = await completeSignupBootstrap(
    {
      createAuthUser: async () => {
        calls.push('createAuthUser');
        return { user: { uid: 'user-1' } };
      },
      createUserDoc: async (uid, phone, extra) => {
        calls.push(`createUserDoc:${uid}:${phone}:${extra?.policyAcceptedVersion ?? 'none'}`);
      },
      signOut: async () => {
        calls.push('signOut');
      },
      getUid: (user) => user.uid,
    },
    '+911234567890',
    { policyAcceptedVersion: 1 },
  );

  assert.equal(result.uid, 'user-1');
  assert.deepEqual(calls, [
    'createAuthUser',
    'createUserDoc:user-1:+911234567890:1',
  ]);
});

test('signup bootstrap failure signs out, preserves original error, and never needs rollback helpers', async () => {
  const calls: string[] = [];
  const bootstrapError = new Error('bootstrap failed');

  await assert.rejects(
    completeSignupBootstrap(
      {
        createAuthUser: async () => {
          calls.push('createAuthUser');
          return { user: { uid: 'user-2' } };
        },
        createUserDoc: async () => {
          calls.push('createUserDoc');
          throw bootstrapError;
        },
        signOut: async () => {
          calls.push('signOut');
        },
        getUid: (user) => user.uid,
      },
      '+911234567890',
      { policyAcceptedVersion: 1 },
    ),
    bootstrapError,
  );

  assert.deepEqual(calls, ['createAuthUser', 'createUserDoc', 'signOut']);
});

test('sign-in always runs createUserDoc with an empty phone for idempotent repair', async () => {
  const createCalls: Array<{ uid: string; phone: string }> = [];

  const result = await completeSignInBootstrap({
    signIn: async () => ({ user: { uid: 'user-3' } }),
    createUserDoc: async (uid, phone) => {
      createCalls.push({ uid, phone });
    },
    getUid: (user) => user.uid,
  });

  assert.equal(result.uid, 'user-3');
  assert.deepEqual(createCalls, [{ uid: 'user-3', phone: '' }]);
});

test('passive recovery attempts one guarded bootstrap repair when the user doc is missing', async () => {
  const createCalls: Array<{ uid: string; phone: string }> = [];

  const attempted = await repairMissingBootstrapUserDoc(
    {
      createUserDoc: async (uid, phone) => {
        createCalls.push({ uid, phone });
      },
    },
    {
      uid: 'user-4',
      hasUserDoc: false,
      authMutationPending: false,
      repairAttempted: false,
    },
  );

  assert.equal(attempted, true);
  assert.deepEqual(createCalls, [{ uid: 'user-4', phone: '' }]);
});

test('existing users doc or an in-flight auth mutation prevents overwrite/duplicate recovery attempts', async () => {
  const createCalls: string[] = [];

  const blockedByExistingDoc = await repairMissingBootstrapUserDoc(
    {
      createUserDoc: async () => {
        createCalls.push('existing-doc');
      },
    },
    {
      uid: 'user-5',
      hasUserDoc: true,
      authMutationPending: false,
      repairAttempted: false,
    },
  );

  const blockedByPendingMutation = await repairMissingBootstrapUserDoc(
    {
      createUserDoc: async () => {
        createCalls.push('pending-mutation');
      },
    },
    {
      uid: 'user-5',
      hasUserDoc: false,
      authMutationPending: true,
      repairAttempted: false,
    },
  );

  const blockedByPreviousAttempt = await repairMissingBootstrapUserDoc(
    {
      createUserDoc: async () => {
        createCalls.push('previous-attempt');
      },
    },
    {
      uid: 'user-5',
      hasUserDoc: false,
      authMutationPending: false,
      repairAttempted: true,
    },
  );

  assert.equal(blockedByExistingDoc, false);
  assert.equal(blockedByPendingMutation, false);
  assert.equal(blockedByPreviousAttempt, false);
  assert.deepEqual(createCalls, []);
});
