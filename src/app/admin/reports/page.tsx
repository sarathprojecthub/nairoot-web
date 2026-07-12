'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminLink,
  AdminPageHeader,
  AdminTable,
  ErrorState,
  RawJson,
  SearchBox,
  useFilteredDocs,
} from '@/components/admin/AdminPrimitives';
import { fetchCollectionDocs, formatDate, formatValue, type AdminDoc } from '@/lib/admin';

export default function AdminReportsPage() {
  return (
    <AdminShell permission="viewReports">
      {() => <Reports />}
    </AdminShell>
  );
}

function Reports() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const filtered = useFilteredDocs(docs, search, ['reporterUid', 'reporterId', 'targetUid', 'targetId', 'conversationId', 'messageId', 'reason', 'status']);

  useEffect(() => {
    fetchCollectionDocs('reports', 50, ['createdAt', 'updatedAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Reports collection not found or not readable yet.'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Reports" eyebrow="Trust and safety queue">
        <SearchBox value={search} onChange={setSearch} placeholder="Search reporter, target, reason, status" />
      </AdminPageHeader>
      {error ? (
        <ErrorState message={`${error} If the reports collection is not implemented yet, this page is ready and will populate once reports exist.`} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No report documents found"
          columns={[
            { label: 'Reporter', render: (doc) => formatValue(doc.data.reporterUid || doc.data.reporterId) },
            { label: 'Target', render: (doc) => formatValue(doc.data.targetUid || doc.data.targetId || doc.data.profileId || doc.data.messageId) },
            { label: 'Reason', render: (doc) => formatValue(doc.data.reason || doc.data.category) },
            { label: 'Status', render: (doc) => formatValue(doc.data.status) },
            { label: 'Created', render: (doc) => formatDate(doc.data.createdAt) },
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
