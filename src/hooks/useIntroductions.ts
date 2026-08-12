'use client';

import { useEffect, useRef, useState } from 'react';
import { useUid } from './useUid';
import { subscribeReceived, subscribeSent, type Introduction } from '@/lib/introductions';
import { fetchProfile } from '@/lib/profiles';
import type { Profile } from '@/lib/types';

// 'loading' = not yet resolved (genuinely in flight or awaiting retry after a
// transient error); 'unavailable' = terminal — the profile document doesn't
// exist or is permission-denied (admin-hidden); 'loaded' = resolved successfully.
export type ProfileStatus = 'loading' | 'loaded' | 'unavailable';

export interface IntroItem {
  intro: Introduction;
  profile: Profile | null; // the OTHER party; null when unresolved or unavailable
  profileStatus: ProfileStatus;
}

// Mirrors Android introductionStore: four realtime listeners — received/sent ×
// pending/accepted — joined with the counterpart's profile.
export function useIntroductions() {
  const uid = useUid();
  const [recvPending, setRecvPending] = useState<Introduction[]>([]);
  const [recvAccepted, setRecvAccepted] = useState<Introduction[]>([]);
  const [sentPending, setSentPending] = useState<Introduction[]>([]);
  const [sentAccepted, setSentAccepted] = useState<Introduction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    let delivered = 0;
    const mark = () => {
      delivered += 1;
      if (delivered >= 4) setLoading(false);
    };
    const unsubs = [
      subscribeReceived(uid, 'pending', (x) => { setRecvPending(x); mark(); }),
      subscribeReceived(uid, 'accepted', (x) => { setRecvAccepted(x); mark(); }),
      subscribeSent(uid, 'pending', (x) => { setSentPending(x); mark(); }),
      subscribeSent(uid, 'accepted', (x) => { setSentAccepted(x); mark(); }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // Join the counterpart profile (sender for received, recipient for sent).
  useEffect(() => {
    const needed = new Set<string>();
    [...recvPending, ...recvAccepted].forEach((i) => needed.add(i.senderId));
    [...sentPending, ...sentAccepted].forEach((i) => needed.add(i.recipientId));
    needed.forEach((id) => {
      if (id in profiles || fetchingRef.current.has(id)) return;
      fetchingRef.current.add(id);
      fetchProfile(id)
        .then((p) => setProfiles((prev) => ({ ...prev, [id]: p })))
        .catch((err: unknown) => {
          // fetchProfile itself already returns null (not a throw) for a
          // missing doc — the only realistic throw here is permission-denied
          // (admin-hidden profile), which is just as terminal as deleted.
          // Any other error (network, transient) is left unresolved so a
          // later effect run — e.g. when a new introduction arrives — retries it.
          const code = (err as { code?: string } | null)?.code;
          if (code === 'permission-denied' || code === 'not-found') {
            setProfiles((prev) => ({ ...prev, [id]: null }));
          }
        })
        .finally(() => { fetchingRef.current.delete(id); });
    });
  }, [recvPending, recvAccepted, sentPending, sentAccepted, profiles]);

  const resolveStatus = (id: string): ProfileStatus => {
    if (!(id in profiles)) return 'loading';
    return profiles[id] ? 'loaded' : 'unavailable';
  };

  const received: IntroItem[] = [...recvPending, ...recvAccepted].map((intro) => ({
    intro,
    profile: profiles[intro.senderId] ?? null,
    profileStatus: resolveStatus(intro.senderId),
  }));
  const sent: IntroItem[] = [...sentPending, ...sentAccepted].map((intro) => ({
    intro,
    profile: profiles[intro.recipientId] ?? null,
    profileStatus: resolveStatus(intro.recipientId),
  }));

  return { received, sent, loading };
}
