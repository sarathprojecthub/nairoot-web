'use client';

// BETA PROTOTYPE — marriage-timing insight pre-signup flow.
// No API calls, no backend writes, no Firebase changes.
// Birth details are stored only in sessionStorage (client-side only) until
// a full authenticated backend storage solution is implemented post-signup.

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';

type Gender = 'male' | 'female' | '';
type Status = '' | 'not-started' | 'actively-searching' | 'family-searching' | 'prev-engaged';

interface FormFields {
  dob: string;
  timeOfBirth: string;
  placeOfBirth: string;
  gender: Gender;
  status: Status;
  nakshatra: string;
  rashi: string;
}

interface Insight {
  window: string;
  meaning: string;
  compatibilityNotes: string[];
  readinessSuggestions: string[];
}

const EMPTY_FORM: FormFields = {
  dob: '',
  timeOfBirth: '',
  placeOfBirth: '',
  gender: '',
  status: '',
  nakshatra: '',
  rashi: '',
};

// BETA PROTOTYPE — client-side only. Must be replaced with secure authenticated
// backend storage after account creation before shipping to production.
const SESSION_KEY = 'nairoot_marriage_insight_draft';

export default function MarriageInsightPage() {
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [insight, setInsight] = useState<Insight | null>(null);

  // Restore draft from sessionStorage so a page refresh doesn't lose the result.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { data?: FormFields; insight?: Insight };
      if (saved.data) setForm(saved.data);
      if (saved.insight) {
        setInsight(saved.insight);
        setStep('result');
      }
    } catch {}
  }, []);

  function validate(): boolean {
    const next: Partial<Record<keyof FormFields, string>> = {};
    if (!form.dob) next.dob = 'Date of birth is required.';
    if (!form.timeOfBirth) next.timeOfBirth = 'Time of birth is required. Approximate is fine.';
    if (!form.placeOfBirth.trim()) next.placeOfBirth = 'Place of birth is required.';
    if (!form.gender) next.gender = 'Please select your gender.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const generated = generateInsight(form);
    setInsight(generated);
    setStep('result');
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ data: form, insight: generated, ts: Date.now() }));
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleEdit() {
    setStep('form');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40);
  }

  function set<K extends keyof FormFields>(key: K, val: FormFields[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  const fieldWrap =
    'flex items-center gap-2.5 rounded-xl border border-line-strong bg-cream px-3.5 py-3 transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20';
  const fieldInput =
    'w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70';
  const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80';
  const errorClass = 'mt-1.5 text-xs text-red-600';

  return (
    <div className="relative min-h-screen overflow-hidden bg-ivory">
      {/* Decorative background — matches /login */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-gold-soft/20 blur-3xl" />
        <div className="absolute -right-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-maroon/[0.05] blur-3xl" />
        <ArchMotif className="absolute -left-6 top-24 hidden h-[28rem] w-auto text-gold/[0.06] lg:block" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl px-5 pb-20 sm:px-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 shrink-0" />
            <div className="leading-tight">
              <p className="font-serif text-lg font-semibold tracking-tight text-charcoal">The Nair Root</p>
              <p className="hidden text-xs text-muted sm:block">Private guidance for serious introductions</p>
            </div>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-muted transition hover:text-maroon"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Back to The Nair Root</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </header>

        {/* ── Hero copy ──────────────────────────────────────────────────────── */}
        <div className="mt-2 mb-8">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
            <MoonIcon className="h-3.5 w-3.5" />
            Private Insight · Beta Preview
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-snug tracking-tight text-charcoal sm:text-4xl">
            Your private marriage-timing insight
          </h1>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink/70">
            Share a few birth details and receive an indicative timing window, compatibility
            notes, and profile-readiness suggestions.
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
            <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-gold" />
            Nothing is sent to us or saved to your account yet. You can review the insight privately before creating an account.
          </p>
        </div>

        {step === 'form' ? (
          /* ── Form ─────────────────────────────────────────────────────────── */
          <div className="rounded-3xl border border-line bg-cream/95 px-6 py-8 shadow-card sm:px-8">
            <h2 className="font-serif text-xl font-semibold text-charcoal">Birth details</h2>
            <p className="mt-1 text-sm text-muted">
              Required fields help us prepare your insight. Optional fields improve accuracy.
            </p>

            <div className="mt-6 space-y-5">

              {/* Date of birth */}
              <div>
                <label className={labelClass}>
                  Date of birth <span className="text-maroon">*</span>
                </label>
                <div className={fieldWrap}>
                  <CalendarIcon className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => set('dob', e.target.value)}
                    className={fieldInput}
                  />
                </div>
                {errors.dob && <p className={errorClass}>{errors.dob}</p>}
              </div>

              {/* Time of birth */}
              <div>
                <label className={labelClass}>
                  Time of birth <span className="text-maroon">*</span>
                </label>
                <div className={fieldWrap}>
                  <ClockIcon className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    type="time"
                    value={form.timeOfBirth}
                    onChange={(e) => set('timeOfBirth', e.target.value)}
                    className={fieldInput}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">Approximate time is okay for this beta preview.</p>
                {errors.timeOfBirth && <p className={errorClass}>{errors.timeOfBirth}</p>}
              </div>

              {/* Place of birth */}
              <div>
                <label className={labelClass}>
                  Place of birth <span className="text-maroon">*</span>
                </label>
                <div className={fieldWrap}>
                  <LocationIcon className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    type="text"
                    value={form.placeOfBirth}
                    onChange={(e) => set('placeOfBirth', e.target.value)}
                    placeholder="e.g. Thrissur, Kerala"
                    className={fieldInput}
                  />
                </div>
                {errors.placeOfBirth && <p className={errorClass}>{errors.placeOfBirth}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className={labelClass}>
                  Gender <span className="text-maroon">*</span>
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-full bg-ivory-deep p-1 text-sm font-medium">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => set('gender', g)}
                      className={`rounded-full py-2 capitalize transition ${
                        form.gender === g ? 'bg-maroon text-cream shadow-soft' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {g === 'male' ? 'Male' : 'Female'}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className={errorClass}>{errors.gender}</p>}
              </div>

              {/* ── Optional section ─────────────────────────────────────────── */}
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-gradient-to-r from-gold/30 to-transparent" />
                <span className="text-xs text-muted">Optional — improves your insight</span>
                <span className="h-px flex-1 bg-gradient-to-l from-gold/30 to-transparent" />
              </div>

              {/* Current status */}
              <div>
                <label className={labelClass}>Current search status</label>
                <div className={fieldWrap}>
                  <select
                    value={form.status}
                    onChange={(e) => set('status', e.target.value as Status)}
                    className={`${fieldInput} cursor-pointer`}
                  >
                    <option value="">Not specified</option>
                    <option value="not-started">Not started searching</option>
                    <option value="actively-searching">Actively searching</option>
                    <option value="family-searching">Family is searching</option>
                    <option value="prev-engaged">Previously engaged / discussion did not proceed</option>
                  </select>
                </div>
              </div>

              {/* Nakshatra */}
              <div>
                <label className={labelClass}>Birth star (nakshatra)</label>
                <div className={fieldWrap}>
                  <StarIcon className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    type="text"
                    value={form.nakshatra}
                    onChange={(e) => set('nakshatra', e.target.value)}
                    placeholder="e.g. Rohini"
                    className={fieldInput}
                  />
                </div>
              </div>

              {/* Rashi */}
              <div>
                <label className={labelClass}>Rashi (moon sign)</label>
                <div className={fieldWrap}>
                  <MoonIcon className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    type="text"
                    value={form.rashi}
                    onChange={(e) => set('rashi', e.target.value)}
                    placeholder="e.g. Vrishabha (Taurus)"
                    className={fieldInput}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSubmit}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-maroon px-6 py-3.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
            >
              Generate my insight
              <ChevronRightIcon className="h-4 w-4" />
            </button>

            {/* Privacy note */}
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-ivory/70 px-4 py-3">
              <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-maroon" />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold text-ink">Your details stay private.</p>
                <p className="text-muted">
                  Nothing is sent to us or saved to your account yet. Birth details are never shown on your profile.
                  You can review everything before continuing.
                </p>
              </div>
            </div>
          </div>

        ) : insight ? (
          /* ── Result ───────────────────────────────────────────────────────── */
          <div className="space-y-4">

            {/* Beta preview banner */}
            <div className="flex items-start gap-2.5 rounded-xl border border-gold/30 bg-cream/80 px-4 py-3">
              <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-xs leading-relaxed text-ink/75">
                <span className="font-semibold text-ink">Beta preview</span> — This shows how your private insight
                will look. Full interpretation will be available after account creation.
              </p>
            </div>

            {/* A: Indicative marriage window */}
            <InsightSection
              label="A · Indicative marriage window"
              icon={<MoonIcon className="h-5 w-5 text-maroon" />}
              body={insight.window}
            />

            {/* B: What this means */}
            <InsightSection
              label="B · What this means for you"
              icon={<LightbulbIcon className="h-5 w-5 text-maroon" />}
              body={insight.meaning}
            />

            {/* C: Compatibility notes */}
            <div className="rounded-2xl border border-line bg-cream/80 px-5 py-5">
              <SectionHeader icon={<HeartIcon className="h-5 w-5 text-maroon" />} label="C · Compatibility notes" />
              <ul className="mt-4 space-y-2.5">
                {insight.compatibilityNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            {/* D: Profile readiness suggestions */}
            <div className="rounded-2xl border border-line bg-cream/80 px-5 py-5">
              <SectionHeader icon={<UserCheckIcon className="h-5 w-5 text-maroon" />} label="D · Profile readiness" />
              <ul className="mt-4 space-y-2.5">
                {insight.readinessSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink/80">
                    <span className="mt-0.5 shrink-0 text-gold text-xs">✦</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* E: Disclaimer */}
            <p className="px-1 text-center text-[11px] leading-relaxed text-muted/80">
              This is indicative traditional guidance, not a guarantee. Your choices, family
              conversations, and mutual compatibility matter most.
            </p>

            {/* Conversion CTA block */}
            <div className="rounded-3xl border border-gold/25 bg-cream/95 px-6 py-8 text-center shadow-card sm:px-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
                <span className="text-gold">✦</span>
                <span className="h-px flex-1 bg-gradient-to-l from-gold/40 to-transparent" />
              </div>

              <h3 className="font-serif text-xl font-semibold text-charcoal">
                Unlock your full private insight
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                Create your Nair Root account to save your details, complete your profile, and receive
                a fuller marriage-timing and compatibility interpretation.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/login?mode=signup&intent=marriage-insight"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-maroon px-7 py-3.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
                >
                  Create account and continue
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line-strong bg-cream px-6 py-3.5 text-sm font-semibold text-maroon shadow-soft transition hover:border-gold/60"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Edit birth details
                </button>
              </div>

              <p className="mt-4 text-xs text-muted">
                Your birth details are never shown on your profile. Private to you only.
              </p>
            </div>
          </div>

        ) : null}
      </div>
    </div>
  );
}

// ── Mock insight generation (no API — deterministic from form data) ────────────
function generateInsight(data: FormFields): Insight {
  const active = data.status === 'actively-searching' || data.status === 'family-searching';
  const notStarted = data.status === 'not-started';

  const window = active
    ? 'The next 12–18 months appear to be a particularly receptive period. Continuing to engage meaningfully and involving family in early conversations may be beneficial during this phase.'
    : notStarted
    ? 'The next 18–30 months may be worth approaching with gradual intentionality — beginning to build your profile and allowing family conversations to develop naturally at a comfortable pace.'
    : 'Your details suggest that the next 12–24 months may be a good period to take introductions more thoughtfully and keep your profile well-maintained.';

  return {
    window,
    meaning:
      'This may be a useful time to keep your profile complete, respond to introductions thoughtfully, and involve family early when a conversation feels genuinely aligned. There is no urgency — considered steps tend to lead to better outcomes.',
    compatibilityNotes: [
      'Profiles with similar family expectations, cultural values, and involvement style may feel easier to progress with.',
      'Location flexibility and openness to family participation often ease the early introduction process.',
      'Education and professional alignment tends to support shared life planning and early family conversations.',
    ],
    readinessSuggestions: [
      'Add clear family context and expectations to your profile.',
      'Include education, work, and future-plans details.',
      'Add birth details after account creation for fuller compatibility notes.',
      'Upload a recent, modest photo for a more complete and trusted profile.',
    ],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-ivory">
        {icon}
      </span>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gold">{label}</p>
    </div>
  );
}

function InsightSection({ label, icon, body }: { label: string; icon: ReactNode; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-cream/80 px-5 py-5">
      <SectionHeader icon={icon} label={label} />
      <p className="mt-3 text-sm leading-relaxed text-ink/80">{body}</p>
    </div>
  );
}

// ── Inline icons ───────────────────────────────────────────────────────────────

type IconProps = { className?: string };

function MoonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 5 6v5.5c0 4.3 3 7.5 7 9 4-1.5 7-4.7 7-9V6l-7-3Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  );
}

function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function LocationIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2Z" />
    </svg>
  );
}

function SparkleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2c.3 3.7 2 5.4 5.7 5.7-3.7.3-5.4 2-5.7 5.7-.3-3.7-2-5.4-5.7-5.7C10 7.4 11.7 5.7 12 2Z" />
    </svg>
  );
}

function LightbulbIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.2-1.2 4.2-3 5.4V17H9v-2.6A6.1 6.1 0 0 1 6 9a6 6 0 0 1 6-6Z" />
    </svg>
  );
}

function HeartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7-2.3c0 4.9-7 9.3-7 9.3Z" />
    </svg>
  );
}

function UserCheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="m16 12.5 1.8 1.8 3.2-3.4" />
    </svg>
  );
}

function ArchMotif({ className }: IconProps) {
  return (
    <svg viewBox="0 0 120 400" fill="none" className={className} stroke="currentColor" strokeWidth="2">
      <path d="M20 400V120a40 40 0 0 1 80 0v280" />
      <path d="M35 400V130a25 25 0 0 1 50 0v270" />
      <rect x="14" y="392" width="92" height="8" />
      <rect x="10" y="60" width="100" height="8" />
      <path d="M60 60V40" />
    </svg>
  );
}
