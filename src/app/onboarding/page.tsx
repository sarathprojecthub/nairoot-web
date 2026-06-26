import { OnboardingWizard } from '@/components/onboarding/Wizard';

// Full-screen onboarding — deliberately outside the (app) layout so it gets no
// top nav. A brand-new user joins entirely here and lands in Discover on finish.
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
