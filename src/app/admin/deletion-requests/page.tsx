'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  createDeletionRequest,
  fetchDeletionRequests,
  formatDate,
  formatValue,
  shortId,
  updateDeletionRequest,
  type AdminDoc,
  type AdminRecord,
  type DeletionRequestInput,
  type DeletionRequestSource,
  type DeletionRequestStatus,
} from '@/lib/admin';

const statuses: DeletionRequestStatus[] = ['requested', 'verifying', 'processing', 'completed', 'rejected'];
const sources: DeletionRequestSource[] = [
  'email_manual',
  'android_account_settings',
  'web_delete_account_page',
  'admin_created',
];

type Draft = {
  status: DeletionRequestStatus;
  adminNotes: string;
  actionNote: string;
};

const initialCreateForm: DeletionRequestInput = {
  userId: '',
  email: '',
  profileName: '',
  status: 'requested',
  source: 'email_manual',
  requestNote: '',
  adminNotes: '',
};

export default function AdminDeletionRequestsPage() {
  return (
    <AdminShell permission="viewUsers">
      {(admin) => <DeletionRequests admin={admin} />}
    </AdminShell>
  );
}

function DeletionRequests({ admin }: { admin: AdminRecord }) {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DeletionRequestStatus | 'all'>('all');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<DeletionRequestInput>(initialCreateForm);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setDocs(await fetchDeletionRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion requests failed to load.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((doc) => {
      const status = statusFromValue(doc.data.status);
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      return [
        doc.id,
        doc.data.email,
        doc.data.userId,
        doc.data.profileName,
        doc.data.requestNote,
        doc.data.adminNotes,
      ].some((value) => formatValue(value).toLowerCase().includes(q));
    });
  }, [docs, filter, search]);

  function draftFor(doc: AdminDoc): Draft {
    return drafts[doc.id] ?? {
      status: statusFromValue(doc.data.status),
      adminNotes: typeof doc.data.adminNotes === 'string' ? doc.data.adminNotes : '',
      actionNote: '',
    };
  }

  function patchDraft(doc: AdminDoc, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [doc.id]: { ...draftFor(doc), ...patch } }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.email.trim()) {
      setError('Email is required to add a deletion request.');
      return;
    }

    setBusyId('create');
    setError(null);
    setNotice(null);
    try {
      const requestId = await createDeletionRequest(admin, createForm);
      setNotice(`Deletion request ${shortId(requestId)} was created.`);
      setCreateForm(initialCreateForm);
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion request was not created.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(doc: AdminDoc) {
    const draft = draftFor(doc);
    if ((draft.status === 'completed' || draft.status === 'rejected') && !draft.actionNote.trim()) {
      setError('Admin note is required before marking a request completed or rejected.');
      return;
    }

    setBusyId(doc.id);
    setError(null);
    setNotice(null);
    try {
      await updateDeletionRequest(
        admin,
        doc,
        { status: draft.status, adminNotes: draft.adminNotes },
        draft.actionNote || draft.adminNotes,
      );
      setNotice(`Deletion request ${shortId(doc.id)} was updated.`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[doc.id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion request was not updated.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Deletion Requests"
        eyebrow="Account safety"
        subtitle="Track member account deletion requests. This queue does not delete Auth users, profiles, messages, or Storage files."
      >
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream shadow-card hover:bg-maroon/90"
        >
          Add deletion request
        </button>
      </AdminPageHeader>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['all', ...statuses] as Array<DeletionRequestStatus | 'all'>).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                filter === item ? 'border-maroon bg-maroon text-cream' : 'border-line bg-cream text-muted'
              }`}
            >
              {labelize(item)}
            </button>
          ))}
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Search email, UID, name, request note" />
      </div>

      {notice && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <EmptyState title="Loading deletion requests" />
      ) : error && docs.length === 0 ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No deletion requests found" body="Try another filter or add the first request manually." />
      ) : (
        <div className="grid gap-4">
          {filtered.map((doc) => (
            <DeletionRequestCard
              key={doc.id}
              doc={doc}
              draft={draftFor(doc)}
              busy={busyId === doc.id}
              onDraft={(patch) => patchDraft(doc, patch)}
              onUpdate={() => handleUpdate(doc)}
            />
          ))}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-2xl rounded-2xl border border-line bg-cream p-6 shadow-2xl">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Manual intake</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold text-charcoal">Add deletion request</h3>
              <p className="mt-2 text-sm text-muted">Use this for email or support requests that need admin tracking.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Email" required value={createForm.email} onChange={(email) => setCreateForm((form) => ({ ...form, email }))} />
              <TextField label="UID optional" value={createForm.userId ?? ''} onChange={(userId) => setCreateForm((form) => ({ ...form, userId }))} />
              <TextField label="Profile name optional" value={createForm.profileName ?? ''} onChange={(profileName) => setCreateForm((form) => ({ ...form, profileName }))} />
              <SelectField
                label="Source"
                value={createForm.source}
                options={sources}
                onChange={(source) => setCreateForm((form) => ({ ...form, source: source as DeletionRequestSource }))}
              />
              <SelectField
                label="Status"
                value={createForm.status}
                options={statuses}
                onChange={(status) => setCreateForm((form) => ({ ...form, status: status as DeletionRequestStatus }))}
              />
            </div>
            <TextArea
              label="Request note"
              value={createForm.requestNote ?? ''}
              onChange={(requestNote) => setCreateForm((form) => ({ ...form, requestNote }))}
            />
            <TextArea
              label="Admin notes"
              value={createForm.adminNotes ?? ''}
              onChange={(adminNotes) => setCreateForm((form) => ({ ...form, adminNotes }))}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-line bg-ivory px-5 py-2.5 text-sm font-semibold text-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyId === 'create'}
                className="rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
              >
                {busyId === 'create' ? 'Creating...' : 'Create request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function DeletionRequestCard({
  doc,
  draft,
  busy,
  onDraft,
  onUpdate,
}: {
  doc: AdminDoc;
  draft: Draft;
  busy: boolean;
  onDraft: (patch: Partial<Draft>) => void;
  onUpdate: () => void;
}) {
  const userId = typeof doc.data.userId === 'string' ? doc.data.userId : '';
  const status = statusFromValue(doc.data.status);

  return (
    <DataCard className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-2xl font-semibold text-charcoal">{formatValue(doc.data.profileName)}</h3>
            <StatusPill tone={statusTone(status)}>{labelize(status)}</StatusPill>
          </div>
          <p className="mt-1 break-all text-sm text-muted">{formatValue(doc.data.email)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-ivory px-3 py-1 font-mono text-xs text-muted">{userId ? shortId(userId) : 'No UID'}</span>
            {userId && <CopyButton value={userId} label="Copy UID" />}
            {userId && <AdminLink href={`/admin/users/${encodeURIComponent(userId)}`}>Member Mirror</AdminLink>}
          </div>
        </div>
        <div className="grid gap-2 text-sm text-muted sm:grid-cols-2 lg:min-w-80">
          <Meta label="Source" value={labelize(formatValue(doc.data.source))} />
          <Meta label="Request ID" value={shortId(doc.id)} />
          <Meta label="Created" value={formatDate(doc.data.createdAt)} />
          <Meta label="Updated" value={formatDate(doc.data.updatedAt)} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-ivory/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Request note</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{formatValue(doc.data.requestNote)}</p>
        </div>
        <div className="rounded-xl bg-ivory/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Admin notes summary</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{formatValue(doc.data.adminNotes)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr_1fr_auto] lg:items-end">
        <SelectField label="Status" value={draft.status} options={statuses} onChange={(value) => onDraft({ status: value as DeletionRequestStatus })} />
        <TextArea label="Admin notes" value={draft.adminNotes} onChange={(adminNotes) => onDraft({ adminNotes })} compact />
        <TextArea label="Reason for this update" value={draft.actionNote} onChange={(actionNote) => onDraft({ actionNote })} compact />
        <button
          type="button"
          onClick={onUpdate}
          disabled={busy}
          className="rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {busy ? 'Saving...' : 'Save update'}
        </button>
      </div>

      <RawJson data={doc.data} />
    </DataCard>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold text-charcoal">
      {label}
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-line bg-ivory px-3 py-2 text-sm font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={`mt-4 block text-sm font-semibold text-charcoal ${compact ? 'mt-0' : ''}`}>
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={compact ? 3 : 4}
        className="mt-2 w-full resize-y rounded-xl border border-line bg-ivory px-3 py-2 text-sm font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-charcoal">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-line bg-ivory px-3 py-2 text-sm font-normal outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labelize(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ivory/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 break-words text-ink">{value}</p>
    </div>
  );
}

function statusFromValue(value: unknown): DeletionRequestStatus {
  return statuses.includes(value as DeletionRequestStatus) ? (value as DeletionRequestStatus) : 'requested';
}

function statusTone(status: DeletionRequestStatus): 'neutral' | 'good' | 'warn' | 'danger' {
  if (status === 'completed') return 'good';
  if (status === 'rejected') return 'danger';
  if (status === 'processing' || status === 'verifying') return 'warn';
  return 'neutral';
}

function labelize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
