'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Slim prompt shown across the app while the user is browsing without a profile.
// Disappears once onboarding is complete. Encourages becoming a discoverable member.
export function JoinBanner() {
  const { uid, isOnboarded, loading } = useCurrentUser();

  if (loading || !uid || isOnboarded) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
        <p className="text-amber-900">
          Complete your profile to be discovered and start sending introductions.
        </p>
        <Link
          href="/onboarding"
          className="shrink-0 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
