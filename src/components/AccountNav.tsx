'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { logout } from '@/lib/auth';

// Header account controls for a signed-in member: link to profile + sign out.
export function AccountNav() {
  const router = useRouter();
  const { uid } = useCurrentUser();
  const [busy, setBusy] = useState(false);

  if (!uid) return null;

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <Link
        href="/profile"
        className="flex items-center gap-1.5 font-medium text-stone-600 transition hover:text-stone-900"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Profile
      </Link>
      <button
        onClick={signOut}
        disabled={busy}
        className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
      >
        {busy ? '…' : 'Log out'}
      </button>
    </div>
  );
}
