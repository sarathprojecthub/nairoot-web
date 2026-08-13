import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchAdminAccountMetadata,
} from '@/lib/adminAccountClient';
import {
  fetchAdminDirectory,
} from '@/lib/adminDirectoryClient';
import type { AuthenticatedAdminFetchResult } from '@/lib/adminApiAuth';

Object.defineProperty(globalThis, 'window', {
  value: {
    location: { origin: 'https://example.com' },
  },
  configurable: true,
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('directory client uses shared authenticated fetch behavior and returns unauthorized when auth resolves without a user', async () => {
  let callCount = 0;

  const result = await fetchAdminDirectory(
    { filter: 'all', pageSize: 25 },
    undefined,
    async () => {
      callCount += 1;
      return { kind: 'unauthenticated' };
    },
  );

  assert.deepEqual(result, { kind: 'unauthorized', message: 'Authentication required.' });
  assert.equal(callCount, 1);
});

test('directory client preserves forbidden state without auth retry logic of its own', async () => {
  const result = await fetchAdminDirectory(
    { filter: 'all', pageSize: 25 },
    undefined,
    async (): Promise<AuthenticatedAdminFetchResult> => ({
      kind: 'response',
      response: jsonResponse({ error: 'Missing viewUsers permission.' }, 403),
    }),
  );

  assert.deepEqual(result, { kind: 'forbidden', message: 'Missing viewUsers permission.' });
});

test('directory client preserves config-error and other existing typed states', async () => {
  const configResult = await fetchAdminDirectory(
    { filter: 'all' },
    undefined,
    async (): Promise<AuthenticatedAdminFetchResult> => ({
      kind: 'response',
      response: jsonResponse({ error: 'Server configuration for Firebase Admin is not available.' }, 503),
    }),
  );
  assert.deepEqual(configResult, {
    kind: 'config-error',
    message: 'Server configuration for Firebase Admin is not available.',
  });

  const genericErrorResult = await fetchAdminDirectory(
    { filter: 'all' },
    undefined,
    async (): Promise<AuthenticatedAdminFetchResult> => ({
      kind: 'response',
      response: jsonResponse({ error: 'Directory exploded.' }, 500),
    }),
  );
  assert.deepEqual(genericErrorResult, { kind: 'error', message: 'Directory exploded.' });
});

test('account client uses shared authenticated fetch behavior and preserves typed states', async () => {
  const unauthorized = await fetchAdminAccountMetadata(
    'member-1',
    undefined,
    async () => ({ kind: 'unauthenticated' }),
  );
  assert.deepEqual(unauthorized, { kind: 'unauthorized', message: 'Authentication required.' });

  const success = await fetchAdminAccountMetadata(
    'member-1',
    undefined,
    async (): Promise<AuthenticatedAdminFetchResult> => ({
      kind: 'response',
      response: jsonResponse({
        data: {
          uid: 'member-1',
          email: 'member@example.com',
          emailVerified: true,
          phoneNumber: null,
          providers: ['password'],
          creationTime: '2026-08-01T10:00:00.000Z',
          lastSignInTime: '2026-08-12T09:00:00.000Z',
          disabled: false,
        },
      }, 200),
    }),
  );

  assert.equal(success.kind, 'success');
  if (success.kind === 'success') {
    assert.equal(success.data.uid, 'member-1');
  }

  const forbidden = await fetchAdminAccountMetadata(
    'member-1',
    undefined,
    async (): Promise<AuthenticatedAdminFetchResult> => ({
      kind: 'response',
      response: jsonResponse({ error: 'Missing viewAccountPII permission.' }, 403),
    }),
  );
  assert.deepEqual(forbidden, { kind: 'forbidden', message: 'Missing viewAccountPII permission.' });
});
