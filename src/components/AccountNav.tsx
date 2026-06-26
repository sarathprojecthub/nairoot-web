'use client';

import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Auth-aware header item. Shows a "Complete profile" CTA while the user has a
// session but no public profile yet; a quiet "Member" marker once onboarded.
export function AccountNav() {
  const { uid, isOnboarded, loading } = useCurrentUser();

  if (loading || !uid) return null;

  if (!isOnboarded) {
    return (
      <Link
        href="/onboarding"
        className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-stone-800"
      >
        Complete profile
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      className="flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-stone-900"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Profile
    </Link>
  );
}
