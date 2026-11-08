import type { Dict } from '../i18n';
import { prayerName } from '../i18n';
import type { Language, PrayerKey } from '../types/prayer';

interface Props {
  next: { prayer: PrayerKey; isTomorrow: boolean } | null;
  /** Next prayer time as "HH:mm" (city wall clock). */
  nextTimeStr: string;
  countdownText: string;
  /** 0..1 progress toward the next prayer. */
  progress: number;
  language: Language;
  t: Dict;
}

export function NextPrayer({
  next,
  nextTimeStr,
  countdownText,
  progress,
  language,
  t,
}: Props): JSX.Element {
  return (
    <section className="mx-4 mb-2 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--accent-softer)] to-transparent px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-semibold uppercase tracking-[2.5px] text-[#8ba3b5]">
          {t.nextPrayer}
          {next?.isTomorrow ? ` · ${t.countdownTargetTomorrow}` : ''}
        </div>
        <div className="font-mono text-[11px] text-[#8b95a5] tabular-nums">{nextTimeStr}</div>
      </div>

      <div className="mt-1.5 flex items-end gap-2">
        <span className="text-[22px] font-bold leading-none text-[var(--accent)]">
          {next ? prayerName(next.prayer, language === 'ar' ? 'fr' : language) : '—'}
        </span>
        <span
          className="font-arabic text-[18px] leading-none text-[var(--accent-hover)]"
          dir={language === 'ar' ? 'ltr' : 'rtl'}
        >
          {next ? prayerName(next.prayer, 'ar') : ''}
        </span>
      </div>

      <div
        className="font-caveat mt-1 text-[34px] font-semibold leading-[1.15] tracking-normal text-[var(--text-primary)] tabular-nums"
        dir={language === 'ar' ? 'ltr' : undefined}
      >
        {countdownText}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-input)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[#2dd4bf] transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </section>
  );
}
