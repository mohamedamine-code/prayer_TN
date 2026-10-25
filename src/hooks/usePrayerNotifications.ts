import { useEffect, useRef } from 'react';
import type { Settings } from '../types/prayer';
import { NOTIF_OFFSET_MINUTES } from '../types/prayer';
import type { DayPrayerTimes } from '../types/prayer';
import { buildPrayerTimestamps, addDaysToDateKey } from '../logic/times';

/**
 * Prayer notification scheduler.
 *
 * The renderer tick (1 s) detects when `now` crosses prayerAt - offset and
 * asks the main process to show a Windows notification. The main process
 * de-duplicates by event key, so both sides together guarantee
 * "no duplicates" even across restarts.
 *
 * Rules:
 *  - only events whose notification point is within the last 90 s are fired
 *    (no replay of long-past notifications after launching the app),
 *  - events already fired in this session are never fired again,
 *  - tomorrow's Fajr is used for the post-Isha/removal duty.
 */
export function usePrayerNotifications(
  settings: Settings,
  today: DayPrayerTimes | null,
  tomorrow: DayPrayerTimes | null,
  nowMs: number,
): void {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!today) return;
    if (!('salati' in window)) return;

    const fired = firedRef.current;
    const durations = Object.entries(settings.notifications);
    const tomorrowKey = addDaysToDateKey(today.dateKey, 1);

    const scan = (day: DayPrayerTimes) => {
      const entries = buildPrayerTimestamps(day);
      if (!entries) return;
      for (const entry of entries) {
        const modes = durations.filter(([prayer]) => prayer === entry.key);
        for (const [, mode] of modes) {
          const offsetMin = NOTIF_OFFSET_MINUTES[mode];
          if (offsetMin < 0) continue;
          const eventAt = entry.at - offsetMin * 60_000;
          if (nowMs < eventAt || nowMs - eventAt > 90_000) continue;
          const key = `${settings.cityId}|${day.dateKey}|${entry.key}|${offsetMin}|${eventAt}`;
          if (fired.has(key)) continue;
          fired.add(key);
          void window.salati.notify({
            key,
            title: `${entry.key} — ${day.timings[entry.key]}`,
            body:
              offsetMin === 0
                ? "C'est l'heure de la prière — وقت الصلاة"
                : offsetMin === 5
                  ? 'Dans 5 minutes — قبل خمس دقائق'
                  : 'Dans 10 minutes — قبل عشر دقائق',
          });
        }
      }
    };

    scan(today);
    // Only include tomorrow when Isha has passed (late night / next-day Fajr).
    const todayEntries = buildPrayerTimestamps(today);
    const ishaPassed = (() => {
      const e = todayEntries?.at(-1);
      return e ? nowMs > e.at : false;
    })();
    if (ishaPassed && tomorrow && tomorrow.dateKey === tomorrowKey) {
      scan(tomorrow);
    }

    // Prune stale fired keys (yesterday) to bound the set size.
    if (fired.size > 60) {
      for (const k of fired) {
        const t = Number(k.split('|').pop());
        if (Number.isFinite(t) && nowMs - t > 26 * 3600_000) fired.delete(k);
      }
    }
  }, [nowMs, today, tomorrow, settings.cityId, settings.notifications]);
}
