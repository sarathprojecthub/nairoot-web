// Shared loading primitives — one consistent treatment across the app so no
// screen shows a bare, left-aligned "Loading…".

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-stone-300 border-t-stone-600 ${className || 'h-5 w-5'}`}
    />
  );
}

// Centered spinner with an optional label — for list/detail screens while data loads.
export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-stone-400">
      <Spinner />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
