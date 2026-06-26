import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountNav } from '@/components/AccountNav';
import { JoinBanner } from '@/components/JoinBanner';

// App shell — desktop-first top bar. Bottom-nav / sidebar nav arrives with the
// other tabs (Introductions, Chats, Profile) in later milestones.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/discover" className="flex flex-col leading-tight">
            <span className="font-serif text-lg font-semibold tracking-tight text-stone-900">
              The Nair Root
            </span>
            <span className="text-[11px] text-stone-400">A quiet place for introductions</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-stone-500 sm:gap-5">
            <Link href="/discover" className="font-medium transition hover:text-stone-900">
              Discover
            </Link>
            <Link href="/introductions" className="font-medium transition hover:text-stone-900">
              Introductions
            </Link>
            <Link href="/chats" className="font-medium transition hover:text-stone-900">
              Chats
            </Link>
            <AccountNav />
          </nav>
        </div>
        <JoinBanner />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
