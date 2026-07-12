'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminLink,
  AdminPageHeader,
  CopyButton,
  DataCard,
  EmptyState,
  ErrorState,
  RawJson,
  StatusPill,
} from '@/components/admin/AdminPrimitives';
import {
  ACCESS_REASONS,
  fetchConversation,
  fetchConversationMessages,
  formatDateHeading,
  formatTime,
  getArray,
  hasReadMetadata,
  isMessageDeleted,
  messageSenderId,
  messageText,
  messageTimestamp,
  readByList,
  resolveParticipants,
  shortId,
  writeAdminAuditLog,
  type AdminDoc,
  type AdminRecord,
  type ParticipantInfo,
} from '@/lib/admin';

export default function AdminConversationDetailPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = use(params);
  return (
    <AdminShell permission="viewMessages">
      {(admin) => <ConversationDetail admin={admin} conversationId={conversationId} />}
    </AdminShell>
  );
}

function ConversationDetail({ admin, conversationId }: { admin: AdminRecord; conversationId: string }) {
  const [conversation, setConversation] = useState<AdminDoc | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});
  const [messages, setMessages] = useState<AdminDoc[]>([]);
  const [reason, setReason] = useState('');
  const [auditReady, setAuditReady] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const doc = await fetchConversation(conversationId);
        if (!alive) return;
        setConversation(doc);
        if (doc) setParticipants(await resolveParticipants(getArray(doc.data, 'participants')));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Conversation failed to load.');
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [conversationId]);

  async function unlockMessages() {
    if (!conversation || !reason) return;
    setLoadingMessages(true);
    setAuditError(null);
    try {
      const participantUids = getArray(conversation.data, 'participants');
      await writeAdminAuditLog(admin, {
        action: 'VIEW_CONVERSATION_MESSAGES',
        reason,
        conversationId,
        participantUids,
      });
      const loaded = await fetchConversationMessages(conversationId);
      setMessages(loaded);
      setAuditReady(true);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Audit log write failed. Messages were not shown.');
    } finally {
      setLoadingMessages(false);
    }
  }

  const participantUids = useMemo(() => getArray(conversation?.data ?? {}, 'participants'), [conversation]);

  return (
    <>
      <AdminPageHeader
        title="Conversation Review"
        eyebrow="Sensitive message access"
        subtitle="Review the full conversation timeline after selecting a logged access reason."
      >
        <Link href="/admin/conversations" className="admin-secondary">Back to conversations</Link>
      </AdminPageHeader>

      {error ? <ErrorState message={error} /> : !conversation ? <EmptyState title="Loading conversation" /> : (
        <div className="space-y-5">
          <DataCard className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-muted">Conversation</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-2xl font-semibold text-charcoal">{shortId(conversation.id)}</h3>
                  <CopyButton value={conversation.id} label="Copy ID" />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {auditReady ? `Access logged: ${reason}` : 'Reason required before viewing messages'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {participantUids.map((uid) => (
                  <StatusPill key={uid}>{participants[uid]?.displayName ?? shortId(uid)}</StatusPill>
                ))}
              </div>
            </div>
          </DataCard>

          {!auditReady && (
            <AccessReasonCard
              reason={reason}
              setReason={setReason}
              loading={loadingMessages}
              error={auditError}
              unlockMessages={unlockMessages}
            />
          )}

          {auditReady && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <DataCard className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-charcoal">Message timeline</h3>
                    <p className="mt-1 text-sm text-muted">{messages.length} messages loaded for review.</p>
                  </div>
                  <StatusPill tone="good">Access logged</StatusPill>
                </div>
                <MessageTimeline messages={messages} participants={participants} participantUids={participantUids} />
              </DataCard>

              <ContextPanel conversation={conversation} participants={participants} participantUids={participantUids} />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AccessReasonCard({
  reason,
  setReason,
  loading,
  error,
  unlockMessages,
}: {
  reason: string;
  setReason: (reason: string) => void;
  loading: boolean;
  error: string | null;
  unlockMessages: () => void;
}) {
  return (
    <DataCard className="border-gold/30 p-6">
      <h3 className="font-serif text-2xl font-semibold text-charcoal">Reason for message access</h3>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Message access is logged for trust, safety, support, and troubleshooting.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {ACCESS_REASONS.map((item) => (
          <button
            key={item}
            onClick={() => setReason(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${reason === item ? 'bg-maroon text-cream' : 'border border-line bg-ivory text-muted hover:border-gold'}`}
          >
            {item}
          </button>
        ))}
      </div>
      <button disabled={!reason || loading} onClick={unlockMessages} className="admin-primary mt-5">
        {loading ? 'Writing audit log...' : 'Write audit log and view messages'}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </DataCard>
  );
}

function MessageTimeline({
  messages,
  participants,
  participantUids,
}: {
  messages: AdminDoc[];
  participants: Record<string, ParticipantInfo>;
  participantUids: string[];
}) {
  const rows = useMemo(() => {
    return messages.map((message, index) => {
      const dateHeading = formatDateHeading(messageTimestamp(message.data));
      const previousMessage = messages[index - 1];
      const previousDate = previousMessage ? formatDateHeading(messageTimestamp(previousMessage.data)) : '';
      const showDate = dateHeading !== previousDate;
      return { message, dateHeading, showDate };
    });
  }, [messages]);

  if (messages.length === 0) return <EmptyState title="No messages found" />;

  return (
    <div className="mt-5 space-y-4">
      {rows.map(({ message, dateHeading, showDate }) => {
        const senderId = messageSenderId(message.data);
        return (
          <div key={message.id}>
            {showDate && (
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="rounded-full border border-line bg-ivory px-3 py-1 text-xs font-semibold text-muted">{dateHeading}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <ConversationBubble
              message={message}
              sender={participants[senderId]}
              senderId={senderId}
              alignRight={participantUids.indexOf(senderId) > 0}
            />
          </div>
        );
      })}
    </div>
  );
}

function ConversationBubble({
  message,
  sender,
  senderId,
  alignRight,
}: {
  message: AdminDoc;
  sender?: ParticipantInfo;
  senderId: string;
  alignRight: boolean;
}) {
  const readBy = readByList(message.data);
  return (
    <div className={`flex ${alignRight ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[46rem] ${alignRight ? 'items-end' : 'items-start'} flex flex-col`}>
        <p className="mb-1 text-xs font-semibold text-muted">
          {sender?.displayName ?? shortId(senderId || 'unknown')} · {formatTime(messageTimestamp(message.data))}
        </p>
        <div className={`rounded-2xl px-4 py-3 shadow-soft ${alignRight ? 'bg-maroon text-cream' : 'border border-line bg-ivory text-ink'}`}>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{messageText(message.data)}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {isMessageDeleted(message.data) && <StatusPill tone="danger">Deleted</StatusPill>}
          {hasReadMetadata(message.data) && <StatusPill>Read by {readBy.length}</StatusPill>}
          <CopyButton value={message.id} label="Copy message ID" />
        </div>
        <details className="mt-2 w-full rounded-xl border border-line bg-cream p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted">Technical details</summary>
          <div className="mt-3 grid gap-2 text-xs text-ink/80 sm:grid-cols-2">
            <p><span className="font-semibold text-muted">Sender UID:</span> <span className="font-mono">{senderId || 'none'}</span></p>
            <p><span className="font-semibold text-muted">Message ID:</span> <span className="font-mono">{message.id}</span></p>
            <p><span className="font-semibold text-muted">Deleted:</span> {String(isMessageDeleted(message.data))}</p>
            <p><span className="font-semibold text-muted">Read by:</span> {readBy.length ? readBy.join(', ') : 'No read metadata'}</p>
          </div>
          <RawJson data={message.data} />
        </details>
      </div>
    </div>
  );
}

function ContextPanel({
  conversation,
  participants,
  participantUids,
}: {
  conversation: AdminDoc;
  participants: Record<string, ParticipantInfo>;
  participantUids: string[];
}) {
  return (
    <aside className="space-y-4">
      <DataCard className="p-5">
        <h3 className="font-serif text-xl font-semibold text-charcoal">Context panel</h3>
        <div className="mt-4 space-y-3">
          {participantUids.map((uid) => (
            <ParticipantCard key={uid} uid={uid} participant={participants[uid]} />
          ))}
        </div>
      </DataCard>

      <DataCard className="p-5">
        <h3 className="font-serif text-xl font-semibold text-charcoal">Admin actions</h3>
        <div className="mt-4 flex flex-col gap-2">
          <CopyButton value={conversation.id} label="Copy conversation ID" />
          {participantUids.map((uid) => <CopyButton key={uid} value={uid} label={`Copy ${shortId(uid)} UID`} />)}
        </div>
        <RawJson data={conversation.data} label="Technical details" />
      </DataCard>
    </aside>
  );
}

function ParticipantCard({ uid, participant }: { uid: string; participant?: ParticipantInfo }) {
  return (
    <div className="rounded-2xl border border-line bg-ivory p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-maroon text-sm font-semibold text-cream">
          {participant?.initials ?? shortId(uid, 2, 0)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-charcoal">{participant?.displayName ?? shortId(uid)}</p>
          <p className="mt-1 break-words text-xs text-muted">{participant?.email ?? 'No email found'}</p>
          <p className="mt-1 text-xs text-muted">UID {shortId(uid)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone={participant?.profileExists ? 'good' : 'warn'}>
          {participant?.profileExists ? 'Profile found' : 'No profile'}
        </StatusPill>
        <StatusPill>{participant?.moderationStatus ?? 'No moderation status'}</StatusPill>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton value={uid} label="Copy UID" />
        <AdminLink href={`/admin/users?search=${encodeURIComponent(uid)}`}>User record</AdminLink>
        <AdminLink href={`/admin/profiles?search=${encodeURIComponent(uid)}`}>Profile</AdminLink>
      </div>
    </div>
  );
}
