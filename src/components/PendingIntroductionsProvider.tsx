'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useUid } from '@/hooks/useUid';
import { subscribeReceived, type Introduction } from '@/lib/introductions';
import { filterMemberVisibleIntroductions } from '@/lib/memberIntroductionVisibility';
import { fetchProfile } from '@/lib/profiles';

export interface PendingSender { uid: string; name: string; photo: string; }
type PendingSenderProfile = PendingSender | null;

interface PendingCtx {
  count: number;
  intros: Introduction[];
  senders: PendingSender[];
}

const Ctx = createContext<PendingCtx>({ count: 0, intros: [], senders: [] });

// One app-wide realtime subscription to pending received introductions. Mounted
// once in the (app) layout so the header badge + Discover banner share a single
// listener and the member-facing count excludes only terminally unavailable
// profiles.
export function PendingIntroductionsProvider({ children }: { children: ReactNode }) {
  const uid = useUid();
  const [intros, setIntros] = useState<Introduction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PendingSenderProfile>>({});
  const fetching = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeReceived(uid, 'pending', setIntros);
    return unsub;
  }, [uid]);

  const activeIntros = useMemo(() => (uid ? intros : []), [uid, intros]);

  useEffect(() => {
    activeIntros.forEach((intro) => {
      if (intro.senderId in profiles || fetching.current.has(intro.senderId)) return;
      fetching.current.add(intro.senderId);
      fetchProfile(intro.senderId)
        .then((profile) => {
          setProfiles((prev) => ({
            ...prev,
            [intro.senderId]: profile
              ? { uid: intro.senderId, name: profile.name ?? 'A member', photo: profile.photo ?? '' }
              : null,
          }));
        })
        .catch((err: { code?: string } | null) => {
          if (err?.code === 'permission-denied' || err?.code === 'not-found') {
            setProfiles((prev) => ({
              ...prev,
              [intro.senderId]: null,
            }));
          }
        })
        .finally(() => {
          fetching.current.delete(intro.senderId);
        });
    });
  }, [activeIntros, profiles]);

  const visibleIntros = filterMemberVisibleIntroductions(
    activeIntros.map((intro) => ({
      intro,
      profileStatus:
        intro.senderId in profiles
          ? (profiles[intro.senderId] ? 'loaded' : 'unavailable')
          : 'loading',
    })),
  ).map(({ intro }) => intro);

  const senders = visibleIntros
    .slice(0, 2)
    .map((intro) => profiles[intro.senderId])
    .filter((sender): sender is PendingSender => !!sender);

  return <Ctx.Provider value={{ count: visibleIntros.length, intros: visibleIntros, senders }}>{children}</Ctx.Provider>;
}

export function usePendingIntroductions(): PendingCtx {
  return useContext(Ctx);
}
