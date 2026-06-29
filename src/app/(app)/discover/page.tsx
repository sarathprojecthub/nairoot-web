'use client';

import { useDiscover } from '@/hooks/useDiscover';
import { ProfileCard } from '@/components/ProfileCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PendingInterestBanner } from '@/components/PendingInterestBanner';

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-soft">
      <div className="aspect-[4/5] w-full animate-pulse bg-ivory-deep" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-ivory-deep" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-ivory-deep" />
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const { profiles, loading, loadingMore, error, hasMore, loadMore } = useDiscover();

  return (
    <div>
      <SectionHeader
        eyebrow="This week"
        title="Considered introductions"
        subtitle="A small, curated set of members — each one considered, not collected."
        className="mb-8"
      />

      <PendingInterestBanner />

      {error && (
        <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load profiles: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
          : profiles.map((p) => <ProfileCard key={p.id} profile={p} />)}
      </div>

      {!loading && profiles.length === 0 && !error && (
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-line-strong bg-cream/60 px-6 py-16 text-center">
          <p className="font-serif text-lg text-charcoal">No introductions yet</p>
          <p className="mt-1.5 text-sm text-muted">
            New members appear here as they join. Do check back soon.
          </p>
        </div>
      )}

      {!loading && hasMore && (
        <div className="mt-12 flex justify-center">
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
  );
}
