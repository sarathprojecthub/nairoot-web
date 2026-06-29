'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchProfile } from '@/lib/profiles';
import type { Profile } from '@/lib/types';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { ProfileRelationshipCTA } from '@/components/ProfileRelationshipCTA';
import { PageSpinner } from '@/components/ui/Loading';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="border-b border-line py-3 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

function SubHead({ children }: { children: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
      <span className="h-px w-5 bg-gold/50" />
      {children}
    </h2>
  );
}

export default function ProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const p = await fetchProfile(id);
        if (!active) return;
        if (!p) { setState('notfound'); return; }
        setProfile(p);
        setState('ready');
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { active = false; };
  }, [id]);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/discover" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        ← Back to Discover
      </Link>

      {state === 'loading' && <PageSpinner />}
      {state === 'notfound' && (
        <Card className="px-6 py-16 text-center"><p className="text-sm text-muted">This profile is no longer available.</p></Card>
      )}
      {state === 'error' && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Could not load profile: {error}</div>
      )}

      {state === 'ready' && profile && (
        <div className="grid gap-8 md:grid-cols-[minmax(0,380px)_1fr]">
          {/* Photo column */}
          <div className="md:sticky md:top-24 md:self-start">
            <Card className="overflow-hidden p-0">
              <ProfilePhoto src={profile.photo} name={profile.name} seed={profile.id} className="aspect-[4/5] w-full" />
            </Card>
            {profile.photos.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {profile.photos.slice(1, 5).map((src, i) => (
                  <ProfilePhoto key={i} src={src} name={profile.name} seed={`${profile.id}-${i}`} rounded="rounded-xl" className="aspect-square w-full border border-line" />
                ))}
              </div>
            )}
          </div>

          {/* Details column */}
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-charcoal">{profile.name || 'Member'}</h1>
              {profile.age > 0 && <span className="text-xl text-muted">{profile.age}</span>}
              {profile.isPremium && <Badge tone="gold">Premium</Badge>}
              {profile.verifiedFields.length > 0 && <Badge tone="verified">✓ {profile.verifiedFields.length} verified</Badge>}
            </div>
            <p className="mt-1.5 text-ink/75">
              {[profile.profession, [profile.city, profile.state].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ')}
            </p>

            {profile.bio && (
              <div className="mt-7">
                <SubHead>Her story</SubHead>
                <p className="whitespace-pre-line leading-relaxed text-ink/90">{profile.bio}</p>
              </div>
            )}

            {profile.prompt?.answer && (
              <Card className="mt-6 bg-gold/[0.06] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">{profile.prompt.question}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink">{profile.prompt.answer}</p>
              </Card>
            )}

            {profile.lookingFor && (
              <div className="mt-7">
                <SubHead>Looking for</SubHead>
                <p className="text-sm text-ink/90">{profile.lookingFor}</p>
              </div>
            )}

            {profile.traits.length > 0 && (
              <div className="mt-7">
                <SubHead>In a few words</SubHead>
                <div className="flex flex-wrap gap-2">
                  {profile.traits.map((t) => (
                    <span key={t} className="rounded-full border border-line bg-cream px-3 py-1 text-xs text-ink/80">{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7">
              <SubHead>Details</SubHead>
              <Card className="px-5 py-1">
                <dl className="grid gap-x-10 sm:grid-cols-2">
                  <Detail label="Education" value={profile.education} />
                  <Detail label="Religion" value={profile.religion} />
                  <Detail label="Mother tongue" value={profile.motherTongue} />
                  <Detail label="Marital status" value={profile.maritalStatus} />
                  <Detail label="Height" value={profile.height} />
                  <Detail label="Family" value={profile.family} />
                </dl>
              </Card>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <ProfileRelationshipCTA profileId={profile.id} />
              <p className="mt-2.5 text-xs text-muted">Introductions are private and mutual — only shared if they accept.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
