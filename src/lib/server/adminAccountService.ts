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

export interface AccountUserRecordLike {
  uid: string;
  email?: string | null;
  emailVerified: boolean;
  phoneNumber?: string | null;
  providerData?: Array<{ providerId?: string | null }>;
  metadata?: {
    creationTime?: string | null;
    lastSignInTime?: string | null;
  };
  disabled: boolean;
}

export interface AdminAccountMetadataResponse {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  providers: string[];
  creationTime: string | null;
  lastSignInTime: string | null;
  disabled: boolean;
}

export interface AuditLogEntry {
  adminUid: string;
  targetUid: string;
  action: 'VIEW_ACCOUNT_PII';
}

export interface ResolveAdminAccountDeps {
  verifyIdToken: (token: string) => Promise<VerifiedRequester>;
  getAdminRecord: (uid: string) => Promise<ServerAdminRecord | null>;
  getUserRecord: (uid: string) => Promise<AccountUserRecordLike | null>;
  writeAuditLog: (entry: AuditLogEntry) => Promise<void>;
}

export interface ResolveAdminAccountResult {
  status: number;
  body:
    | { error: string }
    | { data: AdminAccountMetadataResponse };
}

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

export function toAdminAccountMetadata(
  userRecord: AccountUserRecordLike,
): AdminAccountMetadataResponse {
  return {
    uid: userRecord.uid,
    email: userRecord.email ?? null,
    emailVerified: Boolean(userRecord.emailVerified),
    phoneNumber: userRecord.phoneNumber ?? null,
    providers: (userRecord.providerData ?? [])
      .map((provider) => provider.providerId?.trim() ?? '')
      .filter(Boolean),
    creationTime: userRecord.metadata?.creationTime ?? null,
    lastSignInTime: userRecord.metadata?.lastSignInTime ?? null,
    disabled: Boolean(userRecord.disabled),
  };
}

export async function resolveAdminAccountRequest(
  authHeader: string | null,
  targetUid: string,
  deps: ResolveAdminAccountDeps,
): Promise<ResolveAdminAccountResult> {
  const token = parseBearerToken(authHeader);
  if (!token) {
    return { status: 401, body: { error: 'Authentication required.' } };
  }

  let requester: VerifiedRequester;
  try {
    requester = await deps.verifyIdToken(token);
  } catch (error) {
    const err = error as { code?: string };
    if (
      err.code === 'auth/argument-error'
      || err.code === 'auth/id-token-expired'
      || err.code === 'auth/invalid-id-token'
    ) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }
    throw error;
  }

  const admin = await deps.getAdminRecord(requester.uid);

  if (!admin?.active) {
    return { status: 403, body: { error: 'Admin access required.' } };
  }

  if (!hasServerAdminPermission(admin, 'viewAccountPII')) {
    return { status: 403, body: { error: 'Missing viewAccountPII permission.' } };
  }

  const userRecord = await deps.getUserRecord(targetUid);
  if (!userRecord) {
    return { status: 404, body: { error: 'Target user not found.' } };
  }

  await deps.writeAuditLog({
    adminUid: admin.uid,
    targetUid,
    action: 'VIEW_ACCOUNT_PII',
  });

  return {
    status: 200,
    body: {
      data: toAdminAccountMetadata(userRecord),
    },
  };
}
