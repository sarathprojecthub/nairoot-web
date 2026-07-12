'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { copyToClipboard, formatDate, formatValue, type AdminDoc } from '@/lib/admin';

export function AdminPageHeader({
  title,
  eyebrow,
  subtitle,
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">{eyebrow}</p>}
        <h2 className="mt-1 font-serif text-3xl font-semibold text-charcoal">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-cream p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 font-serif text-3xl font-semibold text-maroon">{value == null ? '—' : value.toLocaleString()}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-full border border-line-strong bg-cream px-4 py-2.5 text-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20 lg:w-96"
    />
  );
}

export function DataCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-cream shadow-card ${className}`}>{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <DataCard className="p-8 text-center">
      <p className="font-serif text-xl font-semibold text-charcoal">{title}</p>
      {body && <p className="mt-2 text-sm text-muted">{body}</p>}
    </DataCard>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <DataCard className="border-red-200 bg-red-50 p-5">
      <p className="font-semibold text-red-700">Unable to load this admin view</p>
      <p className="mt-2 text-sm text-red-700/80">{message}</p>
    </DataCard>
  );
}

export function RawJson({ data, label = 'View raw data' }: { data: unknown; label?: string }) {
  return (
    <details className="mt-3 rounded-xl border border-line bg-ivory/70 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</summary>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-ink/80">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-line bg-ivory px-3 py-1 text-xs font-semibold text-maroon hover:border-gold"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export function FieldList({ doc, fields }: { doc: AdminDoc; fields: Array<{ label: string; key: string; date?: boolean }> }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field.key} className="rounded-xl bg-ivory/70 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{field.label}</dt>
          <dd className="mt-1 break-words text-ink">{field.date ? formatDate(doc.data[field.key]) : formatValue(doc.data[field.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' }) {
  const className = {
    neutral: 'bg-ivory text-muted border-line',
    good: 'bg-green-50 text-green-700 border-green-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
  }[tone];

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

export function AdminTable({
  docs,
  columns,
  empty,
}: {
  docs: AdminDoc[];
  columns: Array<{ label: string; render: (doc: AdminDoc) => ReactNode }>;
  empty: string;
}) {
  if (docs.length === 0) return <EmptyState title={empty} />;

  return (
    <DataCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line text-left text-sm">
          <thead className="bg-ivory/80 text-xs uppercase tracking-[0.12em] text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.label} className="px-4 py-3 font-semibold">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {docs.map((doc) => (
              <tr key={doc.id} className="align-top hover:bg-ivory/60">
                {columns.map((column) => (
                  <td key={column.label} className="px-4 py-4">{column.render(doc)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataCard>
  );
}

export function useFilteredDocs(docs: AdminDoc[], search: string, fields: string[]) {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => {
      if (doc.id.toLowerCase().includes(q)) return true;
      return fields.some((field) => formatValue(doc.data[field]).toLowerCase().includes(q));
    });
  }, [docs, fields, search]);
}

export function AdminLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-semibold text-maroon hover:underline">{children}</Link>;
}
