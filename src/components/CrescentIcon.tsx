import type { ReactNode } from 'react';

export function CrescentIcon({ className = '' }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M15.5 3.5a9 9 0 1 0 5 16.3A10.5 10.5 0 0 1 8.6 5.4a9.9 9.9 0 0 1 6.9-1.9Z"
        fill="url(#crescent-grad)"
      />
      <circle cx="17.5" cy="6.5" r="1.1" fill="#fbbf24" />
      <circle cx="19.8" cy="9" r="0.7" fill="#fbbf24" />
      <defs>
        <linearGradient id="crescent-grad" x1="8" y1="4" x2="18" y2="19">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
    </svg>
  );
}
