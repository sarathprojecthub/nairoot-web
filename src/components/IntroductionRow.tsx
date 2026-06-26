'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { IntroItem } from '@/hooks/useIntroductions';
import { acceptIntroduction, declineIntroduction } from '@/lib/introductions';
import { ProfilePhoto } from './ProfilePhoto';

export function IntroductionRow({ item, side }: { item: IntroItem; side: 'received' | 'sent' }) {
  const { intro, profile } = item;
  const otherId = side === 'received' ? intro.senderId : intro.recipientId;
  const name = profile?.name || 'A member';
  const subtitle = profile
    ? [profile.profession, profile.city].filter(Boolean).join('  ·  ')
    : 'Profile not available';

  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    if (busy) return;
    setBusy('accept');
    setError(null);
    try {
      await acceptIntroduction(intro.id);
      // success → the realtime listener flips this row to 'accepted'
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
      // success → the listener removes this row from the pending list
    } catch {
      setError('Could not decline. Please try again.');
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {profile ? (
          <Link href={`/discover/${otherId}`} className="shrink-0">
            <ProfilePhoto src={profile.photo} name={name} seed={otherId} rounded="rounded-xl" className="h-16 w-16" />
          </Link>
        ) : (
          <ProfilePhoto src="" name={name} seed={otherId} rounded="rounded-xl" className="h-16 w-16 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">
            {name}
            {profile?.age ? <span className="font-normal text-stone-500">, {profile.age}</span> : null}
          </p>
          <p className="truncate text-sm text-stone-500">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {intro.status === 'accepted' ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            Matched ✓
          </span>
        ) : side === 'received' ? (
          <>
            <button
              onClick={onDecline}
              disabled={!!busy}
              className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              {busy === 'decline' ? '…' : 'Decline'}
            </button>
            <button
              onClick={onAccept}
              disabled={!!busy}
              className="rounded-full bg-stone-900 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              {busy === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
          </>
        ) : (
          <span className="rounded-full bg-stone-100 px-4 py-1.5 text-sm text-stone-500">Awaiting response</span>
        )}
      </div>

      {error && <p className="text-xs text-red-600 sm:basis-full sm:text-right">{error}</p>}
    </li>
  );
}
