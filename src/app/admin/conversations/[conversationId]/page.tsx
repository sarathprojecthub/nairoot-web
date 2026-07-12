'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminLink,
  AdminPageHeader,
  CopyButton,
  DataCard,
  EmptyState,
  ErrorState,
  RawJson,
} from '@/components/admin/AdminPrimitives';
import {
  ACCESS_REASONS,
  fetchConversation,
  fetchConversationMessages,
  fetchDocument,
  formatDate,
  formatValue,
  getArray,
  getString,
  writeAdminAuditLog,
  type AdminDoc,
  type AdminRecord,
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
  const [profiles, setProfiles] = useState<AdminDoc[]>([]);
  const [messages, setMessages] = useState<AdminDoc[]>([]);
  const [reason, setReason] = useState('');
  const [auditReady, setAuditReady] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    fetchConversation(conversationId)
      .then(async (doc) => {
        setConversation(doc);
        if (doc) {
          const participantIds = getArray(doc.data, 'participants');
          void participantIds;
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Conversation failed to load.'));
  }, [conversationId]);

  useEffect(() => {
    async function loadProfiles() {
      if (!conversation) return;
      const ids = getArray(conversation.data, 'participants');
      const docs = await Promise.all(ids.map((uid) => fetchDocument('profiles', uid).catch(() => null)));
      setProfiles(docs.filter((doc): doc is AdminDoc => Boolean(doc)));
    }
    loadProfiles();
  }, [conversation]);

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

  const participantProfiles = new Map(profiles.map((profile) => [profile.id, profile]));

  return (
    <>
      <AdminPageHeader title="Conversation Detail" eyebrow="Sensitive message access">
        <Link href="/admin/conversations" className="admin-secondary">Back to conversations</Link>
      </AdminPageHeader>
      {error ? <ErrorState message={error} /> : !conversation ? <EmptyState title="Loading conversation" /> : (
        <div className="space-y-5">
          <DataCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Conversation ID</p>
                <p className="break-all font-mono text-sm text-charcoal">{conversation.id}</p>
              </div>
              <CopyButton value={conversation.id} label="Copy conversation ID" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {getArray(conversation.data, 'participants').map((uid) => {
                const profile = participantProfiles.get(uid);
                return (
                  <div key={uid} className="rounded-2xl border border-line bg-ivory p-4">
                    <p className="font-semibold text-charcoal">{profile ? getString(profile.data, ['name', 'fullName']) || uid : uid}</p>
                    <p className="mt-1 break-all text-xs text-muted">{uid}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <CopyButton value={uid} label="Copy UID" />
                      <AdminLink href={`/admin/users?search=${encodeURIComponent(uid)}`}>User</AdminLink>
                      <AdminLink href={`/admin/profiles?search=${encodeURIComponent(uid)}`}>Profile</AdminLink>
                    </div>
                  </div>
                );
              })}
            </div>
            <RawJson data={conversation.data} label="Raw conversation JSON" />
          </DataCard>

          {!auditReady && (
            <DataCard className="border-gold/30 p-5">
              <h3 className="font-serif text-xl font-semibold text-charcoal">Reason for access</h3>
              <p className="mt-2 text-sm text-muted">An audit log is required before the message timeline is displayed.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {ACCESS_REASONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => setReason(item)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${reason === item ? 'bg-maroon text-cream' : 'border border-line bg-ivory text-muted'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button disabled={!reason || loadingMessages} onClick={unlockMessages} className="admin-primary mt-5">
                {loadingMessages ? 'Writing audit log...' : 'Write audit log and view messages'}
              </button>
              {auditError && <p className="mt-3 text-sm text-red-700">{auditError}</p>}
            </DataCard>
          )}

          {auditReady && (
            <DataCard className="p-5">
              <h3 className="font-serif text-xl font-semibold text-charcoal">Message timeline</h3>
              <div className="mt-4 space-y-3">
                {messages.length === 0 ? <EmptyState title="No messages found" /> : messages.map((message) => {
                  const senderId = getString(message.data, ['senderId', 'senderUid', 'from']);
                  const senderProfile = senderId ? participantProfiles.get(senderId) : null;
                  return (
                    <div key={message.id} className="rounded-2xl border border-line bg-ivory p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-charcoal">{senderProfile ? getString(senderProfile.data, ['name', 'fullName']) || senderId : senderId || 'Unknown sender'}</p>
                          <p className="mt-1 break-all text-xs text-muted">Sender UID: {senderId || '—'}</p>
                          <p className="mt-1 text-xs text-muted">Message ID: {message.id}</p>
                        </div>
                        <p className="text-xs text-muted">{formatDate(message.data.createdAt || message.data.sentAt)}</p>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-cream p-3 text-sm leading-relaxed text-ink">{formatValue(message.data.text || message.data.body || message.data.message)}</p>
                      <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                        <p>Deleted/hidden: {formatValue(message.data.deleted ?? message.data.hidden)}</p>
                        <p>Read by: {formatValue(message.data.readBy)}</p>
                        <p>Status: {formatValue(message.data.status)}</p>
                      </div>
                      <RawJson data={message.data} label="Raw message JSON" />
                    </div>
                  );
                })}
              </div>
            </DataCard>
          )}
        </div>
      )}
    </>
  );
}
