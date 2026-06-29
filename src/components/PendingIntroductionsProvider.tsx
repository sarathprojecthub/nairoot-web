'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useUid } from '@/hooks/useUid';
import { subscribeReceived, type Introduction } from '@/lib/introductions';
import { fetchProfile } from '@/lib/profiles';

export interface PendingSender { uid: string; name: string; photo: string; }

interface PendingCtx {
  count: number;
  intros: Introduction[];
  senders: PendingSender[]; // first 1–2 pending senders (for the banner)
}

const Ctx = createContext<PendingCtx>({ count: 0, intros: [], senders: [] });

// One app-wide realtime subscription to PENDING received introductions. Mounted
// once in the (app) layout so the header badge + Discover banner share a single
// listener (no duplicate subscriptions, no fan-out beyond the first 2 senders).
export function PendingIntroductionsProvider({ children }: { children: ReactNode }) {
  const uid = useUid();
  const [intros, setIntros] = useState<Introduction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PendingSender>>({});
  const fetching = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) { setIntros([]); return; }
    const unsub = subscribeReceived(uid, 'pending', setIntros);
    return unsub;
  }, [uid]);

  // Resolve sender names/photos for the first 2 pending only — cheap, cached.
  useEffect(() => {
    intros.slice(0, 2).forEach((i) => {
      if (profiles[i.senderId] || fetching.current.has(i.senderId)) return;
      fetching.current.add(i.senderId);
      fetchProfile(i.senderId)
        .then((p) =>
          setProfiles((prev) => ({
            ...prev,
            [i.senderId]: { uid: i.senderId, name: p?.name ?? 'A member', photo: p?.photo ?? '' },
          })),
        )
        .catch(() => { /* ignore — banner falls back to count only */ });
    });
  }, [intros, profiles]);

  const senders = intros
    .slice(0, 2)
    .map((i) => profiles[i.senderId])
    .filter((s): s is PendingSender => !!s);

  return <Ctx.Provider value={{ count: intros.length, intros, senders }}>{children}</Ctx.Provider>;
}

export function usePendingIntroductions(): PendingCtx {
  return useContext(Ctx);
}
