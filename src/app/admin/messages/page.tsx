'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminLink,
  AdminPageHeader,
  AdminTable,
  CopyButton,
  ErrorState,
  RawJson,
  SearchBox,
} from '@/components/admin/AdminPrimitives';
import { fetchRecentMessages, formatDate, formatValue, type AdminMessage } from '@/lib/admin';

export default function AdminMessagesPage() {
  return (
    <AdminShell permission="viewMessages">
      {() => <Messages />}
    </AdminShell>
  );
}

function Messages() {
  const [docs, setDocs] = useState<AdminMessage[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentMessages().then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Messages failed to load.'));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      doc.id.toLowerCase().includes(q) ||
      doc.conversationId.toLowerCase().includes(q) ||
      formatValue(doc.data.senderId || doc.data.senderUid).toLowerCase().includes(q) ||
      formatValue(doc.data.text || doc.data.body || doc.data.message).toLowerCase().includes(q)
    );
  }, [docs, search]);

  return (
    <>
      <AdminPageHeader title="All Messages" eyebrow="Recent global message access">
        <SearchBox value={search} onChange={setSearch} placeholder="Search sender UID, conversation ID, text" />
      </AdminPageHeader>
      <p className="mb-4 rounded-2xl border border-gold/30 bg-cream px-4 py-3 text-sm text-muted">
        This page reads recent messages with a Firestore collection group when available. Every full conversation timeline is accessible through conversation detail with audit logging.
      </p>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No messages found"
          columns={[
            { label: 'Conversation', render: (doc) => <AdminLink href={`/admin/conversations/${(doc as AdminMessage).conversationId}`}>{(doc as AdminMessage).conversationId}</AdminLink> },
            { label: 'Sender', render: (doc) => <span className="break-all text-xs">{formatValue(doc.data.senderId || doc.data.senderUid || doc.data.from)}</span> },
            { label: 'Message', render: (doc) => <p className="max-w-md whitespace-pre-wrap">{formatValue(doc.data.text || doc.data.body || doc.data.message)}</p> },
            { label: 'Timestamp', render: (doc) => formatDate(doc.data.createdAt || doc.data.sentAt) },
            { label: 'Flags', render: (doc) => `Deleted: ${formatValue(doc.data.deleted)} · Read: ${formatValue(doc.data.readBy)}` },
            {
              label: 'Debug',
              render: (doc) => (
                <div>
                  <CopyButton value={(doc as AdminMessage).conversationId} label="Copy conversation ID" />
                  <RawJson data={doc.data} />
                </div>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
