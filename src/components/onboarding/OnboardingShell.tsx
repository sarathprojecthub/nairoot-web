'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';

// Responsive onboarding shell: a centered column on desktop, full-bleed on mobile.
// Brand mark + progress bar + step counter up top; sticky footer holds the CTA.
export function OnboardingShell({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  footer,
  children,
}: {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pct = Math.round((step / totalSteps) * 100);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {/* Brand + progress */}
        <div className="pt-6">
          <div className="flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition hover:bg-ivory-deep hover:text-ink"
              >
                ← Back
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <BrandLogo className="h-7 w-7" />
                <span className="font-serif text-sm font-semibold text-charcoal">The Nair Root</span>
              </span>
            )}
            <span className="text-xs font-medium text-muted" aria-hidden="true">Step {step} of {totalSteps}</span>
          </div>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ivory-deep"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Onboarding progress: step ${step} of ${totalSteps}`}
          >
            <div className="h-full rounded-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Header */}
        <div className="pt-7">
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-2xl font-semibold tracking-tight text-charcoal outline-none sm:text-[1.7rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
        </div>

        {/* Body */}
        <div className="flex-1 py-7">{children}</div>

        {/* Footer CTA */}
        <div className="sticky bottom-0 -mx-4 border-t border-line bg-ivory/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          {footer}
        </div>
      </div>
    </div>
  );
}
