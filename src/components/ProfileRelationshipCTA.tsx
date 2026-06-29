'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUid } from '@/hooks/useUid';
import { fetchIntroductionBetween, type Introduction } from '@/lib/introductions';
import { SendInterestButton } from './SendInterestButton';

// Relationship-aware action on a profile page:
//   accepted/matched   → "Message" → the conversation
//   received_pending   → "Respond in Introductions"
//   none / sent_pending → existing SendInterestButton (Express interest / Interest sent)
export function ProfileRelationshipCTA({ profileId }: { profileId: string }) {
  const uid = useUid();
  const [intro, setIntro] = useState<Introduction | null | undefined>(undefined); // undefined = loading

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

  if (intro?.status === 'pending' && intro.recipientId === uid) {
    return (
      <Link
        href="/introductions"
        className="inline-flex items-center gap-2 rounded-full bg-maroon px-7 py-3 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
      >
        Respond in Introductions
      </Link>
    );
  }

  // none, or an interest I already sent (SendInterestButton shows "Interest sent ✓").
  return <SendInterestButton profileId={profileId} />;
}
