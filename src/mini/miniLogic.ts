import type { ClockFormat, DayPrayerTimes, IqamaDelays } from '../types/prayer';
import {
  buildScheduleEntries,
  nextAfterIqama,
  type PrayerPhase,
  type ScheduleKey,
} from '../services/prayerSchedule';

export type MiniKey = ScheduleKey;

export interface MiniEntry {
  key: MiniKey;
  /** Absolute epoch ms of the adhan (Tunis UTC+1). */
  at: number;
  /** Absolute epoch ms of the Iqama; null for Sunrise / not-configured. */
  iqamaAt: number | null;
}

export const MINI_CELLS: readonly { key: MiniKey; abbr: string }[] = [
  { key: 'Fajr', abbr: 'FAJ' },
  { key: 'Sunrise', abbr: 'SUN' },
  { key: 'Dhuhr', abbr: 'DHU' },
  { key: 'Asr', abbr: 'ASR' },
  { key: 'Maghrib', abbr: 'MAG' },
  { key: 'Isha', abbr: 'ISH' },
] as const;

/**
 * 6-entry list (5 prayers + Sunrise) with absolute ms timestamps and the
 * configured Iqama timestamps. Built on the SHARED schedule service so the
 * floating widget and the principal widget never diverge. Sunrise is
 * optional in the API payload; it is skipped when missing.
 * Returns null when any required prayer time is malformed.
 */
export function buildMiniEntries(
  day: DayPrayerTimes | null,
  delays: IqamaDelays = {},
): MiniEntry[] | null {
  if (!day) return null;
  const schedule = buildScheduleEntries(day, delays, true);
  if (!schedule || schedule.length < 5) return null;
  return schedule.map((e) => ({ key: e.key as MiniKey, at: e.prayerAt, iqamaAt: e.iqamaAt }));
}

export interface NextMiniResult {
  key: MiniKey;
  at: number;
  iqamaAt: number | null;
  /** Countdown target: adhan before the adhan, Iqama while waiting. */
  target: number;
  phase: PrayerPhase;
  isTomorrow: boolean;
}

/**
 * Next mini entry after the Iqama-completion boundary. Delegates to the
 * shared scheduler (services/prayerSchedule) — one transition engine for both
 * widgets. `tomorrowFajr` may be a bare adhan timestamp (legacy, no Iqama
 * hold) or a full MiniEntry.
 */
export function getNextMini(
  now: number,
  entries: MiniEntry[] | null,
  tomorrowFajr: MiniEntry | number | null,
): NextMiniResult | null {
  if (!entries || entries.length === 0) return null;
  const tomorrowEntry =
    typeof tomorrowFajr === 'number'
      ? (tomorrowFajr > 0 ? ({ key: 'Fajr' as const, prayerAt: tomorrowFajr, iqamaAt: null } as const) : null)
      : (tomorrowFajr
          ? { key: tomorrowFajr.key, prayerAt: tomorrowFajr.at, iqamaAt: tomorrowFajr.iqamaAt }
          : null);
  const sched = entries.map((e) => ({ key: e.key, prayerAt: e.at, iqamaAt: e.iqamaAt }));
  const r = nextAfterIqama(now, sched, tomorrowEntry, entries[0]!.at);
  if (!r) return null;
  return {
    key: r.key as MiniKey,
    at: r.prayerAt,
    iqamaAt: r.iqamaAt,
    target: r.target,
    phase: r.phase,
    isTomorrow: r.isTomorrow,
  };
}

/** Countdown as "HH:MM:SS" (two digits per unit), clamped at 00:00:00. */
export function formatMiniCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** HH:MM string in 12h or 24h format (mini widget header + cells). */
export function formatMiniTime(hhmmSource: string, clockFormat: ClockFormat): string {
  const p = /^(\d{1,2}):(\d{2})$/.exec(hhmmSource);
  if (!p) return '--:--';
  const h = Number(p[1]);
  const m = p[2];
  if (clockFormat === '12h') {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12)}:${m} ${suffix}`;
  }
  return `${String(h).padStart(2, '0')}:${m}`;
}

/** Live clock with seconds: "HH:MM:SS" (24h) or "h:MM:SS AM/PM" (12h). */
export function formatMiniClock(
  h: number,
  m: number,
  s: number,
  clockFormat: ClockFormat,
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (clockFormat === '12h') {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)}:${pad(s)} ${suffix}`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
