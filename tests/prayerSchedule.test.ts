import { describe, expect, it } from 'vitest';
import type { DayPrayerTimes, IqamaDelays } from '../src/types/prayer';
import {
  buildScheduleEntries,
  nextAfterIqama,
  scheduleCountdownTarget,
  tomorrowFajrEntry,
  type ScheduleEntry,
} from '../src/services/prayerSchedule';
import { activeFocusSession } from '../src/services/focusMode';
import { wallClockToMs } from '../src/logic/times';

const DATE = '08-11-2026';
const NEXT_DATE = '09-11-2026';

const at = (h: number, m: number): number => wallClockToMs(DATE, h, m);
const nextAt = (h: number, m: number): number => wallClockToMs(NEXT_DATE, h, m);

const day = (dateKey: string, t: [string, string, string, string, string]): DayPrayerTimes => ({
  dateKey,
  timings: {
    Fajr: t[0]!,
    Sunrise: '06:34',
    Dhuhr: t[1]!,
    Asr: t[2]!,
    Maghrib: t[3]!,
    Isha: t[4]!,
  },
  hijri: { day: '20', monthNumber: 5, monthEn: 'Jumada II', monthAr: 'جمادى الآخرة', year: '1448' },
});

/** Acceptance case: Dhuhr adhan 12:03, Iqama 13:00 (57-min delay). */
const DELAYS: IqamaDelays = { Fajr: 5, Dhuhr: 57, Asr: 10, Maghrib: 5, Isha: 20 };
const TODAY = day(DATE, ['05:07', '12:03', '15:30', '17:33', '18:59']);
const TOMORROW = day(NEXT_DATE, ['05:07', '12:04', '15:08', '17:33', '18:59']);

describe('buildScheduleEntries', () => {
  it('attaches the configured Iqama timestamp to every prayer', () => {
    const entries = buildScheduleEntries(TODAY, DELAYS)!;
    expect(entries.map((e) => e.key)).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    expect(entries[1]!.prayerAt).toBe(at(12, 3));
    expect(entries[1]!.iqamaAt).toBe(at(13, 0));
    expect(entries[2]!.iqamaAt).toBe(at(15, 40));
  });

  it('Sunrise is optional and never carries an Iqama', () => {
    const entries = buildScheduleEntries(TODAY, DELAYS, true)!;
    expect(entries.map((e) => e.key)).toContain('Sunrise');
    expect(entries.find((e) => e.key === 'Sunrise')!.iqamaAt).toBeNull();
  });

  it('returns null for malformed/offline data (no invented times)', () => {
    expect(buildScheduleEntries(day(DATE, ['bad', '12:03', '15:30', '17:33', '18:59']), DELAYS)).toBeNull();
  });

  it('tomorrowFajrEntry carries the next-day Fajr with its Iqama', () => {
    const e = tomorrowFajrEntry(TOMORROW, DELAYS)!;
    expect(e.prayerAt).toBe(nextAt(5, 7));
    expect(e.iqamaAt).toBe(nextAt(5, 12));
  });
});

describe('nextAfterIqama — required acceptance case (Dhuhr 12:03 → Iqama 13:00)', () => {
  const entries = buildScheduleEntries(TODAY, DELAYS, true)!;
  const asr = entries.find((e) => e.key === 'Asr')!;

  it('1. before 12:03 → Dhuhr upcoming, countdown target = adhan 12:03', () => {
    const r = nextAfterIqama(at(12, 2), entries, null, at(0, 0))!;
    expect(r.key).toBe('Dhuhr');
    expect(r.phase).toBe('upcoming');
    expect(r.target).toBe(at(12, 3)); // countdown to the prayer time
  });

  it('2. at exactly 12:03 (adhan) → Dhuhr STAYS active, target = Iqama 13:00', () => {
    const r = nextAfterIqama(at(12, 3), entries, null, at(0, 0))!;
    expect(r.key).toBe('Dhuhr');
    expect(r.phase).toBe('waiting-for-iqama');
    expect(r.target).toBe(at(13, 0));
    expect(r.prayerAt).toBe(at(12, 3));
  });

  it('3. at 12:59:59 → Dhuhr still active (no switch to Asr)', () => {
    const r = nextAfterIqama(at(12, 59) + 59_000, entries, null, at(0, 0))!;
    expect(r.key).toBe('Dhuhr');
    expect(r.phase).toBe('waiting-for-iqama');
  });

  it('4. at exactly 13:00 (Iqama) → schedule advances to Asr', () => {
    const r = nextAfterIqama(at(13, 0), entries, null, at(0, 0))!;
    expect(r.key).toBe('Asr');
    expect(r.phase).toBe('upcoming');
    expect(r.target).toBe(at(15, 30)); // Asr adhan
  });

  it('5. focus countdown target stays the focus end while Focus Mode runs', () => {
    const now = at(13, 5);
    const focus = activeFocusSession(now, { Dhuhr: at(13, 0) } as Partial<Record<'Dhuhr', number>>, 15);
    expect(focus?.prayer).toBe('Dhuhr'); // activeFocusPrayer ≠ nextPrayer
    const r = nextAfterIqama(now, entries, null, at(0, 0))!;
    expect(r.key).toBe('Asr'); // schedule already advanced
    expect(scheduleCountdownTarget(r, focus!.focusEndAt, now)).toBe(focus!.focusEndAt);
  });

  it('6. after the focus session ends the normal countdown returns to Asr', () => {
    const now = at(13, 15) + 1_000;
    const focus = activeFocusSession(now, { Dhuhr: at(13, 0) } as Partial<Record<'Dhuhr', number>>, 15);
    expect(focus).toBeNull();
    const r = nextAfterIqama(now, entries, null, at(0, 0))!;
    expect(r.key).toBe('Asr');
    expect(scheduleCountdownTarget(r, null, now)).toBe(at(15, 30));
  });
});

describe('nextAfterIqama — all five prayers + edges', () => {
  const entries = buildScheduleEntries(TODAY, DELAYS, true)!;

  it('Fajr holds until its 05:12 Iqama, then Sunrise (informational target)', () => {
    expect(nextAfterIqama(at(5, 7), entries, null, at(0, 0))!.key).toBe('Fajr');
    const waiting = nextAfterIqama(at(5, 8), entries, null, at(0, 0))!;
    expect(waiting.phase).toBe('waiting-for-iqama');
    expect(waiting.target).toBe(at(5, 12));
    // Fajr Iqama passed, Sunrise (no Iqama) not yet reached.
    expect(nextAfterIqama(at(5, 12), entries, null, at(0, 0))!.key).toBe('Sunrise');
  });

  it('Asr holds until 15:40, then Maghrib', () => {
    expect(nextAfterIqama(at(15, 31), entries, null, at(0, 0))!.key).toBe('Asr');
    expect(nextAfterIqama(at(15, 39) + 59_000, entries, null, at(0, 0))!.key).toBe('Asr');
    const r = nextAfterIqama(at(15, 40), entries, null, at(0, 0))!;
    expect(r.key).toBe('Maghrib');
    expect(r.phase).toBe('upcoming');
  });

  it('Maghrib holds until 17:38, then Isha', () => {
    expect(nextAfterIqama(at(17, 34), entries, null, at(0, 0))!.key).toBe('Maghrib');
    expect(nextAfterIqama(at(17, 37) + 59_999, entries, null, at(0, 0))!.key).toBe('Maghrib');
    expect(nextAfterIqama(at(17, 38), entries, null, at(0, 0))!.key).toBe('Isha');
  });

  it('Isha holds until 19:19, then falls back to TOMORROW Fajr (with its Iqama)', () => {
    expect(nextAfterIqama(at(19, 0), entries, null, at(0, 0))!.key).toBe('Isha');
    expect(nextAfterIqama(at(19, 18) + 59_999, entries, null, at(0, 0))!.key).toBe('Isha');
    const after = nextAfterIqama(at(19, 19), entries, tomorrowFajrEntry(TOMORROW, DELAYS), at(0, 0))!;
    expect(after.key).toBe('Fajr');
    expect(after.isTomorrow).toBe(true);
    expect(after.target).toBe(nextAt(5, 7)); // next-day adhan
  });

  it('handles past-midnight sleep (e.g. 23:00) — countdown to tomorrow Fajr', () => {
    const r = nextAfterIqama(at(23, 0), entries, tomorrowFajrEntry(TOMORROW, DELAYS), at(0, 0))!;
    expect(r.key).toBe('Fajr');
    expect(r.isTomorrow).toBe(true);
    expect(r.target).toBe(nextAt(5, 7));
  });

  it('anchor = most recent boundary (Fajr Iqama, then Sunrise adhan)', () => {
    // At 12:05 (waiting for Dhuhr iqama) the newest-elapsed boundary is the
    // no-Iqama Sunrise completion 06:34.
    const r = nextAfterIqama(at(12, 5), entries, null, at(0, 0))!;
    expect(r.phase).toBe('waiting-for-iqama');
    expect(r.anchor).toBe(at(6, 34));
  });

  it('returns null with no data at all', () => {
    expect(nextAfterIqama(at(12, 0), null, null, at(0, 0))).toBeNull();
    expect(nextAfterIqama(at(12, 0), [], null, at(0, 0))).toBeNull();
  });

  it('falls back to legacy adhan-only transitions when no Iqama is configured', () => {
    const plain = buildScheduleEntries(TODAY, {}, false)!;
    const r = nextAfterIqama(at(12, 3), plain, null, at(0, 0))!; // at Dhuhr adhan
    expect(r.key).toBe('Asr');
    expect(r.phase).toBe('upcoming');
  });

  it('date rollover: nothing of today blocks after the last Iqama', () => {
    const r = nextAfterIqama(nextAt(0, 0), entries, tomorrowFajrEntry(TOMORROW, DELAYS), at(23, 59));
    expect(r?.key).toBe('Fajr');
    expect(r?.isTomorrow).toBe(true);
  });
});

describe('independent state separation (schedule vs focus)', () => {
  it('nextPrayer and activeFocusPrayer are separate values at the Iqama instant', () => {
    const now = at(13, 0);
    const iqamaMap = { Dhuhr: at(13, 0) } as Partial<Record<'Dhuhr', number>>;
    const sched = nextAfterIqama(now, buildScheduleEntries(TODAY, DELAYS)!, null, at(0, 0))!;
    const focus = activeFocusSession(now, iqamaMap, 15);
    expect(sched.key).toBe('Asr');
    expect(focus?.prayer).toBe('Dhuhr');
    expect(sched.key).not.toBe(focus!.prayer);
  });
});

describe('ScheduleEntry type sanity', () => {
  it('completion boundary uses the Iqama when configured, else the adhan', () => {
    const e: ScheduleEntry = { key: 'Dhuhr', prayerAt: 1000, iqamaAt: 2000 };
    const s: ScheduleEntry = { key: 'Sunrise', prayerAt: 1000, iqamaAt: null };
    expect(e.iqamaAt).toBe(2000);
    expect(s.iqamaAt).toBeNull();
  });
});
