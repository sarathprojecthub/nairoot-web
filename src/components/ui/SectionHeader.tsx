import type { ReactNode } from 'react';

// Page / section heading with an optional gold eyebrow and a serif title.
export function SectionHeader({
  title, subtitle, eyebrow, className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && (
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
          <span className="h-px w-6 bg-gold/50" />
          {eyebrow}
        </div>
      )}
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-charcoal sm:text-[1.7rem]">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}
