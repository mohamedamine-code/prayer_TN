import { Sun, Moon } from 'lucide-react';
import type { DayPrayerTimes } from '../types/prayer';
import { useMemo } from 'react';
import type { Language, ClockFormat } from '../types/prayer';
import type { Dict } from '../i18n';

interface Props {
  today: DayPrayerTimes | null;
  language: Language;
  clockFormat: ClockFormat;
  clock: { h: number; m: number; s: number };
  t: Dict;
}

const LOCALES: Record<Language, string> = {
  fr: 'fr-TN',
  ar: 'ar-TN',
  en: 'en-GB',
};

export function DateDisplay({ today, language, clockFormat, clock, t }: Props): JSX.Element {
  const gregorian = useMemo(() => {
    // "Etc/GMT-1" == UTC+1 == Africa/Tunis, formatted without locale deps.
    const now = new Date();
    try {
      return new Intl.DateTimeFormat(LOCALES[language], {
        timeZone: 'Africa/Tunis',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return now.toDateString();
    }
  }, [language]);

  const hijri = useMemo(() => {
    if (!today) return null;
    const { hijri: h } = today;
    const monthName = language === 'ar' ? h.monthAr : h.monthEn;
    return `${h.day} ${monthName} ${h.year} AH`;
  }, [today, language]);

  const timeStr = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (clockFormat === '12h') {
      const suffix = clock.h < 12 ? 'AM' : 'PM';
      const h12 = clock.h % 12 === 0 ? 12 : clock.h % 12;
      return `${h12}:${pad(clock.m)}:${pad(clock.s)} ${suffix}`;
    }
    return `${pad(clock.h)}:${pad(clock.m)}:${pad(clock.s)}`;
  }, [clock, clockFormat]);

  return (
    <section className="mx-4 mb-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-medium capitalize text-[var(--text-primary)]">
            {gregorian}
          </div>
          <div className="truncate font-arabic text-[11px] text-[var(--text-muted)]">
            {hijri ?? '...'}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-[var(--accent-softer)] px-2 py-1 text-[var(--accent)]">
          {clock.h >= 6 && clock.h < 19 ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          <span className="font-mono text-[12px] font-semibold tabular-nums">{timeStr}</span>
        </div>
      </div>
      {today && today.timings.Sunrise && (
        <div className="mt-1 text-[10px] text-[var(--text-faint)]">
          ☀ {t.sunrise} : {today.timings.Sunrise}
        </div>
      )}
    </section>
  );
}
