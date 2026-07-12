'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  checkAdminRecord,
  hasPermission,
  type AdminDebugInfo,
  type AdminPermission,
  type AdminRecord,
} from '@/lib/admin';

const navItems: Array<{ href: string; label: string; permission: AdminPermission }> = [
  { href: '/admin', label: 'Dashboard', permission: 'viewDashboard' },
  { href: '/admin/users', label: 'Users', permission: 'viewUsers' },
  { href: '/admin/profiles', label: 'Profiles', permission: 'viewProfiles' },
  { href: '/admin/introductions', label: 'Introductions', permission: 'viewConversations' },
  { href: '/admin/conversations', label: 'Conversations', permission: 'viewConversations' },
  { href: '/admin/messages', label: 'Messages', permission: 'viewMessages' },
  { href: '/admin/waitlist', label: 'Waitlist', permission: 'viewWaitlist' },
  { href: '/admin/reports', label: 'Reports', permission: 'viewReports' },
  { href: '/admin/audit', label: 'Audit Logs', permission: 'writeAuditLogs' },
];

export function AdminShell({
  children,
  permission,
}: {
  children: (admin: AdminRecord) => ReactNode;
  permission: AdminPermission;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [admin, setAdmin] = useState<AdminRecord | null>(null);
  const [debug, setDebug] = useState<AdminDebugInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function check() {
      if (loading) return;
      if (!user) {
        setAdmin(null);
        setDebug(null);
        setChecking(false);
        return;
      }

      setChecking(true);
      setError(null);
      try {
        const result = await checkAdminRecord(user, permission);
        if (alive) {
          setAdmin(result.record);
          setDebug(result.debug);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Unable to verify admin access.');
      } finally {
        if (alive) setChecking(false);
      }
    }

    check();
    return () => {
      alive = false;
    };
  }, [loading, permission, user]);

  if (loading || checking) {
    return <AdminFrame pathname={pathname} admin={admin}><CenteredState title="Checking admin access" /></AdminFrame>;
  }

  if (!user) {
    return (
      <AdminFrame pathname={pathname} admin={admin}>
        <CenteredState
          title="Sign in required"
          body="Admin Console uses the existing Firebase Email + Password sign-in."
          action={<Link className="admin-primary" href="/login">Go to sign in</Link>}
        />
      </AdminFrame>
    );
  }

  if (error || !admin || !hasPermission(admin, permission)) {
    return (
      <AdminFrame pathname={pathname} admin={admin}>
        <CenteredState
          title="Access denied"
          body="This route is available only to active admins with the required permission."
          debug={debug}
          error={error}
        />
      </AdminFrame>
    );
  }

  return <AdminFrame pathname={pathname} admin={admin}>{children(admin)}</AdminFrame>;
}

function AdminFrame({
  children,
  pathname,
  admin,
}: {
  children: ReactNode;
  pathname: string;
  admin: AdminRecord | null;
}) {
  return (
    <div className="min-h-screen bg-ivory text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-line bg-maroon-deep px-5 py-6 text-cream lg:block">
          <div>
            <p className="font-serif text-2xl font-semibold">The Nair Root</p>
            <p className="mt-1 text-sm text-cream/65">Admin Console</p>
          </div>
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                  pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                    ? 'bg-cream text-maroon'
                    : 'text-cream/75 hover:bg-cream/10 hover:text-cream'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Founder operations</p>
                <h1 className="mt-1 font-serif text-2xl font-semibold text-charcoal">Admin Console</h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {admin && (
                  <>
                    <span className="rounded-full border border-line bg-ivory px-3 py-1 text-muted">{admin.email}</span>
                    <span className="rounded-full bg-maroon px-3 py-1 font-semibold text-cream">{admin.role ?? 'admin'}</span>
                  </>
                )}
                <Link className="rounded-full border border-line-strong bg-cream px-4 py-2 font-semibold text-maroon hover:border-gold" href="/discover">
                  Back to app
                </Link>
              </div>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
                    pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
                      ? 'bg-maroon text-cream'
                      : 'border border-line bg-ivory text-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>
          <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function CenteredState({
  title,
  body,
  action,
  debug,
  error,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  debug?: AdminDebugInfo | null;
  error?: string | null;
}) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="max-w-md rounded-3xl border border-line bg-cream p-8 text-center shadow-card">
        <h2 className="font-serif text-2xl font-semibold text-charcoal">{title}</h2>
        {body && <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>}
        {action && <div className="mt-6">{action}</div>}
        {process.env.NODE_ENV === 'development' && debug && (
          <details className="mt-6 rounded-2xl border border-line bg-ivory p-4 text-left">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Admin access debug
            </summary>
            <dl className="mt-3 space-y-2 break-words text-xs text-ink/80">
              <DebugRow label="Current Firebase UID" value={debug.currentUid} />
              <DebugRow label="Current email" value={debug.currentEmail ?? 'null'} />
              <DebugRow label="Admin doc path" value={debug.adminDocPath} />
              <DebugRow label="getDoc succeeded" value={String(debug.getDocSucceeded)} />
              <DebugRow label="Admin doc exists" value={String(debug.docExists)} />
              <DebugRow label="Active value" value={String(debug.activeValue)} />
              <DebugRow label="Role value" value={String(debug.roleValue)} />
              <DebugRow label="Permission checked" value={debug.permissionChecked ?? 'none'} />
              <DebugRow label="Firestore error code" value={debug.firestoreErrorCode ?? 'none'} />
              <DebugRow label="Firestore error message" value={debug.firestoreErrorMessage ?? error ?? 'none'} />
            </dl>
          </details>
        )}
      </div>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
