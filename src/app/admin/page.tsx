'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPageHeader, DataCard, EmptyState, ErrorState, StatCard, StatusPill } from '@/components/admin/AdminPrimitives';
import {
  fetchCollectionDocs,
  fetchDashboardMetrics,
  fetchDocument,
  formatDate,
  resolveAdminSearch,
  shortId,
  type AdminDoc,
  type AdminSearchResult,
  type DashboardMetrics,
} from '@/lib/admin';

const shortcuts = [
  ['User 360 Search', '/admin/users'],
  ['Profiles', '/admin/profiles'],
  ['Conversations', '/admin/conversations'],
  ['Recent Messages', '/admin/messages'],
  ['Reports', '/admin/reports'],
  ['Premium Waitlist', '/admin/waitlist'],
  ['Audit Logs', '/admin/audit'],
] as const;

export default function AdminDashboardPage() {
  return (
    <AdminShell permission="viewDashboard">
      {() => <Dashboard />}
    </AdminShell>
  );
}

function Dashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardMetrics().then(setMetrics).catch((err) => setError(err instanceof Error ? err.message : 'Dashboard failed to load.'));
    fetchCollectionDocs('adminAuditLogs', 8, ['createdAt']).then(setAuditLogs).catch(() => setAuditLogs([]));
  }, []);

  async function runSearch(event?: React.FormEvent) {
    event?.preventDefault();
    const term = search.trim();
    if (!term) {
      setSearchError('Enter a UID, profile ID, email, name, or conversation ID to search.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const [found, conversation] = await Promise.all([
        resolveAdminSearch(term).catch(() => []),
        fetchDocument('conversations', term).catch(() => null),
      ]);
      setResults(found);
      if (conversation) router.push(`/admin/conversations/${encodeURIComponent(term)}`);
      else router.push(`/admin/users/${encodeURIComponent(term)}`);
    } finally {
      setSearching(false);
    }
  }

  if (error) return <ErrorState message={error} />;

  return (
    <>
      <AdminPageHeader
        title="Founder Operations"
        eyebrow="The Nair Root"
        subtitle="A calm command center for member support, trust & safety, profile operations, and premium beta review."
      />

      <DataCard className="border-gold/30 bg-maroon-deep p-6 text-cream">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Member Mirror search</p>
        <h3 className="mt-2 font-serif text-3xl font-semibold">Find a member, profile, or conversation</h3>
        <form onSubmit={runSearch} className="mt-5 flex flex-col gap-3 lg:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search UID, matrimony ID, email, name, phone, conversation ID"
            className="min-h-12 flex-1 rounded-2xl border border-cream/20 bg-cream px-4 text-sm text-charcoal outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          <button type="submit" disabled={searching || !search.trim()} className="admin-primary bg-gold text-maroon hover:bg-gold/90 disabled:opacity-60">
            {searching ? 'Searching...' : 'Open Member Mirror'}
          </button>
        </form>
        <p className="mt-3 text-sm text-cream/75">Search by UID, email, name, profile ID, conversation ID, or matrimony ID if available.</p>
        {searchError && (
          <p className="mt-3 rounded-2xl border border-cream/15 bg-cream/10 px-4 py-3 text-sm text-cream">
            {searchError}
          </p>
        )}
        {results.length > 1 && (
          <div className="mt-5 grid gap-3">
            {results.map((result) => (
              <Link key={`${result.type}:${result.id}`} href={result.href} className="rounded-2xl border border-cream/15 bg-cream/10 p-4 hover:border-gold">
                <p className="font-semibold text-cream">{result.title}</p>
                <p className="mt-1 text-sm text-cream/70">{result.subtitle}</p>
              </Link>
            ))}
          </div>
        )}
        {search && !searching && results.length === 0 && !searchError && (
          <p className="mt-4 rounded-2xl border border-cream/15 bg-cream/10 px-4 py-3 text-sm text-cream/80">
            No preview match loaded yet. You can still open Member Mirror for this UID / Profile ID.
          </p>
        )}
      </DataCard>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total profiles" value={metrics?.profiles ?? null} />
        <StatCard label="Visible profiles" value={metrics?.visibleProfiles ?? null} note="Recent loaded profile count" />
        <StatCard label="Hidden profiles" value={metrics?.hiddenProfiles ?? null} note="Recent loaded profile count" />
        <StatCard label="Under review" value={metrics?.underReviewProfiles ?? null} note="Recent loaded profile count" />
        <StatCard label="Total users" value={metrics?.users ?? null} />
        <StatCard label="Introductions sent" value={metrics?.introductions ?? null} />
        <StatCard label="Accepted introductions" value={metrics?.acceptedIntroductions ?? null} note="Recent loaded introduction count" />
        <StatCard label="Conversations" value={metrics?.conversations ?? null} />
        <StatCard label="Recent messages" value={metrics?.messages ?? null} note="Collection group count when available" />
        <StatCard label="Premium waitlist" value={metrics?.waitlist ?? null} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_24rem]">
        <DataCard className="p-5">
          <h3 className="font-serif text-xl font-semibold text-charcoal">Operational shortcuts</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortcuts.map(([label, href]) => (
              <Link key={href} href={href} className="rounded-2xl border border-line bg-ivory px-4 py-4 text-sm font-semibold text-maroon hover:border-gold">
                {label}
              </Link>
            ))}
          </div>
        </DataCard>

        <DataCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl font-semibold text-charcoal">Recent activity</h3>
            <Link href="/admin/audit" className="text-sm font-semibold text-maroon hover:underline">Audit logs</Link>
          </div>
          <div className="mt-4 space-y-3">
            {auditLogs.length === 0 ? (
              <EmptyState title="No recent audit logs" />
            ) : auditLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-line bg-ivory p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill>{String(log.data.action ?? 'Admin action')}</StatusPill>
                  <span className="text-xs text-muted">{formatDate(log.data.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-charcoal">{String(log.data.reason ?? 'No reason recorded')}</p>
                <p className="mt-1 font-mono text-xs text-muted">{shortId(String(log.data.targetUid ?? log.data.conversationId ?? log.id))}</p>
              </div>
            ))}
          </div>
        </DataCard>
      </div>
    </>
  );
}
