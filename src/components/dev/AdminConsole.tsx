'use client';

import { useCallback, useEffect, useState } from 'react';
import { devApi, getSecret, setSecret, clearSecret, type DevDoc } from '@/lib/dev/client';
import { uploadUserPhoto, isCloudinaryConfigured } from '@/lib/cloudinary';

// ── tiny field getters (doc data is loosely typed) ────────────────────────────
const s = (d: DevDoc, k: string) => (typeof d.data[k] === 'string' ? (d.data[k] as string) : '');
const n = (d: DevDoc, k: string) => (typeof d.data[k] === 'number' ? (d.data[k] as number) : 0);
const b = (d: DevDoc, k: string) => Boolean(d.data[k]);

type Person = { uid: string; name: string };
type Tab = 'profiles' | 'users' | 'matchmaking' | 'conversations' | 'danger';

// ─────────────────────────────────────────────────────────────────────────────
export function AdminConsole() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('profiles');
  const [people, setPeople] = useState<Person[]>([]);

  // Validate any stored secret on mount.
  useEffect(() => {
    (async () => {
      if (!getSecret()) { setChecking(false); return; }
      try {
        await devApi('listProfiles', { search: '__ping__' });
        setUnlocked(true);
      } catch {
        clearSecret();
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const loadPeople = useCallback(async () => {
    try {
      const profiles = await devApi<DevDoc[]>('listProfiles', {});
      setPeople(profiles.map((d) => ({ uid: d.id, name: s(d, 'name') || d.id })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (unlocked) void loadPeople(); }, [unlocked, loadPeople]);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>;
  }
  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <DevBanner />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-6 flex flex-wrap gap-1 border-b border-zinc-800">
          {(['profiles', 'users', 'matchmaking', 'conversations', 'danger'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium capitalize transition ${
                tab === t
                  ? 'border-x border-t border-zinc-700 bg-zinc-900 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              } ${t === 'danger' ? 'text-red-400' : ''}`}
            >
              {t === 'matchmaking' ? 'Intros & Matches' : t}
            </button>
          ))}
        </nav>

        {tab === 'profiles' && <ProfilesPanel onChange={loadPeople} />}
        {tab === 'users' && <UsersPanel onChange={loadPeople} />}
        {tab === 'matchmaking' && <MatchmakingPanel people={people} />}
        {tab === 'conversations' && <ConversationsPanel people={people} />}
        {tab === 'danger' && <DangerPanel onChange={loadPeople} />}
      </div>
    </div>
  );
}

// ─── Gate ─────────────────────────────────────────────────────────────────────
function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function unlock() {
    setBusy(true);
    setError('');
    setSecret(value.trim());
    try {
      await devApi('listProfiles', { search: '__ping__' });
      onUnlock();
    } catch (e) {
      clearSecret();
      setError(e instanceof Error ? e.message : 'Unlock failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-red-400">Developer Only</div>
        <h1 className="mb-4 text-lg font-semibold text-white">Admin Console</h1>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && unlock()}
          placeholder="Developer secret"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500"
        />
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          onClick={unlock}
          disabled={busy || !value.trim()}
          className="mt-4 w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Unlock'}
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Internal tooling. Operates on live <code>nairoot-app</code> data via local developer
          credentials. Not for production users.
        </p>
      </div>
    </div>
  );
}

function DevBanner() {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-red-900/60 bg-red-950/80 px-4 py-2 backdrop-blur">
      <span className="text-xs font-bold uppercase tracking-widest text-red-300">
        ⚠ Developer Only — Internal Admin Console (live data)
      </span>
      <button
        onClick={() => { clearSecret(); location.reload(); }}
        className="text-xs font-medium text-red-300 hover:text-white"
      >
        Lock
      </button>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-300">{title}</h2>
      {children}
    </div>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500 ${props.className ?? ''}`}
    />
  );
}
function Btn({
  children, onClick, tone = 'default', disabled,
}: { children: React.ReactNode; onClick: () => void; tone?: 'default' | 'primary' | 'danger'; disabled?: boolean }) {
  const cls =
    tone === 'primary' ? 'bg-white text-zinc-900 hover:bg-zinc-200'
    : tone === 'danger' ? 'bg-red-600 text-white hover:bg-red-500'
    : 'border border-zinc-700 text-zinc-200 hover:bg-zinc-800';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${cls}`}>
      {children}
    </button>
  );
}
function useFlash() {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const flash = useCallback((text: string, bad = false) => {
    setMsg({ text, bad });
    setTimeout(() => setMsg(null), 4000);
  }, []);
  const node = msg ? (
    <span className={`ml-2 text-xs ${msg.bad ? 'text-red-400' : 'text-emerald-400'}`}>{msg.text}</span>
  ) : null;
  return { flash, node };
}
function PeopleList({ people }: { people: Person[] }) {
  return (
    <datalist id="people-list">
      {people.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
    </datalist>
  );
}

// ─── Profiles ─────────────────────────────────────────────────────────────────
const EDIT_FIELDS = ['name', 'gender', 'city', 'state', 'profession', 'education', 'religion', 'height', 'bio', 'family', 'lookingFor'] as const;

function ProfilesPanel({ onChange }: { onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState<DevDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { flash, node } = useFlash();

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await devApi<DevDoc[]>('listProfiles', { search })); }
    catch (e) { flash(e instanceof Error ? e.message : 'load failed', true); }
    finally { setLoading(false); }
  }, [search, flash]);

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function toggleVisible(d: DevDoc) {
    await devApi('setVisibility', { uid: d.id, isVisible: !b(d, 'isVisible') });
    void load();
  }
  async function remove(uid: string) {
    if (!confirm(`Delete profile ${uid}? This does not delete their intros/convs.`)) return;
    await devApi('deleteProfile', { uid });
    flash('deleted'); void load(); onChange();
  }

  return (
    <div>
      <Section title="Profiles">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search name / city / uid" className="w-64" />
          <Btn onClick={load}>{loading ? 'Searching…' : 'Search'}</Btn>
          <Btn tone="primary" onClick={() => setCreating((v) => !v)}>{creating ? 'Close' : '+ Create profile'}</Btn>
          {node}
        </div>

        {creating && <CreateProfileForm onDone={() => { setCreating(false); flash('created'); void load(); onChange(); }} />}

        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Visible</th><th className="px-3 py-2">uid</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-zinc-800/70">
                  <td className="px-3 py-2 text-white">{s(d, 'name') || '—'}</td>
                  <td className="px-3 py-2">{n(d, 'age') || '—'}</td>
                  <td className="px-3 py-2">{s(d, 'city') || '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleVisible(d)}
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${b(d, 'isVisible') ? 'bg-emerald-900/60 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                      {b(d, 'isVisible') ? 'visible' : 'hidden'}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">{d.id.slice(0, 10)}…</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing(editing === d.id ? null : d.id)} className="mr-3 text-xs text-sky-400 hover:text-sky-300">Edit</button>
                    <button onClick={() => remove(d.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-zinc-500">No profiles. Run a search.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {editing && <ProfileEditor uid={editing} onClose={() => setEditing(null)} onSaved={() => { void load(); onChange(); }} />}
    </div>
  );
}

function CreateProfileForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: '', age: '28', gender: 'male', city: '', profession: '', religion: 'Hindu', bio: '' });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  async function create() {
    await devApi('createProfile', { input: { ...form, age: Number(form.age) || 28, isVisible: true } });
    onDone();
  }
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-3">
      <Input placeholder="Name" value={form.name} onChange={(e) => set('name', e.target.value)} />
      <Input placeholder="Age" value={form.age} onChange={(e) => set('age', e.target.value)} />
      <Input placeholder="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value)} />
      <Input placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
      <Input placeholder="Profession" value={form.profession} onChange={(e) => set('profession', e.target.value)} />
      <Input placeholder="Religion" value={form.religion} onChange={(e) => set('religion', e.target.value)} />
      <Input placeholder="Bio" value={form.bio} onChange={(e) => set('bio', e.target.value)} className="col-span-2 sm:col-span-3" />
      <div><Btn tone="primary" onClick={create} disabled={!form.name.trim()}>Create</Btn></div>
    </div>
  );
}

function ProfileEditor({ uid, onClose, onSaved }: { uid: string; onClose: () => void; onSaved: () => void }) {
  const [doc, setDoc] = useState<DevDoc | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { flash, node } = useFlash();

  useEffect(() => {
    (async () => {
      const d = await devApi<DevDoc | null>('getProfile', { uid });
      if (!d) { flash('not found', true); return; }
      setDoc(d);
      setForm(Object.fromEntries(EDIT_FIELDS.map((f) => [f, s(d, f)])) as Record<string, string>);
      setForm((prev) => ({ ...prev, age: String(n(d, 'age') || '') }));
      setPhotos(Array.isArray(d.data.photos) ? (d.data.photos as string[]) : []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function save() {
    const patch: Record<string, unknown> = { ...form };
    if (form.age !== undefined) patch.age = Number(form.age) || 0;
    patch.photos = photos;
    await devApi('updateProfile', { uid, patch });
    flash('saved'); onSaved();
  }
  async function onUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadUserPhoto(file, uid, photos.length);
      const next = [...photos, url];
      setPhotos(next);
      await devApi('setPhotos', { uid, photos: next });
      flash('photo added');
    } catch (e) { flash(e instanceof Error ? e.message : 'upload failed', true); }
    finally { setUploading(false); }
  }
  async function removePhoto(i: number) {
    const next = photos.filter((_, idx) => idx !== i);
    setPhotos(next);
    await devApi('setPhotos', { uid, photos: next });
    flash('photo removed');
  }

  if (!doc) return null;
  return (
    <Section title={`Edit profile — ${uid}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(['name', 'age', ...EDIT_FIELDS.filter((f) => f !== 'name')] as string[]).map((f) => (
          <label key={f} className="text-xs text-zinc-400">
            {f}
            <Input value={form[f] ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, [f]: e.target.value }))} className="mt-1 w-full" />
          </label>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs text-zinc-400">Photos (Cloudinary)</div>
        <div className="flex flex-wrap gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-16 rounded object-cover" />
              <button onClick={() => removePhoto(i)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">✕</button>
            </div>
          ))}
          <label className={`flex h-20 w-16 cursor-pointer items-center justify-center rounded border border-dashed border-zinc-700 text-xs text-zinc-500 ${!isCloudinaryConfigured() ? 'opacity-40' : ''}`}>
            {uploading ? '…' : '+ add'}
            <input type="file" accept="image/*" className="hidden" disabled={!isCloudinaryConfigured()}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void onUpload(file); e.target.value = ''; }} />
          </label>
        </div>
        {!isCloudinaryConfigured() && <p className="mt-1 text-[11px] text-amber-400">Cloudinary env not set — uploads disabled.</p>}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Btn tone="primary" onClick={save}>Save</Btn>
        <Btn onClick={onClose}>Close</Btn>
        {node}
      </div>
    </Section>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function UsersPanel({ onChange }: { onChange: () => void }) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState<DevDoc[]>([]);
  const { flash, node } = useFlash();

  const load = useCallback(async () => {
    try { setList(await devApi<DevDoc[]>('listUsers', { search })); }
    catch (e) { flash(e instanceof Error ? e.message : 'load failed', true); }
  }, [search, flash]);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function reset(uid: string) {
    await devApi('resetDiscover', { uid });
    flash(`reset discover for ${uid.slice(0, 8)}…`);
  }
  async function wipe(uid: string) {
    if (!confirm(`Cascade-delete ALL data for ${uid} (profile, user, intros, matches, conversations)?`)) return;
    const r = await devApi<Record<string, number | boolean>>('deleteUserCascade', { uid });
    flash(`deleted: ${JSON.stringify(r)}`);
    void load(); onChange();
  }

  return (
    <Section title="Users">
      <div className="mb-3 flex items-center gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search uid / phone" className="w-64" />
        <Btn onClick={load}>Search</Btn>{node}
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr><th className="px-3 py-2">uid</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Onboarded</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="border-t border-zinc-800/70">
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">{d.id}</td>
                <td className="px-3 py-2">{s(d, 'phone') || '—'}</td>
                <td className="px-3 py-2">{b(d, 'isOnboarded') ? 'yes' : 'no'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => reset(d.id)} className="mr-3 text-xs text-sky-400 hover:text-sky-300">Reset Discover</button>
                  <button onClick={() => wipe(d.id)} className="text-xs text-red-400 hover:text-red-300">Delete data</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-zinc-500">No users.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── Intros & Matches ─────────────────────────────────────────────────────────
function MatchmakingPanel({ people }: { people: Person[] }) {
  const [intro, setIntro] = useState({ senderId: '', recipientId: '', status: 'pending' });
  const [match, setMatch] = useState({ userA: '', userB: '' });
  const { flash, node } = useFlash();

  async function makeIntro() {
    const r = await devApi<{ id: string }>('createIntroduction', intro);
    flash(`intro ${r.id.slice(0, 8)}… created`);
  }
  async function makeMatch() {
    const r = await devApi<{ matchId: string; conversationId: string }>('createMatch', match);
    flash(`match ${r.matchId.slice(0, 8)}… + conv ${r.conversationId.slice(0, 8)}…`);
  }

  return (
    <div>
      <PeopleList people={people} />
      <Section title="Create introduction (between any two users)">
        <div className="flex flex-wrap items-center gap-2">
          <Input list="people-list" placeholder="senderId" value={intro.senderId} onChange={(e) => setIntro({ ...intro, senderId: e.target.value })} className="w-64" />
          <Input list="people-list" placeholder="recipientId" value={intro.recipientId} onChange={(e) => setIntro({ ...intro, recipientId: e.target.value })} className="w-64" />
          <select value={intro.status} onChange={(e) => setIntro({ ...intro, status: e.target.value })}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white">
            {['pending', 'accepted', 'declined'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <Btn tone="primary" onClick={makeIntro} disabled={!intro.senderId || !intro.recipientId}>Create intro</Btn>
        </div>
      </Section>
      <Section title="Create match (intro + conversation + match, accepted)">
        <div className="flex flex-wrap items-center gap-2">
          <Input list="people-list" placeholder="userA" value={match.userA} onChange={(e) => setMatch({ ...match, userA: e.target.value })} className="w-64" />
          <Input list="people-list" placeholder="userB" value={match.userB} onChange={(e) => setMatch({ ...match, userB: e.target.value })} className="w-64" />
          <Btn tone="primary" onClick={makeMatch} disabled={!match.userA || !match.userB}>Create match</Btn>
          {node}
        </div>
      </Section>
    </div>
  );
}

// ─── Conversations ────────────────────────────────────────────────────────────
function ConversationsPanel({ people }: { people: Person[] }) {
  const [filterUid, setFilterUid] = useState('');
  const [convs, setConvs] = useState<DevDoc[]>([]);
  const [open, setOpen] = useState<DevDoc | null>(null);
  const [create, setCreate] = useState({ a: '', b: '' });
  const { flash, node } = useFlash();

  const load = useCallback(async () => {
    setConvs(await devApi<DevDoc[]>('listConversations', filterUid ? { uid: filterUid } : {}));
  }, [filterUid]);
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function makeConv() {
    const r = await devApi<{ id: string }>('createConversation', { participants: [create.a, create.b] });
    flash(`conversation ${r.id.slice(0, 8)}… created`); void load();
  }

  return (
    <div>
      <PeopleList people={people} />
      <Section title="Create conversation">
        <div className="flex flex-wrap items-center gap-2">
          <Input list="people-list" placeholder="participant A" value={create.a} onChange={(e) => setCreate({ ...create, a: e.target.value })} className="w-56" />
          <Input list="people-list" placeholder="participant B" value={create.b} onChange={(e) => setCreate({ ...create, b: e.target.value })} className="w-56" />
          <Btn tone="primary" onClick={makeConv} disabled={!create.a || !create.b}>Create</Btn>{node}
        </div>
      </Section>

      <Section title="Conversations">
        <div className="mb-3 flex items-center gap-2">
          <Input list="people-list" value={filterUid} onChange={(e) => setFilterUid(e.target.value)} placeholder="filter by participant uid (optional)" className="w-72" />
          <Btn onClick={load}>Load</Btn>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 text-xs uppercase text-zinc-500"><tr><th className="px-3 py-2">Participants</th><th className="px-3 py-2">Last</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {convs.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-800/70">
                    <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">{(c.data.participants as string[] ?? []).map((p) => p.slice(0, 6)).join(' · ')}</td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{((c.data.lastMessage as { text?: string })?.text ?? '').slice(0, 24)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setOpen(c)} className="text-xs text-sky-400 hover:text-sky-300">Open</button></td>
                  </tr>
                ))}
                {convs.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-zinc-500">No conversations.</td></tr>}
              </tbody>
            </table>
          </div>
          {open && <ConversationView conv={open} onSent={load} />}
        </div>
      </Section>
    </div>
  );
}

function ConversationView({ conv, onSent }: { conv: DevDoc; onSent: () => void }) {
  const participants = (conv.data.participants as string[]) ?? [];
  const [messages, setMessages] = useState<DevDoc[]>([]);
  const [text, setText] = useState('');
  const [sender, setSender] = useState(participants[0] ?? '');
  const { flash, node } = useFlash();

  const load = useCallback(async () => {
    setMessages(await devApi<DevDoc[]>('listMessages', { conversationId: conv.id }));
  }, [conv.id]);
  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!text.trim() || !sender) return;
    await devApi('sendMessage', { conversationId: conv.id, senderId: sender, text: text.trim() });
    setText(''); flash('sent'); void load(); onSent();
  }

  return (
    <div className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-500">conv {conv.id}</div>
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-mono text-[10px] text-zinc-500">{s(m, 'senderId').slice(0, 6)}: </span>
            <span className="text-zinc-200">{s(m, 'text')}</span>
          </div>
        ))}
        {messages.length === 0 && <div className="text-xs text-zinc-600">No messages yet.</div>}
      </div>
      <div className="flex items-center gap-2 border-t border-zinc-800 p-2">
        <select value={sender} onChange={(e) => setSender(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white">
          {participants.map((p) => <option key={p} value={p}>{p.slice(0, 8)}…</option>)}
        </select>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="message as selected user" className="flex-1" />
        <Btn tone="primary" onClick={send}>Send</Btn>{node}
      </div>
    </div>
  );
}

// ─── Danger ───────────────────────────────────────────────────────────────────
function DangerPanel({ onChange }: { onChange: () => void }) {
  const [uid, setUid] = useState('');
  const [result, setResult] = useState<string>('');
  const { flash, node } = useFlash();

  async function wipe() {
    if (!uid.trim()) return;
    if (!confirm(`Cascade-delete ALL test data for ${uid}? This is irreversible.`)) return;
    try {
      const r = await devApi<Record<string, unknown>>('deleteUserCascade', { uid: uid.trim() });
      setResult(JSON.stringify(r, null, 2));
      flash('done'); onChange();
    } catch (e) { flash(e instanceof Error ? e.message : 'failed', true); }
  }

  return (
    <Section title="Delete test data (cascade by uid)">
      <p className="mb-3 text-xs text-zinc-400">
        Deletes the profile, user doc, onboarding draft, and every introduction, match, and
        conversation (with messages) involving this uid. Use only on test accounts.
      </p>
      <div className="flex items-center gap-2">
        <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="uid to wipe" className="w-72" />
        <Btn tone="danger" onClick={wipe} disabled={!uid.trim()}>Delete all data</Btn>{node}
      </div>
      {result && <pre className="mt-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-emerald-300">{result}</pre>}
    </Section>
  );
}
