'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Responsive onboarding shell: a centered card on desktop, full-bleed on mobile.
// A progress bar + step counter sit at the top; a sticky footer holds the
// primary CTA. Mirrors the Android OnboardingShell's structure (header → scroll
// body → footer CTA) adapted to the browser.
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

  // On step change, move focus to the new step's heading so keyboard + screen
  // reader users land in the new step (and the title is announced). Skip the
  // initial mount so the step's own autoFocus (e.g. the phone field) wins.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        {/* Progress */}
        <div className="pt-6">
          <div className="flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-800"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}
            <span className="text-xs font-medium text-stone-400" aria-hidden="true">
              Step {step} of {totalSteps}
            </span>
          </div>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-200"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Onboarding progress: step ${step} of ${totalSteps}`}
          >
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="pt-7">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-2xl font-semibold tracking-tight text-stone-900 outline-none sm:text-[1.7rem]"
          >
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-stone-500">{subtitle}</p>}
        </div>

        {/* Body */}
        <div className="flex-1 py-7">{children}</div>

        {/* Footer CTA */}
        <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-50/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
          {footer}
        </div>
      </div>
    </div>
  );
}
