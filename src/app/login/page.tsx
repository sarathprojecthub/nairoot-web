'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { signUpWithEmail, signInWithEmail } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BrandLogo } from '@/components/ui/BrandLogo';
import {
  DUPLICATE_PHONE_ERROR_CODE,
  DUPLICATE_PHONE_MESSAGE,
  INVALID_PHONE_ERROR_CODE,
  INVALID_PHONE_MESSAGE,
  normalizeIndianPhone,
} from '@/lib/phoneIndex';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { uid, isOnboarded, loading } = useCurrentUser();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false); // UI-only: toggles password visibility
  const [showTimingHint, setShowTimingHint] = useState(false);

  // Already signed in (or just signed in) → route by onboarding state.
  useEffect(() => {
    if (busy || loading || !uid) return;
    router.replace(isOnboarded ? '/discover' : '/onboarding');
  }, [busy, loading, uid, isOnboarded, router]);

  // Read query params: ?mode=signup&intent=marriage-insight (set by /marriage-insight CTA).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'signup') setMode('signup');
    if (params.get('intent') === 'marriage-insight') setShowTimingHint(true);
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  // Confirm-password is required only in create-account mode.
  const passwordsMatch = mode === 'signin' || confirm === password;
  // Phone is required only on Create account.
  const phoneValid = isValidIndianMobile(phone);
  const phoneOk = mode === 'signin' || phoneValid;
  const canSubmit = emailValid && passwordValid && passwordsMatch && phoneOk && !busy;
  // Sign-in: someone typing a phone number into the email field — guide them,
  // do NOT attempt a phone→email lookup (see note above messageFor).
  const phoneInEmailField = mode === 'signin' && !emailValid && looksLikePhone(email);

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUpWithEmail(email.trim(), password, normalizeIndianPhone(phone).phone);
      else await signInWithEmail(email.trim(), password);
      // AuthProvider updates → the effect above redirects. Keep the spinner up.
    } catch (e) {
      setError(messageFor(e, mode));
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setConfirm('');
    setPhone('');
    setError(null);
    if (next === 'signin') setShowTimingHint(false);
  }

  function handleTimingCTA() {
    router.push('/marriage-insight');
  }

  const fieldWrap =
    'flex items-center gap-2.5 rounded-xl border border-line-strong bg-cream px-3.5 py-3 transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20';
  const fieldInput =
    'w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70';
  const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80';

  return (
    <div className="relative min-h-screen overflow-hidden bg-ivory">
      {/* ── Decorative background (pure CSS/SVG, no images) ─────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* warm radial washes */}
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-gold-soft/25 blur-3xl" />
        <div className="absolute -right-40 top-1/4 h-[30rem] w-[30rem] rounded-full bg-maroon/[0.06] blur-3xl" />
        {/* heritage arch/pillar silhouette — far left */}
        <ArchMotif className="absolute -left-6 top-24 hidden h-[30rem] w-auto text-gold/[0.07] lg:block" />
        {/* brass lamp (nilavilakku) — far right */}
        <LampMotif className="absolute right-6 top-1/3 hidden h-[26rem] w-auto text-gold/[0.10] lg:block" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 sm:px-8">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-3 py-5 sm:py-6">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
            <div className="leading-tight">
              <p className="font-serif text-lg font-semibold tracking-tight text-charcoal sm:text-xl">The Nair Root</p>
              <p className="hidden text-xs text-muted sm:block">Rooted in values. Built for families.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {mode === 'signin' ? 'New here?' : 'Already a member?'}
            </span>
            <button
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
              className="rounded-full border border-line-strong bg-cream px-5 py-2 text-sm font-semibold text-maroon shadow-soft transition hover:border-gold/60 hover:bg-ivory-deep"
            >
              {mode === 'signin' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </header>

        {/* ── Main: hero (left) + auth card (right) ────────────────────────── */}
        <main className="grid flex-1 items-center gap-y-10 py-8 lg:grid-cols-12 lg:gap-x-12 lg:py-10">

          {/* Hero intro — top-left (and above the card on mobile) */}
          <section className="order-1 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Private. Trusted. Purposeful.
            </p>
            <h1 className="mt-4 max-w-xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-charcoal sm:text-5xl">
              Where traditions meet{' '}
              <span className="text-maroon">meaningful connections.</span>
            </h1>

            {/* ornamental divider */}
            <div className="mt-6 flex max-w-xs items-center gap-3">
              <span className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" />
              <span className="text-gold">✦</span>
              <span className="h-px flex-1 bg-gradient-to-l from-gold/50 to-transparent" />
            </div>

            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink/75">
              The Nair Root is a private, members-only community for Nair families seeking
              genuine relationships built on trust, values, and compatibility.
            </p>

            {/* ── Marriage-Timing Insight Teaser ─────────────────────────────── */}
            <div className="mt-8 max-w-md">
              <div className="rounded-2xl border border-gold/25 bg-cream/80 px-5 py-5 shadow-soft">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  <MoonIcon className="h-3.5 w-3.5" />
                  New · Private Insight
                </p>
                <h3 className="mt-2.5 font-serif text-[17px] font-semibold leading-snug text-charcoal">
                  Curious about your marriage timing?
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
                  Answer a few private birth-detail questions and receive an indicative
                  marriage-timing insight before creating your profile.
                </p>
                <button
                  type="button"
                  onClick={handleTimingCTA}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
                >
                  Check my marriage timing
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
                <p className="mt-3 text-[11px] text-muted/70">
                  Indicative guidance only. Your choices remain your own.
                </p>
              </div>
            </div>
          </section>

          {/* Auth card — right column on desktop, spans both hero rows */}
          <section className="order-2 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-center">
            <div className="relative mx-auto w-full max-w-md">
              {/* floating brand seal */}
              <div className="absolute -top-7 left-1/2 z-10 -translate-x-1/2">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-cream shadow-card">
                  <BrandLogo className="h-11 w-11" />
                </span>
              </div>

              <div className="rounded-3xl border border-line bg-cream/95 px-6 pb-7 pt-12 shadow-card backdrop-blur-sm sm:px-8">
                <div className="text-center">
                  <h2 className="font-serif text-2xl font-semibold tracking-tight text-charcoal">
                    {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
                    {mode === 'signin'
                      ? 'Glad to see you again. Continue your journey.'
                      : 'Join a private community built for serious introductions.'}
                  </p>
                </div>

                {/* Mode toggle */}
                <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-ivory-deep p-1 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className={`rounded-full py-2 transition ${mode === 'signin' ? 'bg-maroon text-cream shadow-soft' : 'text-muted hover:text-ink'}`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`rounded-full py-2 transition ${mode === 'signup' ? 'bg-maroon text-cream shadow-soft' : 'text-muted hover:text-ink'}`}
                  >
                    Create account
                  </button>
                </div>

                {/* Marriage-timing nudge — shown when user arrives via timing CTA */}
                {showTimingHint && mode === 'signup' && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gold/30 bg-ivory/80 px-3.5 py-3">
                    <MoonIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <p className="text-xs leading-relaxed text-ink/75">
                      Want your private marriage-timing insight? Create your account — we&apos;ll ask for birth details after you join.
                    </p>
                  </div>
                )}

                {/* Email */}
                <div className="mt-5">
                  <label htmlFor="login-email" className={labelClass}>Email address</label>
                  <div className={fieldWrap}>
                    <MailIcon className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submit()}
                      placeholder="you@example.com"
                      className={fieldInput}
                    />
                  </div>
                  {phoneInEmailField && (
                    <p className="mt-1.5 text-xs text-maroon">
                      Phone login is coming soon. Please sign in with your email for now.
                    </p>
                  )}
                </div>

                {/* Phone — create-account only (collected, stored privately) */}
                {mode === 'signup' && (
                  <div className="mt-4">
                    <label htmlFor="login-phone" className={labelClass}>Phone number</label>
                    <div className={fieldWrap}>
                      <PhoneIcon className="h-4 w-4 shrink-0 text-muted" />
                      <input
                        id="login-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        placeholder="10-digit mobile number"
                        className={fieldInput}
                      />
                    </div>
                    {phone.length > 0 && !phoneValid ? (
                      <p className="mt-1.5 text-xs text-red-600">Enter a valid Indian mobile number (10 digits, starting 6–9).</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted">Used only for account safety and future verification. Never shown on your profile.</p>
                    )}
                  </div>
                )}

                {/* Password */}
                <div className="mt-4">
                  <label htmlFor="login-password" className={labelClass}>Password</label>
                  <div className={fieldWrap}>
                    <LockIcon className="h-4 w-4 shrink-0 text-muted" />
                    <input
                      id="login-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && submit()}
                      placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'}
                      className={fieldInput}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="shrink-0 text-muted transition hover:text-ink"
                    >
                      <EyeIcon open={showPw} className="h-4 w-4" />
                    </button>
                  </div>
                  {mode === 'signup' && password.length > 0 && !passwordValid && (
                    <p className="mt-1.5 text-xs text-muted">Password must be at least 6 characters.</p>
                  )}
                  {mode === 'signin' && (
                    <p className="mt-2 text-right text-xs text-muted/70">
                      Forgot password support is coming soon.
                    </p>
                  )}
                </div>

                {/* Confirm password — create-account only */}
                {mode === 'signup' && (
                  <div className="mt-4">
                    <label htmlFor="login-confirm" className={labelClass}>Confirm password</label>
                    <div className={fieldWrap}>
                      <LockIcon className="h-4 w-4 shrink-0 text-muted" />
                      <input
                        id="login-confirm"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        placeholder="Re-enter your password"
                        className={fieldInput}
                      />
                    </div>
                    {confirm.length > 0 && confirm !== password && (
                      <p className="mt-1.5 text-xs text-red-600">Passwords do not match.</p>
                    )}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-maroon px-6 py-3.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />}
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>

                {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

                <p className="mt-5 text-center text-xs text-muted">
                  {mode === 'signin' ? (
                    <>New here?{' '}
                      <button type="button" onClick={() => switchMode('signup')} className="font-semibold text-maroon hover:underline">
                        Create an account
                      </button>
                    </>
                  ) : (
                    <>Already a member?{' '}
                      <button type="button" onClick={() => switchMode('signin')} className="font-semibold text-maroon hover:underline">
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                {/* Trust box */}
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-ivory/70 px-4 py-3">
                  <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-maroon" />
                  <div className="text-xs leading-relaxed">
                    <p className="font-semibold text-ink">Your information is safe with us.</p>
                    <p className="text-muted">We never show your email on your profile.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Hero supporting content — features + testimonial (below card on mobile) */}
          <section className="order-3 lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FeatureCard
                icon={<ShieldIcon className="h-5 w-5 text-maroon" />}
                title="Private & Secure"
                body="Invite-only community with thoughtful privacy."
              />
              <FeatureCard
                icon={<UserCheckIcon className="h-5 w-5 text-maroon" />}
                title="Thoughtful Profiles"
                body="Clearer details, family context, and intent."
              />
              <FeatureCard
                icon={<HeartIcon className="h-5 w-5 text-maroon" />}
                title="Meaningful Introductions"
                body="Considered connections beyond casual browsing."
              />
            </div>

            <figure className="mt-6 max-w-xl rounded-2xl border border-line bg-cream/80 px-5 py-4 shadow-soft">
              <blockquote className="text-sm leading-relaxed text-ink/85">
                <span className="mr-1 font-serif text-2xl leading-none text-gold align-[-0.35em]">“</span>
                Within weeks, we found a conversation that felt aligned with our family
                values and expectations.
              </blockquote>
              <figcaption className="mt-2 text-xs font-medium text-muted">— Early member</figcaption>
            </figure>
          </section>
        </main>
      </div>

      {/* ── Bottom trust strip (maroon) — honest beta-safe values ───────────── */}
      <div className="relative z-10 bg-maroon text-cream">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-6 px-5 py-8 sm:px-8 lg:grid-cols-4 lg:py-9">
          <TrustStat icon={<KeyIcon className="h-6 w-6 text-gold-soft" />} title="Private beta" sub="A small, early community" />
          <TrustStat icon={<ShieldIcon className="h-6 w-6 text-gold-soft" />} title="Privacy focused" sub="Your privacy comes first" />
          <TrustStat icon={<BadgeCheckIcon className="h-6 w-6 text-gold-soft" />} title="Thoughtful profiles" sub="Details and family context" />
          <TrustStat icon={<SproutIcon className="h-6 w-6 text-gold-soft" />} title="Free during beta" sub="No payments, no cards" />
        </div>
      </div>
    </div>
  );
}

// ── Small presentational subcomponents ─────────────────────────────────────────

function FeatureCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-cream/70 px-4 py-4 shadow-soft transition hover:border-gold/40">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-ivory">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-charcoal">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function TrustStat({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="leading-tight">
        <p className="font-serif text-base font-semibold text-cream">{title}</p>
        <p className="mt-0.5 text-xs text-cream/70">{sub}</p>
      </div>
    </div>
  );
}

// ── Inline icons (no external deps) ────────────────────────────────────────────

type IconProps = { className?: string };

function PhoneIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 5 8-5" />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

function EyeIcon({ open, className }: IconProps & { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.5M6.2 7.7A16 16 0 0 0 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3.4-.66" />
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

function UserCheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="m16 12.5 1.8 1.8 3.2-3.4" />
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

function KeyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="4.5" />
      <path d="M11.2 11.2 20 20m-3-3 2-2m-4-1 2-2" />
    </svg>
  );
}

function BadgeCheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.6 2.6.6 2.6-2.3 1.4-1 2.5-2.7-.2L12 21.5l-2.2-1.6-2.7.2-1-2.5L3.8 16l.6-2.6L3.8 10.8l2.3-1.4 1-2.5 2.7.2L12 2.5Z" />
      <path d="m9.3 12 1.9 1.9 3.5-3.7" />
    </svg>
  );
}

function MoonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
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

function SproutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20v-8" />
      <path d="M12 13c-3.2 0-5.5-2-5.5-5.2C9.7 7.8 12 9.8 12 13Z" />
      <path d="M12 11c0-3 2.2-5 5.5-5.2C17.5 9 15.2 11 12 11Z" />
    </svg>
  );
}

// ── Decorative heritage motifs (very low opacity, desktop only) ────────────────

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

function LampMotif({ className }: IconProps) {
  // Stylized Kerala nilavilakku (oil lamp) with flame.
  return (
    <svg viewBox="0 0 120 400" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 70c-6-8-2-18 0-22 2 4 6 14 0 22Z" fill="currentColor" stroke="none" />
      <path d="M60 70v18" />
      <path d="M34 96c0 10 11 14 26 14s26-4 26-14c-8 4-18 6-26 6s-18-2-26-6Z" />
      <path d="M60 110v40" />
      <path d="M44 150h32l-4 22H48l-4-22Z" />
      <path d="M60 172v150" />
      <path d="M40 322h40l8 30H32l8-30Z" />
      <rect x="24" y="352" width="72" height="10" rx="3" />
    </svg>
  );
}

// ── Phone collection (signup only) ────────────────────────────────────────────
// NOTE: Phone + password login requires a secure backend lookup or OTP; do NOT
// add an unauthenticated phone→email lookup (it would leak account existence and
// contact data). We only COLLECT the phone at signup and store it privately;
// sign-in stays email-only.

// Accept spaces / +91 / hyphens etc. Valid = Indian mobile: 10 digits starting
// 6–9, optionally prefixed with 91 or +91.
function isValidIndianMobile(raw: string): boolean {
  try {
    normalizeIndianPhone(raw);
    return true;
  } catch {
    return false;
  }
}

// True when the value looks like a phone number rather than an email.
function looksLikePhone(s: string): boolean {
  return /^[+\d][\d\s\-()]*$/.test(s.trim()) && s.replace(/\D/g, '').length >= 6;
}

function messageFor(e: unknown, mode: Mode): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case DUPLICATE_PHONE_ERROR_CODE:
      return DUPLICATE_PHONE_MESSAGE;
    case INVALID_PHONE_ERROR_CODE:
      return INVALID_PHONE_MESSAGE;
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return mode === 'signin'
        ? 'Incorrect email or password.'
        : 'Those credentials are invalid. Please check and try again.';
    case 'auth/user-not-found':
      return 'No account found for this email. Create one instead.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a little and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this project.';
    default:
      return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
  }
}
