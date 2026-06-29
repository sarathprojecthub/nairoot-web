import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { RequireAuth } from '@/components/RequireAuth';
import { PendingIntroductionsProvider } from '@/components/PendingIntroductionsProvider';

// App shell — members-only. RequireAuth ensures a signed-in, onboarded member
// (no anonymous sessions); signed-out or un-onboarded visitors are redirected.
// PendingIntroductionsProvider opens one realtime subscription shared by the
// header badge + Discover banner.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <PendingIntroductionsProvider>
        <div className="min-h-screen bg-ivory">
          <AppHeader />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </PendingIntroductionsProvider>
    </RequireAuth>
  );
}
