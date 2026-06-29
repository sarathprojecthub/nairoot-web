'use client';

import { useState } from 'react';

// Plain <img> (not next/image) so any Cloudinary/Storage URL works without
// remotePatterns config. Falls back to a warm, premium initial-on-gradient
// placeholder — muted ivory/gold tones (never bright/playful) with a serif mark.
const GRADIENTS = [
  'from-[#efe3cf] to-[#e0c8a4]',
  'from-[#ecd9d1] to-[#d6b6a0]',
  'from-[#e8ddc8] to-[#cdb389]',
  'from-[#ead9cf] to-[#c8a78f]',
  'from-[#efe7d4] to-[#d7c29b]',
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
        <span className="font-serif text-4xl font-semibold text-maroon/55">{initial}</span>
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
