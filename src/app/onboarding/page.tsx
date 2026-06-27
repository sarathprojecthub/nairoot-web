'use client';

import { OnboardingWizard } from '@/components/onboarding/Wizard';
import { RequireAuth } from '@/components/RequireAuth';

// Full-screen onboarding — outside the (app) shell (no top nav). Requires a
// signed-in member (identity comes from Phone-Auth login); the wizard itself
// redirects already-onboarded members to Discover.
export default function OnboardingPage() {
  return (
    <RequireAuth requireOnboarded={false}>
      <OnboardingWizard />
    </RequireAuth>
  );
}
