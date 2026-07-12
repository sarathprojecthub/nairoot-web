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
  bulkDeleteProfileDocs,
  deleteProfileDoc,
  fetchCollectionDocs,
  formatValue,
  getArray,
  getString,
  matchesSearch,
  setProfileModerationStatus,
  shortId,
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
  const [deleteTarget, setDeleteTarget] = useState<AdminDoc | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const [bulkTypedConfirm, setBulkTypedConfirm] = useState('');
  const [bulkResult, setBulkResult] = useState<{ deleted: string[]; failed: Array<{ uid: string; error: string }> } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const selectedProfiles = useMemo(
    () => docs.filter((doc) => selectedIds.has(doc.id)),
    [docs, selectedIds],
  );

  function toggleSelected(uid: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      filtered.forEach((profile) => next.add(profile.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkResult(null);
  }

  async function runAction(profile: AdminDoc, action: 'hide' | 'unhide' | 'review') {
    const reason = window.prompt('Reason for this admin action');
    if (!reason) return;
    setBusy(`${profile.id}:${action}`);
    try {
      await setProfileModerationStatus(admin, profile, action === 'hide' ? 'hidden' : action === 'unhide' ? 'visible' : 'under_review', reason);
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
      setNotice(`Profile ${action === 'hide' ? 'hidden' : action === 'unhide' ? 'unhidden' : 'marked under review'}.`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Admin action failed.');
    } finally {
      setBusy(null);
    }
  }

  function openDeleteModal(profile: AdminDoc) {
    setDeleteTarget(profile);
    setDeleteReason('');
    setDeleteConfirmed(false);
    setNotice(null);
  }

  function closeDeleteModal() {
    if (busy === `${deleteTarget?.id}:delete`) return;
    setDeleteTarget(null);
    setDeleteReason('');
    setDeleteConfirmed(false);
  }

  function openBulkDeleteModal() {
    setBulkDeleteOpen(true);
    setBulkReason('');
    setBulkConfirmed(false);
    setBulkTypedConfirm('');
    setBulkResult(null);
    setNotice(null);
  }

  function closeBulkDeleteModal() {
    if (busy === 'bulk-delete') return;
    setBulkDeleteOpen(false);
    setBulkReason('');
    setBulkConfirmed(false);
    setBulkTypedConfirm('');
  }

  async function confirmDeleteProfile() {
    if (!deleteTarget || !deleteReason.trim() || !deleteConfirmed) return;
    setBusy(`${deleteTarget.id}:delete`);
    try {
      await deleteProfileDoc(admin, deleteTarget, deleteReason.trim());
      setDocs((current) => current.filter((doc) => doc.id !== deleteTarget.id));
      setNotice(`Deleted profile document profiles/${deleteTarget.id}.`);
      setDeleteTarget(null);
      setDeleteReason('');
      setDeleteConfirmed(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Profile delete failed.');
    } finally {
      setBusy(null);
    }
  }

  async function confirmBulkDeleteProfiles() {
    if (selectedProfiles.length === 0 || !bulkReason.trim() || !bulkConfirmed) return;
    if (selectedProfiles.length >= 3 && bulkTypedConfirm !== 'DELETE') return;
    setBusy('bulk-delete');
    try {
      const result = await bulkDeleteProfileDocs({
        admin,
        profiles: selectedProfiles,
        reason: bulkReason.trim(),
      });
      setBulkResult({ deleted: result.deleted, failed: result.failed });
      setDocs((current) => current.filter((doc) => !result.deleted.includes(doc.id)));
      setSelectedIds((current) => {
        const next = new Set(current);
        result.deleted.forEach((uid) => next.delete(uid));
        return next;
      });
      const failedCount = result.failed.length;
      setNotice(
        failedCount
          ? `Deleted ${result.deleted.length} profile documents. ${failedCount} failed.`
          : `Deleted ${result.deleted.length} profile documents.`,
      );
      if (failedCount === 0) closeBulkDeleteModal();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Bulk profile delete failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <AdminPageHeader title="Profiles" eyebrow="Profile moderation">
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, UID, location, profession" />
      </AdminPageHeader>
      {notice && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {notice}
        </div>
      )}
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
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-cream px-4 py-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted">
          <span className="font-semibold text-charcoal">{selectedIds.size} selected</span>
          <span className="ml-2">from {filtered.length} visible profiles</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={selectAllVisible} disabled={filtered.length === 0} className="admin-secondary">
            Select all visible
          </button>
          <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0} className="admin-secondary">
            Clear selection
          </button>
        </div>
      </div>
      {selectedIds.size > 0 && (
        <div className="sticky top-24 z-10 mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-red-800">{selectedIds.size} profiles selected</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={clearSelection} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
                Clear selection
              </button>
              <button type="button" onClick={openBulkDeleteModal} className="rounded-full border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                Delete selected profile docs
              </button>
            </div>
          </div>
        </div>
      )}
      {error ? <ErrorState message={error} /> : filtered.length === 0 ? <EmptyState title="No profiles found" /> : (
        <div className="grid gap-4">
          {filtered.map((profile) => {
            const photos = getArray(profile.data, 'photos');
            const hidden = profile.data.moderationStatus === 'hidden' || profile.data.isVisible === false;
            const underReview = profile.data.moderationStatus === 'under_review';
            const selected = selectedIds.has(profile.id);
            return (
              <DataCard key={profile.id} className={`p-4 ${selected ? 'border-gold ring-2 ring-gold/20' : ''}`}>
                <div className="grid gap-4 lg:grid-cols-[120px_1fr_auto]">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 rounded-xl border border-line bg-ivory px-3 py-2 text-sm font-semibold text-charcoal">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(profile.id)}
                        className="h-4 w-4 rounded border-line-strong"
                      />
                      Select
                    </label>
                    <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-line bg-ivory">
                      {photos[0] ? <Image src={photos[0]} alt="" fill className="object-cover" sizes="128px" /> : <div className="flex h-full items-center justify-center text-xs text-muted">No photo</div>}
                    </div>
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
                    <button disabled={busy === `${profile.id}:delete`} onClick={() => openDeleteModal(profile)} className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Delete profile doc</button>
                  </div>
                </div>
              </DataCard>
            );
          })}
        </div>
      )}
      {deleteTarget && (
        <DeleteProfileModal
          profile={deleteTarget}
          reason={deleteReason}
          confirmed={deleteConfirmed}
          busy={busy === `${deleteTarget.id}:delete`}
          setReason={setDeleteReason}
          setConfirmed={setDeleteConfirmed}
          onCancel={closeDeleteModal}
          onDelete={confirmDeleteProfile}
        />
      )}
      {bulkDeleteOpen && (
        <BulkDeleteProfilesModal
          profiles={selectedProfiles}
          reason={bulkReason}
          confirmed={bulkConfirmed}
          typedConfirm={bulkTypedConfirm}
          busy={busy === 'bulk-delete'}
          result={bulkResult}
          setReason={setBulkReason}
          setConfirmed={setBulkConfirmed}
          setTypedConfirm={setBulkTypedConfirm}
          onCancel={closeBulkDeleteModal}
          onDelete={confirmBulkDeleteProfiles}
        />
      )}
    </>
  );
}

function DeleteProfileModal({
  profile,
  reason,
  confirmed,
  busy,
  setReason,
  setConfirmed,
  onCancel,
  onDelete,
}: {
  profile: AdminDoc;
  reason: string;
  confirmed: boolean;
  busy: boolean;
  setReason: (value: string) => void;
  setConfirmed: (value: boolean) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const canDelete = reason.trim().length > 0 && confirmed && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/45 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="delete-profile-title" className="w-full max-w-xl rounded-3xl border border-red-200 bg-cream p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Destructive profile action</p>
            <h2 id="delete-profile-title" className="mt-2 font-serif text-2xl font-semibold text-charcoal">Delete profile document?</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-full border border-line bg-ivory px-3 py-1 text-sm font-semibold text-muted hover:border-gold">
            Cancel
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink/80">
          <p>
            This will delete only the public profile document:
            <br />
            <span className="font-mono text-charcoal">profiles/{profile.id}</span>
          </p>

          <div className="rounded-2xl border border-line bg-ivory p-4">
            <p className="font-semibold text-charcoal">This will not delete:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Firebase Auth user</li>
              <li><span className="font-mono">users/{profile.id}</span></li>
              <li>Storage photos</li>
              <li>conversations or messages</li>
              <li>introductions</li>
              <li>audit logs</li>
            </ul>
          </div>

          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">
            Use this only for test profiles, broken profiles, or profiles that should be removed from discovery. For real users, hiding the profile is usually safer.
          </p>
        </div>

        <label className="mt-5 block text-sm font-semibold text-charcoal" htmlFor="delete-profile-reason">
          Reason for deletion
        </label>
        <textarea
          id="delete-profile-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
          rows={3}
          placeholder="Example: duplicate test profile created during QA"
          className="mt-2 w-full resize-none rounded-2xl border border-line-strong bg-ivory px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
        />

        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-ivory p-4 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-line-strong"
          />
          <span>I understand this deletes only the profile document.</span>
        </label>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="admin-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="rounded-full border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete profile document'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkDeleteProfilesModal({
  profiles,
  reason,
  confirmed,
  typedConfirm,
  busy,
  result,
  setReason,
  setConfirmed,
  setTypedConfirm,
  onCancel,
  onDelete,
}: {
  profiles: AdminDoc[];
  reason: string;
  confirmed: boolean;
  typedConfirm: string;
  busy: boolean;
  result: { deleted: string[]; failed: Array<{ uid: string; error: string }> } | null;
  setReason: (value: string) => void;
  setConfirmed: (value: boolean) => void;
  setTypedConfirm: (value: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const requiresTypedConfirm = profiles.length >= 3;
  const canDelete = profiles.length > 0 && reason.trim().length > 0 && confirmed && (!requiresTypedConfirm || typedConfirm === 'DELETE') && !busy;
  const preview = profiles.slice(0, 10);
  const remaining = Math.max(0, profiles.length - preview.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/45 px-4 py-6">
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-delete-profile-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-red-200 bg-cream p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Bulk destructive profile action</p>
            <h2 id="bulk-delete-profile-title" className="mt-2 font-serif text-2xl font-semibold text-charcoal">Delete selected profile documents?</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-full border border-line bg-ivory px-3 py-1 text-sm font-semibold text-muted hover:border-gold">
            Cancel
          </button>
        </div>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink/80">
          <p>
            This will delete only the selected public profile documents from:
            <br />
            <span className="font-mono text-charcoal">profiles/{'{uid}'}</span>
          </p>

          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-800">
            Selected profiles: {profiles.length}
          </p>

          <div className="rounded-2xl border border-line bg-ivory p-4">
            <p className="font-semibold text-charcoal">Selected profile summary</p>
            <ul className="mt-3 space-y-2">
              {preview.map((profile) => (
                <li key={profile.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2">
                  <span className="font-medium text-charcoal">{getString(profile.data, ['name', 'fullName']) || 'Unnamed profile'}</span>
                  <span className="font-mono text-xs text-muted">{shortId(profile.id)}</span>
                </li>
              ))}
            </ul>
            {remaining > 0 && <p className="mt-3 text-xs font-semibold text-muted">+ {remaining} more</p>}
          </div>

          <div className="rounded-2xl border border-line bg-ivory p-4">
            <p className="font-semibold text-charcoal">This will not delete:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>Firebase Auth users</li>
              <li><span className="font-mono">users/{'{uid}'}</span></li>
              <li>Storage photos</li>
              <li>conversations or messages</li>
              <li>introductions</li>
              <li>audit logs</li>
            </ul>
          </div>

          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 font-medium text-amber-800">
            Use this only for test profiles, broken profiles, or profiles that should be removed from discovery. For real users, hiding profiles is usually safer.
          </p>
        </div>

        <label className="mt-5 block text-sm font-semibold text-charcoal" htmlFor="bulk-delete-profile-reason">
          Reason for bulk deletion
        </label>
        <textarea
          id="bulk-delete-profile-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={busy}
          rows={3}
          placeholder="Example: removing duplicate QA/test profiles from discovery"
          className="mt-2 w-full resize-none rounded-2xl border border-line-strong bg-ivory px-4 py-3 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
        />

        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-ivory p-4 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={busy}
            className="mt-1 h-4 w-4 rounded border-line-strong"
          />
          <span>I understand this deletes only profile documents.</span>
        </label>

        {requiresTypedConfirm && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-charcoal" htmlFor="bulk-delete-type-confirm">
              Type DELETE to confirm
            </label>
            <input
              id="bulk-delete-type-confirm"
              value={typedConfirm}
              onChange={(event) => setTypedConfirm(event.target.value)}
              disabled={busy}
              placeholder="DELETE"
              className="mt-2 w-full rounded-2xl border border-line-strong bg-ivory px-4 py-3 font-mono text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
        )}

        {result && (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${result.failed.length ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-200 bg-green-50 text-green-700'}`}>
            <p className="font-semibold">Deleted: {result.deleted.length}</p>
            <p className="font-semibold">Failed: {result.failed.length}</p>
            {result.failed.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.failed.map((failure) => (
                  <li key={failure.uid}>
                    <span className="font-mono">{shortId(failure.uid)}</span>: {failure.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={busy} className="admin-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="rounded-full border border-red-700 bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete selected profile docs'}
          </button>
        </div>
      </div>
    </div>
  );
}
