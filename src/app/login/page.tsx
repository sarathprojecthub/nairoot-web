'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signUpWithEmail, signInWithEmail } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const { uid, isOnboarded, loading } = useCurrentUser();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in) → route by onboarding state.
  useEffect(() => {
    if (loading || !uid) return;
    router.replace(isOnboarded ? '/discover' : '/onboarding');
  }, [loading, uid, isOnboarded, router]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const canSubmit = emailValid && passwordValid && !busy;

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
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">The Nair Root</h1>
          <p className="mt-1 text-sm text-stone-500">A quiet place for introductions</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {/* Mode toggle */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-stone-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`rounded-full py-1.5 transition ${mode === 'signin' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`rounded-full py-1.5 transition ${mode === 'signup' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Create account
            </button>
          </div>

          <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-stone-600">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />

          <label htmlFor="login-password" className="mb-2 mt-4 block text-sm font-medium text-stone-600">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
            className="w-full rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          {mode === 'signup' && password.length > 0 && !passwordValid && (
            <p className="mt-1.5 text-xs text-stone-400">Password must be at least 6 characters.</p>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

          <p className="mt-4 text-center text-xs text-stone-500">
            {mode === 'signin' ? (
              <>New here?{' '}
                <button type="button" onClick={() => switchMode('signup')} className="font-medium text-amber-700 hover:underline">
                  Create an account
                </button>
              </>
            ) : (
              <>Already a member?{' '}
                <button type="button" onClick={() => switchMode('signin')} className="font-medium text-amber-700 hover:underline">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-stone-400">
          By continuing you agree this is a private, members-only community. Your email is never
          shown on your profile.
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
