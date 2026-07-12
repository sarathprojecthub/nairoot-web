'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminPageHeader, DataCard, ErrorState, StatCard } from '@/components/admin/AdminPrimitives';
import { fetchDashboardMetrics, type DashboardMetrics } from '@/lib/admin';

const links = [
  ['Users', '/admin/users'],
  ['Profiles', '/admin/profiles'],
  ['Introductions', '/admin/introductions'],
  ['Conversations', '/admin/conversations'],
  ['Messages', '/admin/messages'],
  ['Waitlist', '/admin/waitlist'],
  ['Reports', '/admin/reports'],
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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardMetrics().then(setMetrics).catch((err) => setError(err instanceof Error ? err.message : 'Dashboard failed to load.'));
  }, []);

  if (error) return <ErrorState message={error} />;

  return (
    <>
      <AdminPageHeader title="Dashboard" eyebrow="Overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={metrics?.users ?? null} />
        <StatCard label="Total profiles" value={metrics?.profiles ?? null} />
        <StatCard label="Completed profiles" value={metrics?.completedProfiles ?? null} note="Calculated from recent profile docs" />
        <StatCard label="Hidden profiles" value={metrics?.hiddenProfiles ?? null} note="Recent profile docs" />
        <StatCard label="Under review profiles" value={metrics?.underReviewProfiles ?? null} note="Recent profile docs" />
        <StatCard label="Introductions" value={metrics?.introductions ?? null} />
        <StatCard label="Conversations" value={metrics?.conversations ?? null} />
        <StatCard label="Messages" value={metrics?.messages ?? null} note="Collection group count when rules/indexes allow" />
        <StatCard label="Premium waitlist" value={metrics?.waitlist ?? null} />
        <StatCard label="Reports" value={metrics?.reports ?? null} />
      </div>

      <DataCard className="mt-6 p-5">
        <h3 className="font-serif text-xl font-semibold text-charcoal">Quick links</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {links.map(([label, href]) => (
            <Link key={href} href={href} className="rounded-xl border border-line bg-ivory px-4 py-3 text-sm font-semibold text-maroon hover:border-gold">
              {label}
            </Link>
          ))}
        </div>
      </DataCard>
    </>
  );
}
