import type { ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AppSidebar } from '@/components/AppSidebar';
import { RequireAuth } from '@/components/RequireAuth';
import { PendingIntroductionsProvider } from '@/components/PendingIntroductionsProvider';

// App shell — members-only. RequireAuth ensures a signed-in, onboarded member
// (no anonymous sessions); signed-out or un-onboarded visitors are redirected.
// PendingIntroductionsProvider opens one realtime subscription shared by the
// header badge, sidebar + Discover banner.
//
// Desktop (lg+): a shared sticky maroon sidebar owns primary nav; AppHeader is a
// slim top bar (brand + logout). Mobile/tablet: sidebar hidden, AppHeader keeps
// its mobile nav. Pages render inside <main>, so they no longer each draw a sidebar.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <PendingIntroductionsProvider>
        <div className="min-h-screen bg-ivory">
          <AppHeader />
          <div className="mx-auto max-w-[88rem] px-4 sm:px-6 lg:px-8">
            <div className="gap-8 pb-12 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:pt-8">
              <aside className="hidden lg:block">
                <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto overscroll-contain pr-1">
                  <AppSidebar />
                </div>
              </aside>
              <main className="min-w-0 pt-6 lg:pt-0">{children}</main>
            </div>
          </div>
        </div>
      </PendingIntroductionsProvider>
    </RequireAuth>
  );
}
