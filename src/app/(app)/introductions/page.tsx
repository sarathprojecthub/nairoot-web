'use client';

import { useIntroductions } from '@/hooks/useIntroductions';
import { IntroductionRow } from '@/components/IntroductionRow';
import { PageSpinner } from '@/components/ui/Loading';
import { SectionHeader } from '@/components/ui/SectionHeader';

function Section({
  title, count, empty, children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        {title}
        {count > 0 && (
          <span className="rounded-full bg-maroon/[0.07] px-2 py-0.5 text-[11px] font-semibold text-maroon">{count}</span>
        )}
      </h2>
      {count > 0 ? (
        <ul className="space-y-3">{children}</ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong bg-cream/60 px-4 py-10 text-center text-sm text-muted">
          {empty}
        </div>
      )}
    </section>
  );
}

export default function IntroductionsPage() {
  const { received, sent, loading } = useIntroductions();

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        eyebrow="Private & mutual"
        title="Introductions"
        subtitle="Considered both ways — shared only when both say yes. Updated live."
        className="mb-8"
      />

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <Section title="Received" count={received.length} empty="No introductions received yet. They’ll appear here as members express interest.">
            {received.map((item) => (
              <IntroductionRow key={item.intro.id} item={item} side="received" />
            ))}
          </Section>

          <Section title="Sent" count={sent.length} empty="You haven’t expressed interest yet. Browse Discover to begin.">
            {sent.map((item) => (
              <IntroductionRow key={item.intro.id} item={item} side="sent" />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}
