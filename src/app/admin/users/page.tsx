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

export default function AdminUsersPage() {
  return (
    <AdminShell permission="viewUsers">
      {() => <Users />}
    </AdminShell>
  );
}

function Users() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const filtered = useFilteredDocs(docs, search, ['email', 'phone', 'phoneNumber', 'displayName', 'name']);

  useEffect(() => {
    fetchCollectionDocs('users', 50, ['updatedAt', 'createdAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Users failed to load.'));
  }, []);

  return (
    <>
      <AdminPageHeader title="Users" eyebrow="Identity and onboarding">
        <SearchBox value={search} onChange={setSearch} placeholder="Search UID, email, phone, name" />
      </AdminPageHeader>
      {error ? (
        <ErrorState message={error} />
      ) : (
        <AdminTable
          docs={filtered}
          empty="No users found"
          columns={[
            {
              label: 'User',
              render: (doc) => (
                <div>
                  <p className="font-semibold text-charcoal">{formatValue(doc.data.email || doc.data.displayName || doc.id)}</p>
                  <p className="mt-1 break-all text-xs text-muted">{doc.id}</p>
                  <div className="mt-2"><CopyButton value={doc.id} label="Copy UID" /></div>
                </div>
              ),
            },
            { label: 'Phone', render: (doc) => formatValue(doc.data.phone || doc.data.phoneNumber) },
            { label: 'Onboarding', render: (doc) => formatValue(doc.data.isOnboarded ?? doc.data.onboardingComplete ?? doc.data.onboardingStatus) },
            { label: 'Created', render: (doc) => formatDate(doc.data.createdAt) },
            { label: 'Updated', render: (doc) => formatDate(doc.data.updatedAt) },
            {
              label: 'Links',
              render: (doc) => (
                <div className="space-y-2">
                  <AdminLink href={`/admin/profiles?search=${encodeURIComponent(doc.id)}`}>Profile</AdminLink>
                  <br />
                  <AdminLink href={`/admin/conversations?search=${encodeURIComponent(doc.id)}`}>Conversations</AdminLink>
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
