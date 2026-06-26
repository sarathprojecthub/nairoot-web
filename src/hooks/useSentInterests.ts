'use client';

import { useEffect, useState } from 'react';
import { useUid } from './useUid';
import { subscribeSentInterests } from '@/lib/introductions';

// Subscribes to the current user's pending sent introductions and exposes them
// as a Set of recipientIds. `ready` flips true after the first snapshot so the
// UI can avoid flashing "Send Interest" on an already-actioned profile.
export function useSentInterests() {
  const uid = useUid();
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setReady(false);
    const unsub = subscribeSentInterests(uid, (recipientIds) => {
      setSentTo(new Set(recipientIds));
      setReady(true);
    });
    return unsub;
  }, [uid]);

  return { sentTo, ready };
}
