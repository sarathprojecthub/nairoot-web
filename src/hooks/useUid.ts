'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ensureAuth } from '@/lib/profiles';

// Reactive current (anonymous) uid. Firebase Auth persists the anonymous session
// across refreshes (IndexedDB), so this uid is stable per browser — which is what
// keeps "Interest Sent ✓" correct after a reload.
export function useUid(): string | null {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    void ensureAuth();
    return unsub;
  }, []);

  return uid;
}
