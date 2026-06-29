'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { logout } from '@/lib/auth';

const NAV = [
  { href: '/discover', label: 'Discover' },
  { href: '/introductions', label: 'Introductions' },
  { href: '/chats', label: 'Chats' },
  { href: '/premium', label: 'Premium', accent: true },
  { href: '/profile', label: 'Profile' },
];

export function AppHeader() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [out, setOut] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    if (out) return;
    setOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ivory/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand → Discover */}
        <Link href="/discover" className="flex items-center gap-2.5">
          <BrandLogo className="h-9 w-9 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-lg font-semibold tracking-tight text-charcoal">The Nair Root</span>
            <span className="hidden text-[11px] tracking-wide text-muted sm:block">A quiet place for introductions</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative border-b-2 px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? 'border-gold text-maroon'
                  : 'border-transparent text-ink/60 hover:text-ink'
              }`}
            >
              {item.label}
              {item.accent && !isActive(item.href) && (
                <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-gold" />
              )}
            </Link>
          ))}
        </nav>

        {/* Log out */}
        <button
          onClick={signOut}
          disabled={out}
          className="hidden rounded-full border border-line-strong px-3.5 py-1.5 text-xs font-semibold text-ink/70 transition hover:bg-cream hover:text-ink disabled:opacity-50 md:inline-flex"
        >
          {out ? '…' : 'Log out'}
        </button>
      </div>

      {/* Mobile nav — scrollable pill row */}
      <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 md:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              isActive(item.href) ? 'bg-maroon text-cream' : 'bg-cream text-ink/70 border border-line'
            }`}
          >
            {item.label}
          </Link>
        ))}
        <button
          onClick={signOut}
          disabled={out}
          className="ml-auto shrink-0 rounded-full border border-line-strong px-3.5 py-1.5 text-sm font-medium text-ink/60 disabled:opacity-50"
        >
          {out ? '…' : 'Log out'}
        </button>
      </nav>
    </header>
  );
}
