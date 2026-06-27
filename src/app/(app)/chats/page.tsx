'use client';

import Link from 'next/link';
import { useConversations } from '@/hooks/useConversations';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { PageSpinner } from '@/components/ui/Loading';

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
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-stone-900">Chats</h1>

      {loading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-12 text-center text-sm text-stone-400">
          No conversations yet. Accept an introduction to start chatting.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
          {items.map(({ conversation, other, otherUid, unread }) => {
            const name = other?.name || 'A member';
            const last = conversation.lastMessage;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/chats/${conversation.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50"
                >
                  <ProfilePhoto src={other?.photo ?? ''} name={name} seed={otherUid} rounded="rounded-full" className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium text-stone-900">{name}</p>
                      <span className="shrink-0 text-xs text-stone-400">{timeShort(conversation.updatedAt)}</span>
                    </div>
                    <p className={`truncate text-sm ${unread > 0 ? 'font-medium text-stone-800' : 'text-stone-500'}`}>
                      {last ? last.text : 'Conversation started'}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-xs font-semibold text-white">
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
