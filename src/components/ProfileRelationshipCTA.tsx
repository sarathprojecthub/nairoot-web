'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUid } from '@/hooks/useUid';
import { acceptIntroduction, declineIntroduction, fetchIntroductionBetween, type Introduction } from '@/lib/introductions';
import { isRespondableReceivedIntroduction } from '@/lib/memberIntroductionVisibility';
import { SendInterestButton } from './SendInterestButton';

// Relationship-aware action on a profile page:
//   accepted/matched   → "Message" → the conversation
//   received_pending   → "Respond in Introductions"
//   none / sent_pending → existing SendInterestButton (Express interest / Interest sent)
export function ProfileRelationshipCTA({ profileId }: { profileId: string }) {
  const uid = useUid();
  const [intro, setIntro] = useState<Introduction | null | undefined>(undefined); // undefined = loading
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    fetchIntroductionBetween(uid, profileId)
      .then((i) => { if (active) setIntro(i); })
      .catch(() => { if (active) setIntro(null); });
    return () => { active = false; };
  }, [uid, profileId]);

  if (intro === undefined) {
    return <div className="h-12 w-44 animate-pulse rounded-full bg-ivory-deep" />;
  }

  if (intro?.status === 'accepted' && intro.conversationId) {
    return (
      <Link
        href={`/chats/${intro.conversationId}`}
        className="inline-flex items-center gap-2 rounded-full bg-maroon px-7 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
      >
        Message
      </Link>
    );
  }

  if (isRespondableReceivedIntroduction(intro, uid)) {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              if (!intro || busy) return;
              setBusy('accept');
              setError(null);
              try {
                const conversationId = await acceptIntroduction(intro.id);
                setIntro({ ...intro, status: 'accepted', conversationId });
              } catch {
                setError('Could not accept. Please try again.');
                setBusy(null);
              }
            }}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-full bg-maroon px-7 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep disabled:opacity-50"
          >
            {busy === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
          <button
            onClick={async () => {
              if (!intro || busy) return;
              setBusy('decline');
              setError(null);
              try {
                await declineIntroduction(intro.id);
                setIntro(null);
              } catch {
                setError('Could not pass. Please try again.');
                setBusy(null);
              }
            }}
            disabled={!!busy}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-3 text-sm font-medium text-ink/70 transition hover:bg-ivory-deep disabled:opacity-50"
          >
            {busy === 'decline' ? 'Passing…' : 'Pass'}
          </button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  // none, or an interest I already sent (SendInterestButton shows "Interest sent ✓").
  return <SendInterestButton profileId={profileId} />;
}
