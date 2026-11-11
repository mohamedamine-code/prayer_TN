import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DayPrayerTimes, IqamaDelays, PrayerKey } from '../types/prayer';
import { buildScheduleEntries, type ScheduleEntry } from '../services/prayerSchedule';
import {
  activeFocusSession,
  isIqamaNotificationDue,
  iqamaNotifyKey,
  type FocusSession,
  type FocusWindow,
} from '../services/focusMode';

export interface IqamaFocusState {
  /** Active focus session, or null (Normal Mode). Derived per tick. */
  session: FocusSession | null;
  /** Focus windows [adhan, iqama) for the current day (all five prayers). */
  focusWindows: readonly FocusWindow[];
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
 * absolute timestamps of the current day's schedule — no independent
 * countdown counters anywhere. The focus window is [adhan, iqama): Focus
 * Mode activates at the prayer timestamp, stays active for the WHOLE
 * adhan→iqama interval (duration = iqama − prayer, the per-prayer manual
 * delay — never a fixed value), and ends exactly at the Iqama timestamp.
 * Sleep/wake, minimization, location/settings changes and full app restarts
 * stay consistent because the session is recomputed from real timestamps on
 * each clock tick; a launch mid-interval restores instantly with the exact
 * remaining time, and a launch after the Iqama never restores focus.
 *
 *_state separation (per spec): prayerPhase (upcoming / waiting-for-iqama /
 * completed) lives in the shared scheduler (services/prayerSchedule) while
 * focusModeActive derives from the [adhan, iqama) window — both widgets read
 * the same values. In particular nextPrayer may already be the following
 * prayer while the focus panel still shows the active one in its final
 * minutes.
 *
 * Notifications: at most one Iqama notification per prayer per local
 * calendar date (key = city|date|prayer|iqama|timestamp), grace-gated and
 * de-duplicated by the main process. Notifications are decoupled from focus
 * state: prayer notifications fire at the adhan (usePrayerNotifications),
 * Iqama notifications at the Iqama timestamp — activating focus or ending it
 * never waits for, or suppresses, a notification.
 */
export function useIqamaFocus(
  today: DayPrayerTimes | null,
  delays: IqamaDelays,
  focusEnabled: boolean,
  nowMs: number,
  options: IqamaFocusOptions,
): IqamaFocusState {
  /* The whole adhan→iqama schedule, straight from the single shared
     scheduling service (invalid/offline data ⇒ no windows, no focus). */
  const focusWindows = useMemo<readonly FocusWindow[]>(() => {
    if (!today) return [];
    return (buildScheduleEntries(today, delays) ?? [])
      .filter((e): e is ScheduleEntry & { iqamaAt: number; key: PrayerKey } => e.iqamaAt !== null && e.key !== 'Sunrise')
      .map((e) => ({ prayer: e.key, prayerAt: e.prayerAt, iqamaAt: e.iqamaAt }));
  }, [today, delays]);

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

  /* focusModeActive: derived every tick from real timestamps. */
  const session = useMemo(() => {
    let found = activeFocusSession(nowMs, focusWindows);
    if (!found || !today) return null;
    if (!focusEnabled) return null;
    /* "End early" must collapse only the CURRENT session, never the next
       day's same prayer — the dismissal id includes the Iqama timestamp. */
    const id = iqamaNotifyKey(options.cityId, today.dateKey, found.prayer, found.iqamaAt);
    return dismissed.has(id) ? null : found;
  }, [focusEnabled, nowMs, focusWindows, today, options.cityId, dismissed]);

  /* One-shot Iqama notification per prayer per date (grace-gated). Fires at
     the Iqama timestamp (STATE 3), independent of focus mode / settings. */
  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const todayData = today;
    if (!todayData || !options.notify) return;
    if (!('salati' in window)) return;
    for (const w of focusWindows) {
      if (options.quiet?.(w.prayer)) continue;
      if (!isIqamaNotificationDue(nowMs, w.iqamaAt)) continue;
      const key = iqamaNotifyKey(options.cityId, todayData.dateKey, w.prayer, w.iqamaAt);
      if (firedRef.current.has(key)) continue;
      firedRef.current.add(key);
      void window.salati.notify({
        key,
        title: `Salati Tunisia — ${w.prayer}`,
        body: 'Iqama time has arrived. Take a moment for prayer. — حان وقت الإقامة',
      });
    }
  }, [nowMs, today, focusWindows, options.notify, options.cityId, options.quiet]);

  const dismiss = useCallback(
    (s: FocusSession) => {
      if (!today) return;
      void window.salati?.dismissFocus(
        iqamaNotifyKey(options.cityId, today.dateKey, s.prayer, s.iqamaAt),
      );
    },
    [options.cityId, today],
  );

  return { session, focusWindows, dismiss };
}
