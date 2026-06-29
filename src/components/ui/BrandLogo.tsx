// Brand mark — a gold sprout/root on a maroon seal. Pure SVG (no external image),
// evokes "The Nair Root": something cultivated, growing, rooted.
export function BrandLogo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="The Nair Root">
      <circle cx="20" cy="20" r="19" fill="#6f2b3a" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="#b1894f" strokeWidth="1.1" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="#b1894f" strokeOpacity="0.35" strokeWidth="0.7" />
      {/* stem */}
      <path d="M20 31 C20 25 20 20 20 11.5" fill="none" stroke="#d8c39c" strokeWidth="1.7" strokeLinecap="round" />
      {/* left leaf */}
      <path d="M20 21.5 C15.3 21 12.7 18 13.2 13.4 C17.6 14.1 19.7 17.2 20 21.5 Z" fill="#d8c39c" />
      {/* right leaf */}
      <path d="M20 24.5 C24.7 24 27.3 21 26.8 16.4 C22.4 17.1 20.3 20.2 20 24.5 Z" fill="#b1894f" />
      {/* roots */}
      <path d="M15.5 30.5 C18 32.3 22 32.3 24.5 30.5" fill="none" stroke="#b1894f" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
