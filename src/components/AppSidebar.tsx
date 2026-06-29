'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useUid } from '@/hooks/useUid';
import { useSentInterests } from '@/hooks/useSentInterests';
import { usePendingIntroductions } from '@/components/PendingIntroductionsProvider';
import { subscribeSent, subscribeReceived } from '@/lib/introductions';

// Shared authenticated left sidebar — rendered once by the (app) shell so the
// brand, nav, activity stats and premium card stay consistent across Discover,
// Introductions, Chats, Premium and Profile (desktop only; mobile uses AppHeader).
export function AppSidebar() {
  const pathname = usePathname() ?? '';
  const uid = useUid();
  const { count: pending } = usePendingIntroductions(); // received pending (real)
  const { sentTo } = useSentInterests();                 // sent pending (real)

  // Matches = accepted introductions (both directions). Cheap, indexed listeners.
  const [matches, setMatches] = useState(0);
  useEffect(() => {
    if (!uid) { setMatches(0); return; }
    let s = 0;
    let r = 0;
    const us = subscribeSent(uid, 'accepted', (x) => { s = x.length; setMatches(s + r); });
    const ur = subscribeReceived(uid, 'accepted', (x) => { r = x.length; setMatches(s + r); });
    return () => { us(); ur(); };
  }, [uid]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Brand + nav */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-b from-[#3a0a18] to-[#250713] p-5 text-cream shadow-card">
        <Link href="/discover" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-cream/95">
            <BrandLogo className="h-9 w-9" />
          </span>
          <div className="leading-tight">
            <p className="font-serif text-base font-semibold">The Nair Root</p>
            <p className="text-[11px] text-cream/60">Rooted in tradition. United by values.</p>
          </div>
        </Link>

        <nav className="mt-5 space-y-1 text-sm">
          <SideNav href="/discover" label="Discover" icon={<CompassIcon className="h-4 w-4" />} active={isActive('/discover')} />
          <SideNav href="/introductions" label="Introductions" icon={<UsersIcon className="h-4 w-4" />} active={isActive('/introductions')} badge={pending} />
          <SideNav href="/chats" label="Chats" icon={<ChatIcon className="h-4 w-4" />} active={isActive('/chats')} />
          <SideNav href="/premium" label="Premium" icon={<SparkleIcon className="h-4 w-4" />} active={isActive('/premium')} accent />
          <SideNav href="/profile" label="Profile" icon={<UserIcon className="h-4 w-4" />} active={isActive('/profile')} />
        </nav>
      </div>

      {/* Activity */}
      <div className="rounded-3xl border border-line bg-cream p-5 shadow-soft">
        <div className="flex items-baseline justify-between">
          <p className="font-serif text-base font-semibold text-charcoal">Your activity</p>
          <span className="text-[11px] text-muted">At a glance</span>
        </div>
        <dl className="mt-3 space-y-2.5">
          <ActivityRow label="Likes sent" value={sentTo.size} />
          <ActivityRow label="Interested in you" value={pending} />
          <ActivityRow label="Matches" value={matches} />
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">Counts update live as members respond.</p>
      </div>

      {/* Premium */}
      <div className="overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/[0.10] to-cream p-5 shadow-soft">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-[#8a6a37]">
          <SparkleIcon className="h-3.5 w-3.5" /> Coming soon
        </span>
        <p className="mt-3 font-serif text-base font-semibold text-charcoal">Premium is coming soon</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">Join the waitlist for advanced filters and priority features.</p>
        <Link
          href="/premium"
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-maroon px-4 py-2.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep"
        >
          Join waitlist
        </Link>
      </div>
    </>
  );
}

function SideNav({ href, label, icon, active, accent, badge }: { href: string; label: string; icon: ReactNode; active?: boolean; accent?: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${
        active ? 'bg-cream/15 text-cream' : 'text-cream/70 hover:bg-cream/10 hover:text-cream'
      }`}
    >
      <span className={accent ? 'text-gold-soft' : ''}>{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-bold text-[#3a0a18]">
          {badge}
        </span>
      )}
      {accent && <span className="h-1.5 w-1.5 rounded-full bg-gold-soft" />}
    </Link>
  );
}

function ActivityRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-serif text-lg font-semibold text-maroon">{value}</dd>
    </div>
  );
}

// ── icons ──
type IconProps = { className?: string };
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function CompassIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></svg>;
}
function UsersIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17.5 19a5.5 5.5 0 0 0-3-4.9" /></svg>;
}
function ChatIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M5 5h14v10H9l-4 4V5Z" /></svg>;
}
function UserIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
}
function SparkleIcon({ className }: IconProps) {
  return <svg viewBox="0 0 24 24" className={className} {...stroke}><path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.6 10.4 12.2 5 10.6 10.4 9 12 3.5Z" /></svg>;
}
