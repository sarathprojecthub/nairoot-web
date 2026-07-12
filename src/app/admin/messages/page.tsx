'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminPageHeader,
  CopyButton,
  DataCard,
  EmptyState,
  ErrorState,
  RawJson,
  SearchBox,
  StatusPill,
} from '@/components/admin/AdminPrimitives';
import {
  fetchDocument,
  fetchRecentMessages,
  formatRelativeTime,
  getArray,
  hasReadMetadata,
  isMessageDeleted,
  messageSenderId,
  messageText,
  messageTimestamp,
  readByList,
  resolveParticipants,
  shortId,
  type AdminDoc,
  type AdminMessage,
  type ParticipantInfo,
} from '@/lib/admin';

type MessageFilter = 'all' | 'deleted' | 'read' | 'day' | 'week';

const filters: Array<{ id: MessageFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'read', label: 'Unread metadata' },
  { id: 'day', label: 'Last 24h' },
  { id: 'week', label: 'Last 7 days' },
];

export default function AdminMessagesPage() {
  return (
    <AdminShell permission="viewMessages">
      {() => <Messages />}
    </AdminShell>
  );
}

function Messages() {
  const [docs, setDocs] = useState<AdminMessage[]>([]);
  const [conversations, setConversations] = useState<Record<string, AdminDoc>>({});
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const messages = await fetchRecentMessages();
        if (!alive) return;
        setDocs(messages);

        const conversationIds = Array.from(new Set(messages.map((message) => message.conversationId).filter((id) => id && id !== 'unknown')));
        const conversationEntries = await Promise.all(
          conversationIds.map(async (id) => [id, await fetchDocument('conversations', id).catch(() => null)] as const),
        );
        if (!alive) return;
        const conversationMap = Object.fromEntries(conversationEntries.filter((entry): entry is readonly [string, AdminDoc] => Boolean(entry[1])));
        setConversations(conversationMap);

        const participantUids = Object.values(conversationMap).flatMap((conversation) => getArray(conversation.data, 'participants'));
        const senderUids = messages.map((message) => messageSenderId(message.data)).filter(Boolean);
        setParticipants(await resolveParticipants([...participantUids, ...senderUids]));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Messages failed to load.');
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((doc) => {
      const timestamp = toMillis(messageTimestamp(doc.data));
      const senderId = messageSenderId(doc.data);
      const sender = participants[senderId];
      const conversation = conversations[doc.conversationId];
      const participantNames = getArray(conversation?.data ?? {}, 'participants')
        .map((uid) => participants[uid]?.displayName ?? uid)
        .join(' ');
      const matchesSearch = !q ||
        doc.id.toLowerCase().includes(q) ||
        doc.conversationId.toLowerCase().includes(q) ||
        senderId.toLowerCase().includes(q) ||
        (sender?.displayName ?? '').toLowerCase().includes(q) ||
        participantNames.toLowerCase().includes(q) ||
        messageText(doc.data).toLowerCase().includes(q);

      const matchesFilter =
        filter === 'all' ||
        (filter === 'deleted' && isMessageDeleted(doc.data)) ||
        (filter === 'read' && hasReadMetadata(doc.data)) ||
        (filter === 'day' && timestamp > 0 && now - timestamp <= 24 * 60 * 60 * 1000) ||
        (filter === 'week' && timestamp > 0 && now - timestamp <= 7 * 24 * 60 * 60 * 1000);

      return matchesSearch && matchesFilter;
    });
  }, [conversations, docs, filter, now, participants, search]);

  return (
    <>
      <AdminPageHeader
        title="All Messages"
        eyebrow="RECENT GLOBAL MESSAGE ACCESS"
        subtitle="Recent messages across the platform. Open a conversation to review the full timeline with audit logging."
      >
        <SearchBox value={search} onChange={setSearch} placeholder="Search message text, sender UID, conversation ID" />
      </AdminPageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filter === item.id ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted hover:border-gold'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error} /> : filtered.length === 0 ? (
        <EmptyState title="No messages found" body="Try a different search or filter." />
      ) : (
        <div className="space-y-4">
          {filtered.map((message) => (
            <MessageReviewCard
              key={`${message.conversationId}:${message.id}`}
              message={message}
              conversation={conversations[message.conversationId]}
              participants={participants}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MessageReviewCard({
  message,
  conversation,
  participants,
}: {
  message: AdminMessage;
  conversation?: AdminDoc;
  participants: Record<string, ParticipantInfo>;
}) {
  const senderId = messageSenderId(message.data);
  const sender = participants[senderId];
  const participantUids = getArray(conversation?.data ?? {}, 'participants');
  const readBy = readByList(message.data);

  return (
    <DataCard className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar participant={sender} fallback={senderId} />
            <div>
              <p className="font-semibold text-charcoal">{sender?.displayName ?? shortId(senderId || 'unknown')}</p>
              <p className="text-xs text-muted">{formatRelativeTime(messageTimestamp(message.data))}</p>
            </div>
          </div>

          <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-ivory px-4 py-3 text-[15px] leading-relaxed text-ink">
            {messageText(message.data)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isMessageDeleted(message.data) && <StatusPill tone="danger">Deleted</StatusPill>}
            {hasReadMetadata(message.data) && <StatusPill tone="good">Read metadata</StatusPill>}
            <StatusPill>Has raw data</StatusPill>
          </div>

          {participantUids.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Participants: {participantUids.map((uid) => participants[uid]?.displayName ?? shortId(uid)).join(' and ')}
            </p>
          )}

          <TechnicalDetails
            senderId={senderId}
            conversationId={message.conversationId}
            messageId={message.id}
            readBy={readBy}
            deleted={isMessageDeleted(message.data)}
            data={message.data}
          />
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-56 lg:flex-col">
          <Link className="admin-primary" href={`/admin/conversations/${message.conversationId}`}>Open conversation</Link>
          <CopyButton value={message.conversationId} label="Copy conversation ID" />
          {senderId && <CopyButton value={senderId} label="Copy sender UID" />}
          <p className="text-xs text-muted">Conversation {shortId(message.conversationId)}</p>
        </div>
      </div>
    </DataCard>
  );
}

function Avatar({ participant, fallback }: { participant?: ParticipantInfo; fallback: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-maroon text-sm font-semibold text-cream">
      {participant?.initials ?? shortId(fallback || 'U', 2, 0)}
    </span>
  );
}

function TechnicalDetails({
  senderId,
  conversationId,
  messageId,
  readBy,
  deleted,
  data,
}: {
  senderId: string;
  conversationId: string;
  messageId: string;
  readBy: string[];
  deleted: boolean;
  data: Record<string, unknown>;
}) {
  return (
    <details className="mt-4 rounded-xl border border-line bg-cream p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted">Technical details</summary>
      <div className="mt-3 grid gap-2 text-xs text-ink/80 sm:grid-cols-2">
        <p><span className="font-semibold text-muted">Sender UID:</span> <span className="font-mono">{senderId || 'none'}</span></p>
        <p><span className="font-semibold text-muted">Conversation ID:</span> <span className="font-mono">{conversationId}</span></p>
        <p><span className="font-semibold text-muted">Message ID:</span> <span className="font-mono">{messageId}</span></p>
        <p><span className="font-semibold text-muted">Deleted:</span> {String(deleted)}</p>
        <p className="sm:col-span-2"><span className="font-semibold text-muted">Read by:</span> {readBy.length ? readBy.join(', ') : 'No read metadata'}</p>
      </div>
      <RawJson data={data} />
    </details>
  );
}

function toMillis(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
