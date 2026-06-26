'use client';

import { useState } from 'react';
import { sendInterest } from '@/lib/introductions';
import { useSentInterests } from '@/hooks/useSentInterests';

// Mirrors the Android stableHandleInterest behaviour:
//  - optimistic flip to "sent" on tap
//  - rolls back only on a *real* failure (benign races are kept "sent")
//  - the Firestore subscription confirms and persists across refresh
export function SendInterestButton({ profileId }: { profileId: string }) {
  const { sentTo, ready } = useSentInterests();
  const [optimistic, setOptimistic] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sent = optimistic || sentTo.has(profileId);

  async function handleSend() {
    if (sent || sending || !ready) return;
    setSending(true);
    setError(null);
    setOptimistic(true);
    try {
      await sendInterest(profileId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Benign duplicates: keep the "sent" state (the doc exists / will exist).
      if (msg !== 'interest_already_sent' && msg !== 'already_matched') {
        setOptimistic(false);
        setError('Could not send interest. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-2.5 text-sm font-semibold text-emerald-700"
      >
        Interest Sent ✓
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={sending || !ready}
        className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? 'Sending…' : 'Send Interest'}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
