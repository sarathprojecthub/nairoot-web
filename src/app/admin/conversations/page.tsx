'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  fetchCollectionDocs,
  formatRelativeTime,
  formatValue,
  getArray,
  messageText,
  resolveParticipants,
  shortId,
  type AdminDoc,
  type ParticipantInfo,
} from '@/lib/admin';

export default function AdminConversationsPage() {
  return (
    <AdminShell permission="viewConversations">
      {() => <Conversations />}
    </AdminShell>
  );
}

function Conversations() {
  const params = useSearchParams();
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const conversations = await fetchCollectionDocs('conversations', 50, ['updatedAt', 'lastMessageAt', 'createdAt']);
        if (!alive) return;
        setDocs(conversations);
        const participantUids = conversations.flatMap((doc) => getArray(doc.data, 'participants'));
        setParticipants(await resolveParticipants(participantUids));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Conversations failed to load.');
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => {
      const participantUids = getArray(doc.data, 'participants');
      const participantText = participantUids
        .map((uid) => `${uid} ${participants[uid]?.displayName ?? ''} ${participants[uid]?.email ?? ''}`)
        .join(' ')
        .toLowerCase();
      return (
        doc.id.toLowerCase().includes(q) ||
        participantText.includes(q) ||
        formatValue(doc.data.lastMessage).toLowerCase().includes(q) ||
        formatValue(doc.data.status).toLowerCase().includes(q)
      );
    });
  }, [docs, participants, search]);

  return (
    <>
      <AdminPageHeader
        title="Conversations"
        eyebrow="Conversation inbox"
        subtitle="Review user conversations for support, trust & safety, and troubleshooting."
      >
        <SearchBox value={search} onChange={setSearch} placeholder="Search participant name, UID, email, conversation ID" />
      </AdminPageHeader>
      {error ? <ErrorState message={error} /> : filtered.length === 0 ? (
        <EmptyState title="No conversations found" body="Try a different participant, UID, email, or conversation ID." />
      ) : (
        <div className="space-y-4">
          {filtered.map((conversation) => (
            <ConversationInboxCard key={conversation.id} conversation={conversation} participants={participants} />
          ))}
        </div>
      )}
    </>
  );
}

function ConversationInboxCard({
  conversation,
  participants,
}: {
  conversation: AdminDoc;
  participants: Record<string, ParticipantInfo>;
}) {
  const participantUids = getArray(conversation.data, 'participants');
  const lastMessage = conversation.data.lastMessage;
  const lastMessageText = typeof lastMessage === 'object' && lastMessage
    ? messageText(lastMessage as Record<string, unknown>)
    : formatValue(lastMessage);
  const lastActivity = conversation.data.updatedAt ?? conversation.data.lastMessageAt ?? conversation.data.createdAt;
  const messageCount = conversation.data.messageCount ?? conversation.data.messagesCount;

  return (
    <DataCard className="p-5 transition hover:border-gold/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <AvatarStack uids={participantUids} participants={participants} />
            <div className="min-w-0">
              <h3 className="font-serif text-xl font-semibold text-charcoal">
                {participantUids.map((uid) => participants[uid]?.displayName ?? shortId(uid)).join(' and ') || 'Unknown participants'}
              </h3>
              <p className="mt-1 text-xs text-muted">Conversation {shortId(conversation.id)}</p>
            </div>
          </div>

          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink/80">{lastMessageText}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill>{formatRelativeTime(lastActivity)}</StatusPill>
            {messageCount != null && <StatusPill>{String(messageCount)} messages</StatusPill>}
            {formatValue(conversation.data.unreadCounts) !== '—' && <StatusPill tone="warn">Unread metadata</StatusPill>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {participantUids.map((uid) => (
              <span key={uid} className="rounded-full border border-line bg-ivory px-3 py-1 text-xs text-muted">
                {shortId(uid)}
              </span>
            ))}
          </div>

          <RawJson data={conversation.data} label="Technical details" />
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-52 lg:flex-col">
          <Link className="admin-primary" href={`/admin/conversations/${conversation.id}`}>Review conversation</Link>
          <CopyButton value={conversation.id} label="Copy conversation ID" />
        </div>
      </div>
    </DataCard>
  );
}

function AvatarStack({ uids, participants }: { uids: string[]; participants: Record<string, ParticipantInfo> }) {
  return (
    <div className="flex -space-x-2">
      {uids.slice(0, 3).map((uid) => (
        <span
          key={uid}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-cream bg-maroon text-sm font-semibold text-cream"
          title={participants[uid]?.displayName ?? uid}
        >
          {participants[uid]?.initials ?? shortId(uid, 2, 0)}
        </span>
      ))}
    </div>
  );
}
