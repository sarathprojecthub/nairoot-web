import Link from 'next/link';
import type { Profile } from '@/lib/types';
import { ProfilePhoto } from './ProfilePhoto';

const ACTIVITY_LABEL: Record<Profile['activityStatus'], { text: string; dot: string }> = {
  'active-this-week': { text: 'Active this week', dot: 'bg-emerald-500' },
  'active-recently': { text: 'Active recently', dot: 'bg-amber-500' },
  paused: { text: 'Paused', dot: 'bg-stone-400' },
};

export function ProfileCard({ profile }: { profile: Profile }) {
  const activity = ACTIVITY_LABEL[profile.activityStatus] ?? ACTIVITY_LABEL['active-this-week'];
  const place = [profile.city, profile.state].filter(Boolean).join(', ');
  const verifiedCount = profile.verifiedFields.length;

  return (
    <Link
      href={`/discover/${profile.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-stone-100">
        <ProfilePhoto
          src={profile.photo}
          name={profile.name}
          seed={profile.id}
          className="h-full w-full transition duration-300 group-hover:scale-[1.03]"
        />
        {verifiedCount > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm backdrop-blur">
            ✓ {verifiedCount} verified
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-stone-900">{profile.name || 'Member'}</h3>
          {profile.age > 0 && <span className="shrink-0 text-sm text-stone-500">{profile.age}</span>}
        </div>

        {profile.profession && (
          <p className="truncate text-sm text-stone-600">{profile.profession}</p>
        )}
        {place && <p className="truncate text-xs text-stone-400">{place}</p>}

        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-400">
          <span className={`h-1.5 w-1.5 rounded-full ${activity.dot}`} />
          {activity.text}
        </div>
      </div>
    </Link>
  );
}
