'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminLink,
  AdminPageHeader,
  AdminTable,
  CopyButton,
  ErrorState,
  RawJson,
  SearchBox,
  useFilteredDocs,
} from '@/components/admin/AdminPrimitives';
import { fetchCollectionDocs, formatDate, formatValue, type AdminDoc } from '@/lib/admin';

export default function AdminIntroductionsPage() {
  return (
    <AdminShell permission="viewConversations">
      {() => <Introductions />}
    </AdminShell>
  );
}

function Introductions() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const filtered = useFilteredDocs(docs, search, ['senderId', 'senderUid', 'recipientId', 'recipientUid', 'status', 'conversationId']);

  useEffect(() => {
    fetchCollectionDocs('introductions', 50, ['sentAt', 'createdAt', 'updatedAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Introductions failed to load.'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Introductions" eyebrow="Connection workflow">
        <SearchBox value={search} onChange={setSearch} placeholder="Search sender, recipient, status, conversation ID" />
      </AdminPageHeader>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No introductions found"
          columns={[
            { label: 'Introduction', render: (doc) => <><p className="break-all text-xs">{doc.id}</p><CopyButton value={doc.id} label="Copy ID" /></> },
            { label: 'Sender', render: (doc) => formatValue(doc.data.senderId || doc.data.senderUid) },
            { label: 'Recipient', render: (doc) => formatValue(doc.data.recipientId || doc.data.recipientUid) },
            { label: 'Status', render: (doc) => <span className="font-semibold text-maroon">{formatValue(doc.data.status)}</span> },
            { label: 'Created/sent', render: (doc) => formatDate(doc.data.sentAt || doc.data.createdAt) },
            {
              label: 'Links',
              render: (doc) => (
                <div className="space-y-2">
                  {typeof doc.data.conversationId === 'string' && <AdminLink href={`/admin/conversations/${doc.data.conversationId}`}>Conversation</AdminLink>}
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
