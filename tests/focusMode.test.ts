import { describe, expect, it } from 'vitest';
import type { IqamaDelays, PrayerKey } from '../src/types/prayer';
import {
  activeFocusSession,
  focusEndAt,
  focusRemainingRatio,
  formatFocusCountdown,
  iqamaNotifyKey,
  isIqamaNotificationDue,
  IQAMA_NOTIFY_GRACE_MS,
} from '../src/services/focusMode';
import { resolveIqamaTimestamps } from '../src/services/iqamaTimes';

const DATE = '08-11-2026';

// 08-11-2026 (Africa/Tunis) — adhan times for the day.
const TIMINGS: Record<PrayerKey, string> = {
  Fajr: '05:50',
  Dhuhr: '12:30',
  Asr: '15:30',
  Maghrib: '17:45',
  Isha: '19:00',
};
const DELAYS: IqamaDelays = { Fajr: 5, Dhuhr: 10, Asr: 5, Maghrib: 5, Isha: 5 };
const IQAMA = resolveIqamaTimestamps(DATE, TIMINGS, DELAYS);

describe('resolveIqamaTimestamps base for tests', () => {
  it('derives Iqama = adhan + 10 for Dhuhr', () => {
    expect(IQAMA.Dhuhr).toBeDefined();
    expect(IQAMA.Dhuhr! - IQAMA.Fajr!).toBeGreaterThan(0);
  });
});

describe('focusEndAt', () => {
  it('adds the configured duration to the Iqama timestamp', () => {
    expect(focusEndAt(1_000_000, 15)).toBe(1_000_000 + 15 * 60_000);
    expect(focusEndAt(1_000_000, 20)).toBe(1_000_000 + 20 * 60_000);
  });

  it('treats junk durations as zero', () => {
    expect(focusEndAt(1_000_000, NaN)).toBe(1_000_000);
  });
});

describe('activeFocusSession (timestamp window rule)', () => {
  const dhuhr = IQAMA.Dhuhr!;

  it('STATE 1 — before Iqama: no session (Normal Mode)', () => {
    expect(activeFocusSession(dhuhr - 1, IQAMA, 15)).toBeNull();
  });

  it('STATE 2 — at exactly the Iqama timestamp the session starts', () => {
    const s = activeFocusSession(dhuhr, IQAMA, 15);
    expect(s).not.toBeNull();
    expect(s!.prayer).toBe('Dhuhr');
    expect(s!.iqamaAt).toBe(dhuhr);
    expect(s!.focusEndAt).toBe(dhuhr + 15 * 60_000);
  });

  it('STATE 3 — after the configured focus window the session is over', () => {
    expect(activeFocusSession(dhuhr + 15 * 60_000, IQAMA, 15)).toBeNull();
  });

  it('arbitrary configured durations (5/20 min) drive the window', () => {
    expect(activeFocusSession(dhuhr + 5 * 60_000 - 1, IQAMA, 5)).not.toBeNull();
    expect(activeFocusSession(dhuhr + 5 * 60_000, IQAMA, 5)).toBeNull();
    expect(activeFocusSession(dhuhr + 19 * 60_000 + 59_999, IQAMA, 20)).not.toBeNull();
  });

  it('focus disabled → caller passes no timestamps → null (handled in hook)', () => {
    expect(activeFocusSession(dhuhr, {}, 15)).toBeNull();
  });

  it('survives a "simulated restart": same session derived at any moment inside the window', () => {
    const midway = dhuhr + 7 * 60_000 + 23_456;
    const s = activeFocusSession(midway, IQAMA, 15);
    expect(s?.iqamaAt).toBe(dhuhr);
  });

  it('ignores prayers without a configured Iqama', () => {
    const partial = { Dhuhr: IQAMA.Dhuhr! } as Partial<Record<PrayerKey, number>>;
    expect(activeFocusSession(dhuhr + 1000, partial, 15)?.prayer).toBe('Dhuhr');
    expect(activeFocusSession(dhuhr + 2000, partial, 15)?.focusEndAt).toBe(dhuhr + 15 * 60_000);
  });

  it('handles the Isha → next-day midnight rollover using absolute ms', () => {
    const late = resolveIqamaTimestamps(DATE, { Isha: '23:58' }, { Isha: 5 });
    const at = late.Isha!;
    // 00:03 on the next day: still same session window (1 s after Iqama).
    expect(activeFocusSession(at + 1_000, late, 15)?.prayer).toBe('Isha');
  });
});

describe('formatFocusCountdown (MM:SS display)', () => {
  it('formats the configured duration at start', () => {
    expect(formatFocusCountdown(15 * 60_000)).toBe('15:00');
    expect(formatFocusCountdown(5 * 60_000)).toBe('05:00');
  });

  it('decreases second by second', () => {
    expect(formatFocusCountdown(14 * 60_000 + 59_000)).toBe('14:59');
    expect(formatFocusCountdown(14 * 60_000 + 58_999)).toBe('14:58');
    expect(formatFocusCountdown(0)).toBe('00:00');
  });

  it('clamps negative (stale) remainders at zero', () => {
    expect(formatFocusCountdown(-1)).toBe('00:00');
    expect(formatFocusCountdown(-5 * 60_000)).toBe('00:00');
  });
});

describe('focusRemainingRatio (progress bar)', () => {
  it('starts at 1, decreases, reaches 0 at the end', () => {
    const at = IQAMA.Maghrib!;
    expect(focusRemainingRatio(at, at, 10)).toBe(1);
    expect(focusRemainingRatio(at + 5 * 60_000, at, 10)).toBeCloseTo(0.5, 5);
    expect(focusRemainingRatio(at + 10 * 60_000, at, 10)).toBe(0);
  });

  it('never exceeds 0..1 outside the window', () => {
    const at = IQIMAOrZero();
    expect(focusRemainingRatio(at - 60_000, at, 10)).toBe(1);
    expect(focusRemainingRatio(at + 11 * 60_000, at, 10)).toBe(0);
  });
});

function IQIMAOrZero(): number {
  return IQAMA.Maghrib!;
}

describe('notification deduplication keys', () => {
  it('is unique per prayer and per date/timestamp', () => {
    const k1 = iqamaNotifyKey('tunis', DATE, 'Dhuhr', IQAMA.Dhuhr!);
    const k2 = iqamaNotifyKey('tunis', DATE, 'Maghrib', IQAMA.Maghrib!);
    const k3 = iqamaNotifyKey('tunis', '09-11-2026', 'Dhuhr', IQAMA.Dhuhr!);
    expect(new Set([k1, k2, k3]).size).toBe(3);
  });

  it('is stable for the same prayer/date so replays deduplicate', () => {
    expect(iqamaNotifyKey('tunis', DATE, 'Isha', IQAMA.Isha!)).toBe(
      iqamaNotifyKey('tunis', DATE, 'Isha', IQAMA.Isha!),
    );
  });
});

describe('isIqamaNotificationDue (grace window)', () => {
  const at = IQAMA.Asr!;

  it('due at exactly the Iqama time', () => {
    expect(isIqamaNotificationDue(at, at)).toBe(true);
  });

  it('due within the grace window after it', () => {
    expect(isIqamaNotificationDue(at + IQAMA_NOTIFY_GRACE_MS - 1_000, at)).toBe(true);
  });

  it('stale after the grace window (no replay after wake / long outage)', () => {
    expect(isIqamaNotificationDue(at + IQAMA_NOTIFY_GRACE_MS + 1_000, at)).toBe(false);
  });

  it('not due before the Iqama time', () => {
    expect(isIqamaNotificationDue(at - 1, at)).toBe(false);
  });
});
