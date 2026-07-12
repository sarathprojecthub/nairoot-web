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

export default function AdminAuditPage() {
  return (
    <AdminShell permission="writeAuditLogs">
      {() => <Audit />}
    </AdminShell>
  );
}

function Audit() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const filtered = useFilteredDocs(docs, search, ['adminUid', 'adminEmail', 'action', 'targetUid', 'conversationId', 'reason']);

  useEffect(() => {
    fetchCollectionDocs('adminAuditLogs', 100, ['createdAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Audit logs failed to load.'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Audit Logs" eyebrow="Sensitive access trail">
        <SearchBox value={search} onChange={setSearch} placeholder="Search admin, action, target, conversation, reason" />
      </AdminPageHeader>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No audit logs found"
          columns={[
            { label: 'Created', render: (doc) => formatDate(doc.data.createdAt) },
            { label: 'Admin', render: (doc) => <span className="break-all text-xs">{formatValue(doc.data.adminEmail || doc.data.adminUid)}</span> },
            { label: 'Action', render: (doc) => <span className="font-semibold text-maroon">{formatValue(doc.data.action)}</span> },
            { label: 'Reason', render: (doc) => formatValue(doc.data.reason) },
            {
              label: 'Target',
              render: (doc) => (
                <div>
                  <p className="break-all text-xs">{formatValue(doc.data.targetUid || doc.data.conversationId)}</p>
                  {typeof doc.data.conversationId === 'string' && <AdminLink href={`/admin/conversations/${doc.data.conversationId}`}>Open conversation</AdminLink>}
                </div>
              ),
            },
            { label: 'Raw', render: (doc) => <RawJson data={doc.data} /> },
          ]}
        />
      )}
    </>
  );
}
