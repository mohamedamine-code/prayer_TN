import { describe, it, expect } from 'vitest';
import {
  buildMiniEntries,
  formatMiniCountdown,
  formatMiniTime,
  getNextMini,
} from '../src/mini/miniLogic';
import { wallClockToMs } from '../src/logic/times';
import type { DayPrayerTimes } from '../src/types/prayer';

const mkDay = (sunrise?: string): DayPrayerTimes => ({
  dateKey: '24-10-2026',
  timings: {
    Fajr: '05:07',
    ...(sunrise ? { Sunrise: sunrise } : {}),
    Dhuhr: '12:04',
    Asr: '15:08',
    Maghrib: '17:33',
    Isha: '18:59',
  },
  hijri: { day: '12', monthNumber: 11, monthEn: 'Jumada al-Ula', monthAr: 'جزمة الأولى', year: '1448' },
});

describe('buildMiniEntries', () => {
  it('produces 6 ordered entries when Sunrise exists', () => {
    const e = buildMiniEntries(mkDay('06:34'))!;
    expect(e.map((x) => x.key)).toEqual(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
  });
  it('skips SUN when Sunrise is missing but keeps the 5 prayers', () => {
    const e = buildMiniEntries(mkDay())!;
    expect(e.map((x) => x.key)).not.toContain('Sunrise');
    expect(e).toHaveLength(5);
  });
  it('returns null on malformed prayer data', () => {
    expect(buildMiniEntries(null)).toBeNull();
  });
});

describe('getNextMini', () => {
  const entries = buildMiniEntries(mkDay('06:34'))!;

  it('returns the future prayer including Sunrise', () => {
    const now = wallClockToMs('24-10-2026', 5, 0);
    expect(getNextMini(now, entries, null)?.key).toBe('Fajr');
    const afterFajr = wallClockToMs('24-10-2026', 5, 30);
    expect(getNextMini(afterFajr, entries, null)?.key).toBe('Sunrise');
  });
  it('moves to next prayer as soon as its time is reached', () => {
    const maghrib = entries.find((x) => x.key === 'Maghrib')!.at;
    expect(getNextMini(maghrib, entries, null)?.key).toBe('Isha');
  });
  it('falls back to tomorrow Fajr after Isha', () => {
    const now = wallClockToMs('24-10-2026', 23, 0);
    const tomorrowFajr = wallClockToMs('25-10-2026', 5, 6);
    const r = getNextMini(now, entries, tomorrowFajr)!;
    expect(r.key).toBe('Fajr');
    expect(r.isTomorrow).toBe(true);
  });
  it('returns null without tomorrow data past the last prayer', () => {
    const now = wallClockToMs('24-10-2026', 23, 0);
    expect(getNextMini(now, entries, null)).toBeNull();
  });
});

describe('formatMiniCountdown', () => {
  it('shows hours and minutes over 1h', () => {
    expect(formatMiniCountdown(60 * 60_000 + 5 * 60_000)).toBe('1h 5m');
    expect(formatMiniCountdown(3 * 3600_000)).toBe('3h');
  });
  it('shows minutes and seconds under 1h', () => {
    expect(formatMiniCountdown(4 * 60_000 + 20_000)).toBe('4m 20s');
  });
  it('shows bare seconds under 1 minute and clamps negatives', () => {
    expect(formatMiniCountdown(45_000)).toBe('45s');
    expect(formatMiniCountdown(-5_000)).toBe('0s');
  });
});

describe('formatMiniTime', () => {
  it('keeps 24h and converts 12h with AM/PM', () => {
    expect(formatMiniTime('17:33', '24h')).toBe('17:33');
    expect(formatMiniTime('17:33', '12h')).toBe('5:33 PM');
    expect(formatMiniTime('05:07', '12h')).toBe('5:07 AM');
    expect(formatMiniTime('bad', '24h')).toBe('--:--');
  });
});
