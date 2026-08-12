import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasServerAdminPermission,
  parseBearerToken,
  resolveAdminAccountRequest,
  toAdminAccountMetadata,
  type AuditLogEntry,
  type ResolveAdminAccountDeps,
  type ServerAdminRecord,
} from '@/lib/server/adminAccountService';

function makeDeps(overrides: Partial<ResolveAdminAccountDeps> = {}): ResolveAdminAccountDeps {
  return {
    verifyIdToken: async () => ({ uid: 'admin-1', email: 'admin@example.com' }),
    getAdminRecord: async () => ({
      uid: 'admin-1',
      email: 'admin@example.com',
      active: true,
      permissions: { viewAccountPII: true },
    }),
    getUserRecord: async (uid) => ({
      uid,
      email: 'member@example.com',
      emailVerified: true,
      phoneNumber: '+911234567890',
      providerData: [{ providerId: 'password' }, { providerId: 'phone' }],
      metadata: {
        creationTime: '2026-08-01T10:00:00.000Z',
        lastSignInTime: '2026-08-11T15:45:00.000Z',
      },
      disabled: false,
    }),
    writeAuditLog: async () => undefined,
    ...overrides,
  };
}

test('parseBearerToken accepts Bearer tokens only', () => {
  assert.equal(parseBearerToken(null), null);
  assert.equal(parseBearerToken('Token abc'), null);
  assert.equal(parseBearerToken('Bearer abc123'), 'abc123');
});

test('hasServerAdminPermission preserves super admin access', () => {
  const superAdmin: ServerAdminRecord = {
    uid: 'admin-1',
    active: true,
    role: 'super_admin',
    permissions: {},
  };
  assert.equal(hasServerAdminPermission(superAdmin, 'viewAccountPII'), true);
  assert.equal(hasServerAdminPermission(null, 'viewAccountPII'), false);
});

test('toAdminAccountMetadata returns allowlisted values only', () => {
  const result = toAdminAccountMetadata({
    uid: 'user-1',
    emailVerified: false,
    disabled: true,
    providerData: [{ providerId: 'password' }, { providerId: '' }],
    metadata: {},
  });
  assert.deepEqual(result, {
    uid: 'user-1',
    email: null,
    emailVerified: false,
    phoneNumber: null,
    providers: ['password'],
    creationTime: null,
    lastSignInTime: null,
    disabled: true,
  });
});

test('resolveAdminAccountRequest denies unauthenticated callers', async () => {
  let getUserRecordCalls = 0;
  let auditWrites = 0;
  const result = await resolveAdminAccountRequest(
    null,
    'user-1',
    makeDeps({
      getUserRecord: async (uid) => {
        getUserRecordCalls += 1;
        return {
          uid,
          emailVerified: true,
          disabled: false,
        };
      },
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'Authentication required.' });
  assert.equal(getUserRecordCalls, 0);
  assert.equal(auditWrites, 0);
});

test('resolveAdminAccountRequest denies malformed bearer token via verify failure path', async () => {
  let getUserRecordCalls = 0;
  let auditWrites = 0;
  const result = await resolveAdminAccountRequest(
    'Bearer malformed-token',
    'user-1',
    makeDeps({
      verifyIdToken: async () => {
        const error = new Error('Invalid token');
        (error as Error & { code?: string }).code = 'auth/invalid-id-token';
        throw error;
      },
      getUserRecord: async (uid) => {
        getUserRecordCalls += 1;
        return {
          uid,
          emailVerified: true,
          disabled: false,
        };
      },
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'Authentication required.' });
  assert.equal(getUserRecordCalls, 0);
  assert.equal(auditWrites, 0);
});

test('resolveAdminAccountRequest denies authenticated non-admin callers', async () => {
  let getUserRecordCalls = 0;
  let auditWrites = 0;
  const result = await resolveAdminAccountRequest(
    'Bearer token',
    'user-1',
    makeDeps({
      getAdminRecord: async () => null,
      getUserRecord: async (uid) => {
        getUserRecordCalls += 1;
        return {
          uid,
          emailVerified: true,
          disabled: false,
        };
      },
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: 'Admin access required.' });
  assert.equal(getUserRecordCalls, 0);
  assert.equal(auditWrites, 0);
});

test('resolveAdminAccountRequest denies admins without viewAccountPII', async () => {
  let getUserRecordCalls = 0;
  let auditWrites = 0;
  const result = await resolveAdminAccountRequest(
    'Bearer token',
    'user-1',
    makeDeps({
      getAdminRecord: async () => ({
        uid: 'admin-1',
        active: true,
        permissions: { viewUsers: true },
      }),
      getUserRecord: async (uid) => {
        getUserRecordCalls += 1;
        return {
          uid,
          emailVerified: true,
          disabled: false,
        };
      },
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: 'Missing viewAccountPII permission.' });
  assert.equal(getUserRecordCalls, 0);
  assert.equal(auditWrites, 0);
});

test('resolveAdminAccountRequest allows admins with viewAccountPII and writes audit log', async () => {
  const auditEntries: AuditLogEntry[] = [];
  const result = await resolveAdminAccountRequest(
    'Bearer token',
    'user-1',
    makeDeps({
      writeAuditLog: async (entry) => {
        auditEntries.push(entry);
      },
    }),
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    data: {
      uid: 'user-1',
      email: 'member@example.com',
      emailVerified: true,
      phoneNumber: '+911234567890',
      providers: ['password', 'phone'],
      creationTime: '2026-08-01T10:00:00.000Z',
      lastSignInTime: '2026-08-11T15:45:00.000Z',
      disabled: false,
    },
  });
  assert.equal(auditEntries.length, 1);
  assert.deepEqual(auditEntries[0], {
    adminUid: 'admin-1',
    targetUid: 'user-1',
    action: 'VIEW_ACCOUNT_PII',
  });
});

test('resolveAdminAccountRequest returns safe 404 for missing target user', async () => {
  const result = await resolveAdminAccountRequest(
    'Bearer token',
    'missing-user',
    makeDeps({ getUserRecord: async () => null }),
  );
  assert.equal(result.status, 404);
});
