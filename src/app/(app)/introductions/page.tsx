'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useIntroductions, type IntroItem } from '@/hooks/useIntroductions';
import { acceptIntroduction, declineIntroduction } from '@/lib/introductions';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { PageSpinner } from '@/components/ui/Loading';

type Side = 'received' | 'sent';
type Row = { item: IntroItem; side: Side };
type TabId = 'all' | 'received' | 'sent' | 'accepted';
type SortId = 'recent' | 'oldest' | 'name';

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d > 1 ? 's' : ''} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} week${w > 1 ? 's' : ''} ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'received', label: 'Received' },
  { id: 'sent', label: 'Sent' },
  { id: 'accepted', label: 'Accepted' },
];

const SORTS: { id: SortId; label: string }[] = [
  { id: 'recent', label: 'Recent first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'name', label: 'Name A–Z' },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function IntroductionsPage() {
  const { received, sent, loading } = useIntroductions();
  const [tab, setTab] = useState<TabId>('all');
  const [sort, setSort] = useState<SortId>('recent');
  const [search, setSearch] = useState('');

  const allRows: Row[] = useMemo(() => [
    ...received.map((item): Row => ({ item, side: 'received' })),
    ...sent.map((item): Row => ({ item, side: 'sent' })),
  ], [received, sent]);

  const counts = useMemo(() => ({
    all: allRows.length,
    received: received.filter((i) => i.intro.status === 'pending').length,
    sent: sent.filter((i) => i.intro.status === 'pending').length,
    accepted: allRows.filter((r) => r.item.intro.status === 'accepted').length,
  }), [allRows, received, sent]);

  const sentTotal = sent.length;
  const sentAcceptedCount = sent.filter((i) => i.intro.status === 'accepted').length;

  const rows = useMemo(() => {
    let list = allRows;
    if (tab === 'received') list = allRows.filter((r) => r.side === 'received' && r.item.intro.status === 'pending');
    else if (tab === 'sent') list = allRows.filter((r) => r.side === 'sent' && r.item.intro.status === 'pending');
    else if (tab === 'accepted') list = allRows.filter((r) => r.item.intro.status === 'accepted');

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const p = r.item.profile;
        return [p?.name, p?.profession, p?.city, p?.state].filter(Boolean).join(' ').toLowerCase().includes(q);
      });
    }

    const out = [...list];
    if (sort === 'recent') out.sort((a, b) => b.item.intro.sentAt - a.item.intro.sentAt);
    else if (sort === 'oldest') out.sort((a, b) => a.item.intro.sentAt - b.item.intro.sentAt);
    else if (sort === 'name') out.sort((a, b) => (a.item.profile?.name ?? '~').localeCompare(b.item.profile?.name ?? '~'));
    return out;
  }, [allRows, tab, sort, search]);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-8">
      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="min-w-0">
        <IntroHero
          received={counts.received}
          sent={counts.sent}
          accepted={counts.accepted}
        />

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                    active ? 'bg-maroon text-cream shadow-soft' : 'border border-line bg-cream text-ink/70 hover:bg-ivory-deep'
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? 'bg-cream/20 text-cream' : 'bg-ivory-deep text-muted'}`}>
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-line-strong bg-cream px-3.5 py-1.5 shadow-soft">
              <SearchIcon className="h-4 w-4 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, work, place"
                aria-label="Search introductions"
                className="w-40 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
              />
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-cream px-3.5 py-1.5 text-sm shadow-soft">
              <span className="hidden text-muted sm:inline">Sort:</span>
              <select
                value={sort}
                aria-label="Sort introductions"
                onChange={(e) => setSort(e.target.value as SortId)}
                className="cursor-pointer bg-transparent font-medium text-ink outline-none"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* List */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <PageSpinner />
          ) : rows.length === 0 ? (
            <IntroEmptyState tab={tab} searching={search.trim().length > 0} />
          ) : (
            rows.map((r) => <IntroCard key={r.item.intro.id} row={r} />)
          )}
        </div>

        {/* Insights below the list on mobile/tablet */}
        <div className="mt-8 xl:hidden">
          <IntroInsights recvPending={counts.received} sentTotal={sentTotal} sentAccepted={sentAcceptedCount} />
        </div>
      </div>

      {/* ── Right insight column (desktop xl+) ───────────────────────────── */}
      <aside className="hidden xl:block">
        <div className="sticky top-24 space-y-4">
          <IntroInsights recvPending={counts.received} sentTotal={sentTotal} sentAccepted={sentAcceptedCount} />
        </div>
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function IntroHero({ received, sent, accepted }: { received: number; sent: number; accepted: number }) {
  const stats: { label: string; value: number; href?: string }[] = [
    { label: 'Received', value: received },
    { label: 'Sent', value: sent },
    { label: 'Accepted', value: accepted },
    { label: 'Conversations', value: accepted, href: '/chats' },
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-cream shadow-card">
      {/* CSS-only heritage ambience */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-gold-soft/20 blur-3xl" />
        <div className="absolute -bottom-16 right-1/3 h-56 w-56 rounded-full bg-maroon/[0.06] blur-3xl" />
        <LampMotif className="absolute right-6 top-4 hidden h-40 w-auto text-[#9c7b3e]/15 sm:block" />
      </div>

      <div className="relative px-6 py-7 sm:px-8 sm:py-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">Private &amp; mutual</p>
        <h1 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-charcoal sm:text-3xl">Your introductions</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/70">
          Meaningful connections, one conversation at a time.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => {
            const inner = (
              <>
                <p className="font-serif text-2xl font-semibold text-maroon">{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-muted">{s.label}</p>
              </>
            );
            return s.href ? (
              <Link key={s.label} href={s.href} className="rounded-2xl border border-line bg-ivory/60 px-4 py-3 transition hover:border-gold/40 hover:bg-ivory">
                {inner}
              </Link>
            ) : (
              <div key={s.label} className="rounded-2xl border border-line bg-ivory/60 px-4 py-3">{inner}</div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Introduction card — preserves accept / decline / message logic
// ─────────────────────────────────────────────────────────────────────────────

function IntroCard({ row }: { row: Row }) {
  const { item, side } = row;
  const { intro, profile } = item;
  const otherId = side === 'received' ? intro.senderId : intro.recipientId;
  const name = profile?.name || 'A member';
  const age = profile?.age && profile.age > 0 ? profile.age : null;
  const place = profile ? [profile.city, profile.state].filter(Boolean).join(', ') : '';

  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    if (busy) return;
    setBusy('accept');
    setError(null);
    try {
      await acceptIntroduction(intro.id); // creates conversation + auto-message exactly once
    } catch {
      setError('Could not accept. Please try again.');
      setBusy(null);
    }
  }
  async function onDecline() {
    if (busy) return;
    setBusy('decline');
    setError(null);
    try {
      await declineIntroduction(intro.id);
    } catch {
      setError('Could not decline. Please try again.');
      setBusy(null);
    }
  }

  const accepted = intro.status === 'accepted';
  const chip = accepted
    ? { text: 'Accepted', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    : side === 'received'
      ? { text: 'Interested in you', cls: 'border-gold/40 bg-gold/10 text-[#8a6a37]' }
      : { text: 'Awaiting response', cls: 'border-line bg-ivory-deep text-muted' };
  const context = accepted
    ? 'Your conversation is open.'
    : side === 'received'
      ? 'They’re interested in connecting with you.'
      : 'Waiting for their response.';
  const stamp = accepted
    ? `Connected ${timeAgo(intro.sentAt)}`
    : side === 'received'
      ? `Received ${timeAgo(intro.sentAt)}`
      : `Sent ${timeAgo(intro.sentAt)}`;

  return (
    <div className="rounded-3xl border border-line bg-cream p-4 shadow-soft transition hover:border-line-strong sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Identity (click-through to profile) */}
        <Link href={`/discover/${otherId}`} className="flex min-w-0 flex-1 items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
          <ProfilePhoto src={profile?.photo ?? ''} name={name} seed={otherId} rounded="rounded-2xl" className="h-16 w-16 shrink-0 border border-line" />
          <div className="min-w-0">
            <p className="truncate font-serif text-base font-semibold text-charcoal">
              {name}{age ? <span className="font-sans text-sm font-normal text-muted">, {age}</span> : null}
            </p>
            <p className="truncate text-sm text-ink/75">{profile?.profession || 'Profession not added'}</p>
            <p className="truncate text-xs text-muted">
              {[profile?.education || null, place || null].filter(Boolean).join('  ·  ') || 'Details not added'}
            </p>
          </div>
        </Link>

        {/* Status + meta */}
        <div className="shrink-0 sm:w-44 sm:text-right">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${chip.cls}`}>{chip.text}</span>
          <p className="mt-1.5 text-xs text-muted">{stamp}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted/80">{context}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
        {accepted ? (
          <Link
            href={intro.conversationId ? `/chats/${intro.conversationId}` : '/chats'}
            className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
          >
            Message
          </Link>
        ) : side === 'received' ? (
          <>
            <button
              onClick={onAccept}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep disabled:opacity-50"
            >
              {busy === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
            <button
              onClick={onDecline}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink/70 transition hover:bg-ivory-deep disabled:opacity-50"
            >
              {busy === 'decline' ? '…' : 'Decline'}
            </button>
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ivory-deep px-4 py-2 text-sm font-medium text-muted">
            Awaiting response
          </span>
        )}
        <Link href={`/discover/${otherId}`} className="ml-auto text-sm font-medium text-maroon hover:underline">
          View profile
        </Link>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states
// ─────────────────────────────────────────────────────────────────────────────

function IntroEmptyState({ tab, searching }: { tab: TabId; searching: boolean }) {
  if (searching) {
    return <EmptyCard title="No matches" body="No introductions match your search. Try a different name or place." />;
  }
  const copy: Record<TabId, { title: string; body: string }> = {
    all: { title: 'No introductions here yet', body: 'When someone expresses interest — or you do — it will appear here.' },
    received: { title: 'No introductions received yet', body: 'When someone expresses interest, you’ll see it here.' },
    sent: { title: 'You haven’t expressed interest yet', body: 'Browse Discover and send a considered introduction to begin.' },
    accepted: { title: 'No accepted introductions yet', body: 'Once an introduction is mutual, your conversation opens here.' },
  };
  const c = copy[tab];
  return (
    <EmptyCard title={c.title} body={c.body} cta={tab === 'sent' || tab === 'all' ? { href: '/discover', label: 'Go to Discover' } : undefined} />
  );
}

function EmptyCard({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-3xl border border-dashed border-line-strong bg-cream/60 px-6 py-16 text-center">
      <p className="font-serif text-lg text-charcoal">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{body}</p>
      {cta && (
        <Link href={cta.href} className="mt-4 inline-flex rounded-full border border-line-strong bg-cream px-5 py-2 text-sm font-medium text-maroon shadow-soft transition hover:bg-ivory-deep">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right-side insight column
// ─────────────────────────────────────────────────────────────────────────────

function IntroInsights({ recvPending, sentTotal, sentAccepted }: { recvPending: number; sentTotal: number; sentAccepted: number }) {
  const rate = sentTotal > 0 ? Math.round((sentAccepted / sentTotal) * 100) : null;
  return (
    <div className="space-y-4">
      {/* A. Insights */}
      <div className="rounded-3xl border border-line bg-cream p-5 shadow-soft">
        <div className="flex items-baseline justify-between">
          <p className="font-serif text-base font-semibold text-charcoal">Introduction insights</p>
          <span className="text-[11px] text-muted">At a glance</span>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-ivory/60 px-4 py-3">
          {rate !== null ? (
            <>
              <p className="font-serif text-2xl font-semibold text-maroon">{rate}%</p>
              <p className="mt-0.5 text-xs text-muted">of your sent interests have been accepted.</p>
            </>
          ) : (
            <p className="text-xs text-muted">Send an interest from Discover to start a conversation.</p>
          )}
        </div>
        <p className="mt-3 text-sm text-ink/80">
          {recvPending > 0
            ? `You have ${recvPending} new introduction${recvPending > 1 ? 's' : ''} waiting.`
            : 'No new introductions waiting right now.'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">Responding thoughtfully keeps conversations moving.</p>
      </div>

      {/* B. Conversation starters */}
      <div className="rounded-3xl border border-line bg-cream p-5 shadow-soft">
        <p className="font-serif text-base font-semibold text-charcoal">Conversation starters</p>
        <ul className="mt-3 space-y-2.5">
          {['Ask about their interests', 'Mention something specific from their profile', 'Share what stood out to you'].map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-sm text-ink/80">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* C. Stay in control */}
      <div className="rounded-3xl border border-line bg-cream p-5 shadow-soft">
        <p className="font-serif text-base font-semibold text-charcoal">Stay in control</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">Your browsing is private; interests are shared only when you send one.</p>
        <div className="mt-3 space-y-2">
          <Link href="/discover" className="flex items-center justify-between rounded-xl border border-line bg-ivory/50 px-3.5 py-2.5 text-sm font-medium text-ink/80 transition hover:border-gold/40">
            Update preferences <span className="text-muted">→</span>
          </Link>
          <Link href="/profile" className="flex items-center justify-between rounded-xl border border-line bg-ivory/50 px-3.5 py-2.5 text-sm font-medium text-ink/80 transition hover:border-gold/40">
            Account &amp; privacy <span className="text-muted">→</span>
          </Link>
        </div>
      </div>

      {/* D. Need help */}
      <div className="rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/[0.08] to-cream p-5 shadow-soft">
        <p className="font-serif text-base font-semibold text-charcoal">Need help?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Questions about an introduction or your privacy? In-app support is coming soon — until then, manage everything from your profile.
        </p>
      </div>
    </div>
  );
}

// ── icons ──
type IconProps = { className?: string };
function SearchIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
}
function LampMotif({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 400" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 70c-6-8-2-18 0-22 2 4 6 14 0 22Z" fill="currentColor" stroke="none" />
      <path d="M60 70v18M34 96c0 10 11 14 26 14s26-4 26-14c-8 4-18 6-26 6s-18-2-26-6ZM60 110v40M44 150h32l-4 22H48l-4-22ZM60 172v150M40 322h40l8 30H32l8-30Z" />
      <rect x="24" y="352" width="72" height="10" rx="3" />
    </svg>
  );
}
