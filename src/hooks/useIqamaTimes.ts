import { useMemo } from 'react';
import type { ClockFormat, IqamaDelays, PrayerKey, TimingRow } from '../types/prayer';
import { hasAnyIqamaDelay, isIqamaConfigured, resolveManualIqama } from '../services/iqamaTimes';

export interface IqamaState {
  /** True when at least one prayer has a configured delay. */
  enabled: boolean;
  /** True while no delay is configured at all (UI shows the hint). */
  notConfigured: boolean;
  /** Displayable Iqama per prayer; prayers without config are absent. */
  times: Partial<Record<PrayerKey, string>>;
  /** Per-prayer "has a configured delay" lookup. */
  isConfigured: (prayer: PrayerKey) => boolean;
}

/**
 * Manual Iqama times derived from the daily prayer timings plus the
 * per-prayer delays configured in shared settings. Recomputed whenever the
 * daily times change, so hour/midnight rollovers are always correct. Purely
 * synchronous — no network, no cache, no loading state.
 */
export function useIqamaTimes(
  todayTimings: TimingRow | undefined,
  delays: IqamaDelays,
  _clockFormat?: ClockFormat,
): IqamaState {
  const times = useMemo(() => resolveManualIqama(todayTimings, delays), [todayTimings, delays]);
  const enabled = useMemo(() => hasAnyIqamaDelay(delays), [delays]);
  const isConfigured = useMemo(() => (prayer: PrayerKey) => isIqamaConfigured(delays, prayer), [delays]);
  return { enabled, notConfigured: !enabled, times, isConfigured };
}
