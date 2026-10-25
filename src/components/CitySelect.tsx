import { useState, type ReactNode } from 'react';
import { Search, Check, X, MapPin } from 'lucide-react';
import { TUNISIAN_CITIES } from '../data/tunisianCities';
import type { Language } from '../types/prayer';

interface Props {
  value: string;
  onChange: (cityId: string) => void;
  language: Language;
  placeholder?: string;
}

export function CitySelect({ value, onChange, language, placeholder }: Props): ReactNode {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const nameOf = (c: { nameFr: string; nameAr: string; nameEn: string }) =>
    language === 'ar' ? c.nameAr : language === 'en' ? c.nameEn : c.nameFr;

  const cities = query
    ? TUNISIAN_CITIES.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.nameFr.toLowerCase().includes(q) ||
          c.nameEn.toLowerCase().includes(q) ||
          c.nameAr.includes(query)
        );
      })
    : TUNISIAN_CITIES;

  return (
    <div className="relative app-no-drag w-full">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] transition hover:border-[var(--border-strong)]"
      >
        <MapPin className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="flex-1 truncate text-start">
          {nameOf(TUNISIAN_CITIES.find((c) => c.id === value) ?? TUNISIAN_CITIES[0]!)}
        </span>
        <svg
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition ${open ? 'rotate-180' : ''}`}
          fill="currentColor"
        >
          <path d="M5.2 7.3a1 1 0 0 1 1.4 0L10 10.6l3.4-3.3a1 1 0 1 1 1.4 1.4l-4.1 4a1 1 0 0 1-1.4 0l-4.1-4a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[#0c241a] shadow-2xl" data-theme="dark">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder ?? 'Rechercher…'}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)]"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]"
              aria-label="Close city list"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {cities.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-start text-sm transition hover:bg-[var(--bg-card-hover)] ${
                  c.id === value ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                }`}
              >
                <span>{nameOf(c)}</span>
                {c.id === value && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
            {cities.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-[var(--text-faint)]">—</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
