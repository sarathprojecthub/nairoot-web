'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchProfile } from '@/lib/profiles';
import type { Profile } from '@/lib/types';
import { ProfilePhoto } from '@/components/ProfilePhoto';
import { SendInterestButton } from '@/components/SendInterestButton';

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="border-b border-stone-100 py-2.5">
      <dt className="text-xs uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-stone-800">{value}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
          {t}
        </span>
      ))}
    </div>
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
        if (!p) {
          setState('notfound');
          return;
        }
        setProfile(p);
        setState('ready');
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div>
      <Link href="/discover" className="mb-6 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        ← Back to Discover
      </Link>

      {state === 'loading' && <p className="text-sm text-stone-400">Loading…</p>}
      {state === 'notfound' && <p className="text-sm text-stone-500">This profile is no longer available.</p>}
      {state === 'error' && <p className="text-sm text-red-600">Could not load profile: {error}</p>}

      {state === 'ready' && profile && (
        <div className="grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
          {/* Photo column */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              <ProfilePhoto
                src={profile.photo}
                name={profile.name}
                seed={profile.id}
                className="aspect-[4/5] w-full"
              />
            </div>
            {profile.photos.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {profile.photos.slice(1, 5).map((src, i) => (
                  <ProfilePhoto
                    key={i}
                    src={src}
                    name={profile.name}
                    seed={`${profile.id}-${i}`}
                    rounded="rounded-lg"
                    className="aspect-square w-full"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Details column */}
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900">{profile.name || 'Member'}</h1>
              {profile.age > 0 && <span className="text-xl text-stone-500">{profile.age}</span>}
            </div>
            <p className="mt-1 text-stone-600">
              {[profile.profession, [profile.city, profile.state].filter(Boolean).join(', ')]
                .filter(Boolean)
                .join('  ·  ')}
            </p>

            {profile.bio && (
              <p className="mt-5 whitespace-pre-line leading-relaxed text-stone-700">{profile.bio}</p>
            )}

            {profile.prompt?.answer && (
              <div className="mt-5 rounded-xl bg-stone-50 p-4">
                <p className="text-xs uppercase tracking-wide text-amber-700">{profile.prompt.question}</p>
                <p className="mt-1 text-sm text-stone-700">{profile.prompt.answer}</p>
              </div>
            )}

            {profile.lookingFor && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-stone-400">Looking for</p>
                <p className="mt-0.5 text-sm text-stone-800">{profile.lookingFor}</p>
              </div>
            )}

            {profile.traits.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs uppercase tracking-wide text-stone-400">Traits</p>
                <Chips items={profile.traits} />
              </div>
            )}

            <dl className="mt-6 grid gap-x-8 sm:grid-cols-2">
              <Field label="Education" value={profile.education} />
              <Field label="Religion" value={profile.religion} />
              <Field label="Mother tongue" value={profile.motherTongue} />
              <Field label="Marital status" value={profile.maritalStatus} />
              <Field label="Height" value={profile.height} />
              <Field label="Family" value={profile.family} />
            </dl>

            <div className="mt-8 border-t border-stone-100 pt-6">
              <SendInterestButton profileId={profile.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
