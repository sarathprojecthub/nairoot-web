import Link from 'next/link';
import { BrandLogo } from '@/components/ui/BrandLogo';

const publicLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/delete-account', label: 'Delete Account' },
  { href: '/support', label: 'Support' },
];

export function PublicPolicyPage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-ivory text-ink">
      <header className="border-b border-line bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/discover" className="flex items-center gap-3">
            <BrandLogo className="h-10 w-10 shrink-0" />
            <span>
              <span className="block font-serif text-xl font-semibold text-charcoal">The Nair Root</span>
              <span className="block text-xs text-muted">For meaningful introductions</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-2">
            {publicLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-line bg-ivory px-3.5 py-1.5 text-sm font-semibold text-maroon transition hover:border-gold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-charcoal sm:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-muted">{subtitle}</p>
        </div>

        <article className="mt-8 rounded-3xl border border-line bg-cream p-5 shadow-card sm:p-8">
          <div className="space-y-8 text-sm leading-7 text-ink/85 sm:text-base">{children}</div>
        </article>

        <footer className="mt-8 flex flex-col gap-4 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Questions? Email <a className="font-semibold text-maroon hover:underline" href="mailto:hello@thenairroot.com">hello@thenairroot.com</a>.</p>
          <div className="flex flex-wrap gap-3">
            {publicLinks.map((item) => (
              <Link key={item.href} href={item.href} className="font-semibold text-maroon hover:underline">
                {item.label}
              </Link>
            ))}
          </div>
        </footer>
      </section>
    </main>
  );
}

export function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold text-charcoal">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
