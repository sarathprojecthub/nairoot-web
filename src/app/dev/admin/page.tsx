import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminConsole } from '@/components/dev/AdminConsole';

// DEVELOPER ONLY — unlinked route, excluded from indexing. All privileged work
// happens server-side behind a secret + the local firebase-tools credential.
// Disabled entirely (404) unless DEV_ADMIN_ENABLED=true is set — present in local
// .env.local, intentionally absent on production hosts.
export const metadata: Metadata = {
  title: 'Dev Admin — Developer Only',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function DevAdminPage() {
  if (process.env.DEV_ADMIN_ENABLED !== 'true') notFound();
  return <AdminConsole />;
}
