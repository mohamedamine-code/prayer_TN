import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey,
  buildPrayerTimestamps,
  formatCountdown,
  getNextPrayer,
  localDateKeyInTz,
  parseHHMM,
  wallClockToMs,
} from '../src/logic/times';
import type { DayPrayerTimes } from '../src/types/prayer';

const day = (dateKey: string, times: [string, string, string, string, string]): DayPrayerTimes => ({
  dateKey,
  timings: {
    Fajr: times[0]!,
    Dhuhr: times[1]!,
    Asr: times[2]!,
    Maghrib: times[3]!,
    Isha: times[4]!,
  },
  hijri: { day: '12', monthNumber: 5, monthEn: 'Jumada I', monthAr: 'جمادى الأولى', year: '1448' },
});

describe('parseHHMM', () => {
  it('parses plain times', () => {
    expect(parseHHMM('05:07')).toEqual({ h: 5, m: 7 });
  });
  it('strips timezone suffixes like " (CET)"', () => {
    expect(parseHHMM('18:52 (CET)')).toEqual({ h: 18, m: 52 });
  });
  it('rejects malformed input', () => {
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('abc')).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
  });
});

describe('wallClockToMs (Africa/Tunis fixed UTC+1)', () => {
  it('converts a wall-clock time to the correct absolute epoch ms', () => {
    // 2026-10-23 05:07 Tunis == 2026-10-23 04:07 UTC
    expect(wallClockToMs('23-10-2026', 5, 7)).toBe(Date.UTC(2026, 9, 23, 4, 7, 0, 0));
  });
  it('wraps to the previous UTC day for early Fajr', () => {
    // 23-10 00:30 Tunis == 22-10 23:30 UTC
    expect(wallClockToMs('23-10-2026', 0, 30)).toBe(Date.UTC(2026, 9, 22, 23, 30));
  });
});

describe('buildPrayerTimestamps', () => {
  it('returns ordered absolute timestamps', () => {
    const d = day('23-10-2026', ['05:07', '12:04', '15:08', '17:33', '18:59']);
    const entries = buildPrayerTimestamps(d);
    expect(entries).not.toBeNull();
    const at = entries!.map((e) => e.at);
    expect(at.every((v, i) => i === 0 || v > at[i - 1]!)).toBe(true);
  });
  it('returns null when any prayer is malformed', () => {
    const d = day('23-10-2026', ['05:07', '12:04', 'bad', '17:33', '18:59']);
    expect(buildPrayerTimestamps(d)).toBeNull();
  });
});

describe('getNextPrayer', () => {
  const d = day('23-10-2026', ['05:07', '12:04', '15:08', '17:33', '18:59']);
  const entries = buildPrayerTimestamps(d)!;
  const fajrAt = entries[0]!.at;
  const ishaAt = entries[4]!.at;

  it('picks the next upcoming prayer mid-day', () => {
    const beforeAsr = entries[2]!.at - 60_000;
    const r = getNextPrayer(beforeAsr, entries, null)!;
    expect(r.prayer).toBe('Asr');
    expect(r.isTomorrow).toBe(false);
    expect(r.elapsed).toEqual(['Fajr', 'Dhuhr']);
  });

  it('countdown switches to next-day Fajr after Isha', () => {
    const afterIsha = ishaAt + 120_000;
    const tomorrowFajr = wallClockToMs('24-10-2026', 5, 6);
    const r = getNextPrayer(afterIsha, entries, tomorrowFajr)!;
    expect(r.prayer).toBe('Fajr');
    expect(r.isTomorrow).toBe(true);
    expect(r.at).toBe(tomorrowFajr);
    expect(r.elapsed).toHaveLength(5);
  });

  it('switches immediately when prayer time arrives (countdown reaches zero)', () => {
    const r = getNextPrayer(entries[2]!.at, entries, null)!; // now == Asr time -> switch to Maghrib
    expect(r.prayer).toBe('Maghrib');
    expect(r.elapsed).toContain('Asr');
  });

  it('handles midnight between Isha and next-day Fajr', () => {
    const midnight = wallClockToMs('24-10-2026', 0, 0);
    const tomorrowFajr = wallClockToMs('24-10-2026', 5, 6);
    const r = getNextPrayer(midnight, entries, tomorrowFajr)!;
    expect(r.prayer).toBe('Fajr');
    expect(r.isTomorrow).toBe(true);
  });

  it('returns null when there is no data at all', () => {
    expect(getNextPrayer(Date.now(), [], null)).toBeNull();
  });

  it('never returns a prayer whose time already passed (edge: last prayer == now)', () => {
    const tomorrowFajr = wallClockToMs('24-10-2026', 5, 6);
    const r = getNextPrayer(ishaAt, entries, tomorrowFajr)!;
    expect(r.prayer).toBe('Fajr'); // tomorrow
    expect(r.isTomorrow).toBe(true);
  });

  it('returns null when the last prayer just ended and no tomorrow data yet', () => {
    expect(getNextPrayer(ishaAt, entries, null)).toBeNull();
  });

  it('uses fajrAt boundary: now == Fajr -> next is Dhuhr later that day', () => {
    const r = getNextPrayer(fajrAt, entries, null)!;
    expect(r.prayer).toBe('Dhuhr');
    expect(r.elapsed).toEqual(['Fajr']);
  });
});

describe('formatCountdown', () => {
  it('formats hours, minutes, seconds padded', () => {
    expect(formatCountdown((1 * 3600 + 24 * 60 + 35) * 1000)).toBe('01 h 24 min 35 s');
  });
  it('clamps negative remainders to zero', () => {
    expect(formatCountdown(-5000)).toBe('00 h 00 min 00 s');
  });
});

describe('addDaysToDateKey', () => {
  it('crosses normal day boundaries', () => {
    expect(addDaysToDateKey('31-10-2026', 1)).toBe('01-11-2026');
  });
  it('crosses month and year boundaries', () => {
    expect(addDaysToDateKey('31-12-2026', 1)).toBe('01-01-2027');
  });
  it('handles leap years', () => {
    expect(addDaysToDateKey('28-02-2028', 1)).toBe('29-02-2028');
  });
});

describe('localDateKeyInTz', () => {
  it('returns DD-MM-YYYY (API format), not en-CA yyyy-mm-dd — regression guard', () => {
    // 2026-10-23T23:00Z is 2026-10-24 00:00 in Tunis (UTC+1).
    const date = new Date(Date.UTC(2026, 9, 23, 23, 0, 0));
    expect(localDateKeyInTz('Africa/Tunis', date)).toBe('24-10-2026');
  });
  it('rolls back correctly across the UTC boundary', () => {
    // 2026-10-24T01:00Z is still 2026-10-24 02:00 in Tunis.
    const date = new Date(Date.UTC(2026, 9, 24, 1, 0, 0));
    expect(localDateKeyInTz('Africa/Tunis', date)).toBe('24-10-2026');
  });
});
