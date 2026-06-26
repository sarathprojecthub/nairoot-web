'use client';

import { useState } from 'react';

// Plain <img> (not next/image) so any Firebase Storage URL works without
// configuring remotePatterns. Falls back to a tasteful initial-on-gradient
// placeholder when a profile has no photo or the URL fails to load — common
// for the existing test profiles.
const GRADIENTS = [
  'from-rose-200 to-amber-200',
  'from-amber-200 to-orange-200',
  'from-stone-200 to-rose-200',
  'from-emerald-200 to-teal-200',
  'from-indigo-200 to-rose-200',
];

function gradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function ProfilePhoto({
  src,
  name,
  seed,
  className = '',
  rounded = 'rounded-none',
}: {
  src: string;
  name: string;
  seed: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.[0] ?? '·').toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br ${gradientFor(seed)} ${rounded} ${className}`}
        aria-label={name}
      >
        <span className="text-4xl font-semibold text-white/90 drop-shadow-sm">{initial}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`object-cover ${rounded} ${className}`}
    />
  );
}
