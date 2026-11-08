import { useMemo } from 'react';
import type { DayPrayerTimes, IqamaDelays } from '../types/prayer';
import { buildPrayerTimestamps, formatCountdown, wallClockToMs, COUNTDOWN_PARTS_TZ, wallClockInTz } from '../logic/times';
import type { PrayerTimeEntry } from '../logic/times';
import { useHeartbeat } from './useHeartbeat';
import {
  buildScheduleEntries,
  nextAfterIqama,
  tomorrowFajrEntry,
  type NextScheduled,
  type PrayerPhase,
  type ScheduleKey,
} from '../services/prayerSchedule';

export interface CountdownState {
  nowMs: number;
  next: {
    prayer: ScheduleKey;
    /** Countdown TARGET (adhan or Iqama) as absolute ms. */
    atMs: number;
    /** Adhan timestamp of that prayer (display). */
    prayerAtMs: number;
    iqamaAtMs: number | null;
    isTomorrow: boolean;
  } | null;
  remainingMs: number;
  countdownText: string;
  /** 0..1 progress toward the current countdown target since the anchor. */
  progress: number;
  upcoming: PrayerTimeEntry[];
  /** Scheduling phase of `next` (upcoming / waiting-for-iqama). */
  phase: PrayerPhase;
}

export interface CountdownOptions {
  /** Mini-widget continuity: keep Sunrise as a countdown target (no Iqama). */
  includeSunrise?: boolean;
}

/**
 * Every-second countdown state derived from today's (and tomorrow's) prayer
 * times PLUS the configured Iqama delays. The next-prayer transition follows
 * the shared rule in services/prayerSchedule (a prayer stays active until its
 * Iqama), so both widgets run ONE transition engine:
 *
 *   before adhan      → countdown target = adhan
 *   adhan .. iqama    → prayer stays active, target = iqama
 *   at/after iqama    → schedule advances to the following prayer
 *
 * Focus Mode changes only the DISPLAYED countdown (its own timestamps in
 * services/focusMode); the schedule (`next`) is never mixed with the active
 * focus prayer. All values are absolute epoch ms — correct across midnight,
 * sleep/wake and app restarts.
 */
export function usePrayerCountdown(
  today: DayPrayerTimes | null,
  tomorrow: DayPrayerTimes | null,
  delays?: IqamaDelays,
  opts?: CountdownOptions,
): CountdownState {
  const nowMs = useHeartbeat(1000);

  return useMemo(() => {
    const schedule = today ? buildScheduleEntries(today, delays ?? {}, opts?.includeSunrise) : null;
    const tomorrowEntry = tomorrow ? tomorrowFajrEntry(tomorrow, delays ?? {}) : null;
    const dayStart = today ? wallClockToMs(today.dateKey, 0, 0) : 0;
    const nextS: NextScheduled | null = schedule
      ? nextAfterIqama(nowMs, schedule, tomorrowEntry, dayStart)
      : null;

    if (!nextS || !schedule) {
      return {
        nowMs,
        next: null,
        remainingMs: 0,
        countdownText: formatCountdown(0),
        progress: 0,
        upcoming: today ? buildPrayerTimestamps(today) ?? [] : [],
        phase: 'upcoming',
      };
    }

    const span = Math.max(1, nextS.target - nextS.anchor);
    const progress = Math.min(1, Math.max(0, (nowMs - nextS.anchor) / span));

    return {
      nowMs,
      next: {
        prayer: nextS.key,
        atMs: nextS.target,
        prayerAtMs: nextS.prayerAt,
        iqamaAtMs: nextS.iqamaAt,
        isTomorrow: nextS.isTomorrow,
      },
      remainingMs: nextS.target - nowMs,
      countdownText: formatCountdown(nextS.target - nowMs),
      progress,
      upcoming: buildPrayerTimestamps(today!) ?? [],
      phase: nextS.phase,
    };
  }, [nowMs, today, tomorrow, delays, opts?.includeSunrise]);
}

/** Wall-clock time in Tunis for display ("current time" row), updates every second. */
export function useTunisClock(): { h: number; m: number; s: number } {
  const nowMs = useHeartbeat(1000);
  return useMemo(() => wallClockInTz(COUNTDOWN_PARTS_TZ, new Date(nowMs)), [nowMs]);
}
