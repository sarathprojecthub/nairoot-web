import type { Metadata } from 'next';
import { PolicyList, PolicySection, PublicPolicyPage } from '@/components/PublicPolicyPage';

export const metadata: Metadata = {
  title: 'Community Guidelines | The Nair Root',
  description: 'Community Guidelines for The Nair Root.',
};

export default function CommunityGuidelinesPage() {
  return (
    <PublicPolicyPage
      eyebrow="Community Guidelines"
      title="Community Guidelines"
      subtitle="These guidelines keep introductions safe, respectful, and genuine for every member of The Nair Root."
    >
      <p className="text-sm font-semibold text-muted">Last updated: August 10, 2026</p>

      <PolicySection title="Purpose">
        <p>The Nair Root exists to support serious, respectful matrimonial introductions. These guidelines set out what we expect from every member so the community stays safe and trustworthy.</p>
      </PolicySection>

      <PolicySection title="Prohibited Conduct">
        <PolicyList
          items={[
            'Harassment or bullying of any member.',
            'Hate speech or discrimination based on caste, religion, gender, disability, or any other characteristic.',
            'Sexual or obscene content of any kind.',
            'Impersonation or fake profiles — you must represent yourself truthfully.',
            'Scams, fraud, or requests for money or financial information.',
            'Threats, violence, or intimidation.',
            'Illegal content or activity of any kind.',
            'Exploitation or abuse of any member, including minors.',
            'Privacy violations — sharing another member’s personal information without consent.',
            'Spam, unsolicited advertising, or repetitive unwanted messages.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Profiles & Photos">
        <p>Use real, recent photos of yourself. Do not upload misleading, offensive, explicit, or non-consensual images. Profile information — age, profession, education, family background — must be accurate.</p>
      </PolicySection>

      <PolicySection title="Respectful Messaging">
        <p>Communicate the way you would want to be communicated with. No harassment, solicitation, or abusive language in messages or introductions. Messages are not end-to-end encrypted, and authorised administrators may review them for trust and safety as described in our Privacy Policy.</p>
      </PolicySection>

      <PolicySection title="Enforcement & Reporting">
        <p>Content or accounts that violate these guidelines may be hidden, restricted, suspended, or removed, consistent with our Terms of Service. If you experience or witness a violation, use the report or block option available on any profile or conversation — every report is reviewed privately by our team.</p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>For questions about these guidelines, email <a className="font-semibold text-maroon hover:underline" href="mailto:hello@thenairroot.com">hello@thenairroot.com</a>.</p>
      </PolicySection>
    </PublicPolicyPage>
  );
}
