import { describe, expect, it } from 'vitest';
import type { DayPrayerTimes, IqamaDelays } from '../src/types/prayer';
import {
  activeFocusSession,
  focusRemainingRatio,
  formatFocusCountdown,
  IQAMA_NOTIFY_GRACE_MS,
  isIqamaNotificationDue,
  iqamaNotifyKey,
  type FocusWindow,
} from '../src/services/focusMode';
import { buildScheduleEntries } from '../src/services/prayerSchedule';
import { buildPrayerTimestamps, wallClockToMs } from '../src/logic/times';
import { resolveIqamaTimestamps } from '../src/services/iqamaTimes';

const DATE = '08-11-2026';
const NEXT_DATE = '09-11-2026';

const at = (h: number, m: number, extraMs = 0): number => wallClockToMs(DATE, h, m) + extraMs;
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

/** Required acceptance case: Dhuhr 12:03, Iqama 13:00 (57-min delay). */
const DHUHR_WINDOW: FocusWindow = { prayer: 'Dhuhr', prayerAt: at(12, 3), iqamaAt: at(13, 0) };

/** Day with DIFFERENT Iqama delays per prayer (Fajr+5, Dhuhr+57, Asr+10, Maghrib+5, Isha+20). */
const DELAYS: IqamaDelays = { Fajr: 5, Dhuhr: 57, Asr: 10, Maghrib: 5, Isha: 20 };
const TODAY = day(DATE, ['05:07', '12:03', '15:30', '17:33', '18:59']);
const TOMORROW = day(NEXT_DATE, ['05:07', '12:04', '15:08', '17:33', '18:59']);

describe('ACCEPTANCE TESTS a–F (Dhuhr 12:03 → Iqama 13:00)', () => {
  /** Test F detail: app launched mid-interval without knowing previous ticks. */
  const derive = (now: number) => activeFocusSession(now, [DHUHR_WINDOW]);

  it('A: 12:02:59 → Normal Mode (no focus)', () => {
    expect(derive(at(12, 2, 59_000))).toBeNull();
  });

  it('B: 12:03:00 → Focus activates immediately, 57 minutes remaining', () => {
    const s = derive(at(12, 3))!;
    expect(s).not.toBeNull();
    expect(s.prayer).toBe('Dhuhr');
    expect(s.durationMin).toBe(57);
    expect(s.focusEndAt).toBe(at(13, 0));
    expect(formatFocusCountdown(s.focusEndAt - at(12, 3))).toBe('00:57:00');
  });

  it('C: 12:43 → Focus remains active, 17 minutes remaining', () => {
    const s = derive(at(12, 43))!;
    expect(s.prayer).toBe('Dhuhr');
    expect(formatFocusCountdown(s.focusEndAt - at(12, 43))).toBe('00:17:00');
  });

  it('D: 12:59:59 → Focus remains active', () => {
    expect(derive(at(12, 59, 59_999))).not.toBeNull();
  });

  it('E: 13:00:00 → Focus ends; expired focus is never restored', () => {
    expect(derive(at(13, 0))).toBeNull();
    expect(derive(at(13, 15, 1_000))).toBeNull();
  });

  it('F: app starts at 12:43 → Focus restored instantly (stateless derivation)', () => {
    const s = activeFocusSession(at(12, 43), [DHUHR_WINDOW])!;
    expect(s.prayer).toBe('Dhuhr');
    expect(formatFocusCountdown(s.focusEndAt - at(12, 43))).toBe('00:17:00');
  });
});

describe('activeFocusSession — window rule [adhan, iqama)', () => {
  it('duration always = iqama − prayer (never a fixed value)', () => {
    const s = activeFocusSession(at(12, 30), [DHUHR_WINDOW])!;
    expect(s.durationMin).toBe(57);
    expect(s.focusEndAt).toBe(s.iqamaAt);
  });
  it('active at the adhan instant, inactive one ms before it', () => {
    expect(activeFocusSession(at(12, 3) - 1, [DHUHR_WINDOW])).toBeNull();
    expect(activeFocusSession(at(12, 3), [DHUHR_WINDOW])).not.toBeNull();
  });
  it('inactive at the iqama instant (State 3 begins)', () => {
    expect(activeFocusSession(at(13, 0), [DHUHR_WINDOW])).toBeNull();
  });
  it('ignores degenerate windows (iqama not after prayer)', () => {
    expect(activeFocusSession(at(12, 30), [{ prayer: 'Dhuhr', prayerAt: at(12, 3), iqamaAt: at(12, 3) }])).toBeNull();
    expect(
      activeFocusSession(at(12, 30), [{ prayer: 'Dhuhr', prayerAt: at(12, 3), iqamaAt: at(12, 2) }]),
    ).toBeNull();
  });
  it('all five prayers, each with its own delay (integration)', () => {
    const windows = buildScheduleEntries(TODAY, DELAYS)!.map((e) => ({
      prayer: e.key,
      prayerAt: e.prayerAt,
      iqamaAt: e.iqamaAt!,
    }));
    expect(activeFocusSession(at(5, 9), windows)!.prayer).toBe('Fajr');
    expect(activeFocusSession(at(12, 43), windows)!.prayer).toBe('Dhuhr');
    expect(activeFocusSession(at(15, 35), windows)!.prayer).toBe('Asr');
    expect(activeFocusSession(at(17, 35), windows)!.prayer).toBe('Maghrib');
    expect(activeFocusSession(at(19, 5), windows)!.prayer).toBe('Isha');
    // After every iqama: back to Normal Mode (no focus).
    expect(activeFocusSession(at(13, 0), windows)).toBeNull();
    expect(activeFocusSession(at(19, 19), windows)).toBeNull();
  });
  it('Isha window ends before next-day Fajr; next-day Fajr window works after midnight', () => {
    const isha = { prayer: 'Isha' as const, prayerAt: at(18, 59), iqamaAt: at(19, 19) };
    const fajr = { prayer: 'Fajr' as const, prayerAt: nextAt(5, 7), iqamaAt: nextAt(5, 12) };
    expect(activeFocusSession(at(23, 0), [isha, fajr])).toBeNull(); // after midnight sleep
    const s = activeFocusSession(nextAt(5, 10), [isha, fajr])!;
    expect(s.prayer).toBe('Fajr');
    expect(s.durationMin).toBe(5);
  });
  it('multiple day-boundaries: current-day window wins over stale tomorrow window', () => {
    const todayFajr = { prayer: 'Fajr' as const, prayerAt: at(5, 7), iqamaAt: at(5, 12) };
    const tomorrowFajr = { prayer: 'Fajr' as const, prayerAt: nextAt(5, 7), iqamaAt: nextAt(5, 12) };
    const s = activeFocusSession(at(5, 10), [tomorrowFajr, todayFajr])!;
    expect(s.iqamaAt).toBe(at(5, 12));
  });
});

describe('integration — resolveIqamaTimestamps + pc times', () => {
  it('delay configuration produces exact windows for all five prayers', () => {
    const timings = resolveIqamaTimestamps(TODAY.dateKey, TODAY.timings, DELAYS);
    const windows = buildScheduleEntries(TODAY, DELAYS)!.map((e) => ({
      prayer: e.key,
      prayerAt: e.prayerAt,
      iqamaAt: e.iqamaAt!,
    }));
    expect(windows.map((w) => w.prayer)).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    const dhuhr = windows.find((w) => w.prayer === 'Dhuhr')!;
    expect(dhuhr.prayerAt).toBe(at(12, 3));
    expect(dhuhr.iqamaAt).toBe(at(13, 0));
    expect(timings.Dhuhr).not.toBeUndefined();
  });
  it('app restart mid-focus reconstructs the identical session from stored data', () => {
    const entries = buildScheduleEntries(TODAY, DELAYS)!;
    const restored = activeFocusSession(at(12, 43), entries.map((e) => ({ prayer: e.key, prayerAt: e.prayerAt, iqamaAt: e.iqamaAt! })));
    expect(restored!.prayer).toBe('Dhuhr');
    expect(restored!.focusEndAt).toBe(at(13, 0));
  });
});

describe('formatFocusCountdown (H:MM:SS display)', () => {
  it('formats 17 minutes as 00:17:00 and 57 minutes as 00:57:00', () => {
    expect(formatFocusCountdown(17 * 60_000)).toBe('00:17:00');
    expect(formatFocusCountdown(57 * 60_000)).toBe('00:57:00');
  });
  it('keeps ticking per second', () => {
    expect(formatFocusCountdown(16 * 60_000 + 59_000)).toBe('00:16:59');
    expect(formatFocusCountdown(20 * 60_000 - 1)).toBe('00:19:59');
  });
  it('supports hours (IH → next-day transitions longer than 60 min)', () => {
    expect(formatFocusCountdown(61 * 60_000)).toBe('01:01:00');
    expect(formatFocusCountdown(2 * 3600_000 + 59 * 60_000 + 59_000)).toBe('02:59:59');
  });
  it('clamps at zero', () => {
    expect(formatFocusCountdown(0)).toBe('00:00:00');
    expect(formatFocusCountdown(-1)).toBe('00:00:00');
    expect(formatFocusCountdown(-5 * 60_000)).toBe('00:00:00');
  });
});

describe('focusRemainingRatio (progress bar, span = iqama − prayer)', () => {
  it('1 at the adhan, 0.5 mid-window, 0 at the iqama', () => {
    expect(focusRemainingRatio(at(12, 3), at(12, 3), at(13, 0))).toBe(1);
    expect(focusRemainingRatio(at(12, 31, 30_000), at(12, 3), at(13, 0))).toBeCloseTo(0.5, 5);
    expect(focusRemainingRatio(at(13, 0), at(12, 3), at(13, 0))).toBe(0);
  });
  it('clamps outside the window', () => {
    expect(focusRemainingRatio(at(12, 2), at(12, 3), at(13, 0))).toBe(1);
    expect(focusRemainingRatio(at(14, 0), at(12, 3), at(13, 0))).toBe(0);
  });
  it('degenerate window yields zero', () => {
    expect(focusRemainingRatio(at(12, 30), at(12, 30), at(12, 30))).toBe(0);
  });
});

describe('notification helpers (unchanged semantics)', () => {
  it('iqama key is stable per prayer/date/timestamp (dedup across restarts)', () => {
    const a = iqamaNotifyKey('tunis', DATE, 'Dhuhr', at(13, 0));
    expect(a).toBe(iqamaNotifyKey('tunis', DATE, 'Dhuhr', at(13, 0)));
    expect(a).not.toBe(iqamaNotifyKey('tunis', DATE, 'Dhuhr', at(13, 1)));
    expect(a).not.toBe(iqamaNotifyKey('sfax', DATE, 'Dhuhr', at(13, 0)));
    expect(a).not.toBe(iqamaNotifyKey('tunis', '09-11-2026', 'Dhuhr', at(13, 0)));
  });
  it('iqama notification is due only within the grace of the iqama timestamp', () => {
    expect(isIqamaNotificationDue(at(13, 0), at(13, 0))).toBe(true);
    expect(isIqamaNotificationDue(at(13, 0, IQAMA_NOTIFY_GRACE_MS), at(13, 0))).toBe(true);
    expect(isIqamaNotificationDue(at(13, 0, IQAMA_NOTIFY_GRACE_MS + 1), at(13, 0))).toBe(false);
    expect(isIqamaNotificationDue(at(12, 59), at(13, 0))).toBe(false);
  });
});

describe('prayer notification firing time (adhan, not iqama)', () => {
  it('buildPrayerTimestamps keeps the official adhan as the prayer timestamp', () => {
    const entries = buildPrayerTimestamps(TODAY)!;
    expect(entries.find((e) => e.key === 'Dhuhr')!.at).toBe(at(12, 3));
  });
});
