'use client';

import { useEffect, useRef, useState } from 'react';
import { useUid } from './useUid';
import { subscribeConversations } from '@/lib/chat';
import { fetchProfile } from '@/lib/profiles';
import type { Conversation, Profile } from '@/lib/types';

export interface ConversationItem {
  conversation: Conversation;
  other: Profile | null;
  otherUid: string;
  unread: number;
}

export function useConversations() {
  const uid = useUid();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
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
      fetchProfile(other)
        .then((p) => setProfiles((prev) => ({ ...prev, [other]: p })))
        .catch(() => setProfiles((prev) => ({ ...prev, [other]: null })));
    });
  }, [conversations, profiles, uid]);

  const items: ConversationItem[] = conversations.map((c) => {
    const otherUid = c.participants.find((p) => p !== uid) ?? '';
    return {
      conversation: c,
      other: profiles[otherUid] ?? null,
      otherUid,
      unread: uid ? c.unreadCounts?.[uid] ?? 0 : 0,
    };
  });

  return { items, loading, uid };
}
