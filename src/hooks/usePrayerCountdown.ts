import { useMemo } from 'react';
import type { DayPrayerTimes, PrayerKey } from '../types/prayer';
import {
  buildPrayerTimestamps,
  formatCountdown,
  getNextPrayer,
  wallClockInTz,
  wallClockToMs,
  COUNTDOWN_PARTS_TZ,
} from '../logic/times';
import type { PrayerTimeEntry } from '../logic/times';
import { useHeartbeat } from './useHeartbeat';

export interface CountdownState {
  nowMs: number;
  next: {
    prayer: PrayerKey;
    atMs: number;
    isTomorrow: boolean;
  } | null;
  remainingMs: number;
  countdownText: string;
  /** 0..1 progress toward the next prayer since the previous prayer (or Isha). */
  progress: number;
  upcoming: PrayerTimeEntry[];
}

/**
 * Every-second countdown state derived from today's (and tomorrow's) prayer
 * times. All "at" values are absolute epoch ms, so the timer stays correct
 * across midnight, sleep/wake and timezone-safe comparisons.
 *
 * `today`/`tomorrow` are expected keyed "DD-MM-YYYY" in Africa/Tunis.
 */
export function usePrayerCountdown(
  today: DayPrayerTimes | null,
  tomorrow: DayPrayerTimes | null,
): CountdownState {
  const nowMs = useHeartbeat(1000);

  return useMemo(() => {
    const todayEntries = today ? buildPrayerTimestamps(today) : null;
    const tomorrowFajr = tomorrow
      ? buildPrayerTimestamps(tomorrow)?.find((e) => e.key === 'Fajr')?.at ?? null
      : null;

    const next = todayEntries ? getNextPrayer(nowMs, todayEntries, tomorrowFajr) : null;

    if (!next || !todayEntries) {
      return {
        nowMs,
        next: null,
        remainingMs: 0,
        countdownText: formatCountdown(0),
        progress: 0,
        upcoming: [],
      };
    }

    // Progress: interval between the previous anchor and the next prayer.
    // Anchor = previous prayer today (or Isha when next is tomorrow's Fajr),
    // or start of the day for the first prayer.
    let anchor: number;
    if (next.isTomorrow) {
      anchor = todayEntries[todayEntries.length - 1]!.at; // Isha today
    } else {
      const idx = todayEntries.findIndex((e) => e.key === next.prayer);
      anchor = idx > 0 ? todayEntries[idx - 1]!.at : wallClockToMs(today!.dateKey, 0, 0);
    }
    const span = Math.max(1, next.at - anchor);
    const progress = Math.min(1, Math.max(0, (nowMs - anchor) / span));

    return {
      nowMs,
      next: { prayer: next.prayer, atMs: next.at, isTomorrow: next.isTomorrow },
      remainingMs: next.at - nowMs,
      countdownText: formatCountdown(next.at - nowMs),
      progress,
      upcoming: todayEntries,
    };
  }, [nowMs, today, tomorrow]);
}

/** Wall-clock time in Tunis for display ("current time" row), updates every second. */
export function useTunisClock(): { h: number; m: number; s: number } {
  const nowMs = useHeartbeat(1000);
  return useMemo(() => wallClockInTz(COUNTDOWN_PARTS_TZ, new Date(nowMs)), [nowMs]);
}
