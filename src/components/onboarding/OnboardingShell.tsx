'use client';

import type { ReactNode } from 'react';

// Responsive onboarding shell: a centered card on desktop, full-bleed on mobile.
// A thin progress bar + step counter sit at the top; a sticky footer holds the
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

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 sm:px-6">
        {/* Progress */}
        <div className="pt-6">
          <div className="flex items-center justify-between">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="-ml-1 rounded-full p-1 text-stone-400 transition hover:text-stone-700"
                aria-label="Go back"
              >
                ← Back
              </button>
            ) : (
              <span />
            )}
            <span className="text-xs font-medium text-stone-400">
              Step {step} of {totalSteps}
            </span>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Header */}
        <div className="pt-7">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">
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
