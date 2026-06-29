'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';

const BENEFITS: { title: string; desc: string }[] = [
  { title: 'Priority visibility', desc: 'Your profile is shown earlier to thoughtfully matched members.' },
  { title: 'More weekly introductions', desc: 'A larger, curated set of considered introductions each week.' },
  { title: 'See who viewed you', desc: 'Know which members have taken an interest in your profile.' },
  { title: 'Verified badge', desc: 'A quiet mark of trust shown beside your name across the platform.' },
  { title: 'Concierge shortlisting', desc: 'Our team hand-picks a small shortlist suited to you and your family.' },
  { title: 'Better profile placement', desc: 'Refined positioning so the right families notice you first.' },
];

function Ornament() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
      <span className="h-2 w-2 rounded-full bg-gold" />
    </span>
  );
}

type Status = 'checking' | 'idle' | 'joining' | 'joined';

export default function PremiumPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  // On load, check whether the current user is already on the waitlist.
  useEffect(() => {
    if (!user) return;
    let active = true;
    setStatus('checking');
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'premiumWaitlist', user.uid));
        if (active) setStatus(snap.exists() ? 'joined' : 'idle');
      } catch {
        // Can't read yet (e.g. rules not deployed) — allow an attempt.
        if (active) setStatus('idle');
      }
    })();
    return () => { active = false; };
  }, [user]);

  // Idempotent: doc id = uid + setDoc(merge) → re-clicking never duplicates.
  async function join() {
    if (!user || status === 'joining' || status === 'joined') return;
    setStatus('joining');
    setError(null);
    try {
      await setDoc(
        doc(db, 'premiumWaitlist', user.uid),
        {
          userId: user.uid,
          email: user.email ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: 'web_premium_page',
          status: 'joined',
        },
        { merge: true },
      );
      setStatus('joined');
    } catch {
      setError('Could not join the waitlist just now. Please try again.');
      setStatus('idle');
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="relative px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/10 blur-2xl" />
          <div className="relative">
            <Badge tone="gold">Premium · Coming soon</Badge>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight text-charcoal sm:text-4xl">
              A more considered way to be introduced
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Premium will offer quieter, more curated introductions and a few thoughtful tools for
              members who want a little more care. It is <span className="font-medium text-ink">not yet
              available, and there is nothing to pay</span> — join the waitlist and we&apos;ll let you know.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {status === 'joined' ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-700">
                  ✓ You&apos;re on the waitlist
                </span>
              ) : (
                <Button
                  variant="gold"
                  size="lg"
                  onClick={join}
                  loading={status === 'joining'}
                  disabled={status === 'joining' || status === 'checking'}
                >
                  {status === 'joining' ? 'Joining…' : 'Join the waitlist'}
                </Button>
              )}
              <span className="text-xs text-muted">No payment · no card required</span>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </Card>

      {/* Benefits */}
      <div className="mt-10">
        <SectionHeader eyebrow="What’s planned" title="Premium benefits" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="flex items-start gap-4 p-5">
              <Ornament />
              <div>
                <h3 className="text-sm font-semibold text-charcoal">{b.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{b.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Premium is planned, not currently charged. Every member keeps full access to Discover,
        introductions, and chats for free during beta.
      </p>
    </div>
  );
}
