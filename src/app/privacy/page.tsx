import type { Metadata } from 'next';
import { PolicyList, PolicySection, PublicPolicyPage } from '@/components/PublicPolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy | The Nair Root',
  description: 'Privacy Policy for The Nair Root.',
};

export default function PrivacyPage() {
  return (
    <PublicPolicyPage
      eyebrow="Privacy Policy"
      title="Privacy Policy"
      subtitle="We built The Nair Root for serious matrimonial introductions, with privacy, safety, and clarity at the center of the experience."
    >
      <p className="text-sm font-semibold text-muted">Last updated: July 14, 2026</p>

      <PolicySection title="Information We Collect">
        <PolicyList
          items={[
            'Account information such as name, email address, and phone number if provided.',
            'Profile information such as age or date of birth, gender, community, religion, mother tongue, education, profession, city or location entered by you, family/background details, profile bio, partner preferences, and lifestyle details.',
            'Profile photos and gallery images that you upload.',
            'Introductions, interests, matches, conversations, and messages.',
            'Profile views, activity signals, notification state, reports, blocks, moderation data, premium waitlist status, support requests, and admin audit logs.',
            'Technical information needed to keep the service working, such as authentication state, device/app diagnostics, and security-related logs.',
          ]}
        />
      </PolicySection>

      <PolicySection title="How We Use Information">
        <PolicyList
          items={[
            'To create and secure your account.',
            'To build your profile and show relevant profiles in discovery.',
            'To support introductions, matches, messaging, and relationship-related app features.',
            'To provide support, troubleshoot issues, prevent abuse, investigate reports, enforce safety standards, and comply with legal obligations.',
            'To improve service quality, reliability, privacy controls, and the overall user experience.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Messages and Admin Review">
        <p className="rounded-2xl border border-gold/30 bg-ivory p-4 font-semibold text-charcoal">
          Messages are not end-to-end encrypted. Authorised administrators may review messages when needed for trust and safety, support, abuse prevention, troubleshooting, or legal compliance.
        </p>
        <p>Admin access is restricted and intended for support, moderation, abuse prevention, troubleshooting, and compliance. Sensitive admin access may be recorded in audit logs.</p>
      </PolicySection>

      <PolicySection title="Service Providers">
        <PolicyList
          items={[
            'Firebase / Google Cloud for authentication, database, app infrastructure, and related backend services.',
            'Vercel for web hosting and delivery.',
            'Cloudinary for profile photo uploads and image delivery where used by the web or app experience.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Security">
        <p>We use encryption in transit, Firebase security controls, and access restrictions to protect user data. No online service can guarantee absolute security, but we design access around least-necessary use and operational accountability.</p>
      </PolicySection>

      <PolicySection title="Account Deletion">
        <p>You can request deletion of your account and associated app data at <a className="font-semibold text-maroon hover:underline" href="/delete-account">/delete-account</a>.</p>
        <p>Some records may be retained where required for safety, fraud prevention, abuse prevention, dispute resolution, audit, or legal compliance.</p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>For privacy questions or requests, email <a className="font-semibold text-maroon hover:underline" href="mailto:hello@thenairroot.com">hello@thenairroot.com</a>.</p>
      </PolicySection>
    </PublicPolicyPage>
  );
}
