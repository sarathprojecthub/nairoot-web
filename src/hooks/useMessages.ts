'use client';

import { useEffect, useState } from 'react';
import { subscribeMessages, markConversationRead } from '@/lib/chat';
import type { Message } from '@/lib/types';

// Realtime messages for a conversation. Marks the conversation read on each
// snapshot while it's open — mirrors Android (markConversationRead in the
// messages onUpdate of realtimeConversationStore.openConversation).
export function useMessages(convId: string | undefined, uid: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!convId) return;
    setLoading(true);
    const unsub = subscribeMessages(
      convId,
      (m) => {
        setMessages(m);
        setLoading(false);
        if (uid) void markConversationRead(convId, uid).catch(() => {});
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [convId, uid]);

  return { messages, loading, error };
}
