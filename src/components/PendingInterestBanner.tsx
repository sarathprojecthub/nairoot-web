'use client';

import Link from 'next/link';
import { usePendingIntroductions } from './PendingIntroductionsProvider';
import { ProfilePhoto } from './ProfilePhoto';

// Premium, tasteful banner shown on Discover when the member has pending received
// interests. Realtime (driven by the shared subscription). Renders nothing if none.
export function PendingInterestBanner() {
  const { count, senders } = usePendingIntroductions();
  if (count === 0) return null;

  const lead = senders[0];
  const title =
    count === 1
      ? lead
        ? `${lead.name} is interested in you`
        : 'You have 1 new interest waiting'
      : `You have ${count} new interests waiting`;

  return (
    <Link
      href="/introductions"
      className="mb-6 flex items-center gap-4 rounded-2xl border border-gold/40 bg-gold/[0.07] px-4 py-3.5 shadow-soft transition hover:bg-gold/10"
    >
      <div className="flex -space-x-2">
        {senders.length > 0 ? (
          senders.slice(0, 2).map((s) => (
            <ProfilePhoto key={s.uid} src={s.photo} name={s.name} seed={s.uid} rounded="rounded-full" className="h-10 w-10 border-2 border-cream" />
          ))
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-gold/15">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-sm font-semibold text-charcoal">{title}</p>
        <p className="truncate text-xs text-muted">
          Tap to review {count === 1 ? 'this introduction' : 'these introductions'} and respond.
        </p>
      </div>

      <span className="shrink-0 rounded-full bg-maroon px-4 py-1.5 text-xs font-semibold text-cream">
        View
      </span>
    </Link>
  );
}
