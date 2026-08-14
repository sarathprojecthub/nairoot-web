'use client';

import { useEffect, useRef, useState } from 'react';
import { useUid } from './useUid';
import { subscribeConversations } from '@/lib/chat';
import { fetchProfile } from '@/lib/profiles';
import type { Conversation, Profile } from '@/lib/types';
import type { MemberConversationProfileStatus } from '@/lib/memberConversationVisibility';

export interface ConversationItem {
  conversation: Conversation;
  other: Profile | null;
  otherUid: string;
  unread: number;
  profileStatus: MemberConversationProfileStatus;
}

export function useConversations() {
  const uid = useUid();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [profileStatuses, setProfileStatuses] = useState<Record<string, MemberConversationProfileStatus>>({});
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeConversations(
      uid,
      (c) => {
        setConversations(c);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    conversations.forEach((c) => {
      const other = c.participants.find((p) => p !== uid);
      if (!other || other in profiles || fetchingRef.current.has(other)) return;
      fetchingRef.current.add(other);
      setProfileStatuses((prev) => ({ ...prev, [other]: prev[other] ?? 'loading' }));
      fetchProfile(other)
        .then((p) => {
          setProfiles((prev) => ({ ...prev, [other]: p }));
          setProfileStatuses((prev) => ({
            ...prev,
            [other]: p ? 'loaded' : 'unavailable',
          }));
        })
        .catch((err: unknown) => {
          const code = (err as { code?: string } | null)?.code;
          if (code === 'permission-denied' || code === 'not-found') {
            setProfiles((prev) => ({ ...prev, [other]: null }));
            setProfileStatuses((prev) => ({ ...prev, [other]: 'unavailable' }));
          }
        })
        .finally(() => {
          fetchingRef.current.delete(other);
        });
    });
  }, [conversations, profiles, uid]);

  const items: ConversationItem[] = conversations.map((c) => {
    const otherUid = c.participants.find((p) => p !== uid) ?? '';
    return {
      conversation: c,
      other: profiles[otherUid] ?? null,
      otherUid,
      unread: uid ? c.unreadCounts?.[uid] ?? 0 : 0,
      profileStatus: profileStatuses[otherUid] ?? 'loading',
    };
  });

  return { items, loading, uid };
}
