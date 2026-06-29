import type { ReactNode } from 'react';

type Tone = 'gold' | 'maroon' | 'verified' | 'neutral' | 'active';

const TONES: Record<Tone, string> = {
  gold: 'border-gold/30 bg-gold/10 text-[#8a6a37]',
  maroon: 'border-maroon/20 bg-maroon/[0.06] text-maroon',
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-line-strong bg-ivory-deep text-ink/70',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

export function Badge({
  children, tone = 'neutral', className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
