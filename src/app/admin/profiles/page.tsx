'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminLink,
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
  deleteProfileDoc,
  fetchCollectionDocs,
  formatValue,
  getArray,
  getString,
  matchesSearch,
  setProfileModerationStatus,
  type AdminDoc,
  type AdminRecord,
} from '@/lib/admin';

type Filter = 'all' | 'completed' | 'incomplete' | 'hidden' | 'under_review';

export default function AdminProfilesPage() {
  return (
    <AdminShell permission="viewProfiles">
      {(admin) => <Profiles admin={admin} />}
    </AdminShell>
  );
}

function Profiles({ admin }: { admin: AdminRecord }) {
  const params = useSearchParams();
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchCollectionDocs('profiles', 50, ['updatedAt', 'createdAt']).then(setDocs).catch((err) => setError(err instanceof Error ? err.message : 'Profiles failed to load.'));
  }, []);

  const filtered = useMemo(() => {
    return docs.filter((doc) => {
      const completed = Boolean(doc.data.completed || doc.data.isComplete || doc.data.profileCompleted);
      const hidden = doc.data.moderationStatus === 'hidden' || doc.data.isVisible === false;
      const underReview = doc.data.moderationStatus === 'under_review';
      const filterOk =
        filter === 'all' ||
        (filter === 'completed' && completed) ||
        (filter === 'incomplete' && !completed) ||
        (filter === 'hidden' && hidden) ||
        (filter === 'under_review' && underReview);
      return filterOk && matchesSearch(doc, search, ['name', 'city', 'state', 'profession', 'education']);
    });
  }, [docs, filter, search]);

  async function runAction(profile: AdminDoc, action: 'hide' | 'unhide' | 'review' | 'delete') {
    const reason = window.prompt('Reason for this admin action');
    if (!reason) return;
    if (action === 'delete' && !window.confirm('Delete this profile document only? Auth user and Storage photos will not be deleted.')) return;
    setBusy(`${profile.id}:${action}`);
    try {
      if (action === 'delete') await deleteProfileDoc(admin, profile, reason);
      else await setProfileModerationStatus(admin, profile, action === 'hide' ? 'hidden' : action === 'unhide' ? 'visible' : 'under_review', reason);
      setDocs((current) => current.filter((doc) => action !== 'delete' || doc.id !== profile.id));
      if (action !== 'delete') {
        setDocs((current) =>
          current.map((doc) =>
            doc.id === profile.id
              ? {
                  ...doc,
                  data: {
                    ...doc.data,
                    moderationStatus: action === 'hide' ? 'hidden' : action === 'unhide' ? 'visible' : 'under_review',
                    ...(action === 'hide' ? { isVisible: false } : action === 'unhide' ? { isVisible: true } : {}),
                  },
                }
              : doc,
          ),
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Admin action failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminPageHeader title="Profiles" eyebrow="Profile moderation">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, UID, location, profession" />
      </AdminPageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'completed', 'incomplete', 'hidden', 'under_review'] as Filter[]).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item ? 'bg-maroon text-cream' : 'border border-line bg-cream text-muted'}`}
          >
            {item.replace('_', ' ')}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} /> : filtered.length === 0 ? <EmptyState title="No profiles found" /> : (
        <div className="grid gap-4">
          {filtered.map((profile) => {
            const photos = getArray(profile.data, 'photos');
            const hidden = profile.data.moderationStatus === 'hidden' || profile.data.isVisible === false;
            const underReview = profile.data.moderationStatus === 'under_review';
            return (
              <DataCard key={profile.id} className="p-4">
                <div className="grid gap-4 lg:grid-cols-[120px_1fr_auto]">
                  <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-line bg-ivory">
                    {photos[0] ? <Image src={photos[0]} alt="" fill className="object-cover" sizes="128px" /> : <div className="flex h-full items-center justify-center text-xs text-muted">No photo</div>}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-xl font-semibold text-charcoal">{getString(profile.data, ['name', 'fullName']) || profile.id}</h3>
                      {hidden && <StatusPill tone="danger">Hidden</StatusPill>}
                      {underReview && <StatusPill tone="warn">Under review</StatusPill>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{profile.id}</p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <p><span className="text-muted">Location:</span> {formatValue(profile.data.city || profile.data.location)}</p>
                      <p><span className="text-muted">Profession:</span> {formatValue(profile.data.profession)}</p>
                      <p><span className="text-muted">Education:</span> {formatValue(profile.data.education)}</p>
                      <p><span className="text-muted">Completion:</span> {formatValue(profile.data.profileCompletion || profile.data.completionScore || profile.data.completed)}</p>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/75">{formatValue(profile.data.bio || profile.data.about)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <CopyButton value={profile.id} label="Copy UID" />
                      <AdminLink href={`/admin/users?search=${encodeURIComponent(profile.id)}`}>User</AdminLink>
                      <AdminLink href={`/admin/conversations?search=${encodeURIComponent(profile.id)}`}>Conversations</AdminLink>
                    </div>
                    <RawJson data={profile.data} />
                  </div>
                  <div className="flex flex-col gap-2 lg:min-w-44">
                    <button disabled={busy === `${profile.id}:hide`} onClick={() => runAction(profile, 'hide')} className="admin-secondary">Hide profile</button>
                    <button disabled={busy === `${profile.id}:unhide`} onClick={() => runAction(profile, 'unhide')} className="admin-secondary">Unhide profile</button>
                    <button disabled={busy === `${profile.id}:review`} onClick={() => runAction(profile, 'review')} className="admin-secondary">Mark under review</button>
                    <button disabled={busy === `${profile.id}:delete`} onClick={() => runAction(profile, 'delete')} className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Delete profile doc</button>
                  </div>
                </div>
              </DataCard>
            );
          })}
        </div>
      )}
    </>
  );
}
