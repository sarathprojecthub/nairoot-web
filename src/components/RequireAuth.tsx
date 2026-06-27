'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
    </div>
  );
}

// Production access gate. Signed-out visitors go to /login. When `requireOnboarded`
// (default), members without a completed profile go to /onboarding. No anonymous
// sessions exist, so app pages only ever render for a real, signed-in member.
export function RequireAuth({
  children,
  requireOnboarded = true,
}: {
  children: ReactNode;
  requireOnboarded?: boolean;
}) {
  const router = useRouter();
  const { uid, isOnboarded, loading } = useCurrentUser();

  useEffect(() => {
    if (loading) return;
    if (!uid) router.replace('/login');
    else if (requireOnboarded && !isOnboarded) router.replace('/onboarding');
  }, [loading, uid, isOnboarded, requireOnboarded, router]);

  if (loading || !uid) return <FullScreenSpinner />;
  if (requireOnboarded && !isOnboarded) return <FullScreenSpinner />;
  return <>{children}</>;
}
