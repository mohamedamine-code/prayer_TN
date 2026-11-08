import type { DayPrayerTimes, IqamaDelays, PrayerKey } from '../types/prayer';
import { resolveIqamaTimestamps } from './iqamaTimes';
import { buildPrayerTimestamps, parseHHMM, wallClockToMs } from '../logic/times';

/**
 * Shared prayer SCHEDULING service — the single source of the next-prayer
 * transition for the principal widget AND the floating widget.
 *
 * Main rule: a prayer stays active until its configured Iqama timestamp is
 * reached (Iqama = Adhan + configured delay). Transitions therefore depend
 * on Iqama completion, not on the adhan:
 *
 *   now < adhan                  → upcoming, countdown target = adhan
 *   adhan <= now < iqama         → waiting-for-iqama, target = iqama
 *   now >= iqama                 → completed, schedule advances
 *
 * This is deliberately kept separate from the Focus Mode state
 * (activeFocusSession in services/focusMode.ts): the next scheduled prayer
 * and the prayer shown in Focus Mode are independent values.
 */

export type PrayerPhase = 'upcoming' | 'waiting-for-iqama' | 'completed';

/** Scheduler participants: the five prayers plus the informational Sunrise. */
export type ScheduleKey = PrayerKey | 'Sunrise';

export interface ScheduleEntry {
  key: ScheduleKey;
  /** Absolute epoch ms of the adhan (Tunis local day derived from dateKey). */
  prayerAt: number;
  /** Absolute epoch ms of the Iqama; null when not configured / Sunrise. */
  iqamaAt: number | null;
}

export interface NextScheduled {
  key: ScheduleKey;
  prayerAt: number;
  iqamaAt: number | null;
  /** Countdown target: adhan before the adhan, Iqama while waiting. */
  target: number;
  phase: PrayerPhase;
  isTomorrow: boolean;
  /** Anchor for progress = previous prayer's completion (its Iqama). */
  anchor: number;
}

/** Build ordered schedule entries for one day (Sunrise optional, prayers mandatory). */
export function buildScheduleEntries(
  day: DayPrayerTimes,
  delays: IqamaDelays,
  includeSunrise = false,
): ScheduleEntry[] | null {
  if (!day) return null;
  const prayers = buildPrayerTimestamps(day);
  if (!prayers) return null; // offline/partial data: no schedule invented
  const iqama = resolveIqamaTimestamps(day.dateKey, day.timings, delays);
  const out: ScheduleEntry[] = [];
  if (includeSunrise) {
    const sunrise = parseHHMM(day.timings.Sunrise);
    if (sunrise) {
      out.push({
        key: 'Sunrise',
        prayerAt: wallClockToMs(day.dateKey, sunrise.h, sunrise.m),
        iqamaAt: null, // Sunrise is informational: no Iqama, completes at its adhan
      });
    }
  }
  for (const p of prayers) {
    out.push({ key: p.key, prayerAt: p.at, iqamaAt: iqama[p.key] ?? null });
  }
  return out.sort((a, b) => a.prayerAt - b.prayerAt);
}

/** Tomorrow's first schedule entry (Fajr, with its Iqama), or null. */
export function tomorrowFajrEntry(
  day: DayPrayerTimes,
  delays: IqamaDelays,
): ScheduleEntry | null {
  return buildScheduleEntries(day, delays, false)?.find((e) => e.key === 'Fajr') ?? null;
}

/** The instant after which a prayer no longer blocks the schedule. */
export function completionBoundary(e: ScheduleEntry): number {
  return e.iqamaAt ?? e.prayerAt;
}

function mkUpcoming(e: ScheduleEntry, isTomorrow: boolean, anchor: number): NextScheduled {
  return {
    key: e.key,
    prayerAt: e.prayerAt,
    iqamaAt: e.iqamaAt,
    target: e.prayerAt,
    phase: 'upcoming',
    isTomorrow,
    anchor: Math.min(anchor, e.prayerAt),
  };
}

/**
 * Next scheduled prayer under the Iqama-completion rule. A prayer whose
 * adhan passed but whose Iqama did not keeps the schedule (phase
 * 'waiting-for-iqama'); once its Iqama boundary passes, the schedule
 * advances to the following prayer. Falls back to tomorrow's Fajr after the
 * last prayer of the day completes.
 */
export function nextAfterIqama(
  now: number,
  entries: ScheduleEntry[] | null,
  tomorrowFajr: ScheduleEntry | null,
  dayStart: number,
): NextScheduled | null {
  if (!entries || entries.length === 0) {
    return tomorrowFajr ? mkUpcoming(tomorrowFajr, true, dayStart) : null;
  }
  let anchor = dayStart;
  for (const e of entries) {
    if (now < e.prayerAt) return mkUpcoming(e, false, anchor);
    if (e.iqamaAt !== null && now < e.iqamaAt) {
      return {
        key: e.key,
        prayerAt: e.prayerAt,
        iqamaAt: e.iqamaAt,
        target: e.iqamaAt,
        phase: 'waiting-for-iqama',
        isTomorrow: false,
        anchor: Math.min(anchor, e.prayerAt),
      };
    }
    anchor = completionBoundary(e);
  }
  if (tomorrowFajr) return mkUpcoming(tomorrowFajr, true, anchor);
  return null;
}

/** Countdown target under the full state machine, given an optional focus end. */
export function scheduleCountdownTarget(
  next: NextScheduled | null,
  focusEnd: number | null,
  now: number,
): number {
  if (focusEnd !== null && focusEnd > now) return focusEnd; // Focus Mode owns the clock
  return next ? next.target : now;
}
