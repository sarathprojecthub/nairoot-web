'use client';

import { useDiscover } from '@/hooks/useDiscover';
import { ProfileCard } from '@/components/ProfileCard';

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="aspect-[4/5] w-full animate-pulse bg-stone-100" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const { profiles, loading, loadingMore, error, hasMore, loadMore } = useDiscover();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">This week&apos;s introductions</h1>
        <p className="mt-1 text-sm text-stone-500">Each one considered — not collected.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load profiles: {error}
        </div>
      )}

      {/* Responsive grid — desktop-first: up to 4 across, never single-column on wide screens */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
          : profiles.map((p) => <ProfileCard key={p.id} profile={p} />)}
      </div>

      {!loading && profiles.length === 0 && !error && (
        <div className="py-24 text-center">
          <p className="text-base font-medium text-stone-600">No profiles yet</p>
          <p className="mt-1 text-sm text-stone-400">New introductions will appear here.</p>
        </div>
      )}

      {!loading && hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border border-stone-300 bg-white px-6 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}
