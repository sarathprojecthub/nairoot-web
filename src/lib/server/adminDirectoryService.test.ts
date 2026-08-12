import assert from 'node:assert/strict';
import test from 'node:test';
import {
  type FirestoreDocLike,
  hasServerAdminPermission,
  parseBearerToken,
  resolveAdminDirectoryRequest,
  type DirectoryAuditEntry,
  type ResolveAdminDirectoryDeps,
} from '@/lib/server/adminDirectoryService';

function makeDeps(overrides: Partial<ResolveAdminDirectoryDeps> = {}): ResolveAdminDirectoryDeps {
  const authUsers = [
    {
      uid: 'uid-complete',
      email: 'complete@example.com',
      phoneNumber: '+911111111111',
      disabled: false,
      metadata: { creationTime: '2026-08-01T00:00:00.000Z' },
    },
    {
      uid: 'uid-noprofile',
      email: 'noprofile@example.com',
      phoneNumber: '+922222222222',
      disabled: false,
      metadata: { creationTime: '2026-08-02T00:00:00.000Z' },
    },
    {
      uid: 'uid-missinguserdoc',
      email: 'missinguser@example.com',
      phoneNumber: '+933333333333',
      disabled: true,
      metadata: { creationTime: '2026-08-03T00:00:00.000Z' },
    },
  ];

  const userDocs = new Map<string, FirestoreDocLike>([
    ['uid-complete', { id: 'uid-complete', data: { name: 'Complete Member', city: 'Kochi', state: 'Kerala', isOnboarded: true, phone: '+911111111111', isTestProfile: false } }],
    ['uid-noprofile', { id: 'uid-noprofile', data: { name: 'No Profile Member', city: 'Thrissur', isOnboarded: false, phone: '+922222222222' } }],
    ['uid-authmissing', { id: 'uid-authmissing', data: { name: 'Auth Missing Member', city: 'Kozhikode', isOnboarded: false } }],
  ]);

  const profileDocs = new Map<string, FirestoreDocLike>([
    ['uid-complete', { id: 'uid-complete', data: { name: 'Complete Member', age: 29, gender: 'female', city: 'Kochi', state: 'Kerala', isVisible: true, moderationStatus: 'visible' } }],
    ['uid-profileonly', { id: 'uid-profileonly', data: { name: 'Profile Only Member', age: 31, city: 'Thiruvananthapuram', moderationStatus: 'under_review' } }],
  ]);

  const adminRecord = {
    uid: 'admin-1',
    active: true,
    role: 'admin',
    permissions: {
      viewUsers: true,
      viewAccountPII: true,
    },
  };

  return {
    verifyIdToken: async (token) => {
      if (token === 'invalid') {
        const error = new Error('invalid');
        (error as Error & { code?: string }).code = 'auth/invalid-id-token';
        throw error;
      }
      return { uid: token };
    },
    getAdminRecord: async (uid) => {
      if (uid === 'non-admin') return null;
      if (uid === 'view-users-only') {
        return {
          ...adminRecord,
          uid,
          permissions: { viewUsers: true, viewAccountPII: false },
        };
      }
      if (uid === 'missing-view-users') {
        return {
          ...adminRecord,
          uid,
          permissions: { viewUsers: false, viewAccountPII: true },
        };
      }
      return { ...adminRecord, uid };
    },
    listAuthUsers: async (pageSize, pageToken) => {
      if (pageToken === 'page-2') {
        return { users: authUsers.slice(2), pageToken: undefined };
      }
      return {
        users: authUsers.slice(0, pageSize),
        pageToken: authUsers.length > pageSize ? 'page-2' : undefined,
      };
    },
    getAuthUserByUid: async (uid) => authUsers.find((user) => user.uid === uid) ?? null,
    getAuthUserByEmail: async (email) => authUsers.find((user) => user.email === email) ?? null,
    getAuthUserByPhone: async (phone) => authUsers.find((user) => user.phoneNumber === phone) ?? null,
    getDocsByUids: async (collectionName, uids) => {
      const source = collectionName === 'users' ? userDocs : profileDocs;
      return uids.map((uid) => source.get(uid)).filter(Boolean) as Array<{ id: string; data: Record<string, unknown> }>;
    },
    listRecentFirestoreDocs: async (collectionName) => {
      const source = collectionName === 'users' ? userDocs : profileDocs;
      return Array.from(source.values());
    },
    getFirestoreDocById: async (collectionName, uid) => {
      const source = collectionName === 'users' ? userDocs : profileDocs;
      return source.get(uid) ?? null;
    },
    writeAuditLog: async () => undefined,
    ...overrides,
  };
}

test('parseBearerToken accepts Bearer tokens only', () => {
  assert.equal(parseBearerToken('Bearer abc'), 'abc');
  assert.equal(parseBearerToken('bearer abc'), null);
  assert.equal(parseBearerToken(null), null);
});

test('hasServerAdminPermission preserves super admin access', () => {
  assert.equal(hasServerAdminPermission({ uid: '1', active: true, role: 'super_admin', permissions: {} }, 'viewUsers'), true);
  assert.equal(hasServerAdminPermission({ uid: '1', active: true, role: 'admin', permissions: { viewUsers: false } }, 'viewUsers'), false);
});

test('unauthenticated request is denied and never writes audit logs', async () => {
  let auditWrites = 0;
  const result = await resolveAdminDirectoryRequest(
    { authHeader: null },
    makeDeps({
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 401);
  assert.equal(auditWrites, 0);
});

test('invalid token is denied and never writes audit logs', async () => {
  let auditWrites = 0;
  const result = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer invalid' },
    makeDeps({
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 401);
  assert.equal(auditWrites, 0);
});

test('non-admin request is denied and never writes audit logs', async () => {
  let auditWrites = 0;
  const result = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer non-admin' },
    makeDeps({
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: 'Admin access required.' });
  assert.equal(auditWrites, 0);
});

test('admin without viewUsers is denied and never writes audit logs', async () => {
  let auditWrites = 0;
  const result = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer missing-view-users' },
    makeDeps({
      writeAuditLog: async () => {
        auditWrites += 1;
      },
    }),
  );
  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: 'Missing viewUsers permission.' });
  assert.equal(auditWrites, 0);
});

test('admin with viewUsers receives auth-backed directory entries', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', pageSize: 2 }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  assert.equal(result.body.data.records.length, 2);
  assert.equal(result.body.data.records[0]?.uid, 'uid-complete');
  assert.equal(result.body.data.nextPageToken, 'page-2');
});

test('without viewAccountPII email and phone are absent but records remain visible', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer view-users-only' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  const record = result.body.data.records[0];
  assert.equal(record?.email, null);
  assert.equal(record?.phone, null);
  assert.equal(result.body.data.piiAuthorized, false);
});

test('with viewAccountPII approved pii fields are present', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  const record = result.body.data.records[0];
  assert.equal(record?.email, 'complete@example.com');
  assert.equal(record?.phone, '+911111111111');
  assert.equal(record?.accountDisabled, false);
});

test('auth account with no user doc is surfaced in the main directory', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', uid: 'uid-missinguserdoc' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  const record = result.body.data.records[0];
  assert.equal(record?.userDocExists, false);
  assert.equal(record?.authExists, true);
  assert.ok(record?.badges.includes('User document missing'));
  assert.equal(result.body.data.anomalies.length, 0);
});

test('auth account with no profile is surfaced in the main directory', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', uid: 'uid-noprofile' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  const record = result.body.data.records[0];
  assert.equal(record?.profileExists, false);
  assert.ok(record?.badges.includes('No profile'));
});

test('complete user is surfaced', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', uid: 'uid-complete' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  const record = result.body.data.records[0];
  assert.equal(record?.displayName, 'Complete Member');
  assert.equal(record?.profileExists, true);
  assert.equal(record?.userDocExists, true);
});

test('exact uid lookup can surface firestore-only anomalies', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', uid: 'uid-profileonly' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  assert.equal(result.body.data.records.length, 0);
  assert.equal(result.body.data.anomalies[0]?.uid, 'uid-profileonly');
  assert.ok(result.body.data.anomalies[0]?.badges.includes('Auth account missing'));
});

test('exact email lookup requires pii permission and works when authorized', async () => {
  const audits: DirectoryAuditEntry[] = [];
  const allowed = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer admin-1', email: 'complete@example.com' },
    makeDeps({
      writeAuditLog: async (entry) => {
        audits.push(entry);
      },
    }),
  );
  assert.equal(allowed.status, 200);
  if (!('data' in allowed.body)) assert.fail('expected directory data');
  assert.equal(allowed.body.data.records[0]?.uid, 'uid-complete');
  assert.deepEqual(audits, [{ adminUid: 'admin-1', action: 'SEARCH_DIRECTORY_EMAIL' }]);

  const deniedAudits: DirectoryAuditEntry[] = [];
  const denied = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer view-users-only', email: 'complete@example.com' },
    makeDeps({
      writeAuditLog: async (entry) => {
        deniedAudits.push(entry);
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.deepEqual(deniedAudits, []);
});

test('exact phone lookup requires pii permission and works when authorized', async () => {
  const audits: DirectoryAuditEntry[] = [];
  const allowed = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer admin-1', phone: '+911111111111' },
    makeDeps({
      writeAuditLog: async (entry) => {
        audits.push(entry);
      },
    }),
  );
  assert.equal(allowed.status, 200);
  if (!('data' in allowed.body)) assert.fail('expected directory data');
  assert.equal(allowed.body.data.records[0]?.uid, 'uid-complete');
  assert.deepEqual(audits, [{ adminUid: 'admin-1', action: 'SEARCH_DIRECTORY_PHONE' }]);

  const deniedAudits: DirectoryAuditEntry[] = [];
  const denied = await resolveAdminDirectoryRequest(
    { authHeader: 'Bearer view-users-only', phone: '+911111111111' },
    makeDeps({
      writeAuditLog: async (entry) => {
        deniedAudits.push(entry);
      },
    }),
  );
  assert.equal(denied.status, 403);
  assert.deepEqual(deniedAudits, []);
});

test('auth-missing anomalies are surfaced separately', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', filter: 'authMissing' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  assert.equal(result.body.data.records.length, 0);
  assert.ok(result.body.data.anomalies.some((record) => record.uid === 'uid-authmissing'));
  assert.ok(result.body.data.anomalies.some((record) => record.uid === 'uid-profileonly'));
});

test('pagination forwards the auth page token', async () => {
  const first = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', pageSize: 2 }, makeDeps());
  assert.equal(first.status, 200);
  if (!('data' in first.body)) assert.fail('expected directory data');
  assert.equal(first.body.data.nextPageToken, 'page-2');

  const second = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1', pageSize: 2, pageToken: first.body.data.nextPageToken }, makeDeps());
  assert.equal(second.status, 200);
  if (!('data' in second.body)) assert.fail('expected directory data');
  assert.equal(second.body.data.records[0]?.uid, 'uid-missinguserdoc');
  assert.equal(second.body.data.nextPageToken, null);
});

test('response does not leak raw auth user records', async () => {
  const result = await resolveAdminDirectoryRequest({ authHeader: 'Bearer admin-1' }, makeDeps());
  assert.equal(result.status, 200);
  if (!('data' in result.body)) assert.fail('expected directory data');
  const raw = JSON.stringify(result.body.data);
  assert.equal(raw.includes('providerData'), false);
  assert.equal(raw.includes('customClaims'), false);
  assert.equal(raw.includes('passwordHash'), false);
});
