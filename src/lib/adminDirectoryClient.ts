import { authenticatedAdminFetch } from '@/lib/adminApiAuth';

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

export type AdminDirectoryClientResult =
  | { kind: 'success'; data: AdminDirectoryResponse }
  | { kind: 'forbidden'; message: string }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'config-error'; message: string }
  | { kind: 'error'; message: string };

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error;
  }
  return fallback;
}

export async function fetchAdminDirectory(
  params: {
    filter?: DirectoryFilter;
    pageToken?: string | null;
    pageSize?: number;
    uid?: string;
    email?: string;
    phone?: string;
  },
  signal?: AbortSignal,
  authenticatedFetchImpl: typeof authenticatedAdminFetch = authenticatedAdminFetch,
): Promise<AdminDirectoryClientResult> {
  const url = new URL('/api/admin/users', window.location.origin);
  if (params.filter) url.searchParams.set('filter', params.filter);
  if (params.pageToken) url.searchParams.set('pageToken', params.pageToken);
  if (params.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params.uid) url.searchParams.set('uid', params.uid);
  if (params.email) url.searchParams.set('email', params.email);
  if (params.phone) url.searchParams.set('phone', params.phone);

  const authResult = await authenticatedFetchImpl(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (authResult.kind === 'unauthenticated') {
    return { kind: 'unauthorized', message: 'Authentication required.' };
  }

  const { response } = authResult;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) {
    const data = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data?: AdminDirectoryResponse }).data
      : null;
    if (data) return { kind: 'success', data };
    return { kind: 'error', message: 'Directory response was missing its data payload.' };
  }

  if (response.status === 401) return { kind: 'unauthorized', message: readErrorMessage(payload, 'Authentication required.') };
  if (response.status === 403) return { kind: 'forbidden', message: readErrorMessage(payload, 'Restricted. You do not have permission to view this admin directory data.') };
  if (response.status === 503) return { kind: 'config-error', message: readErrorMessage(payload, 'Server configuration for Firebase Admin is not available.') };

  return { kind: 'error', message: readErrorMessage(payload, `Directory request failed with status ${response.status}.`) };
}
