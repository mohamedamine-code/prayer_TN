import type { IqamaDelays, PrayerKey } from '../types/prayer';
import { IQAMA_PRAYER_KEYS, validateIqamaDelay } from '../shared/settings';
import { parseHHMM, wallClockToMs } from '../logic/times';

/**
 * Manual Iqama (congregation) timing — the single shared service used by the
 * principal widget and the floating widget.
 *
 * Iqama time = daily prayer adhan time + user-configured delay (minutes).
 * Delays live in Settings.iqamaDelays and are edited per prayer in the
 * settings UI. Nothing is fetched from an external API and no delay is ever
 * invented or presented as an official mosque schedule: a prayer without a
 * configured delay simply has no Iqama time.
 */

/** Add minutes to "HH:MM", wrapping past midnight (e.g. 23:55 + 10 → 00:05). */
export function addMinutesToHHMM(hhmm: string, minutes: number): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** True when the user has configured a delay for at least one prayer. */
export function hasAnyIqamaDelay(delays: IqamaDelays): boolean {
  return IQAMA_PRAYER_KEYS.some((k) => typeof delays[k] === 'number');
}

export function isIqamaConfigured(delays: IqamaDelays, prayer: PrayerKey): boolean {
  return typeof delays[prayer] === 'number';
}

/**
 * Compute the displayable Iqama map for one day's adhan timings. Independent
 * per prayer: only prayers with a configured (non-null) delay receive an
 * Iqama time; hour and midnight transitions are handled by addMinutesToHHMM.
 */
export function resolveManualIqama(
  timings: Partial<Record<PrayerKey, string>> | undefined,
  delays: IqamaDelays,
): Partial<Record<PrayerKey, string>> {
  const out: Partial<Record<PrayerKey, string>> = {};
  if (!timings) return out;
  for (const prayer of IQAMA_PRAYER_KEYS) {
    const configured = delays[prayer];
    if (typeof configured !== 'number') continue;
    // Enforce the shared 5-min minimum / whole-minute rule at this layer too.
    const minutes = validateIqamaDelay(configured);
    const adhan = timings[prayer];
    if (!adhan) continue;
    const iqama = addMinutesToHHMM(adhan, minutes);
    if (iqama) out[prayer] = iqama;
  }
  return out;
}

/**
 * Absolute Iqama timestamps (epoch ms) for one day: prayer timestamp + delay.
 * Built from real timestamps so midnight/date rollovers are exact (a late
 * Isha Iqama past 00:00 belongs to the next instant, not the same minute).
 * Recomputed whenever the daily times change — the delay is never applied
 * twice because the source is always the adhan timestamp.
 */
export function resolveIqamaTimestamps(
  dateKey: string,
  timings: Partial<Record<PrayerKey, string>> | undefined,
  delays: IqamaDelays,
): Partial<Record<PrayerKey, number>> {
  const out: Partial<Record<PrayerKey, number>> = {};
  if (!timings) return out;
  for (const prayer of IQAMA_PRAYER_KEYS) {
    const configured = delays[prayer];
    if (typeof configured !== 'number') continue;
    const minutes = validateIqamaDelay(configured);
    const adhan = timings[prayer];
    const parsed = parseHHMM(adhan);
    if (!parsed) continue;
    out[prayer] = wallClockToMs(dateKey, parsed.h, parsed.m) + minutes * 60_000;
  }
  return out;
}
