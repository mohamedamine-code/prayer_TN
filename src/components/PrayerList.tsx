import { CheckCircle2, Circle } from 'lucide-react';
import type { JSX } from 'react';
import type { ClockFormat, Language, PrayerKey } from '../types/prayer';
import type { CompletedMap } from '../services/storage';
import type { PrayerTimeEntry } from '../logic/times';
import { getDict, prayerName } from '../i18n';
import { formatTime, prayerIcon } from './prayerDisplay';

interface Props {
  entries: PrayerTimeEntry[];
  rawTimings: Record<PrayerKey, string | undefined>;
  /** Index of the upcoming prayer within entries (entries.length if next is tomorrow's Fajr). */
  nextIndex: number;
  nextIsTomorrow: boolean;
  completed: CompletedMap;
  onToggleCompleted: (key: PrayerKey) => void;
  language: Language;
  clockFormat: ClockFormat;
}

export function PrayerList({
  entries,
  rawTimings,
  nextIndex,
  nextIsTomorrow,
  completed,
  onToggleCompleted,
  language,
  clockFormat,
}: Props): JSX.Element {
  const t = getDict(language);

  return (
    <section className="mx-4 mb-2 space-y-1.5">
      {entries.map((entry, i) => {
        const Icon = prayerIcon(entry.key);
        const isNext = !nextIsTomorrow && i === nextIndex;
        const isPast = i < nextIndex || (nextIsTomorrow && i < entries.length);
        const done = completed[entry.key] === true;

        let highlight = 'border-[var(--border-subtle)] bg-[var(--bg-card)]';
        if (isNext) {
          highlight =
            'border-[rgba(52,211,153,0.45)] bg-[var(--accent-softer)] shadow-[0_0_0_1px_rgba(52,211,153,0.25)]';
        } else if (isPast) {
          highlight = 'border-[var(--border-subtle)] bg-[var(--bg-card)] opacity-70';
        }

        return (
          <div
            key={entry.key}
            className={`app-no-drag flex items-center gap-2.5 rounded-xl border px-3 py-2 transition ${highlight}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                isNext ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`truncate text-[12.5px] font-semibold ${
                    isNext ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {prayerName(entry.key, language)}
                </span>
                <span className="font-arabic truncate text-[11px] text-[var(--text-muted)]">
                  {prayerName(entry.key, 'ar')}
                </span>
              </div>
            </div>

            <div
              className={`font-mono text-[13px] font-semibold tabular-nums ${
                isNext ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
              }`}
            >
              {formatTime(rawTimings[entry.key], clockFormat)}
            </div>

            <button
              type="button"
              onClick={() => onToggleCompleted(entry.key)}
              title={done ? t.completed : t.markCompleted}
              className={`ml-0.5 rounded-md p-1 transition ${
                done
                  ? 'text-[var(--accent)] hover:brightness-125'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-muted)]'
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </button>
          </div>
        );
      })}
    </section>
  );
}
