'use client';

import type { ReactNode } from 'react';

// ─── Reusable, responsive, brand-styled form primitives. ──────────────────────

export function FieldLabel({
  children, optional, required,
}: { children: ReactNode; optional?: boolean; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-medium text-ink/80">
      {children}
      {required && <span className="text-gold"> *</span>}
      {optional && <span className="font-normal text-muted"> (optional)</span>}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-muted">{children}</p>;
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-red-600">{children}</p>;
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="mb-7">{children}</div>;
}

// ── Single-select chip ────────────────────────────────────────────────────────
export function Chip({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
        selected
          ? 'border-maroon bg-maroon text-cream shadow-soft'
          : 'border-line-strong bg-cream text-ink/80 hover:border-gold/50'
      }`}
    >
      {label}
    </button>
  );
}

export function ChipGroup({
  options, value, onChange, toggleable,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  toggleable?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Chip
          key={opt}
          label={opt}
          selected={value === opt}
          onClick={() => onChange(toggleable && value === opt ? '' : opt)}
        />
      ))}
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────
const FIELD_CLASS =
  'w-full rounded-lg border border-line-strong bg-cream px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-gold focus:ring-2 focus:ring-gold/20';

export function TextField({
  value, onChange, placeholder, type = 'text', inputMode, maxLength, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel';
  maxLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      inputMode={inputMode}
      value={value}
      maxLength={maxLength}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={FIELD_CLASS}
    />
  );
}

export function TextArea({
  value, onChange, placeholder, maxLength, rows = 5,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength: number;
  rows?: number;
}) {
  return (
    <div>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        className={`${FIELD_CLASS} resize-none leading-relaxed`}
      />
      <div className="mt-1 text-right text-xs text-muted">{maxLength - value.length} left</div>
    </div>
  );
}

// ── Selectable card (label + sub) ─────────────────────────────────────────────
export function OptionCard({
  label, sub, selected, onClick, className = '',
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        selected
          ? 'border-gold bg-gold/10 ring-1 ring-gold'
          : 'border-line-strong bg-cream hover:border-gold/50'
      } ${className}`}
    >
      <div className={`text-sm font-semibold ${selected ? 'text-maroon' : 'text-charcoal'}`}>{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </button>
  );
}

// ── Primary CTA button (shell footer + forms) ─────────────────────────────────
export function PrimaryButton({
  children, onClick, disabled, loading,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-maroon px-6 py-3.5 text-sm font-semibold text-cream shadow-soft transition hover:bg-maroon-deep disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />}
      {children}
    </button>
  );
}
