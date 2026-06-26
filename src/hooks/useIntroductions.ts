'use client';

import { useEffect, useRef, useState } from 'react';
import { useUid } from './useUid';
import { subscribeReceived, subscribeSent, type Introduction } from '@/lib/introductions';
import { fetchProfile } from '@/lib/profiles';
import type { Profile } from '@/lib/types';

export interface IntroItem {
  intro: Introduction;
  profile: Profile | null; // the OTHER party; null when they have no profile yet
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
        .catch(() => setProfiles((prev) => ({ ...prev, [id]: null })));
    });
  }, [recvPending, recvAccepted, sentPending, sentAccepted, profiles]);

  const received: IntroItem[] = [...recvPending, ...recvAccepted].map((intro) => ({
    intro,
    profile: profiles[intro.senderId] ?? null,
  }));
  const sent: IntroItem[] = [...sentPending, ...sentAccepted].map((intro) => ({
    intro,
    profile: profiles[intro.recipientId] ?? null,
  }));

  return { received, sent, loading };
}
