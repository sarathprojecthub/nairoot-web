'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ConfirmationResult } from 'firebase/auth';
import { startPhoneSignIn, confirmOtp, clearRecaptcha } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const RECAPTCHA_ID = 'recaptcha-container';

export default function LoginPage() {
  const router = useRouter();
  const { uid, isOnboarded, loading } = useCurrentUser();
  const [phase, setPhase] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in) → route by onboarding state.
  useEffect(() => {
    if (loading || !uid) return;
    router.replace(isOnboarded ? '/discover' : '/onboarding');
  }, [loading, uid, isOnboarded, router]);

  const phoneValid = /^\+\d{8,15}$/.test(phone.trim());

  async function sendCode() {
    if (!phoneValid || busy) return;
    setBusy(true); setError(null);
    try {
      const conf = await startPhoneSignIn(phone.trim(), RECAPTCHA_ID);
      setConfirmation(conf);
      setPhase('otp');
    } catch (e) {
      clearRecaptcha();
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!confirmation || code.trim().length < 6 || busy) return;
    setBusy(true); setError(null);
    try {
      await confirmOtp(confirmation, code.trim());
      // AuthProvider updates → the effect above redirects. Keep the spinner up.
    } catch (e) {
      setError(messageFor(e));
      setBusy(false);
    }
  }

  function reset() {
    clearRecaptcha();
    setPhase('phone'); setCode(''); setConfirmation(null); setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">The Nair Root</h1>
          <p className="mt-1 text-sm text-stone-500">A quiet place for introductions</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {phase === 'phone' ? (
            <>
              <label htmlFor="login-phone" className="mb-2 block text-sm font-medium text-stone-600">
                Mobile number
              </label>
              <input
                id="login-phone"
                type="tel"
                inputMode="tel"
                autoFocus
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 16))}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="mt-1.5 text-xs text-stone-400">
                Include your country code. We’ll text you a 6-digit code.
              </p>
              <button
                onClick={sendCode}
                disabled={!phoneValid || busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Send code
              </button>
            </>
          ) : (
            <>
              <label htmlFor="login-otp" className="mb-2 block text-sm font-medium text-stone-600">
                Enter the 6-digit code
              </label>
              <input
                id="login-otp"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                placeholder="123456"
                className="w-full rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-center text-lg tracking-[0.4em] text-stone-900 outline-none transition placeholder:tracking-normal placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              <p className="mt-1.5 text-xs text-stone-400">Sent to {phone}.</p>
              <button
                onClick={verify}
                disabled={code.trim().length < 6 || busy}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                Verify & continue
              </button>
              <button onClick={reset} className="mt-3 w-full text-center text-xs text-stone-400 hover:text-stone-600">
                Use a different number
              </button>
            </>
          )}

          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-stone-400">
          By continuing you agree this is a private, members-only community. Your number is never
          shown on your profile.
        </p>
      </div>

      {/* Invisible reCAPTCHA host (required by Firebase Phone Auth). */}
      <div id={RECAPTCHA_ID} />
    </div>
  );
}

function messageFor(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-phone-number') return 'That phone number looks invalid. Include the country code.';
  if (code === 'auth/invalid-verification-code') return 'That code is incorrect. Please try again.';
  if (code === 'auth/code-expired') return 'That code expired. Request a new one.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a little and try again.';
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
