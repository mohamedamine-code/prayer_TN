import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSettings } from './hooks/useSettings';
import { useLocation } from './hooks/useLocation';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { usePrayerCountdown, useTunisClock } from './hooks/usePrayerCountdown';
import { usePrayerNotifications } from './hooks/usePrayerNotifications';
import { useIqamaTimes } from './hooks/useIqamaTimes';
import { getDict } from './i18n';
import type { PrayerKey } from './types/prayer';
import { loadCompleted, saveCompleted, type CompletedMap } from './services/storage';
import { Header } from './components/Header';
import { DateDisplay } from './components/DateDisplay';
import { NextPrayer } from './components/NextPrayer';
import { PrayerList } from './components/PrayerList';
import { Footer } from './components/Footer';
import { SettingsPanel } from './components/SettingsPanel';
import { LocationPermissionDialog } from './components/LocationPermissionDialog';
import { ErrorView } from './components/ErrorView';
import { buildPrayerTimestamps } from './logic/times';
import { applyFontSize, applyTheme } from './logic/theme';

export default function App(): JSX.Element {
  const { settings, ready } = useSettings();
  const { language, theme, opacity } = settings;
  const loc = useLocation();

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const onSchemeChange = () => {
      if (theme === 'system') applyTheme(theme);
    };
    mq?.addEventListener?.('change', onSchemeChange);
    return () => mq?.removeEventListener?.('change', onSchemeChange);
  }, [theme]);

  useEffect(() => {
    applyFontSize(settings.fontSize);
  }, [settings.fontSize]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  // Real coordinates when automatic location is active, else manual city.
  const city = loc.activeCity;
  const times = usePrayerTimes({
    city,
    calculationMethod: settings.calculationMethod,
    asrMadhab: settings.asrMadhab,
  });

  const countdown = usePrayerCountdown(times.today, times.tomorrow);
  const clock = useTunisClock();

  const iqama = useIqamaTimes(times.today?.timings, settings.iqamaDelays, settings.clockFormat);

  usePrayerNotifications(settings, times.today, times.tomorrow, countdown.nowMs);

  const [completed, setCompleted] = useState<CompletedMap>({});
  const completedDateRef = useRef('');

  useEffect(() => {
    const key = times.today?.dateKey ?? '';
    if (key && key !== completedDateRef.current) {
      completedDateRef.current = key;
      let cancelled = false;
      void loadCompleted(key).then((map) => {
        if (!cancelled) setCompleted(map);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [times.today?.dateKey]);

  const toggleCompleted = useCallback((key: PrayerKey) => {
    const dateKey = completedDateRef.current;
    if (!dateKey) return;
    setCompleted((prev) => {
      const next: CompletedMap = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      void saveCompleted(dateKey, next);
      return next;
    });
  }, []);

  const t = getDict(language);

  const nextTimeStr = useMemo(() => {
    if (!countdown.next) return '--:--';
    if (countdown.next.isTomorrow) return times.tomorrow?.timings.Fajr ?? '--:--';
    return times.today?.timings[countdown.next.prayer] ?? '--:--';
  }, [countdown.next, times.today, times.tomorrow]);

  const nextIndex = useMemo(
    () =>
      times.today
        ? (buildPrayerTimestamps(times.today) ?? []).findIndex(
            (e) => e.key === countdown.next?.prayer,
          )
        : -1,
    [times.today, countdown.next],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const offlineMode = !navigator.onLine;
  const showLoading =
    !ready || (times.loading && !times.today);

  if (showLoading) {
    return (
      <Shell opacity={opacity}>
        <div className="flex h-full items-center justify-center animate-fade-in">
          <span className="animate-pulse-soft text-[12px] text-[var(--text-muted)]">{t.loading}</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell opacity={opacity}>
      <Header onRefresh={times.refresh} onOpenSettings={() => setSettingsOpen(true)} />
      <main className="app-no-drag flex min-h-0 flex-1 flex-col overflow-y-auto">
        <DateDisplay
          today={times.today}
          language={language}
          clockFormat={settings.clockFormat}
          clock={clock}
          t={t}
        />

        {!times.today ? (
          <ErrorView error={times.error} showNoData onRetry={times.refresh} />
        ) : (
          <>
            <NextPrayer
              next={countdown.next}
              nextTimeStr={nextTimeStr}
              countdownText={countdown.countdownText}
              progress={countdown.progress}
              language={language}
              t={t}
            />
            {countdown.upcoming.length > 0 && (
              <PrayerList
                entries={countdown.upcoming}
                rawTimings={times.today.timings}
                nextIndex={nextIndex}
                nextIsTomorrow={countdown.next?.isTomorrow ?? false}
                completed={completed}
                onToggleCompleted={toggleCompleted}
                language={language}
                clockFormat={settings.clockFormat}
                iqama={{
                  enabled: iqama.enabled,
                  notConfiguredHint: iqama.notConfigured,
                  times: iqama.times,
                  isConfigured: iqama.isConfigured,
                }}
              />
            )}
            {times.fromCache && offlineMode && (
              <div className="mx-4 mb-2 rounded-lg bg-[var(--bg-card)] px-3 py-1.5 text-center text-[10px] text-[var(--text-faint)]">
                ⓘ {t.usingCache}
              </div>
            )}
          </>
        )}
      </main>

      <Footer lastUpdated={times.lastUpdated} refreshing={times.refreshing} online={!offlineMode} />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <LocationPermissionDialog />
    </Shell>
  );
}

function Shell({ opacity, children }: { opacity: number; children: ReactNode }): JSX.Element {
  return (
    <div
      className="relative h-full w-full flex flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-gradient-to-b from-[var(--shell-from)] to-[var(--shell-to)] text-[var(--text-primary)] shadow-2xl"
      id="salati-shell"
    >
      <div
        className="pattern-islamic pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
      />
      <div className="relative flex h-full min-h-0 flex-col" style={{ opacity }}>
        {children}
      </div>
    </div>
  );
}
