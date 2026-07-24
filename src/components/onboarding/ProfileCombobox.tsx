'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MANUAL_OPTION_VALUE, type ProfileOption } from '@/lib/onboarding/options';
import { compactProfileText, isManualPlaceholder } from '@/lib/onboarding/profileValidation';

export function ProfileCombobox({
  label,
  value,
  options,
  onChange,
  required,
  optional,
  allowManual,
  allowClear,
  error,
  placeholder = 'Select',
}: {
  label: string;
  value: string;
  options: readonly ProfileOption[];
  onChange: (value: string) => void;
  required?: boolean;
  optional?: boolean;
  allowManual?: boolean;
  allowClear?: boolean;
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState(false);
  const [manualError, setManualError] = useState('');
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      `${option.label} ${option.search ?? ''}`.toLowerCase().includes(normalized),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const dialog = searchRef.current?.closest('[role="dialog"]');
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, options, value]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openDialog() {
    const customValue = !!value && !options.some((option) => option.value === value);
    setManual(customValue);
    setQuery(customValue ? value : '');
    setManualError('');
    setOpen(true);
  }

  function select(option: ProfileOption) {
    if (option.manual || option.value === MANUAL_OPTION_VALUE) {
      setManual(true);
      setQuery('');
      requestAnimationFrame(() => searchRef.current?.focus());
      return;
    }
    onChange(option.value);
    close();
  }

  function saveManual() {
    const custom = compactProfileText(query);
    if (custom.length < 2 || custom.length > 80 || isManualPlaceholder(custom)) {
      setManualError('Enter a specific value between 2 and 80 characters.');
      return;
    }
    onChange(custom);
    close();
  }

  return (
    <div>
      <label id={`${id}-label`} className="mb-2 block text-xs font-semibold text-charcoal">
        {label}{required && <span className="text-maroon"> *</span>}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}`}
        aria-describedby={error ? errorId : undefined}
        onClick={openDialog}
        className={`flex min-h-12 w-full items-center justify-between rounded-xl border bg-cream px-4 py-3 text-left text-sm outline-none transition focus:ring-2 focus:ring-maroon/25 ${error ? 'border-red-500' : 'border-line-strong hover:border-gold'}`}
      >
        <span className={selectedLabel ? 'text-ink' : 'text-muted'}>{selectedLabel || placeholder}</span>
        <span aria-hidden className="text-gold">⌄</span>
      </button>
      {error && <p id={errorId} className="mt-1.5 text-xs text-red-700">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/45 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby={`${id}-dialog-title`} className="max-h-[82dvh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id={`${id}-dialog-title`} className="font-serif text-xl font-semibold text-charcoal">{manual ? `Enter ${label.toLowerCase()}` : label}</h2>
              <button type="button" onClick={close} className="min-h-11 rounded-full px-3 text-sm font-semibold text-maroon focus:ring-2 focus:ring-maroon/25">Cancel</button>
            </div>
            <div className="p-5">
              <input
                ref={searchRef}
                value={query}
                maxLength={80}
                onChange={(event) => { setQuery(event.target.value); setManualError(''); }}
                placeholder={manual ? 'Type a specific value' : 'Search options'}
                aria-label={manual ? `Enter ${label}` : `Search ${label}`}
                className="w-full rounded-xl border border-line-strong bg-ivory px-4 py-3 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-maroon/20"
              />
              {manual ? (
                <div className="pt-4">
                  {manualError && <p className="mb-3 text-xs text-red-700">{manualError}</p>}
                  <button type="button" onClick={saveManual} className="min-h-12 w-full rounded-full bg-maroon px-5 text-sm font-semibold text-cream focus:ring-2 focus:ring-maroon/30">Save custom value</button>
                </div>
              ) : (
                <div role="listbox" aria-label={`${label} options`} className="mt-3 max-h-[48dvh] overflow-y-auto">
                  {filtered.map((option) => (
                    <button
                      key={`${option.value}-${option.label}`}
                      type="button"
                      role="option"
                      aria-selected={value === option.value}
                      onClick={() => select(option)}
                      className="flex min-h-12 w-full items-center justify-between border-b border-line px-2 py-3 text-left text-sm text-ink outline-none hover:bg-ivory focus:bg-ivory"
                    >
                      <span>{option.label}</span>{value === option.value && <span className="font-bold text-maroon">✓</span>}
                    </button>
                  ))}
                  {!filtered.length && <p className="py-8 text-center text-sm text-muted">No matching options</p>}
                  {allowManual && compactProfileText(query).length >= 2 && !isManualPlaceholder(query) && (
                    <button type="button" onClick={saveManual} className="mt-3 min-h-12 w-full rounded-xl border border-gold/50 bg-gold/10 px-4 text-sm font-semibold text-maroon">
                      Use “{compactProfileText(query)}”
                    </button>
                  )}
                </div>
              )}
              {allowClear && value && (
                <button type="button" onClick={() => { onChange(''); close(); }} className="mt-3 min-h-11 w-full border-t border-line pt-3 text-sm font-semibold text-red-700">
                  Clear selection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
