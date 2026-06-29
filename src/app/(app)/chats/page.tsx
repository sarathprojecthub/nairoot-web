'use client';

import Link from 'next/link';
import { useConversations } from '@/hooks/useConversations';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { PageSpinner } from '@/components/ui/Loading';
import { SectionHeader } from '@/components/ui/SectionHeader';

function timeShort(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatsPage() {
  const { items, loading } = useConversations();

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader eyebrow="Your conversations" title="Chats" className="mb-8" />

      {loading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong bg-cream/60 px-4 py-16 text-center">
          <p className="font-serif text-lg text-charcoal">No conversations yet</p>
          <p className="mt-1.5 text-sm text-muted">Accept an introduction to begin a conversation.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-cream shadow-soft">
          {items.map(({ conversation, other, otherUid, unread }) => {
            const name = other?.name || 'A member';
            const last = conversation.lastMessage;
            return (
              <li key={conversation.id}>
                <Link href={`/chats/${conversation.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-ivory-deep/50">
                  <ProfilePhoto src={other?.photo ?? ''} name={name} seed={otherUid} rounded="rounded-full" className="h-12 w-12 shrink-0 border border-line" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold text-charcoal">{name}</p>
                      <span className="shrink-0 text-xs text-muted">{timeShort(conversation.updatedAt)}</span>
                    </div>
                    <p className={`truncate text-sm ${unread > 0 ? 'font-medium text-ink' : 'text-muted'}`}>
                      {last ? last.text : 'Conversation started'}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-maroon px-1.5 text-xs font-semibold text-cream">
                      {unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
