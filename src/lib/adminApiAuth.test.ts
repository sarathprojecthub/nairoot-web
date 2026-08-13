import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticatedAdminFetch,
  defaultBrowserFetch,
  waitForResolvedAdminAuth,
  type AdminApiAuthDeps,
} from '@/lib/adminApiAuth';

function makeUser(tokens: string[]) {
  const tokenCalls: boolean[] = [];
  return {
    user: {
      getIdToken: async (forceRefresh?: boolean) => {
        tokenCalls.push(Boolean(forceRefresh));
        const token = tokens.shift();
        if (!token) {
          throw new Error('No token available');
        }
        return token;
      },
    },
    tokenCalls,
  };
}

function makeDeps(overrides: Partial<AdminApiAuthDeps> = {}): AdminApiAuthDeps {
  return {
    getCurrentUser: () => null,
    onAuthStateChanged: (callback) => {
      queueMicrotask(() => callback(null));
      return () => undefined;
    },
    fetchImpl: async () => new Response(null, { status: 200 }),
    ...overrides,
  };
}

test('default browser fetch wrapper preserves Window binding for native-style fetch implementations', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  const fakeWindow = {
    fetch(this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      void input;
      void init;
      if (this !== fakeWindow) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  } as typeof globalThis.window & { fetch: typeof fetch };

  Object.defineProperty(globalThis, 'window', {
    value: fakeWindow,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'fetch', {
    value: fakeWindow.fetch,
    configurable: true,
  });

  try {
    const response = await defaultBrowserFetch('https://example.com/api/admin/users');
    assert.equal(response.status, 204);
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  }
});

test('auth resolves with authenticated user and request carries Bearer token', async () => {
  const { user, tokenCalls } = makeUser(['token-1']);
  const requests: Array<{ authorization: string | null }> = [];

  const result = await authenticatedAdminFetch(
    'https://example.com/api/admin/users',
    { method: 'GET' },
    makeDeps({
      getCurrentUser: () => user as never,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init?.headers);
        requests.push({ authorization: headers.get('Authorization') });
        return new Response(JSON.stringify({ data: {} }), { status: 200 });
      },
    }),
  );

  assert.equal(result.kind, 'response');
  assert.deepEqual(tokenCalls, [false]);
  assert.deepEqual(requests, [{ authorization: 'Bearer token-1' }]);
});

test('401 triggers exactly one forced-refresh retry and succeeds on second request', async () => {
  const { user, tokenCalls } = makeUser(['token-1', 'token-2']);
  const requests: string[] = [];

  const result = await authenticatedAdminFetch(
    'https://example.com/api/admin/users',
    { method: 'GET' },
    makeDeps({
      getCurrentUser: () => user as never,
      fetchImpl: async (_input, init) => {
        const headers = new Headers(init?.headers);
        requests.push(headers.get('Authorization') ?? 'missing');
        return requests.length === 1
          ? new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 })
          : new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
      },
    }),
  );

  assert.equal(result.kind, 'response');
  assert.deepEqual(tokenCalls, [false, true]);
  assert.deepEqual(requests, ['Bearer token-1', 'Bearer token-2']);
});

test('retry also returning 401 does not trigger a third request', async () => {
  const { user, tokenCalls } = makeUser(['token-1', 'token-2']);
  let requestCount = 0;

  const result = await authenticatedAdminFetch(
    'https://example.com/api/admin/users',
    { method: 'GET' },
    makeDeps({
      getCurrentUser: () => user as never,
      fetchImpl: async () => {
        requestCount += 1;
        return new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 });
      },
    }),
  );

  assert.equal(result.kind, 'response');
  if (result.kind === 'response') {
    assert.equal(result.response.status, 401);
  }
  assert.deepEqual(tokenCalls, [false, true]);
  assert.equal(requestCount, 2);
});

test('403 does not trigger token refresh retry', async () => {
  const { user, tokenCalls } = makeUser(['token-1']);
  let requestCount = 0;

  const result = await authenticatedAdminFetch(
    'https://example.com/api/admin/users',
    { method: 'GET' },
    makeDeps({
      getCurrentUser: () => user as never,
      fetchImpl: async () => {
        requestCount += 1;
        return new Response(JSON.stringify({ error: 'Forbidden.' }), { status: 403 });
      },
    }),
  );

  assert.equal(result.kind, 'response');
  if (result.kind === 'response') {
    assert.equal(result.response.status, 403);
  }
  assert.deepEqual(tokenCalls, [false]);
  assert.equal(requestCount, 1);
});

test('auth resolves unauthenticated and no protected API request is sent', async () => {
  let fetchCalls = 0;

  const authState = await waitForResolvedAdminAuth(
    makeDeps({
      onAuthStateChanged: (callback) => {
        queueMicrotask(() => callback(null));
        return () => undefined;
      },
    }),
  );
  assert.deepEqual(authState, { kind: 'unauthenticated' });

  const result = await authenticatedAdminFetch(
    'https://example.com/api/admin/users',
    { method: 'GET' },
    makeDeps({
      onAuthStateChanged: (callback) => {
        queueMicrotask(() => callback(null));
        return () => undefined;
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 200 });
      },
    }),
  );

  assert.deepEqual(result, { kind: 'unauthenticated' });
  assert.equal(fetchCalls, 0);
});
