import Link from 'next/link';
import type { Profile } from '@/lib/types';
import { ProfilePhoto } from './ProfilePhoto';

const ACTIVITY: Record<Profile['activityStatus'], string> = {
  'active-this-week': 'Active this week',
  'active-recently': 'Active recently',
  paused: 'Paused',
};

export function ProfileCard({ profile }: { profile: Profile }) {
  const place = [profile.city, profile.state].filter(Boolean).join(', ');
  const verified = profile.verifiedFields.length;
  const activity = ACTIVITY[profile.activityStatus] ?? ACTIVITY['active-this-week'];

  return (
    <Link
      href={`/discover/${profile.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-soft transition duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-ivory-deep">
        <ProfilePhoto
          src={profile.photo}
          name={profile.name}
          seed={profile.id}
          className="h-full w-full transition duration-500 group-hover:scale-[1.04]"
        />
        {/* gentle bottom fade for legibility of any future overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/15 to-transparent" />

        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2">
          {profile.isPremium && (
            <span className="rounded-full border border-gold/40 bg-cream/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#8a6a37] shadow-soft backdrop-blur">
              Premium
            </span>
          )}
          {verified > 0 && (
            <span className="ml-auto rounded-full border border-emerald-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-soft backdrop-blur">
              ✓ {verified} verified
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate font-serif text-[1.05rem] font-semibold text-charcoal">
            {profile.name || 'Member'}
          </h3>
          {profile.age > 0 && <span className="shrink-0 text-sm text-muted">{profile.age}</span>}
        </div>

        {profile.profession && (
          <p className="truncate text-sm text-ink/75">{profile.profession}</p>
        )}
        {place && <p className="truncate text-xs text-muted">{place}</p>}

        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
          {activity}
        </div>
      </div>
    </Link>
  );
}
