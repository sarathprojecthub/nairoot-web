'use client';

import { OnePageProfileForm } from '@/components/onboarding/OnePageProfileForm';
import { RequireAuth } from '@/components/RequireAuth';

// Full-screen onboarding — outside the (app) shell (no top nav). Requires a
// signed-in member; the form itself
// redirects already-onboarded members to Discover.
export default function OnboardingPage() {
  return (
    <RequireAuth requireOnboarded={false}>
      <OnePageProfileForm />
    </RequireAuth>
  );
}
