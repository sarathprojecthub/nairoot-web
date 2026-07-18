'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { isAuthMutationPending, subscribeAuthMutation } from '@/lib/authMutation';

// Single source of truth for the signed-in Firebase user. Production auth is
// persistent (getAuth uses IndexedDB persistence by default), so onAuthStateChanged
// resolves to the previously signed-in user on reload — no anonymous sessions.
interface AuthState {
  user: User | null;
  loading: boolean; // true until the initial auth state is known
  authMutationPending: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, authMutationPending: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: auth.currentUser,
    loading: true,
    authMutationPending: isAuthMutationPending(),
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setState((current) => ({ ...current, user, loading: false }));
    });
    const unsubscribeMutation = subscribeAuthMutation((authMutationPending) => {
      setState((current) => ({ ...current, authMutationPending }));
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMutation();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
