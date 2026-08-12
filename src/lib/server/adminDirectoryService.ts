export type AdminPermissionName =
  | 'viewDashboard'
  | 'viewUsers'
  | 'viewAccountPII'
  | 'viewProfiles'
  | 'manageProfiles'
  | 'viewConversations'
  | 'viewMessages'
  | 'viewWaitlist'
  | 'viewReports'
  | 'writeAuditLogs';

export interface ServerAdminRecord {
  uid: string;
  email?: string | null;
  role?: string | null;
  active: boolean;
  permissions?: Partial<Record<AdminPermissionName, boolean>>;
}

export interface VerifiedRequester {
  uid: string;
  email?: string | null;
}

export interface AuthUserRecordLike {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  disabled?: boolean;
  metadata?: {
    creationTime?: string | null;
  };
}

export interface FirestoreDocLike {
  id: string;
  data: Record<string, unknown>;
}

export interface AuthListPageLike {
  users: AuthUserRecordLike[];
  pageToken?: string;
}

export type DirectoryFilter =
  | 'all'
  | 'hasProfile'
  | 'noProfile'
  | 'hidden'
  | 'underReview'
  | 'test'
  | 'userDocMissing'
  | 'authMissing';

export interface AdminDirectoryRecord {
  uid: string;
  authExists: boolean;
  userDocExists: boolean;
  profileExists: boolean;
  displayName: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  state: string | null;
  isOnboarded: boolean | null;
  isVisible: boolean | null;
  moderationStatus: string | null;
  createdAt: string | null;
  email: string | null;
  phone: string | null;
  accountDisabled: boolean | null;
  isTestProfile: boolean;
  badges: string[];
}

export interface AdminDirectoryResponse {
  records: AdminDirectoryRecord[];
  anomalies: AdminDirectoryRecord[];
  nextPageToken: string | null;
  pageSize: number;
  appliedFilter: DirectoryFilter;
  query: {
    uid: string | null;
    email: string | null;
    phone: string | null;
  };
  piiAuthorized: boolean;
}

export interface DirectoryAuditEntry {
  adminUid: string;
  action: 'SEARCH_DIRECTORY_EMAIL' | 'SEARCH_DIRECTORY_PHONE';
}

export interface ResolveAdminDirectoryDeps {
  verifyIdToken: (token: string) => Promise<VerifiedRequester>;
  getAdminRecord: (uid: string) => Promise<ServerAdminRecord | null>;
  listAuthUsers: (pageSize: number, pageToken?: string) => Promise<AuthListPageLike>;
  getAuthUserByUid: (uid: string) => Promise<AuthUserRecordLike | null>;
  getAuthUserByEmail: (email: string) => Promise<AuthUserRecordLike | null>;
  getAuthUserByPhone: (phone: string) => Promise<AuthUserRecordLike | null>;
  getDocsByUids: (collectionName: 'users' | 'profiles', uids: string[]) => Promise<FirestoreDocLike[]>;
  listRecentFirestoreDocs: (collectionName: 'users' | 'profiles', pageSize: number) => Promise<FirestoreDocLike[]>;
  getFirestoreDocById: (collectionName: 'users' | 'profiles', uid: string) => Promise<FirestoreDocLike | null>;
  writeAuditLog?: (entry: DirectoryAuditEntry) => Promise<void>;
}

export interface ResolveAdminDirectoryInput {
  authHeader: string | null;
  pageToken?: string | null;
  pageSize?: number | null;
  filter?: string | null;
  uid?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ResolveAdminDirectoryResult {
  status: number;
  body:
    | { error: string }
    | { data: AdminDirectoryResponse };
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const ANOMALY_SCAN_LIMIT = 100;
const FIRESTORE_ONLY_ANOMALY_LIMIT = 12;

export function hasServerAdminPermission(
  admin: ServerAdminRecord | null,
  permission: AdminPermissionName,
): boolean {
  if (!admin?.active) return false;
  if (admin.role === 'super_admin') return true;
  return admin.permissions?.[permission] === true;
}

export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim() || null;
}

function normalizePageSize(value: number | null | undefined): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(value)));
}

function normalizeFilter(value: string | null | undefined): DirectoryFilter {
  const allowed: DirectoryFilter[] = ['all', 'hasProfile', 'noProfile', 'hidden', 'underReview', 'test', 'userDocMissing', 'authMissing'];
  return allowed.includes(value as DirectoryFilter) ? (value as DirectoryFilter) : 'all';
}

function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

function toIsoString(value: unknown): string | null {
  const ms = toMillis(value);
  return ms ? new Date(ms).toISOString() : null;
}

function readString(data: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(data: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function readBoolean(data: Record<string, unknown> | null | undefined, keys: string[]): boolean | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'boolean') return value;
  }
  return null;
}

function shortUid(uid: string): string {
  if (uid.length <= 13) return uid;
  return `${uid.slice(0, 8)}…${uid.slice(-4)}`;
}

function badgesForRecord(input: {
  authExists: boolean;
  userDocExists: boolean;
  profileExists: boolean;
  isVisible: boolean | null;
  moderationStatus: string | null;
  isTestProfile: boolean;
}): string[] {
  const badges: string[] = [];
  badges.push(input.profileExists ? 'Has profile' : 'No profile');
  if (input.isVisible === false || input.moderationStatus === 'hidden') badges.push('Hidden');
  if (input.moderationStatus === 'under_review') badges.push('Under review');
  if (!input.userDocExists) badges.push('User document missing');
  if (!input.authExists) badges.push('Auth account missing');
  if (!input.userDocExists && input.profileExists && !input.authExists) badges.push('Profile-only record');
  if (input.isTestProfile) badges.push('Test profile');
  return badges;
}

function buildDirectoryRecord({
  authUser,
  userDoc,
  profileDoc,
  piiAuthorized,
}: {
  authUser: AuthUserRecordLike | null;
  userDoc: FirestoreDocLike | null;
  profileDoc: FirestoreDocLike | null;
  piiAuthorized: boolean;
}): AdminDirectoryRecord {
  const userData = userDoc?.data ?? null;
  const profileData = profileDoc?.data ?? null;
  const displayName =
    readString(profileData, ['name', 'fullName', 'displayName'])
    ?? readString(userData, ['name', 'fullName', 'displayName'])
    ?? shortUid(authUser?.uid ?? userDoc?.id ?? profileDoc?.id ?? 'unknown');
  const isVisible = readBoolean(profileData, ['isVisible']);
  const moderationStatus = readString(profileData, ['moderationStatus']);
  const isTestProfile = readBoolean(userData, ['isTestProfile']) === true || readBoolean(profileData, ['isTestProfile']) === true;

  return {
    uid: authUser?.uid ?? userDoc?.id ?? profileDoc?.id ?? 'unknown',
    authExists: Boolean(authUser),
    userDocExists: Boolean(userDoc),
    profileExists: Boolean(profileDoc),
    displayName,
    age: readNumber(profileData, ['age']),
    gender: readString(profileData, ['gender']),
    city: readString(profileData, ['city']) ?? readString(userData, ['city']),
    state: readString(profileData, ['state']) ?? readString(userData, ['state']),
    isOnboarded: readBoolean(userData, ['isOnboarded']),
    isVisible,
    moderationStatus,
    createdAt: toIsoString(authUser?.metadata?.creationTime ?? userData?.createdAt ?? profileData?.createdAt),
    email: piiAuthorized ? (authUser?.email ?? readString(userData, ['email']) ?? null) : null,
    phone: piiAuthorized ? (authUser?.phoneNumber ?? readString(userData, ['phone', 'phoneNumber']) ?? null) : null,
    accountDisabled: piiAuthorized ? (typeof authUser?.disabled === 'boolean' ? authUser.disabled : null) : null,
    isTestProfile,
    badges: badgesForRecord({
      authExists: Boolean(authUser),
      userDocExists: Boolean(userDoc),
      profileExists: Boolean(profileDoc),
      isVisible,
      moderationStatus,
      isTestProfile,
    }),
  };
}

function recordMatchesFilter(record: AdminDirectoryRecord, filter: DirectoryFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'hasProfile':
      return record.profileExists;
    case 'noProfile':
      return !record.profileExists;
    case 'hidden':
      return record.badges.includes('Hidden');
    case 'underReview':
      return record.badges.includes('Under review');
    case 'test':
      return record.isTestProfile;
    case 'userDocMissing':
      return record.authExists && !record.userDocExists;
    case 'authMissing':
      return !record.authExists;
    default:
      return true;
  }
}

async function buildAuthPageRecords(
  page: AuthListPageLike,
  deps: ResolveAdminDirectoryDeps,
  piiAuthorized: boolean,
): Promise<AdminDirectoryRecord[]> {
  const uids = page.users.map((user) => user.uid);
  const [userDocs, profileDocs] = await Promise.all([
    deps.getDocsByUids('users', uids),
    deps.getDocsByUids('profiles', uids),
  ]);
  const userMap = new Map(userDocs.map((doc) => [doc.id, doc]));
  const profileMap = new Map(profileDocs.map((doc) => [doc.id, doc]));

  return page.users.map((authUser) => buildDirectoryRecord({
    authUser,
    userDoc: userMap.get(authUser.uid) ?? null,
    profileDoc: profileMap.get(authUser.uid) ?? null,
    piiAuthorized,
  }));
}

async function buildFirestoreOnlyAnomalies(
  deps: ResolveAdminDirectoryDeps,
  piiAuthorized: boolean,
): Promise<AdminDirectoryRecord[]> {
  const [userDocs, profileDocs] = await Promise.all([
    deps.listRecentFirestoreDocs('users', ANOMALY_SCAN_LIMIT),
    deps.listRecentFirestoreDocs('profiles', ANOMALY_SCAN_LIMIT),
  ]);

  const userMap = new Map(userDocs.map((doc) => [doc.id, doc]));
  const profileMap = new Map(profileDocs.map((doc) => [doc.id, doc]));
  const candidateUids = Array.from(new Set([...userMap.keys(), ...profileMap.keys()]));

  const authUsers = await Promise.all(candidateUids.map(async (uid) => [uid, await deps.getAuthUserByUid(uid)] as const));
  const authMap = new Map(authUsers);

  return candidateUids
    .map((uid) => buildDirectoryRecord({
      authUser: authMap.get(uid) ?? null,
      userDoc: userMap.get(uid) ?? null,
      profileDoc: profileMap.get(uid) ?? null,
      piiAuthorized,
    }))
    .filter((record) => !record.authExists)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

async function auditSensitiveLookup(
  adminUid: string,
  query: { email: string | null; phone: string | null },
  deps: ResolveAdminDirectoryDeps,
): Promise<void> {
  if (!deps.writeAuditLog) return;
  if (query.email) {
    await deps.writeAuditLog({ adminUid, action: 'SEARCH_DIRECTORY_EMAIL' });
  }
  if (query.phone) {
    await deps.writeAuditLog({ adminUid, action: 'SEARCH_DIRECTORY_PHONE' });
  }
}

export async function resolveAdminDirectoryRequest(
  input: ResolveAdminDirectoryInput,
  deps: ResolveAdminDirectoryDeps,
): Promise<ResolveAdminDirectoryResult> {
  const token = parseBearerToken(input.authHeader);
  if (!token) return { status: 401, body: { error: 'Authentication required.' } };

  let requester: VerifiedRequester;
  try {
    requester = await deps.verifyIdToken(token);
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'auth/argument-error' || err.code === 'auth/id-token-expired' || err.code === 'auth/invalid-id-token') {
      return { status: 401, body: { error: 'Authentication required.' } };
    }
    throw error;
  }

  const admin = await deps.getAdminRecord(requester.uid);
  if (!admin?.active) return { status: 403, body: { error: 'Admin access required.' } };
  if (!hasServerAdminPermission(admin, 'viewUsers')) return { status: 403, body: { error: 'Missing viewUsers permission.' } };

  const piiAuthorized = hasServerAdminPermission(admin, 'viewAccountPII');
  const query = {
    uid: input.uid?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  };

  if ((query.email || query.phone) && !piiAuthorized) {
    return { status: 403, body: { error: 'Missing viewAccountPII permission.' } };
  }

  const pageSize = normalizePageSize(input.pageSize);
  const filter = normalizeFilter(input.filter);

  await auditSensitiveLookup(requester.uid, query, deps);

  if (query.uid || query.email || query.phone) {
    const authUser = query.uid
      ? await deps.getAuthUserByUid(query.uid)
      : query.email
        ? await deps.getAuthUserByEmail(query.email)
        : await deps.getAuthUserByPhone(query.phone!);

    const lookupUid = authUser?.uid ?? query.uid ?? null;
    const [userDoc, profileDoc] = await Promise.all([
      lookupUid ? deps.getFirestoreDocById('users', lookupUid) : Promise.resolve(null),
      lookupUid ? deps.getFirestoreDocById('profiles', lookupUid) : Promise.resolve(null),
    ]);

    const record = lookupUid
      ? buildDirectoryRecord({ authUser, userDoc, profileDoc, piiAuthorized })
      : null;

    const records = record && record.authExists && recordMatchesFilter(record, filter) ? [record] : [];
    const anomalies = record && !record.authExists && recordMatchesFilter(record, filter === 'all' ? 'authMissing' : filter) ? [record] : [];

    return {
      status: 200,
      body: {
        data: {
          records,
          anomalies,
          nextPageToken: null,
          pageSize,
          appliedFilter: filter,
          query,
          piiAuthorized,
        },
      },
    };
  }

  if (filter === 'authMissing') {
    const anomalies = (await buildFirestoreOnlyAnomalies(deps, piiAuthorized)).slice(0, pageSize);
    return {
      status: 200,
      body: {
        data: {
          records: [],
          anomalies,
          nextPageToken: null,
          pageSize,
          appliedFilter: filter,
          query,
          piiAuthorized,
        },
      },
    };
  }

  const authPage = await deps.listAuthUsers(pageSize, input.pageToken ?? undefined);
  const records = (await buildAuthPageRecords(authPage, deps, piiAuthorized)).filter((record) => recordMatchesFilter(record, filter));
  const anomalies = filter === 'all'
    ? (await buildFirestoreOnlyAnomalies(deps, piiAuthorized)).slice(0, FIRESTORE_ONLY_ANOMALY_LIMIT)
    : [];

  return {
    status: 200,
    body: {
      data: {
        records,
        anomalies,
        nextPageToken: authPage.pageToken ?? null,
        pageSize,
        appliedFilter: filter,
        query,
        piiAuthorized,
      },
    },
  };
}
