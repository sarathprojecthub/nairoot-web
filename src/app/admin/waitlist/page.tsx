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

export default function AdminWaitlistPage() {
  return (
    <AdminShell permission="viewWaitlist">
      {() => <Waitlist />}
    </AdminShell>
  );
}

function Waitlist() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const filtered = useFilteredDocs(docs, search, ['userId', 'uid', 'email', 'status', 'source']);

  useEffect(() => {
    fetchCollectionDocs('premiumWaitlist', 50, ['updatedAt', 'createdAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Waitlist failed to load.'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Premium Waitlist" eyebrow="Coming soon only">
        <SearchBox value={search} onChange={setSearch} placeholder="Search user ID, email, status, source" />
      </AdminPageHeader>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No waitlist entries found"
          columns={[
            {
              label: 'User',
              render: (doc) => {
                const uid = String(doc.data.userId || doc.data.uid || doc.id);
                return (
                  <div>
                    <p className="break-all font-semibold text-charcoal">{uid}</p>
                    <p className="text-sm text-muted">{formatValue(doc.data.email)}</p>
                    <CopyButton value={uid} label="Copy UID" />
                  </div>
                );
              },
            },
            { label: 'Status', render: (doc) => formatValue(doc.data.status) },
            { label: 'Source', render: (doc) => formatValue(doc.data.source) },
            { label: 'Created', render: (doc) => formatDate(doc.data.createdAt) },
            { label: 'Updated', render: (doc) => formatDate(doc.data.updatedAt) },
            {
              label: 'Links',
              render: (doc) => {
                const uid = String(doc.data.userId || doc.data.uid || doc.id);
                return (
                  <div>
                    <AdminLink href={`/admin/users?search=${encodeURIComponent(uid)}`}>User</AdminLink>
                    <RawJson data={doc.data} />
                  </div>
                );
              },
            },
          ]}
        />
      )}
    </>
  );
}
