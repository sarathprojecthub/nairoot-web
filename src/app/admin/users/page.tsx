'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminPageHeader,
  CopyButton,
  DataCard,
  EmptyState,
  ErrorState,
  RawJson,
  SearchBox,
  StatusPill,
} from '@/components/admin/AdminPrimitives';
import {
  fetchCollectionDocs,
  formatDate,
  formatValue,
  getString,
  initialsFor,
  resolveAdminSearch,
  shortId,
  type AdminDoc,
  type AdminSearchResult,
} from '@/lib/admin';

type Filter = 'all' | 'hasProfile' | 'noProfile' | 'hidden' | 'underReview' | 'test';

export default function AdminUsersPage() {
  return (
    <AdminShell permission="viewUsers">
      {() => <Users />}
    </AdminShell>
  );
}

function Users() {
  const [users, setUsers] = useState<AdminDoc[]>([]);
  const [profiles, setProfiles] = useState<Record<string, AdminDoc>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [userDocs, profileDocs] = await Promise.all([
          fetchCollectionDocs('users', 100, ['updatedAt', 'createdAt']),
          fetchCollectionDocs('profiles', 200, ['updatedAt', 'createdAt']),
        ]);
        if (!alive) return;
        setUsers(userDocs);
        setProfiles(Object.fromEntries(profileDocs.map((profile) => [profile.id, profile])));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Users failed to load.');
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const found = await resolveAdminSearch(search).catch(() => []);
      if (alive) setResults(found);
    }, 350);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      const profile = profiles[user.id];
      const hidden = profile?.data.isVisible === false || profile?.data.moderationStatus === 'hidden';
      const underReview = profile?.data.moderationStatus === 'under_review';
      const isTest = user.data.isTestProfile === true || profile?.data.isTestProfile === true;
      const filterOk =
        filter === 'all' ||
        (filter === 'hasProfile' && Boolean(profile)) ||
        (filter === 'noProfile' && !profile) ||
        (filter === 'hidden' && hidden) ||
        (filter === 'underReview' && underReview) ||
        (filter === 'test' && isTest);
      const haystack = [
        user.id,
        user.data.email,
        user.data.phone,
        user.data.phoneNumber,
        user.data.name,
        user.data.displayName,
        user.data.matrimonyId,
        profile?.data.name,
        profile?.data.fullName,
        profile?.data.city,
        profile?.data.profession,
      ].map(formatValue).join(' ').toLowerCase();
      return filterOk && (!q || haystack.includes(q));
    });
  }, [filter, profiles, search, users]);

  return (
    <>
      <AdminPageHeader
        title="Member Directory"
        eyebrow="User 360"
        subtitle="Find a member by UID, email, name, phone, or matrimony ID if available. Open Member Mirror for the full account view."
      >
        <SearchBox value={search} onChange={setSearch} placeholder="Search UID, email, name, phone, matrimony ID" />
      </AdminPageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ['all', 'All'],
          ['hasProfile', 'Has profile'],
          ['noProfile', 'No profile'],
          ['hidden', 'Hidden'],
          ['underReview', 'Under review'],
          ['test', 'Test profiles'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id as Filter)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === id ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted hover:border-gold'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <DataCard className="mb-5 p-5">
          <h3 className="font-serif text-xl font-semibold text-charcoal">Search matches</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {results.map((result) => (
              <Link key={`${result.type}:${result.id}`} href={result.href} className="rounded-2xl border border-line bg-ivory p-4 hover:border-gold">
                <p className="font-semibold text-charcoal">{result.title}</p>
                <p className="mt-1 text-sm text-muted">{result.subtitle}</p>
              </Link>
            ))}
          </div>
        </DataCard>
      )}

      {error ? <ErrorState message={error} /> : filtered.length === 0 ? <EmptyState title="No members found" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((user) => <MemberCard key={user.id} user={user} profile={profiles[user.id]} />)}
        </div>
      )}
    </>
  );
}

function MemberCard({ user, profile }: { user: AdminDoc; profile?: AdminDoc }) {
  const name = getString(profile?.data ?? {}, ['name', 'fullName', 'displayName']) || getString(user.data, ['name', 'displayName']) || shortId(user.id);
  const hidden = profile?.data.isVisible === false || profile?.data.moderationStatus === 'hidden';
  const underReview = profile?.data.moderationStatus === 'under_review';
  const isTest = user.data.isTestProfile === true || profile?.data.isTestProfile === true;

  return (
    <DataCard className="p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-maroon text-sm font-semibold text-cream">
          {initialsFor(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-semibold text-charcoal">{name}</h3>
            <StatusPill tone={profile ? 'good' : 'warn'}>{profile ? 'Profile exists' : 'No profile'}</StatusPill>
            {hidden && <StatusPill tone="danger">Hidden</StatusPill>}
            {underReview && <StatusPill tone="warn">Under review</StatusPill>}
            {isTest && <StatusPill>Test profile</StatusPill>}
          </div>
          <p className="mt-1 text-sm text-muted">{formatValue(user.data.email || user.data.phone || user.data.phoneNumber)}</p>
          <p className="mt-1 font-mono text-xs text-muted">UID {shortId(user.id)}</p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted">Profile status:</span> {profile ? formatValue(profile.data.moderationStatus ?? profile.data.isVisible) : 'Missing'}</p>
            <p><span className="text-muted">Updated:</span> {formatDate(profile?.data.updatedAt ?? user.data.updatedAt)}</p>
            <p><span className="text-muted">Location:</span> {formatValue(profile?.data.city ?? user.data.city)}</p>
            <p><span className="text-muted">Profession:</span> {formatValue(profile?.data.profession ?? user.data.profession)}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/users/${user.id}`} className="admin-primary">Open Member Mirror</Link>
            <CopyButton value={user.id} label="Copy UID" />
          </div>
          <RawJson data={{ user: user.data, profile: profile?.data ?? null }} label="Technical details" />
        </div>
      </div>
    </DataCard>
  );
}
