'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ensureAuth } from '@/lib/profiles';

export interface CurrentUser {
  uid: string | null;
  isOnboarded: boolean;
  phone: string | null;
  loading: boolean;
}

// Reactive current user: tracks the (anonymous) uid and live-reads its
// users/{uid} doc to know whether onboarding is complete. Used to gate the
// onboarding flow and to switch the header between "Join" and "Profile".
export function useCurrentUser(): CurrentUser {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    void ensureAuth();
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
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

  return { uid, isOnboarded, phone, loading: !uid || !docLoaded };
}
