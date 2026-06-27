'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUid } from '@/hooks/useUid';
import { useMessages } from '@/hooks/useMessages';
import { fetchConversation, sendMessage } from '@/lib/chat';
import { fetchProfile } from '@/lib/profiles';
import type { Conversation, Profile } from '@/lib/types';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { PageSpinner } from '@/components/ui/Loading';

function timeShort(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const convId = params?.id;
  const uid = useUid();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const { messages, loading } = useMessages(convId, uid);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversation (participants needed to send) + the other party's profile.
  useEffect(() => {
    if (!convId || !uid) return;
    let active = true;
    (async () => {
      const c = await fetchConversation(convId);
      if (!active) return;
      setConversation(c);
      const otherUid = c?.participants.find((p) => p !== uid);
      if (otherUid) {
        const p = await fetchProfile(otherUid).catch(() => null);
        if (active) setOther(p);
      }
    })();
    return () => {
      active = false;
    };
  }, [convId, uid]);

  // Auto-scroll to newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || !convId || !uid || !conversation || sending) return;
    setSending(true);
    setError(null);
    setText(''); // optimistic clear; Firestore local cache shows the bubble instantly
    try {
      await sendMessage(convId, uid, value, conversation.participants);
    } catch {
      setError('Message failed to send.');
      setText(value); // restore on failure
    } finally {
      setSending(false);
    }
  }

  const name = other?.name || 'A member';

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-stone-200 pb-3">
        <Link href="/chats" className="text-stone-400 hover:text-stone-700">
          ←
        </Link>
        <ProfilePhoto src={other?.photo ?? ''} name={name} seed={conversation?.participants.find((p) => p !== uid) ?? convId ?? ''} rounded="rounded-full" className="h-9 w-9" />
        <p className="font-medium text-stone-900">{name}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {loading ? (
          <PageSpinner />
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-stone-400">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === uid;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    mine ? 'rounded-br-sm bg-stone-900 text-white' : 'rounded-bl-sm bg-stone-100 text-stone-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.deleted ? <em className="opacity-60">Message removed</em> : m.text}</p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-white/50' : 'text-stone-400'}`}>{timeShort(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-stone-200 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          className="flex-1 rounded-full border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-stone-500"
        />
        <button
          type="submit"
          disabled={sending || text.trim().length === 0}
          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
      {error && <p className="pb-1 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
