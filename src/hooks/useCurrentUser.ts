'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';

export interface CurrentUser {
  uid: string | null;
  isOnboarded: boolean;
  phone: string | null;
  loading: boolean;
}

// Reactive current user: the signed-in Phone-Auth uid (from AuthProvider) joined
// with a live read of its users/{uid} doc to know whether onboarding is complete.
// Drives route guards and the header.
export function useCurrentUser(): CurrentUser {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);

  useEffect(() => {
    if (!uid) { setIsOnboarded(false); setPhone(null); setDocLoaded(false); return; }
    setDocLoaded(false);
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        const data = snap.data();
        setIsOnboarded(Boolean(data?.isOnboarded));
        setPhone((data?.phone as string) ?? null);
        setDocLoaded(true);
      },
      () => setDocLoaded(true),
    );
    return unsub;
  }, [uid]);

  return {
    uid,
    isOnboarded,
    phone,
    loading: authLoading || (!!uid && !docLoaded),
  };
}
