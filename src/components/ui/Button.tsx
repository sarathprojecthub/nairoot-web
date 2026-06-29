'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-maroon text-cream hover:bg-maroon-deep shadow-soft',
  gold: 'bg-gold text-cream hover:brightness-95 shadow-soft',
  secondary: 'border border-line-strong bg-cream text-ink hover:bg-ivory-deep',
  ghost: 'text-ink hover:bg-ivory-deep',
  danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3.5 text-sm gap-2',
};

function classes(variant: Variant, size: Size, full?: boolean) {
  return [
    'inline-flex items-center justify-center rounded-full font-semibold tracking-[0.01em]',
    'transition disabled:cursor-not-allowed disabled:opacity-50',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
    VARIANTS[variant],
    SIZES[size],
    full ? 'w-full' : '',
  ].join(' ');
}

export function Button({
  children, onClick, type = 'button', variant = 'primary', size = 'md',
  disabled, loading, fullWidth, className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${classes(variant, size, fullWidth)} ${className}`}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  children, href, variant = 'primary', size = 'md', fullWidth, className = '',
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={`${classes(variant, size, fullWidth)} ${className}`}>
      {children}
    </Link>
  );
}
