'use client';

import type { ReactNode } from 'react';

// ─── Reusable, responsive form primitives for the onboarding wizard. ──────────

export function FieldLabel({
  children,
  optional,
  required,
}: {
  children: ReactNode;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-medium text-stone-600">
      {children}
      {required && <span className="text-amber-600"> *</span>}
      {optional && <span className="font-normal text-stone-400"> (optional)</span>}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{children}</p>;
}

export function FieldError({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-red-600">{children}</p>;
}

export function Field({ children }: { children: ReactNode }) {
  return <div className="mb-7">{children}</div>;
}

// ── Single-select chip ────────────────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
        selected
          ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
      }`}
    >
      {label}
    </button>
  );
}

export function ChipGroup({
  options,
  value,
  onChange,
  toggleable,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  // when true, clicking the selected chip clears it (matches Android optional chips)
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
export function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  maxLength,
  autoFocus,
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
      className="w-full rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 5,
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
        className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
      />
      <div className="mt-1 text-right text-xs text-stone-400">
        {maxLength - value.length} left
      </div>
    </div>
  );
}

// ── Selectable card (label + sub) for grids / radio-style lists ───────────────
export function OptionCard({
  label,
  sub,
  selected,
  onClick,
  className = '',
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
          ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500'
          : 'border-stone-200 bg-white hover:border-stone-300'
      } ${className}`}
    >
      <div className={`text-sm font-semibold ${selected ? 'text-amber-700' : 'text-stone-800'}`}>
        {label}
      </div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </button>
  );
}

// ── Primary CTA button used in the shell footer ───────────────────────────────
export function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
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
      className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}
