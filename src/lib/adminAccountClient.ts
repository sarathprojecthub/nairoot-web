import { authenticatedAdminFetch } from '@/lib/adminApiAuth';

export interface AdminAccountMetadata {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  providers: string[];
  creationTime: string | null;
  lastSignInTime: string | null;
  disabled: boolean;
}

export type AdminAccountClientResult =
  | { kind: 'success'; data: AdminAccountMetadata }
  | { kind: 'forbidden'; message: string }
  | { kind: 'unauthorized'; message: string }
  | { kind: 'not-found'; message: string }
  | { kind: 'config-error'; message: string }
  | { kind: 'error'; message: string };

interface AdminAccountApiSuccess {
  data?: AdminAccountMetadata;
}

interface AdminAccountApiError {
  error?: string;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof (payload as AdminAccountApiError).error === 'string') {
    return (payload as AdminAccountApiError).error ?? fallback;
  }
  return fallback;
}

export async function fetchAdminAccountMetadata(
  uid: string,
  signal?: AbortSignal,
  authenticatedFetchImpl: typeof authenticatedAdminFetch = authenticatedAdminFetch,
): Promise<AdminAccountClientResult> {
  const authResult = await authenticatedFetchImpl(`/api/admin/users/${encodeURIComponent(uid)}/account`, {
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
    const data = (payload as AdminAccountApiSuccess | null)?.data;
    if (data) {
      return { kind: 'success', data };
    }
    return { kind: 'error', message: 'Account metadata response was missing its data payload.' };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized', message: readErrorMessage(payload, 'Authentication required.') };
  }
  if (response.status === 403) {
    return { kind: 'forbidden', message: readErrorMessage(payload, "You don't have permission to view account identity information.") };
  }
  if (response.status === 404) {
    return { kind: 'not-found', message: readErrorMessage(payload, 'Target user not found.') };
  }
  if (response.status === 503) {
    return { kind: 'config-error', message: readErrorMessage(payload, 'Server configuration for Firebase Admin is not available.') };
  }

  return {
    kind: 'error',
    message: readErrorMessage(payload, `Account metadata request failed with status ${response.status}.`),
  };
}
