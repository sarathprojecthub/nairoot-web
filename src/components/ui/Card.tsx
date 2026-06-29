import type { ReactNode } from 'react';

// Rounded, soft-bordered surface with a tasteful shadow. The base building block
// for the premium card-driven layout.
export function Card({
  children, className = '', as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return (
    <Tag className={`rounded-2xl border border-line bg-cream shadow-soft ${className}`}>
      {children}
    </Tag>
  );
}
