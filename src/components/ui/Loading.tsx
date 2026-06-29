// Shared loading primitives — one consistent, on-brand treatment.

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-line-strong border-t-maroon ${className || 'h-5 w-5'}`}
    />
  );
}

// Centered spinner with an optional label — for list/detail screens while data loads.
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted">
      <Spinner />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
