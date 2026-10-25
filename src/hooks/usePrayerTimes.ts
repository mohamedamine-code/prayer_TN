import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, AsrMadhab, City, DayPrayerTimes } from '../types/prayer';
import { getDay, prefetchMonth } from '../services/prayerTimes';
import { TUNIS_TZ, addDaysToDateKey, localDateKeyInTz } from '../logic/times';

export interface PrayerTimesState {
  today: DayPrayerTimes | null;
  /** Tomorrow's data (needed for the Isha -> next-day Fajr countdown). */
  tomorrow: DayPrayerTimes | null;
  loading: boolean;
  refreshing: boolean;
  fromCache: boolean;
  lastUpdated: number | null;
  error: ApiError | null;
  /** dateKey of the loaded data ("DD-MM-YYYY"). */
  loadedDateKey: string;
}

interface UseDeps {
  city: City;
  calculationMethod: number;
  asrMadhab: AsrMadhab;
}

/** Force one network refresh per (city, method, madhab, date) per session. */
const forcedSessions = new Set<string>();

function sessionStamp(cityId: string, method: number, madhab: AsrMadhab, dateKey: string): string {
  return `${cityId}:${method}:${madhab}:${dateKey}`;
}

export function usePrayerTimes({ city, calculationMethod, asrMadhab }: UseDeps) {
  const [state, setState] = useState<PrayerTimesState>({
    today: null,
    tomorrow: null,
    loading: true,
    refreshing: false,
    fromCache: false,
    lastUpdated: null,
    error: null,
    loadedDateKey: '',
  });
  const runIdRef = useRef(0);

  const load = useCallback(
    async (dateKey: string, force: boolean) => {
      const runId = ++runIdRef.current;
      setState((s) => ({
        ...s,
        loading: s.loadedDateKey !== dateKey,
        refreshing: s.today !== null,
      }));
      const [todayRes, tomorrowRes] = await Promise.all([
        getDay(city, calculationMethod, asrMadhab, dateKey, force),
        getDay(city, calculationMethod, asrMadhab, addDaysToDateKey(dateKey, 1), false),
      ]);
      if (runIdRef.current !== runId) return; // superseded by a newer request
      const error = todayRes.error ?? tomorrowRes.error;
      setState({
        today: todayRes.day,
        tomorrow: tomorrowRes.day,
        loading: false,
        refreshing: false,
        fromCache: todayRes.fromCache || tomorrowRes.fromCache,
        lastUpdated: todayRes.day ? Date.now() : null,
        error,
        loadedDateKey: dateKey,
      });
    },
    [city, calculationMethod, asrMadhab],
  );

  /** Load `dateKey`, forcing the network once per session for that key. */
  const loadForDate = useCallback(
    (dateKey: string) => {
      const stamp = sessionStamp(city.id, calculationMethod, asrMadhab, dateKey);
      const force = !forcedSessions.has(stamp);
      forcedSessions.add(stamp);
      void load(dateKey, force);
    },
    [city.id, calculationMethod, asrMadhab, load],
  );

  // Initial load + city/method change.
  useEffect(() => {
    loadForDate(localDateKeyInTz(TUNIS_TZ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadForDate]);

  // Watchdog: every 30 s check the Tunis-local date (handles midnight rollover
  // and wake-from-sleep where timers fire late) + 'online'/'visibility' recovery.
  useEffect(() => {
    let lastKey = localDateKeyInTz(TUNIS_TZ);

    const watchdog = window.setInterval(() => {
      const key = localDateKeyInTz(TUNIS_TZ);
      if (key !== lastKey) {
        lastKey = key;
        loadForDate(key);
      }
    }, 30_000);

    const onOnline = () => void load(localDateKeyInTz(TUNIS_TZ), true);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const key = localDateKeyInTz(TUNIS_TZ);
      if (key !== lastKey) {
        lastKey = key;
        loadForDate(key);
      } else {
        void load(key, true);
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(watchdog);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadForDate, load]);

  // Prefetch the next month near month end (offline safety for the next-day Fajr).
  useEffect(() => {
    const today = state.today;
    if (!today) return;
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(today.dateKey);
    if (!m) return;
    const day = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (!Number.isFinite(day) || day < 27) return;
    const nextMonth = mo === 12 ? 1 : mo + 1;
    const nextYear = mo === 12 ? y + 1 : y;
    void prefetchMonth(city, calculationMethod, asrMadhab, nextYear, nextMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.today?.dateKey]);

  const refresh = useCallback(() => {
    void load(localDateKeyInTz(TUNIS_TZ), true);
  }, [load]);

  return { ...state, refresh };
}
