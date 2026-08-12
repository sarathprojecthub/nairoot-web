'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { repairMissingBootstrapUserDoc } from '@/lib/authBootstrap';
import { createUserDoc } from '@/lib/user';

export interface CurrentUser {
  uid: string | null;
  isOnboarded: boolean;
  phone: string | null;
  loading: boolean;
  authMutationPending: boolean;
}

interface UserDocState {
  observedUid: string | null;
  isOnboarded: boolean;
  phone: string | null;
  loaded: boolean;
}

// Reactive current user: the signed-in Firebase uid (from AuthProvider) joined
// with a live read of its users/{uid} doc to know whether onboarding is complete.
// Drives route guards and the header.
export function useCurrentUser(): CurrentUser {
  const { user, loading: authLoading, authMutationPending } = useAuth();
  const uid = user?.uid ?? null;
  const [docState, setDocState] = useState<UserDocState>({
    observedUid: null,
    isOnboarded: false,
    phone: null,
    loaded: false,
  });

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    let repairAttempted = false;

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      async (snap) => {
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          setDocState({
            observedUid: uid,
            isOnboarded: Boolean(data?.isOnboarded),
            phone: (data?.phone as string) ?? null,
            loaded: true,
          });
          return;
        }

        try {
          const attemptedRepair = await repairMissingBootstrapUserDoc(
            { createUserDoc },
            {
              uid,
              hasUserDoc: false,
              authMutationPending,
              repairAttempted,
            },
          );
          repairAttempted = repairAttempted || attemptedRepair;
          if (attemptedRepair) {
            return;
          }
        } catch {
          repairAttempted = true;
          // Best effort repair only - if this fails we surface the signed-in
          // account without claiming onboarding completion or inventing fields.
        }

        if (!cancelled) {
          setDocState({
            observedUid: uid,
            isOnboarded: false,
            phone: null,
            loaded: true,
          });
        }
      },
      () => {
        if (!cancelled) {
          setDocState({
            observedUid: uid,
            isOnboarded: false,
            phone: null,
            loaded: true,
          });
        }
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [uid, authMutationPending]);

  const docLoaded = uid ? docState.observedUid === uid && docState.loaded : false;
  const isOnboarded = uid && docState.observedUid === uid ? docState.isOnboarded : false;
  const phone = uid && docState.observedUid === uid ? docState.phone : null;

  return {
    uid,
    isOnboarded,
    phone,
    loading: authMutationPending || authLoading || (!!uid && !docLoaded),
    authMutationPending,
  };
}
