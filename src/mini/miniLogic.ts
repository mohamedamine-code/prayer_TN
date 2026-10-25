import { parseHHMM, wallClockToMs } from '../logic/times';
import type { ClockFormat, DayPrayerTimes } from '../types/prayer';

export type MiniKey = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface MiniEntry {
  key: MiniKey;
  /** Absolute epoch ms of the adhan (Tunis UTC+1). */
  at: number;
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
 * 6-entry list (5 prayers + Sunrise) with absolute ms timestamps.
 * Sunrise is optional in the API payload; it is skipped when missing.
 * Returns null when any required prayer time is malformed.
 */
export function buildMiniEntries(day: DayPrayerTimes | null): MiniEntry[] | null {
  if (!day) return null;
  const ordered: MiniKey[] = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const out: MiniEntry[] = [];
  for (const key of ordered) {
    const raw = day.timings[key];
    if (raw === undefined || raw === null) continue; // Sunrise is optional
    const parsed = parseHHMM(raw);
    if (!parsed) return null;
    out.push({ key, at: wallClockToMs(day.dateKey, parsed.h, parsed.m) });
  }
  if (out.length < 5) return null;
  return out.sort((a, b) => a.at - b.at);
}

export interface NextMiniResult {
  key: MiniKey;
  at: number;
  isTomorrow: boolean;
}

/** Next mini entry strictly after `now`; tomorrow's Fajr after the last one. */
export function getNextMini(
  now: number,
  entries: MiniEntry[] | null,
  tomorrowFajrMs: number | null,
): NextMiniResult | null {
  if (!entries || entries.length === 0) return null;
  for (const e of entries) {
    if (e.at > now) return { key: e.key, at: e.at, isTomorrow: false };
  }
  if (tomorrowFajrMs !== null) return { key: 'Fajr', at: tomorrowFajrMs, isTomorrow: true };
  return null;
}

/** "1h 5m" over an hour, "4m 20s" under an hour, "45s" under a minute. */
export function formatMiniCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
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
