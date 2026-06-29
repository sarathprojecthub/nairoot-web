'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUpWithEmail, signInWithEmail } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BrandLogo } from '@/components/ui/BrandLogo';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { uid, isOnboarded, loading } = useCurrentUser();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in) → route by onboarding state.
  useEffect(() => {
    if (loading || !uid) return;
    router.replace(isOnboarded ? '/discover' : '/onboarding');
  }, [loading, uid, isOnboarded, router]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  // Confirm-password is required only in create-account mode.
  const passwordsMatch = mode === 'signin' || confirm === password;
  const canSubmit = emailValid && passwordValid && passwordsMatch && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUpWithEmail(email.trim(), password);
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
    setError(null);
  }

  const inputClass =
    'w-full rounded-xl border border-line-strong bg-cream px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-gold focus:ring-2 focus:ring-gold/20';

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo className="h-12 w-12" />
          <h1 className="mt-3 font-serif text-2xl font-semibold tracking-tight text-charcoal">The Nair Root</h1>
          <p className="mt-1 text-sm text-muted">A private, members-only community</p>
        </div>

        <div className="rounded-2xl border border-line bg-cream p-6 shadow-card">
          {/* Mode toggle */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-ivory-deep p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`rounded-full py-2 transition ${mode === 'signin' ? 'bg-cream text-charcoal shadow-soft' : 'text-muted hover:text-ink'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`rounded-full py-2 transition ${mode === 'signup' ? 'bg-cream text-charcoal shadow-soft' : 'text-muted hover:text-ink'}`}
            >
              Create account
            </button>
          </div>

          <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-ink/80">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="you@example.com"
            className={inputClass}
          />

          <label htmlFor="login-password" className="mb-1.5 mt-4 block text-sm font-medium text-ink/80">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
            className={inputClass}
          />
          {mode === 'signup' && password.length > 0 && !passwordValid && (
            <p className="mt-1.5 text-xs text-muted">Password must be at least 6 characters.</p>
          )}

          {mode === 'signup' && (
            <>
              <label htmlFor="login-confirm" className="mb-1.5 mt-4 block text-sm font-medium text-ink/80">Confirm password</label>
              <input
                id="login-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Re-enter your password"
                className={inputClass}
              />
              {confirm.length > 0 && confirm !== password && (
                <p className="mt-1.5 text-xs text-red-600">Passwords do not match.</p>
              )}
            </>
          )}

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
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          Introductions here are private, mutual, and considered with care.
          Your email is never shown on your profile.
        </p>
      </div>
    </div>
  );
}

function messageFor(e: unknown, mode: Mode): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
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
