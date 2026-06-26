import type { Metadata } from 'next';
import { AdminConsole } from '@/components/dev/AdminConsole';

// DEVELOPER ONLY — unlinked route, excluded from indexing. All privileged work
// happens server-side behind a secret + the local firebase-tools credential.
export const metadata: Metadata = {
  title: 'Dev Admin — Developer Only',
  robots: { index: false, follow: false },
};

export default function DevAdminPage() {
  return <AdminConsole />;
}
