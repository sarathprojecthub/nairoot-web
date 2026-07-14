import type { Metadata } from 'next';
import { PolicyList, PolicySection, PublicPolicyPage } from '@/components/PublicPolicyPage';

export const metadata: Metadata = {
  title: 'Terms of Service | The Nair Root',
  description: 'Terms of Service for The Nair Root.',
};

export default function TermsPage() {
  return (
    <PublicPolicyPage
      eyebrow="Terms of Service"
      title="Terms of Service"
      subtitle="These terms explain the expectations for using The Nair Root respectfully and safely."
    >
      <p className="text-sm font-semibold text-muted">Last updated: July 14, 2026</p>

      <PolicySection title="Purpose of the Service">
        <p>The Nair Root is a matrimony and introduction app for serious, respectful matrimonial exploration. It is designed to help people and families discover compatible introductions with context and care.</p>
      </PolicySection>

      <PolicySection title="Your Responsibilities">
        <PolicyList
          items={[
            'Provide accurate, current, and truthful account and profile information.',
            'Use your own identity and do not impersonate another person.',
            'Do not harass, abuse, threaten, scam, spam, exploit, or mislead other members.',
            'Do not upload misleading, offensive, unlawful, or non-consensual content.',
            'Respect privacy and do not share another member’s private information without permission.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Introductions and Outcomes">
        <p>Users are responsible for their own interactions, decisions, communications, and offline meetings. The Nair Root does not guarantee any match, marriage, compatibility, response, introduction, or outcome.</p>
      </PolicySection>

      <PolicySection title="Safety and Moderation">
        <p>The Nair Root may review, moderate, hide, suspend, restrict, or remove profiles, content, accounts, or activity when needed for safety, abuse prevention, support, policy enforcement, or legal compliance.</p>
        <p>Admin and safety review may occur for trust and safety, support, abuse prevention, troubleshooting, or legal compliance. Messages are not end-to-end encrypted.</p>
      </PolicySection>

      <PolicySection title="Premium and Payments">
        <p>Premium features are not live yet. Any Premium page or waitlist is informational only, and no payment is currently charged through The Nair Root.</p>
      </PolicySection>

      <PolicySection title="Changes and Availability">
        <p>We may improve, change, pause, or discontinue parts of the service over time. We may update these terms as the product develops.</p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>For questions about these terms, email <a className="font-semibold text-maroon hover:underline" href="mailto:hello@thenairroot.com">hello@thenairroot.com</a>.</p>
      </PolicySection>
    </PublicPolicyPage>
  );
}
