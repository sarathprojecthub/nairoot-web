import { onAuthStateChanged, type User } from 'firebase/auth';

export type ResolvedAdminAuthState =
  | { kind: 'authenticated'; user: User }
  | { kind: 'unauthenticated' };

export interface AdminApiAuthDeps {
  getCurrentUser: () => User | null;
  onAuthStateChanged: (callback: (user: User | null) => void) => () => void;
  fetchImpl: typeof fetch;
}

export type AuthenticatedAdminFetchResult =
  | { kind: 'unauthenticated' }
  | { kind: 'response'; response: Response };

async function defaultDeps(): Promise<AdminApiAuthDeps> {
  const { auth } = await import('@/lib/firebase');
  return {
    getCurrentUser: () => auth.currentUser,
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),
    fetchImpl: fetch,
  };
}

export function waitForResolvedAdminAuth(
  deps?: Pick<AdminApiAuthDeps, 'getCurrentUser' | 'onAuthStateChanged'>,
): Promise<ResolvedAdminAuthState> {
  async function resolveAuthState(): Promise<ResolvedAdminAuthState> {
    const resolvedDeps = deps ?? await defaultDeps();
    const currentUser = resolvedDeps.getCurrentUser();
    if (currentUser) {
      return { kind: 'authenticated', user: currentUser };
    }

    return new Promise<ResolvedAdminAuthState>((resolve) => {
      const unsubscribe = resolvedDeps.onAuthStateChanged((user) => {
        unsubscribe();
        if (user) resolve({ kind: 'authenticated', user });
        else resolve({ kind: 'unauthenticated' });
      });
    });
  }

  return resolveAuthState();
}

function withBearerToken(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return {
    ...init,
    headers,
  };
}

export async function authenticatedAdminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  deps?: AdminApiAuthDeps,
): Promise<AuthenticatedAdminFetchResult> {
  const resolvedDeps = deps ?? await defaultDeps();
  const authState = await waitForResolvedAdminAuth(resolvedDeps);
  if (authState.kind === 'unauthenticated') {
    return { kind: 'unauthenticated' };
  }

  const user = authState.user;
  let token = await user.getIdToken();
  let response = await resolvedDeps.fetchImpl(input, withBearerToken(init, token));

  if (response.status === 401) {
    token = await user.getIdToken(true);
    response = await resolvedDeps.fetchImpl(input, withBearerToken(init, token));
  }

  return { kind: 'response', response };
}
