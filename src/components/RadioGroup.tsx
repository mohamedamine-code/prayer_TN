import type { ComponentType } from 'react';

export interface RadioGroupOption<V extends string | number> {
  value: V;
  label: string;
  /** Optional leading icon (e.g. the theme switcher's sun/moon/sparkle). */
  icon?: ComponentType<{ className?: string }>;
}

export type RadioGroupOptions<V extends string | number> = RadioGroupOption<V>[];

export function RadioGroup<V extends string | number>({
  value,
  options,
  onChange,
  stacked = false,
}: {
  value: V;
  options: RadioGroupOption<V>[];
  onChange: (v: V) => void;
  stacked?: boolean;
}): JSX.Element {
  return (
    <div
      className={`gap-1.5 ${stacked ? 'flex flex-col' : 'flex flex-wrap'}`}
      role="radiogroup"
    >
      {(options as RadioGroupOption<V>[]).map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={`app-no-drag flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition ${
              o.value === value
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/40'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
