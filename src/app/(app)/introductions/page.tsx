'use client';

import { useIntroductions } from '@/hooks/useIntroductions';
import { IntroductionRow } from '@/components/IntroductionRow';
import { PageSpinner } from '@/components/ui/Loading';

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">{title}</h2>
      {hasItems ? (
        <ul className="space-y-3">{children}</ul>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-sm text-stone-400">
          {empty}
        </p>
      )}
    </section>
  );
}

export default function IntroductionsPage() {
  const { received, sent, loading } = useIntroductions();

  if (loading) {
    return (
      <div className="max-w-3xl">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">Introductions</h1>
        <p className="mb-8 text-sm text-stone-500">Your active introductions, updated live.</p>
        <PageSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">Introductions</h1>
      <p className="mb-8 text-sm text-stone-500">Your active introductions, updated live.</p>

      <Section title="Received" empty="No introductions received yet.">
        {received.map((item) => (
          <IntroductionRow key={item.intro.id} item={item} side="received" />
        ))}
      </Section>

      <Section title="Sent" empty="You haven’t sent any introductions yet.">
        {sent.map((item) => (
          <IntroductionRow key={item.intro.id} item={item} side="sent" />
        ))}
      </Section>
    </div>
  );
}
