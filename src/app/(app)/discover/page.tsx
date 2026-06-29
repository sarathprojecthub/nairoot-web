'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useDiscover } from '@/hooks/useDiscover';
import { useSentInterests } from '@/hooks/useSentInterests';
import { useUid } from '@/hooks/useUid';
import { usePendingIntroductions } from '@/components/PendingIntroductionsProvider';
import { PendingInterestBanner } from '@/components/PendingInterestBanner';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { sendInterest, subscribeSent, subscribeReceived } from '@/lib/introductions';
import type { Profile } from '@/lib/types';

const WEEK = 7 * 24 * 60 * 60 * 1000;

type TabId = 'all' | 'new' | 'active' | 'shortlisted';
type SortId = 'best' | 'newest' | 'age_asc' | 'age_desc';

interface Filters {
  ageMin: number;
  ageMax: number;
  location: string;
  community: string;
  education: string;
  profession: string;
  height: string;
  withPhotoOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  ageMin: 18,
  ageMax: 70,
  location: '',
  community: '',
  education: '',
  profession: '',
  height: '',
  withPhotoOnly: false,
};

const FIT_LABELS = ['Shared values', 'Good fit', 'Profile match'];
function fitLabel(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FIT_LABELS[h % FIT_LABELS.length];
}

const isNew = (p: Profile) => p.createdAt > 0 && Date.now() - p.createdAt < WEEK;
const isActive = (p: Profile) => p.activityStatus !== 'paused';
const placeOf = (p: Profile) => [p.city, p.state].filter(Boolean).join(', ');
const distinct = (vals: (string | undefined)[]) =>
  Array.from(new Set(vals.map((v) => (v ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

// ─────────────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const { profiles, loading, loadingMore, error, hasMore, loadMore } = useDiscover();
  const uid = useUid();
  const { sentTo, ready } = useSentInterests();
  const { count: pendingCount } = usePendingIntroductions();

  // Optimistic interest state (mirrors SendInterestButton); the subscription confirms.
  const [optimisticSent, setOptimisticSent] = useState<Set<string>>(new Set());
  const isSent = (id: string) => optimisticSent.has(id) || sentTo.has(id);

  async function handleInterest(id: string) {
    if (isSent(id) || !ready) return;
    setOptimisticSent((prev) => new Set(prev).add(id));
    try {
      await sendInterest(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== 'interest_already_sent' && msg !== 'already_matched') {
        setOptimisticSent((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }

  // Shortlist — localStorage only (per uid). No backend writes / rule changes.
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const storageKey = uid ? `nairoot_shortlist_${uid}` : null;
  useEffect(() => {
    if (!storageKey) { setShortlist(new Set()); return; }
    try {
      const raw = localStorage.getItem(storageKey);
      setShortlist(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setShortlist(new Set());
    }
  }, [storageKey]);

  function toggleShortlist(id: string) {
    setShortlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      }
      return next;
    });
  }

  // Dismiss — session-only (React state, not persisted).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  // Matches metric — cheap, reuses existing indexed accepted-introduction queries.
  const [matchesCount, setMatchesCount] = useState(0);
  useEffect(() => {
    if (!uid) { setMatchesCount(0); return; }
    let s = 0;
    let r = 0;
    const unsubS = subscribeSent(uid, 'accepted', (x) => { s = x.length; setMatchesCount(s + r); });
    const unsubR = subscribeReceived(uid, 'accepted', (x) => { r = x.length; setMatchesCount(s + r); });
    return () => { unsubS(); unsubR(); };
  }, [uid]);

  // Tabs / sort / filters
  const [tab, setTab] = useState<TabId>('all');
  const [sort, setSort] = useState<SortId>('best');
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS);
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // "Refine preferences" → on desktop (xl+) the filter panel is already visible,
  // so scroll it into view and pulse it; on smaller screens open the drawer.
  const filterColRef = useRef<HTMLDivElement>(null);
  const [pulseFilters, setPulseFilters] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  function handleRefine() {
    const desktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches;
    if (desktop && filterColRef.current) {
      filterColRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPulseFilters(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulseFilters(false), 1100);
    } else {
      setMobileFiltersOpen(true);
    }
  }

  function applyFilters() {
    // Normalise/clamp age only here (not on every keystroke) so min ≤ max always.
    const lo = Math.min(Math.max(draft.ageMin || 18, 18), 99);
    const hi = Math.min(Math.max(draft.ageMax || 70, 18), 99);
    const norm: Filters = { ...draft, ageMin: Math.min(lo, hi), ageMax: Math.max(lo, hi) };
    setDraft(norm);
    setApplied(norm);
    setMobileFiltersOpen(false);
  }
  function clearFilters() {
    setDraft(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
  }

  // Select option lists derived from the actually-loaded profiles.
  const options = useMemo(() => ({
    location: distinct(profiles.map((p) => p.city)),
    community: distinct(profiles.map((p) => p.motherTongue)),
    education: distinct(profiles.map((p) => p.education)),
    profession: distinct(profiles.map((p) => p.profession)),
    height: distinct(profiles.map((p) => p.height)),
  }), [profiles]);

  // Filter pipeline (client-side, on already-loaded profiles).
  const filtered = useMemo(() => {
    const f = applied;
    return profiles.filter((p) => {
      if (dismissed.has(p.id)) return false;
      if (p.age > 0 && (p.age < f.ageMin || p.age > f.ageMax)) return false;
      if (f.location && p.city !== f.location) return false;
      if (f.community && (p.motherTongue ?? '') !== f.community) return false;
      if (f.education && p.education !== f.education) return false;
      if (f.profession && p.profession !== f.profession) return false;
      if (f.height && (p.height ?? '') !== f.height) return false;
      if (f.withPhotoOnly && !p.photo) return false;
      return true;
    });
  }, [profiles, applied, dismissed]);

  const counts = useMemo(() => ({
    all: filtered.length,
    new: filtered.filter(isNew).length,
    active: filtered.filter(isActive).length,
    shortlisted: filtered.filter((p) => shortlist.has(p.id)).length,
  }), [filtered, shortlist]);

  const visible = useMemo(() => {
    let list = filtered;
    if (tab === 'new') list = list.filter(isNew);
    else if (tab === 'active') list = list.filter(isActive);
    else if (tab === 'shortlisted') list = list.filter((p) => shortlist.has(p.id));

    const sorted = [...list];
    if (sort === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'age_asc') sorted.sort((a, b) => (a.age || 999) - (b.age || 999));
    else if (sort === 'age_desc') sorted.sort((a, b) => (b.age || 0) - (a.age || 0));
    return sorted;
  }, [filtered, tab, sort, shortlist]);

  const filtersActive =
    applied.location !== '' || applied.community !== '' || applied.education !== '' ||
    applied.profession !== '' || applied.height !== '' || applied.withPhotoOnly ||
    applied.ageMin !== DEFAULT_FILTERS.ageMin || applied.ageMax !== DEFAULT_FILTERS.ageMax;

  const filterPanel = (
    <FilterPanel
      draft={draft}
      setDraft={setDraft}
      options={options}
      onApply={applyFilters}
      onClear={clearFilters}
      highlight={pulseFilters}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto overscroll-contain pr-1">
          <DiscoverSidebar
            pendingCount={pendingCount}
            likesSent={sentTo.size}
            matches={matchesCount}
          />
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <main className="min-w-0">
        <PendingInterestBanner />
        <DiscoverHero onRefine={handleRefine} />

        {/* Tabs + sort */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DiscoverTabs tab={tab} setTab={setTab} counts={counts} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-cream px-3.5 py-2 text-sm font-medium text-ink/80 shadow-soft transition hover:bg-ivory-deep xl:hidden"
            >
              <SlidersIcon className="h-4 w-4" /> Filters
              {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
            </button>
            <SortMenu sort={sort} setSort={setSort} />
          </div>
        </div>

        {/* Grid */}
        <div className="mt-5">
          {error && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load profiles: {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState tab={tab} filtersActive={filtersActive} onClear={clearFilters} />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p) => (
                <DiscoverCard
                  key={p.id}
                  profile={p}
                  sent={isSent(p.id)}
                  ready={ready}
                  shortlisted={shortlist.has(p.id)}
                  onInterest={() => handleInterest(p.id)}
                  onToggleShortlist={() => toggleShortlist(p.id)}
                  onDismiss={() => dismiss(p.id)}
                />
              ))}
            </div>
          )}

          {!loading && hasMore && visible.length > 0 && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-full border border-line-strong bg-cream px-7 py-2.5 text-sm font-medium text-ink shadow-soft transition hover:bg-ivory-deep disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </div>

        <DiscoverHowItWorks />
      </main>

      {/* ── Right filter column (desktop xl+) — own scroll area ──────────── */}
      <aside className="hidden xl:block">
        <div
          ref={filterColRef}
          className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto overscroll-contain pr-1"
        >
          <TrustCard profiles={visible} />
          {filterPanel}
        </div>
      </aside>

      {/* ── Mobile / tablet filter drawer ────────────────────────────────── */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div
            className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-ivory p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-serif text-lg font-semibold text-charcoal">Refine your search</p>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-cream text-ink/70"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Left sidebar
// ─────────────────────────────────────────────────────────────────────────────

function DiscoverSidebar({ pendingCount, likesSent, matches }: { pendingCount: number; likesSent: number; matches: number }) {
  return (
    <>
      {/* Brand + quick nav */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-[#3a0a18] to-[#250713] p-5 text-cream shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-cream/95">
            <BrandLogo className="h-9 w-9" />
          </span>
          <div className="leading-tight">
            <p className="font-serif text-base font-semibold">The Nair Root</p>
            <p className="text-[11px] text-cream/60">Rooted in tradition. United by values.</p>
          </div>
        </div>

        <nav className="mt-5 space-y-1 text-sm">
          <SideNav href="/discover" label="Discover" icon={<CompassIcon className="h-4 w-4" />} active />
          <SideNav href="/introductions" label="Introductions" icon={<UsersIcon className="h-4 w-4" />} badge={pendingCount} />
          <SideNav href="/chats" label="Chats" icon={<ChatIcon className="h-4 w-4" />} />
          <SideNav href="/premium" label="Premium" icon={<SparkleIcon className="h-4 w-4" />} accent />
          <SideNav href="/profile" label="Profile" icon={<UserIcon className="h-4 w-4" />} />
        </nav>
      </div>

      {/* Activity card */}
      <div className="rounded-3xl border border-line bg-cream p-5 shadow-soft">
        <div className="flex items-baseline justify-between">
          <p className="font-serif text-base font-semibold text-charcoal">Your activity</p>
          <span className="text-[11px] text-muted">At a glance</span>
        </div>
        <dl className="mt-3 space-y-2.5">
          <ActivityRow label="Likes sent" value={likesSent} />
          <ActivityRow label="Interested in you" value={pendingCount} />
          <ActivityRow label="Matches" value={matches} />
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Counts update live as members respond.
        </p>
      </div>

      {/* Premium waitlist card */}
      <div className="overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/[0.10] to-cream p-5 shadow-soft">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-[#8a6a37]">
          <SparkleIcon className="h-3.5 w-3.5" /> Coming soon
        </span>
        <p className="mt-3 font-serif text-base font-semibold text-charcoal">Premium is coming soon</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Join the waitlist for advanced filters and private matching tools.
        </p>
        <Link
          href="/premium"
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-maroon px-4 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
        >
          View Premium
        </Link>
      </div>
    </>
  );
}

function SideNav({ href, label, icon, active, accent, badge }: { href: string; label: string; icon: ReactNode; active?: boolean; accent?: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
        active ? 'bg-cream/15 text-cream' : 'text-cream/70 hover:bg-cream/10 hover:text-cream'
      }`}
    >
      <span className={accent ? 'text-gold-soft' : ''}>{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-[#3a0a18]">
          {badge}
        </span>
      )}
      {accent && <span className="h-1.5 w-1.5 rounded-full bg-gold-soft" />}
    </Link>
  );
}

function ActivityRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-serif text-lg font-semibold text-maroon">{value}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function DiscoverHero({ onRefine }: { onRefine: () => void }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-cream shadow-card">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
        {/* Copy */}
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            Curated for meaningful connections
          </p>
          <h1 className="mt-3 max-w-md font-serif text-2xl font-semibold leading-tight tracking-tight text-charcoal sm:text-3xl">
            Discover people who share your values
          </h1>
          <p className="mt-2.5 max-w-md text-sm leading-relaxed text-ink/70">
            A considered set of profiles to explore — shown with your preferences in mind.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              onClick={onRefine}
              className="inline-flex items-center gap-2 rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
            >
              <SlidersIcon className="h-4 w-4" /> Refine preferences
            </button>
            <button
              onClick={() => setShowHow((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-cream px-5 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-ivory-deep"
            >
              How it works
            </button>
          </div>
          {showHow && (
            <p className="mt-4 max-w-md rounded-2xl border border-line bg-ivory/70 px-4 py-3 text-xs leading-relaxed text-muted">
              Browse considered profiles, express interest privately, and start a
              conversation only when it&apos;s mutual. Your details stay private until you choose to share them.
            </p>
          )}
        </div>

        {/* CSS-only heritage ambience (no image assets) */}
        <div aria-hidden className="relative hidden min-h-[12rem] overflow-hidden bg-gradient-to-br from-[#f3e7cf] via-[#ecd9bb] to-[#e2c79b] md:block">
          <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_80%_10%,rgba(255,255,255,0.55),transparent_60%)]" />
          <div className="absolute -bottom-10 -right-6 h-44 w-44 rounded-full bg-maroon/[0.08] blur-2xl" />
          <LampMotif className="absolute bottom-2 right-6 h-40 w-auto text-[#9c7b3e]/30" />
          <ArchMotif className="absolute -left-4 bottom-0 h-44 w-auto text-[#9c7b3e]/20" />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs + Sort
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New This Week' },
  { id: 'active', label: 'Recently Active' },
  { id: 'shortlisted', label: 'Shortlisted' },
];

function DiscoverTabs({ tab, setTab, counts }: { tab: TabId; setTab: (t: TabId) => void; counts: Record<TabId, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
              active
                ? 'bg-maroon text-cream shadow-soft'
                : 'border border-line bg-cream text-ink/70 hover:bg-ivory-deep'
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
  );
}

const SORTS: { id: SortId; label: string }[] = [
  { id: 'best', label: 'Recommended' },
  { id: 'newest', label: 'Newest' },
  { id: 'age_asc', label: 'Age: Low to High' },
  { id: 'age_desc', label: 'Age: High to Low' },
];

function SortMenu({ sort, setSort }: { sort: SortId; setSort: (s: SortId) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-cream px-3.5 py-1.5 text-sm shadow-soft">
      <span className="text-muted">Sort by:</span>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as SortId)}
        className="cursor-pointer bg-transparent font-medium text-ink outline-none"
      >
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile card
// ─────────────────────────────────────────────────────────────────────────────

function DiscoverCard({
  profile,
  sent,
  ready,
  shortlisted,
  onInterest,
  onToggleShortlist,
  onDismiss,
}: {
  profile: Profile;
  sent: boolean;
  ready: boolean;
  shortlisted: boolean;
  onInterest: () => void;
  onToggleShortlist: () => void;
  onDismiss: () => void;
}) {
  const place = placeOf(profile);
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-cream shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-card">
      {/* Bookmark — sibling of the link, not nested inside the <a> */}
      <button
        onClick={onToggleShortlist}
        aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
        className={`absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border shadow-soft backdrop-blur transition ${
          shortlisted
            ? 'border-gold/50 bg-gold/90 text-cream'
            : 'border-line bg-cream/85 text-ink/60 hover:text-maroon'
        }`}
      >
        <BookmarkIcon filled={shortlisted} className="h-4 w-4" />
      </button>

      <Link href={`/discover/${profile.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-ivory-deep">
          <ProfilePhoto
            src={profile.photo}
            name={profile.name}
            seed={profile.id}
            className="h-full w-full transition duration-500 group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            {isNew(profile) && (
              <span className="rounded-full bg-maroon/90 px-2 py-0.5 text-[10px] font-semibold text-cream shadow-soft backdrop-blur">New</span>
            )}
            {shortlisted && (
              <span className="rounded-full border border-gold/50 bg-cream/90 px-2 py-0.5 text-[10px] font-semibold text-[#8a6a37] shadow-soft backdrop-blur">Shortlisted</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5 px-4 pt-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-serif text-[1.05rem] font-semibold text-charcoal">{profile.name || 'Member'}</h3>
            {profile.age > 0 && <span className="shrink-0 text-sm text-muted">{profile.age}</span>}
          </div>
          <p className="truncate text-sm text-ink/75">{profile.profession || 'Profession not added'}</p>
          <p className="truncate text-xs text-muted">{profile.education || 'Education not added'}</p>
          <p className="truncate text-xs text-muted">{place || 'Location not added'}</p>
          <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-[#8a6a37]">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {fitLabel(profile.id)}
          </span>
        </div>
      </Link>

      {/* Actions — separate from the link */}
      <div className="mt-3 flex items-center gap-2 px-4 pb-4">
        {sent ? (
          <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
            ✓ Interest sent
          </span>
        ) : (
          <button
            onClick={onInterest}
            disabled={!ready}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-maroon px-4 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HeartIcon className="h-4 w-4" /> Express interest
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss for now"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-cream text-ink/50 transition hover:bg-ivory-deep hover:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-cream shadow-soft">
      <div className="aspect-[4/5] w-full animate-pulse bg-ivory-deep" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-ivory-deep" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-ivory-deep" />
        <div className="h-9 w-full animate-pulse rounded-full bg-ivory-deep" />
      </div>
    </div>
  );
}

function EmptyState({ tab, filtersActive, onClear }: { tab: TabId; filtersActive: boolean; onClear: () => void }) {
  const copy: Record<TabId, { title: string; body: string }> = {
    all: { title: 'No profiles match yet', body: 'Try widening your filters — new members appear here as they join.' },
    new: { title: 'Nothing new this week', body: 'Check back soon — fresh profiles are added regularly.' },
    active: { title: 'No recently active members', body: 'Members who have been active lately will show up here.' },
    shortlisted: { title: 'Your shortlist is empty', body: 'Tap the bookmark on a profile to save it here for later.' },
  };
  const c = copy[tab];
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-dashed border-line-strong bg-cream/60 px-6 py-16 text-center">
      <p className="font-serif text-lg text-charcoal">{c.title}</p>
      <p className="mt-1.5 text-sm text-muted">{c.body}</p>
      {filtersActive && (tab === 'all' || tab === 'active' || tab === 'new') && (
        <button onClick={onClear} className="mt-4 rounded-full border border-line-strong bg-cream px-5 py-2 text-sm font-medium text-maroon shadow-soft transition hover:bg-ivory-deep">
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Right column — trust card + filter panel
// ─────────────────────────────────────────────────────────────────────────────

function TrustCard({ profiles }: { profiles: Profile[] }) {
  const avatars = profiles.slice(0, 4);
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#3a0a18] to-[#250713] p-5 text-cream shadow-card">
      <p className="font-serif text-base font-semibold">Private &amp; considered</p>
      <p className="mt-1.5 text-xs leading-relaxed text-cream/70">
        Profiles are shown with care, privacy, and clear intent.
      </p>
      {avatars.length > 0 && (
        <div className="mt-4 flex -space-x-2">
          {avatars.map((p) => (
            <ProfilePhoto
              key={p.id}
              src={p.photo}
              name={p.name}
              seed={p.id}
              rounded="rounded-full"
              className="h-9 w-9 border-2 border-[#2c0a16]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  draft,
  setDraft,
  options,
  onApply,
  onClear,
  highlight,
}: {
  draft: Filters;
  setDraft: (f: Filters) => void;
  options: { location: string[]; community: string[]; education: string[]; profession: string[]; height: string[] };
  onApply: () => void;
  onClear: () => void;
  highlight?: boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const set = (patch: Partial<Filters>) => setDraft({ ...draft, ...patch });

  return (
    <div
      className={`overflow-hidden rounded-3xl bg-gradient-to-b from-[#3a0a18] to-[#250713] p-5 text-cream shadow-card transition-shadow duration-700 ${
        highlight ? 'shadow-[inset_0_0_0_2px_rgba(216,180,106,0.9)]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-serif text-base font-semibold">Refine your search</p>
        <button onClick={onClear} className="text-xs font-medium text-gold-soft hover:underline">Clear all</button>
      </div>

      {/* Age */}
      <div className="mt-4">
        <FilterLabel>Age</FilterLabel>
        <div className="flex items-center gap-2">
          <NumberField ariaLabel="Minimum age" value={draft.ageMin} min={18} max={draft.ageMax} onChange={(v) => set({ ageMin: v })} />
          <span className="text-cream/40">–</span>
          <NumberField ariaLabel="Maximum age" value={draft.ageMax} min={draft.ageMin} max={99} onChange={(v) => set({ ageMax: v })} />
        </div>
      </div>

      <SelectField label="Location" value={draft.location} options={options.location} onChange={(v) => set({ location: v })} anyLabel="Any location" />
      <SelectField label="Language / Community" value={draft.community} options={options.community} onChange={(v) => set({ community: v })} anyLabel="Any language / community" />
      <SelectField label="Education" value={draft.education} options={options.education} onChange={(v) => set({ education: v })} anyLabel="Any education" />
      <SelectField label="Profession" value={draft.profession} options={options.profession} onChange={(v) => set({ profession: v })} anyLabel="Any profession" />

      {/* More filters */}
      <button
        onClick={() => setShowMore((v) => !v)}
        className="mt-4 flex w-full items-center justify-between text-sm font-medium text-cream/80"
      >
        More filters
        <ChevronIcon className={`h-4 w-4 transition ${showMore ? 'rotate-180' : ''}`} />
      </button>
      {showMore && (
        <div className="mt-3 space-y-1">
          {options.height.length > 0 && (
            <SelectField label="Height" value={draft.height} options={options.height} onChange={(v) => set({ height: v })} anyLabel="Any height" embedded />
          )}
          <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-sm text-cream/85">
            <input
              type="checkbox"
              checked={draft.withPhotoOnly}
              onChange={(e) => set({ withPhotoOnly: e.target.checked })}
              className="h-4 w-4 accent-[#b1894f]"
            />
            Show only profiles with a photo
          </label>
        </div>
      )}

      <button
        onClick={onApply}
        className="mt-5 w-full rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-[#2c0a16] shadow-soft transition hover:bg-gold-soft"
      >
        Apply filters
      </button>
    </div>
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-soft/80">{children}</p>;
}

// Age input that lets you type freely (incl. blank/partial) and only
// parses + clamps on blur / Enter — no "typing fight" with the value.
function NumberField({ value, min, max, onChange, ariaLabel }: { value: number; min: number; max: number; onChange: (v: number) => void; ariaLabel: string }) {
  const [raw, setRaw] = useState(String(value));
  useEffect(() => { setRaw(String(value)); }, [value]);

  function commit() {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) { setRaw(String(value)); return; } // revert blanks/garbage
    const clamped = Math.min(Math.max(n, min), max);
    setRaw(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={raw}
      min={18}
      max={99}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-full rounded-lg border border-cream/15 bg-cream/10 px-2.5 py-1.5 text-sm text-cream outline-none focus:border-gold/60"
    />
  );
}

function SelectField({ label, value, options, onChange, anyLabel, embedded }: { label: string; value: string; options: string[]; onChange: (v: string) => void; anyLabel: string; embedded?: boolean }) {
  return (
    <div className={embedded ? '' : 'mt-4'}>
      <FilterLabel>{label}</FilterLabel>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-cream/15 bg-cream/10 px-2.5 py-2 text-sm text-cream outline-none focus:border-gold/60"
      >
        <option value="" className="text-ink">{anyLabel}</option>
        {options.map((o) => (
          <option key={o} value={o} className="text-ink">{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// "A quieter way to discover" — premium, product-specific closing section
// ─────────────────────────────────────────────────────────────────────────────

function DiscoverHowItWorks() {
  const steps = [
    { n: 1, title: 'Review with context', body: 'See the essentials before opening a profile.' },
    { n: 2, title: 'Shortlist privately', body: 'Save profiles for later without notifying anyone.' },
    { n: 3, title: 'Send one clear interest', body: 'Start only the introductions you genuinely want.' },
  ];
  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-line bg-cream shadow-card">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-12">
        <div className="lg:self-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">How discovery works</p>
          <h2 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-charcoal">A quieter way to discover</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/70">
            Profiles are intentionally shown in a smaller, more considered set — so every
            introduction feels easier to evaluate.
          </p>
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            Your browsing stays private. Interests are shared only when you choose to send one.
          </p>
        </div>

        <ol className="space-y-3.5">
          {steps.map((s) => (
            <li key={s.n} className="flex items-start gap-4 rounded-2xl border border-line bg-ivory/50 px-5 py-4 transition hover:border-gold/40">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/45 bg-gold/10 font-serif text-sm font-semibold text-[#8a6a37]">
                {s.n}
              </span>
              <div>
                <p className="text-sm font-semibold text-charcoal">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline icons (no external deps)
// ─────────────────────────────────────────────────────────────────────────────

type IconProps = { className?: string };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function HeartIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7-2.3c0 4.9-7 9.3-7 9.3Z" /></svg>;
}
function BookmarkIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h12v16l-6-3.5L6 20V4Z" /></svg>;
}
function XIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}
function SlidersIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></svg>;
}
function ChevronIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="m6 9 6 6 6-6" /></svg>;
}
function ShieldIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M12 3 5 6v5.5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6l-7-3Z" /><path d="m9.2 12 2 2 3.6-3.8" /></svg>;
}
function SparkleIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.6 10.4 12.2 5 10.6 10.4 9 12 3.5Z" /></svg>;
}
function CompassIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></svg>;
}
function UsersIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 19a5.5 5.5 0 0 0-3-4.9" /></svg>;
}
function ChatIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M5 5h14v10H9l-4 4V5Z" /></svg>;
}
function UserIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
}

// Decorative heritage motifs (very low opacity)
function LampMotif({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 400" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 70c-6-8-2-18 0-22 2 4 6 14 0 22Z" fill="currentColor" stroke="none" />
      <path d="M60 70v18M34 96c0 10 11 14 26 14s26-4 26-14c-8 4-18 6-26 6s-18-2-26-6ZM60 110v40M44 150h32l-4 22H48l-4-22ZM60 172v150M40 322h40l8 30H32l8-30Z" />
      <rect x="24" y="352" width="72" height="10" rx="3" />
    </svg>
  );
}
function ArchMotif({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 400" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 400V120a40 40 0 0 1 80 0v280M35 400V130a25 25 0 0 1 50 0v270" />
      <rect x="14" y="392" width="92" height="8" />
    </svg>
  );
}
