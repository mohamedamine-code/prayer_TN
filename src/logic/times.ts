import type { DayPrayerTimes, PrayerKey, TimingRow } from '../types/prayer';
import { PRAYER_ORDER } from '../types/prayer';

/** Tunisia observes Africa/Tunis with a fixed UTC+1 offset (no DST since 2009). */
export const TUNIS_TZ = 'Africa/Tunis';
export const TUNIS_UTC_OFFSET_MIN = 60;

/** Matches a trailing " (CET)" / " (EET)" suffix returned by the Aladhan API. */
const TIME_SUFFIX_RE = /\s*\([^)]*\)\s*$/;

export function parseHHMM(raw: string | undefined): { h: number; m: number } | null {
  if (!raw) return null;
  const cleaned = raw.replace(TIME_SUFFIX_RE, '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(cleaned);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/** "10-12-2026" -> [2026, 12, 10]. */
export function parseDateKey(dateKey: string): [number, number, number] | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateKey);
  if (!m) return null;
  return [Number(m[3]), Number(m[2]), Number(m[1])];
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, mo, d] = parseDateKey(dateKey) ?? [2026, 1, 1];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dd}-${mm}-${dt.getUTCFullYear()}`;
}

/** Absolute ms of a wall-clock time on a given dateKey in Tunis (UTC+1, fixed). */
export function wallClockToMs(dateKey: string, h: number, m: number): number {
  const [y, mo, d] = parseDateKey(dateKey) ?? [2026, 1, 1];
  return Date.UTC(y, mo - 1, d, h, m, 0, 0) - TUNIS_UTC_OFFSET_MIN * 60_000;
}

/** Date in the given timezone as a dateKey "DD-MM-YYYY" (matches the API format). */
export function localDateKeyInTz(tz: string, date: Date = new Date()): string {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date); // "yyyy-mm-dd"
  const [y, m, d] = iso.split('-');
  return `${d!}-${m!}-${y!}`;
}

/** Local (device) wall-clock time in the given timezone as a {h,m,s} triple. */
export function wallClockInTz(
  tz: string,
  date: Date = new Date(),
): { h: number; m: number; s: number } {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const val = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0');
  const h = val('hour') % 24;
  return { h, m: val('minute'), s: val('second') };
}

export interface PrayerTimeEntry {
  key: PrayerKey;
  /** Absolute ms (UTC epoch) of the adhan time. */
  at: number;
}

/**
 * Build absolute timestamps for the five prayers of one day,
 * in Tunis local time. Returns null for any invalid prayer row.
 */
export function buildPrayerTimestamps(day: DayPrayerTimes): PrayerTimeEntry[] | null {
  const out: PrayerTimeEntry[] = [];
  for (const key of PRAYER_ORDER) {
    const parsed = parseHHMM(day.timings[key]);
    if (!parsed) return null;
    out.push({ key, at: wallClockToMs(day.dateKey, parsed.h, parsed.m) });
  }
  return out;
}

export interface NextPrayerResult {
  prayer: PrayerKey;
  /** Absolute ms of the vote/prayer time. */
  at: number;
  /** true when the target is Fajr on the following day (after Isha / late night). */
  isTomorrow: boolean;
  /** Prayers of today that have already been reached, in order. */
  elapsed: PrayerKey[];
}

/**
 * Determine the next prayer strictly after `now` (ms epoch).
 * Falls back to tomorrow's Fajr when all of today's prayers have passed.
 */
export function getNextPrayer(
  now: number,
  today: PrayerTimeEntry[],
  tomorrowFajrMs: number | null,
): NextPrayerResult | null {
  if (today.length === 0 && tomorrowFajrMs === null) return null;
  const elapsed: PrayerKey[] = [];
  for (const entry of today) {
    if (entry.at > now) {
      return { prayer: entry.key, at: entry.at, isTomorrow: false, elapsed };
    }
    elapsed.push(entry.key);
  }
  if (tomorrowFajrMs !== null) {
    return { prayer: 'Fajr', at: tomorrowFajrMs, isTomorrow: true, elapsed };
  }
  return null;
}

/** Countdown as "HH:MM:SS" (two digits per unit), clamped at 00:00:00. */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export const COUNTDOWN_PARTS_TZ = TUNIS_TZ;

export type { TimingRow };
