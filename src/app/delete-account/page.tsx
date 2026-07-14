import type { Metadata } from 'next';
import { PolicyList, PolicySection, PublicPolicyPage } from '@/components/PublicPolicyPage';

export const metadata: Metadata = {
  title: 'Delete Account | The Nair Root',
  description: 'Request account and data deletion for The Nair Root.',
};

export default function DeleteAccountPage() {
  return (
    <PublicPolicyPage
      eyebrow="Account Deletion"
      title="Delete your account / Request data deletion"
      subtitle="Deletion is currently handled as a support request so we can verify account ownership and process related data safely."
    >
      <PolicySection title="How to Request Deletion">
        <p>If you have a The Nair Root account, you can request deletion of your account and associated app data by emailing us from your registered email address.</p>
        <a
          className="admin-primary mt-2"
          href="mailto:hello@thenairroot.com?subject=Account%20deletion%20request"
        >
          Email hello@thenairroot.com
        </a>
      </PolicySection>

      <PolicySection title="Include This Information">
        <PolicyList
          items={[
            'Registered email address.',
            'Profile name.',
            'Optional UID if you know it.',
            'The request: “Please delete my The Nair Root account”.',
          ]}
        />
        <p className="rounded-2xl border border-gold/30 bg-ivory p-4 text-sm font-semibold text-charcoal">
          For security, we may ask you to verify ownership of the account before completing deletion.
        </p>
      </PolicySection>

      <PolicySection title="Data That May Be Deleted">
        <PolicyList
          items={[
            'Your public profile.',
            'User account data associated with your app profile.',
            'Profile photos where technically possible.',
            'Premium waitlist entry, if present.',
            'App activity associated with your account where feasible.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Data That May Be Retained">
        <PolicyList
          items={[
            'Admin audit logs.',
            'Safety and moderation records.',
            'Reports and abuse-prevention records.',
            'Records needed for legal compliance, fraud prevention, abuse prevention, dispute resolution, or security.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Messages and Conversations">
        <p>Message and conversation records may be retained where needed for safety, moderation, support, dispute resolution, legal, or abuse-prevention reasons.</p>
        <p>If message deletion or anonymisation becomes automated later, this page and the Privacy Policy will be updated. This page does not claim instant deletion or automated Firebase Auth deletion.</p>
      </PolicySection>
    </PublicPolicyPage>
  );
}
