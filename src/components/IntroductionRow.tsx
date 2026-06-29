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

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-line bg-cream p-4 shadow-soft transition hover:border-line-strong sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {profile ? (
          <Link href={`/discover/${otherId}`} className="shrink-0">
            <ProfilePhoto src={profile.photo} name={name} seed={otherId} rounded="rounded-xl" className="h-16 w-16 border border-line" />
          </Link>
        ) : (
          <ProfilePhoto src="" name={name} seed={otherId} rounded="rounded-xl" className="h-16 w-16 shrink-0 border border-line" />
        )}
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-semibold text-charcoal">
            {name}
            {profile?.age ? <span className="font-sans text-sm font-normal text-muted">, {profile.age}</span> : null}
          </p>
          <p className="truncate text-sm text-muted">{subtitle}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {intro.status === 'accepted' ? (
          <Link
            href="/chats"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            ✓ Matched · Message
          </Link>
        ) : side === 'received' ? (
          <>
            <button
              onClick={onDecline}
              disabled={!!busy}
              className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-ivory-deep disabled:opacity-50"
            >
              {busy === 'decline' ? '…' : 'Decline'}
            </button>
            <button
              onClick={onAccept}
              disabled={!!busy}
              className="rounded-full bg-maroon px-5 py-1.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep disabled:opacity-50"
            >
              {busy === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
          </>
        ) : (
          <span className="rounded-full border border-line bg-ivory-deep px-4 py-1.5 text-sm text-muted">Awaiting response</span>
        )}
      </div>

      {error && <p className="text-xs text-red-600 sm:basis-full sm:text-right">{error}</p>}
    </li>
  );
}
