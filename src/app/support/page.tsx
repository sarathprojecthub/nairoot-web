import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyList, PolicySection, PublicPolicyPage } from '@/components/PublicPolicyPage';

export const metadata: Metadata = {
  title: 'Support | The Nair Root',
  description: 'Contact support for The Nair Root.',
};

export default function SupportPage() {
  return (
    <PublicPolicyPage
      eyebrow="Support"
      title="How can we help?"
      subtitle="For account help, safety concerns, deletion requests, or technical issues, contact The Nair Root support."
    >
      <PolicySection title="Contact">
        <p>Email us at <a className="font-semibold text-maroon hover:underline" href="mailto:hello@thenairroot.com">hello@thenairroot.com</a>.</p>
        <a className="admin-primary mt-2" href="mailto:hello@thenairroot.com?subject=The%20Nair%20Root%20support%20request">
          Email support
        </a>
      </PolicySection>

      <PolicySection title="Support Topics">
        <PolicyList
          items={[
            'Account access.',
            'Profile correction.',
            'Delete account / data request.',
            'Report abuse or safety concern.',
            'Premium waitlist.',
            'Technical issue.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Safety Concerns">
        <p>If you feel unsafe or see abusive behavior, contact support with the profile name, UID if known, screenshots if appropriate, and a brief description of what happened.</p>
        <p>For immediate danger or emergencies, contact local emergency services first.</p>
      </PolicySection>

      <PolicySection title="Helpful Links">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/privacy" className="rounded-2xl border border-line bg-ivory p-4 font-semibold text-maroon hover:border-gold">Privacy Policy</Link>
          <Link href="/terms" className="rounded-2xl border border-line bg-ivory p-4 font-semibold text-maroon hover:border-gold">Terms of Service</Link>
          <Link href="/delete-account" className="rounded-2xl border border-line bg-ivory p-4 font-semibold text-maroon hover:border-gold">Delete Account</Link>
        </div>
      </PolicySection>
    </PublicPolicyPage>
  );
}
