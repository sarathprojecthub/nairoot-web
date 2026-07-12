'use client';

import { useSearchParams } from 'next/navigation';
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
import { fetchCollectionDocs, formatDate, formatValue, getArray, type AdminDoc } from '@/lib/admin';

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
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [error, setError] = useState<string | null>(null);
  const filtered = useFilteredDocs(docs, search, ['participants', 'lastMessage', 'status', 'introductionId']);

  useEffect(() => {
    fetchCollectionDocs('conversations', 50, ['updatedAt', 'lastMessageAt', 'createdAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Conversations failed to load.'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Conversations" eyebrow="All conversation records">
        <SearchBox value={search} onChange={setSearch} placeholder="Search conversation ID, participant UID, name, email" />
      </AdminPageHeader>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No conversations found"
          columns={[
            {
              label: 'Conversation',
              render: (doc) => (
                <div>
                  <AdminLink href={`/admin/conversations/${doc.id}`}>{doc.id}</AdminLink>
                  <div className="mt-2"><CopyButton value={doc.id} label="Copy ID" /></div>
                </div>
              ),
            },
            {
              label: 'Participants',
              render: (doc) => (
                <div className="space-y-2">
                  {getArray(doc.data, 'participants').map((uid) => (
                    <div key={uid} className="flex items-center gap-2">
                      <span className="break-all text-xs">{uid}</span>
                      <CopyButton value={uid} label="Copy" />
                    </div>
                  ))}
                </div>
              ),
            },
            { label: 'Last message', render: (doc) => formatValue(doc.data.lastMessage) },
            { label: 'Last activity', render: (doc) => formatDate(doc.data.updatedAt || doc.data.lastMessageAt || doc.data.createdAt) },
            { label: 'Unread', render: (doc) => formatValue(doc.data.unreadCounts) },
            {
              label: 'Inspect',
              render: (doc) => (
                <div>
                  <AdminLink href={`/admin/conversations/${doc.id}`}>Open messages</AdminLink>
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
