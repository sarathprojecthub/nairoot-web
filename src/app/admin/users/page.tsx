'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminPageHeader,
  CopyButton,
  DataCard,
  EmptyState,
  ErrorState,
  SearchBox,
  StatusPill,
} from '@/components/admin/AdminPrimitives';
import {
  fetchAdminDirectory,
  type AdminDirectoryClientResult,
  type AdminDirectoryRecord,
  type DirectoryFilter,
} from '@/lib/adminDirectoryClient';
import { formatDate, initialsFor, shortId } from '@/lib/admin';

type SearchMode = 'uid' | 'email' | 'phone';

const FILTERS: Array<{ id: DirectoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hasProfile', label: 'Has profile' },
  { id: 'noProfile', label: 'No profile' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'underReview', label: 'Under review' },
  { id: 'test', label: 'Test profiles' },
  { id: 'userDocMissing', label: 'User doc missing' },
  { id: 'authMissing', label: 'Auth missing' },
];

export default function AdminUsersPage() {
  return (
    <AdminShell permission="viewUsers">
      {() => <UsersDirectory />}
    </AdminShell>
  );
}

function UsersDirectory() {
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [searchMode, setSearchMode] = useState<SearchMode>('uid');
  const [searchValue, setSearchValue] = useState('');
  const [directory, setDirectory] = useState<AdminDirectoryClientResult | { kind: 'loading' }>({ kind: 'loading' });
  const [pageToken, setPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const activeQuery = useMemo(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) return { uid: '', email: '', phone: '' };
    return {
      uid: searchMode === 'uid' ? trimmed : '',
      email: searchMode === 'email' ? trimmed : '',
      phone: searchMode === 'phone' ? trimmed : '',
    };
  }, [searchMode, searchValue]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function load() {
      if (authLoading) {
        return;
      }

      if (!user) {
        setDirectory({ kind: 'unauthorized', message: 'Authentication required.' });
        return;
      }

      setDirectory({ kind: 'loading' });
      setPageToken(null);

      try {
        const result = await fetchAdminDirectory({
          filter,
          pageSize: 25,
          uid: activeQuery.uid || undefined,
          email: activeQuery.email || undefined,
          phone: activeQuery.phone || undefined,
        },
          controller.signal,
        );
        if (!alive) return;
        setDirectory(result);
        if (result.kind === 'success') setPageToken(result.data.nextPageToken);
      } catch (error) {
        if (!alive || controller.signal.aborted) return;
        setDirectory({ kind: 'error', message: error instanceof Error ? error.message : 'Unable to load admin directory.' });
      }
    }

    void load();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [activeQuery.email, activeQuery.phone, activeQuery.uid, authLoading, filter, user]);

  async function loadMore() {
    if (authLoading || !user || !pageToken || directory.kind !== 'success') return;
    setLoadingMore(true);
    try {
      const result = await fetchAdminDirectory({
        filter,
        pageSize: directory.data.pageSize,
        pageToken,
      });
      if (result.kind === 'success') {
        setDirectory({
          kind: 'success',
          data: {
            ...result.data,
            records: [...directory.data.records, ...result.data.records],
            anomalies: directory.data.anomalies,
          },
        });
        setPageToken(result.data.nextPageToken);
      } else {
        setDirectory(result);
      }
    } catch (error) {
      setDirectory({ kind: 'error', message: error instanceof Error ? error.message : 'Unable to load more accounts.' });
    } finally {
      setLoadingMore(false);
    }
  }

  const exactSearchHint = searchMode === 'uid'
    ? 'Exact UID lookup'
    : searchMode === 'email'
      ? 'Exact email lookup (PII-gated)'
      : 'Exact phone lookup (PII-gated)';

  return (
    <>
      <AdminPageHeader
        title="Registered account directory"
        eyebrow="User 360"
        subtitle="Firebase Authentication is the primary account source. Firestore user and profile documents are joined where available, and anomalies are surfaced explicitly."
      >
        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2">
            {(['uid', 'email', 'phone'] as SearchMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSearchMode(mode)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${searchMode === mode ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted hover:border-gold'}`}
              >
                {mode === 'uid' ? 'UID' : mode === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-96">
            <SearchBox value={searchValue} onChange={setSearchValue} placeholder={exactSearchHint} />
          </div>
        </div>
      </AdminPageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item.id ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted hover:border-gold'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="mb-5 text-sm text-muted">
        Search is exact-only in Phase 3. Email and phone lookups remain server-side and require <span className="font-semibold text-charcoal">viewAccountPII</span>.
      </p>

      <DirectoryContent
        directory={directory}
        onLoadMore={loadMore}
        loadingMore={loadingMore}
        pageToken={pageToken}
      />
    </>
  );
}

function DirectoryContent({
  directory,
  onLoadMore,
  loadingMore,
  pageToken,
}: {
  directory: AdminDirectoryClientResult | { kind: 'loading' };
  onLoadMore: () => void;
  loadingMore: boolean;
  pageToken: string | null;
}) {
  if (directory.kind === 'loading') {
    return <EmptyState title="Loading registered accounts" body="Listing Firebase Auth accounts and joining Firestore user/profile records." />;
  }

  if (directory.kind === 'unauthorized') {
    return <ErrorState message={directory.message} />;
  }

  if (directory.kind === 'forbidden') {
    return <EmptyState title="Restricted" body={directory.message} />;
  }

  if (directory.kind === 'config-error' || directory.kind === 'error') {
    return <ErrorState message={directory.message} />;
  }

  const { records, anomalies, piiAuthorized } = directory.data;

  return (
    <div className="space-y-6">
      {!piiAuthorized && (
        <DataCard className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Email and phone are restricted in this directory because the signed-in admin does not have <span className="font-semibold">viewAccountPII</span>.
          </p>
        </DataCard>
      )}

      {records.length === 0 ? (
        <EmptyState title="No registered accounts found" body="Try a different exact lookup or filter." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {records.map((record) => <AccountCard key={`record:${record.uid}`} record={record} anomaly={false} />)}
        </div>
      )}

      {pageToken && records.length > 0 && (
        <div className="flex justify-center">
          <button type="button" onClick={onLoadMore} disabled={loadingMore} className="admin-primary">
            {loadingMore ? 'Loading more…' : 'Load more'}
          </button>
        </div>
      )}

      {anomalies.length > 0 && (
        <DataCard className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-charcoal">Integrity anomalies</h3>
              <p className="mt-1 text-sm text-muted">These records need human review. Nothing is auto-repaired in Phase 3.</p>
            </div>
            <StatusPill tone="warn">{anomalies.length} surfaced</StatusPill>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {anomalies.map((record) => <AccountCard key={`anomaly:${record.uid}`} record={record} anomaly />)}
          </div>
        </DataCard>
      )}
    </div>
  );
}

function AccountCard({ record, anomaly }: { record: AdminDirectoryRecord; anomaly: boolean }) {
  const primaryBadgeTone = anomaly ? 'warn' : record.profileExists ? 'good' : 'warn';
  const identityLine = [record.gender, record.age ? String(record.age) : null].filter(Boolean).join(' · ') || 'Details not available';
  const location = [record.city, record.state].filter(Boolean).join(', ') || 'Location not available';

  return (
    <DataCard className={`p-5 ${anomaly ? 'border-amber-200 bg-amber-50/40' : ''}`}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-maroon text-sm font-semibold text-cream">
          {initialsFor(record.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-semibold text-charcoal">{record.displayName}</h3>
            <StatusPill tone={primaryBadgeTone}>{record.profileExists ? 'Has profile' : 'No profile'}</StatusPill>
            {record.badges.filter((badge) => badge !== 'Has profile' && badge !== 'No profile').map((badge) => (
              <StatusBadge key={badge} badge={badge} />
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">{record.email ?? record.phone ?? 'Identity information restricted or unavailable'}</p>
          <p className="mt-1 font-mono text-xs text-muted">UID {shortId(record.uid)}</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted">Identity:</span> {identityLine}</p>
            <p><span className="text-muted">Location:</span> {location}</p>
            <p><span className="text-muted">Onboarded:</span> {record.isOnboarded == null ? 'Unknown' : record.isOnboarded ? 'Yes' : 'No'}</p>
            <p><span className="text-muted">Created:</span> {record.createdAt ? formatDate(record.createdAt) : 'Not available'}</p>
            <p><span className="text-muted">Visibility:</span> {record.isVisible == null ? 'Not available' : record.isVisible ? 'Visible' : 'Hidden'}</p>
            <p><span className="text-muted">Moderation:</span> {record.moderationStatus ?? 'Not available'}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/users/${record.uid}`} className="admin-primary">Open member detail</Link>
            <CopyButton value={record.uid} label="Copy UID" />
          </div>
        </div>
      </div>
    </DataCard>
  );
}

function StatusBadge({ badge }: { badge: string }) {
  if (badge === 'Hidden') return <StatusPill tone="danger">{badge}</StatusPill>;
  if (badge === 'Under review' || badge === 'User document missing' || badge === 'Profile-only record') {
    return <StatusPill tone="warn">{badge}</StatusPill>;
  }
  if (badge === 'Auth account missing') return <StatusPill tone="danger">{badge}</StatusPill>;
  return <StatusPill>{badge}</StatusPill>;
}
