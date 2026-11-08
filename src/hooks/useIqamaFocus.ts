import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DayPrayerTimes, IqamaDelays, PrayerKey } from '../types/prayer';
import { buildPrayerTimestamps, type PrayerTimeEntry } from '../logic/times';
import { resolveIqamaTimestamps } from '../services/iqamaTimes';
import {
  activeFocusSession,
  isIqamaNotificationDue,
  iqamaNotifyKey,
  type FocusSession,
} from '../services/focusMode';

export interface IqamaFocusState {
  /** Active focus session, or null (Normal Mode). Derived per tick. */
  session: FocusSession | null;
  /** Absolute epoch ms of each configured Iqama for the current day. */
  iqamaTimestamps: Partial<Record<PrayerKey, number>>;
  /** End the active focus session early (no further notification). */
  dismiss: (session: FocusSession) => void;
}

export interface IqamaFocusOptions {
  /** Send the Windows notification at Iqama time (deduplicated). */
  notify: boolean;
  /** City id used for unique notification keys. */
  cityId: string;
  /** Optional filter honouring the existing per-prayer notification modes. */
  quiet?: (prayer: PrayerKey) => boolean;
}

/**
 * Shared Iqama Focus state for BOTH windows. Everything is derived from
 * absolute timestamps of the current day's prayer times — no independent
 * countdown counters anywhere:
 *   Focus End        = Iqama timestamp + focus duration
 *   Remaining        = max(0, Focus End - now)
 * so sleep/wake, minimization and full app restarts stay consistent, and
 * an already-expired window simply returns Normal Mode.
 *
 * Notifications: at most one per prayer per local calendar date (key =
 * city|date|prayer|iqama|timestamp), grace-gated and de-duplicated by the
 * main process, and only while Focus Mode is enabled.
 */
export function useIqamaFocus(
  today: DayPrayerTimes | null,
  delays: IqamaDelays,
  focusDurationMin: number,
  focusEnabled: boolean,
  nowMs: number,
  options: IqamaFocusOptions,
): IqamaFocusState {
  const prayerTimestamps = useMemo(() => {
    if (!today) return null;
    const entries = buildPrayerTimestamps(today);
    if (!entries) return null;
    const map: Partial<Record<PrayerKey, number>> = {};
    for (const e of entries as PrayerTimeEntry[]) map[e.key] = e.at;
    return map;
  }, [today]);
  const iqamaTimestamps = useMemo(
    () =>
      today
        ? resolveIqamaTimestamps(today.dateKey, today.timings, delays)
        : {},
    [today, delays],
  );

  /* Sessions the user ended early (also survives an app restart). */
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void window.salati
        ?.getFocusDismissals()
        .then((ids) => {
          if (!cancelled) setDismissed(new Set(ids));
        })
        .catch(() => undefined);
    };
    load();
    const unsub = window.salati?.onFocusDismissalsChanged(load);
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const session = useMemo(() => {
    if (!focusEnabled) return null;
    const found = activeFocusSession(nowMs, iqamaTimestamps, focusDurationMin, prayerTimestamps ?? undefined);
    if (!found || !today) return null;
    const id = iqamaNotifyKey(options.cityId, today.dateKey, found.prayer, found.iqamaAt);
    return dismissed.has(id) ? null : found;
  }, [focusEnabled, nowMs, iqamaTimestamps, focusDurationMin, prayerTimestamps, today, options.cityId, dismissed]);

  /* One-shot Iqama notification per prayer per date (grace-gated). */
  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const todayData = today;
    if (!todayData || !options.notify || !focusEnabled) return;
    if (!('salati' in window)) return;
    for (const [prayer, iqamaAt] of Object.entries(iqamaTimestamps) as [PrayerKey, number][]) {
      if (options.quiet?.(prayer)) continue;
      if (!isIqamaNotificationDue(nowMs, iqamaAt)) continue;
      const key = iqamaNotifyKey(options.cityId, todayData.dateKey, prayer, iqamaAt);
      if (firedRef.current.has(key)) continue;
      firedRef.current.add(key);
      void window.salati.notify({
        key,
        title: `Salati Tunisia — ${prayer}`,
        body: 'Iqama time has arrived. Take a moment for prayer. — حان وقت الإقامة',
      });
    }
  }, [nowMs, today, iqamaTimestamps, focusEnabled, options.notify, options.cityId, options.quiet]);

  const dismiss = useCallback(
    (s: FocusSession) => {
      if (!today) return;
      void window.salati?.dismissFocus(
        iqamaNotifyKey(options.cityId, today.dateKey, s.prayer, s.iqamaAt),
      );
    },
    [options.cityId, today],
  );

  return { session, iqamaTimestamps, dismiss };
}
