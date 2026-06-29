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
    return () => { active = false; };
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
  const otherUid = conversation?.participants.find((p) => p !== uid) ?? convId ?? '';

  return (
    <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-card">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line bg-ivory/70 px-4 py-3 backdrop-blur">
        <Link href="/chats" className="text-muted transition hover:text-ink" aria-label="Back to chats">←</Link>
        <ProfilePhoto src={other?.photo ?? ''} name={name} seed={otherUid} rounded="rounded-full" className="h-9 w-9 border border-line" />
        <Link href={`/discover/${otherUid}`} className="font-serif text-base font-semibold text-charcoal hover:underline">{name}</Link>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-5">
        {loading ? (
          <PageSpinner />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === uid;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
                    mine ? 'rounded-br-md bg-maroon text-cream' : 'rounded-bl-md border border-line bg-white text-ink'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {m.deleted ? <em className="opacity-60">Message removed</em> : m.text}
                  </p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-cream/55' : 'text-muted'}`}>{timeShort(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line bg-ivory/70 px-3 py-3 backdrop-blur">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          className="flex-1 rounded-full border border-line-strong bg-cream px-4 py-2.5 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={sending || text.trim().length === 0}
          className="rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-maroon-deep disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
      {error && <p className="px-4 pb-2 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
