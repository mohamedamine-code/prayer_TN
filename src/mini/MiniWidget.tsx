import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { LottieLight } from 'lottie-react';
import flowIcon from './assets/flowIcon.json';
import type { AnimationEvent, JSX } from 'react';
import type { Settings, PrayerKey } from '../types/prayer';
import type { CompletedMap } from '../shared/completions';
import { validateCompletionsStore } from '../shared/completions';
import type { DockEdge, DockState } from './dockLogic';
import { animFallbackMs, nextPhase, type DockPhase } from './dockPhase';
import { getCity } from '../data/tunisianCities';
import { getDict } from '../i18n';
import { LocationProvider } from '../hooks/useLocation';
import {
  MINI_CELLS,
  buildMiniEntries,
  formatMiniClock,
  formatMiniCountdown,
  formatMiniTime,
  getNextMini,
} from './miniLogic';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { usePrayerCountdown } from '../hooks/usePrayerCountdown';
import { useIqamaTimes } from '../hooks/useIqamaTimes';
import { useLocation } from '../hooks/useLocation';
import { TUNIS_TZ, wallClockInTz } from '../logic/times';
import { applyFontSize, applyTheme } from '../logic/theme';

/** Observe settings changes coming from the main app (read-only). */
function useMiniSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void window.salati.getSettings().then((s) => {
        if (!cancelled) setSettings(s);
      });
    };
    load();
    const unsub = window.salati.onChanged(load);
    const poll = window.setInterval(load, 10_000);
    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(poll);
    };
  }, []);
  return settings;
}

/** Dock state (edge + collapsed/expanded) driven by the main process. */
function useDockState(): DockState | null {
  const [dock, setDock] = useState<DockState | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!window.salati) return;
    const unsub = window.salati.onDockChanged((s) => setDock(s));
    /* Fetch the state after subscribing: covers both the initial load and an
       early/missed dock:changed push, so the phase can never fall out of sync. */
    void window.salati
      .getDockState()
      .then((s) => {
        if (!cancelled) setDock(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return dock;
}

/** Completion state for the current day, kept in sync with the main app. */
function useMiniCompletions(dateKey: string | undefined): CompletedMap {
  const [done, setDone] = useState<CompletedMap>({});
  useEffect(() => {
    let cancelled = false;
    if (!dateKey) {
      setDone({});
      return;
    }
    const load = () => {
      void window.salati
        ?.getCompleted()
        .then((store) => {
          if (!cancelled) setDone(validateCompletionsStore(store)[dateKey] ?? {});
        })
        .catch(() => undefined);
    };
    load();
    const unsub = window.salati?.onCompletedChanged(load);
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [dateKey]);
  return done;
}

/** Chevron direction: collapsed points inward, expanded points back to the edge. */
function chevronFor(edge: DockEdge, expanded: boolean): 'left' | 'right' | 'up' | 'down' {
  const collapseDir: Record<DockEdge, 'left' | 'right' | 'up' | 'down'> = {
    left: 'left',
    right: 'right',
    top: 'up',
    bottom: 'down',
  };
  const expandDir: Record<DockEdge, 'left' | 'right' | 'up' | 'down'> = {
    left: 'right',
    right: 'left',
    top: 'down',
    bottom: 'up',
  };
  return expanded ? collapseDir[edge] : expandDir[edge];
}

function Chevron({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }): JSX.Element {
  if (dir === 'left') return <ChevronLeft />;
  if (dir === 'right') return <ChevronRight />;
  if (dir === 'up') return <ChevronUp />;
  return <ChevronDown />;
}

/** Widget surface classes for the current expansion phase. */
function miniMainClass(phase: DockPhase): string {
  if (phase === 'opening') return 'mini-main anim-open';
  if (phase === 'closing') return 'mini-main anim-close';
  return 'mini-main';
}

/** Root of the mini window: an edge-docked tab that expands into the widget. */
export function MiniWidget(): JSX.Element {
  const dock = useDockState();
  /* The window starts hidden; once the dock phase has been adopted and
     committed (real content on screen), tell the main process it is safe to
     show the widget - prevents a first-frame flash of a stale/empty layout. */
  const readySent = useRef(false);
  useEffect(() => {
    if (dock && !readySent.current) {
      readySent.current = true;
      window.salati?.dockReady();
    }
  }, [dock]);
  if (!dock) return <div className="dock-root" />;
  // The mini window never drives the watcher: it mirrors main-process state.
  return <LocationProvider><DockSurface dock={dock} /></LocationProvider>;
}

function rootClass(edge: DockEdge): string {
  const orient = edge === 'left' || edge === 'right' ? 'dock-h' : 'dock-v';
  return `dock-root dock-${edge} ${orient}`;
}

function DockSurface({ dock }: { dock: DockState }): JSX.Element {
  const settings = useMiniSettings();
  const loc = useLocation();
  /* Mirror the shared appearance tokens (theme + font size, P5) so the
     floating widget always matches the principal widget instantly. */
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);
  }, [settings]);
  const city = getCity(settings?.cityId ?? 'tunis');  const times = usePrayerTimes({
    city,
    calculationMethod: settings?.calculationMethod ?? 18,
    asrMadhab: settings?.asrMadhab ?? 'standard',
  });
  const countdown = usePrayerCountdown(times.today, times.tomorrow);
  const completedToday = useMiniCompletions(times.today?.dateKey);
  const t = getDict(settings?.language ?? 'fr');
  const iqama = useIqamaTimes(
    times.today?.timings,
    settings?.iqamaDelays ?? {},
    settings?.clockFormat,
  );

  const nextMini = useMemo(
    () => getNextMini(countdown.nowMs, buildMiniEntries(times.today), buildMiniEntries(times.tomorrow)?.find((e) => e.key === 'Fajr')?.at ?? null),
    [countdown.nowMs, times.today, times.tomorrow],
  );

  /* Dragging (P3): raw pointermove can fire far faster than the display frame
     rate (especially after a DPI/resolution change, where the move class
     becomes expensive). Coalesce to at most ONE IPC per animation frame with
     the latest pointer position instead of sending every raw event. No React
     state is touched during the drag, and the main process only persists the
     position once, when the drag ends. */
  const dragPos = useRef<{ x: number; y: number } | null>(null);
  const dragRaf = useRef(0);
  const clearDragRaf = () => {
    if (dragRaf.current) {
      cancelAnimationFrame(dragRaf.current);
      dragRaf.current = 0;
    }
  };
  useEffect(() => clearDragRaf, []);

  /* Expansion lifecycle. The first paint adopts the current state without any
     animation (no flash on startup / restore); later changes animate. */
  const [phase, setPhase] = useState<DockPhase>(() => (dock.expanded ? 'open' : 'collapsed'));
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setPhase((prev) => nextPhase(prev, dock.expanded));
  }, [dock.expanded]);

  /* Failsafe: if a keyframe never starts/ends (panel hidden, move cancelled,
     etc.), force the phase exit so visibility always matches reality. The
     closing branch also acks the main process like a real animationend. */
  useEffect(() => {
    if (phase !== 'opening' && phase !== 'closing') return;
    const id = window.setTimeout(() => {
      if (phase === 'closing') {
        void window.salati?.dockCollapseFinish();
        setPhase('collapsed');
      } else {
        setPhase('open');
      }
    }, animFallbackMs(phase)!);
    return () => window.clearTimeout(id);
  }, [phase]);

  const onMiniAnimEnd = (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'closing') {
      setPhase('collapsed');
      void window.salati?.dockCollapseFinish();
    } else if (phase === 'opening') {
      setPhase('open');
    }
  };

  if (!settings) return <div className={rootClass(dock.edge)} />;
  const clockFormat = settings.clockFormat;
  const clock = wallClockInTz(TUNIS_TZ);
  const nowHHMMSS = formatMiniClock(clock.h, clock.m, clock.s, clockFormat);
  const cityName =
    settings.language === 'ar' ? city.nameAr : settings.language === 'en' ? city.nameEn : city.nameFr;
  const remaining = nextMini ? nextMini.at - countdown.nowMs : 0;
  const chev = chevronFor(dock.edge, dock.expanded);

  /* Location indicator states (floating widget):
     📍 active · ⏳ detecting · 🔒 permission required · ⚠️ unavailable */
  const miniCity =
    loc.status === 'active' && loc.placeLabel
      ? `📍 ${loc.placeLabel}`
      : loc.status === 'detecting'
        ? `⏳ ${t.locDetecting}`
        : (loc.status === 'prompt' || loc.status === 'denied')
          ? `🔒 ${t.locLocked}`
          : loc.status === 'unavailable'
            ? `⚠️ ${t.locUnavailable}`
            : cityName;

  return (
    <div className={rootClass(dock.edge)} onContextMenu={() => void window.salati?.openMiniMenu()}>
      <div
        className="dock-tab"
        title={dock.expanded ? t.dockCollapse : t.dockExpand}
        onPointerDown={(e) => {
          if ((e.target as Element).closest?.('.dock-chev')) return;
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          void window.salati?.dockDragStart(e.screenX, e.screenY);
        }}
        onPointerMove={(e) => {
          if (!(e.buttons & 1)) return;
          dragPos.current = { x: e.screenX, y: e.screenY };
          if (dragRaf.current) return;
          dragRaf.current = requestAnimationFrame(() => {
            dragRaf.current = 0;
            const p = dragPos.current;
            if (p) void window.salati?.dockDragMove(p.x, p.y);
          });
        }}
        onPointerUp={() => {
          clearDragRaf();
          void window.salati?.dockDragEnd();
        }}
        onPointerCancel={() => {
          clearDragRaf();
          void window.salati?.dockDragEnd();
        }}
      >
        <LottieLight className="dock-anim" src={flowIcon} loop autoplay />
        <button
          type="button"
          className="dock-chev"
          title={dock.expanded ? t.dockCollapse : t.dockExpand}
          onClick={() => void window.salati?.dockToggle()}
        >
          <Chevron dir={chev} />
        </button>
      </div>

      <div
        className={miniMainClass(phase)}
        style={{ visibility: phase === 'collapsed' ? 'hidden' : 'visible' }}
        onAnimationEnd={onMiniAnimEnd}
      >
        <div className="mini-root">
          <div className="mini-header">
            <span className="mini-logo">Salati</span>
            <span className="mini-clock">{nowHHMMSS}</span>
            <span className="mini-city" title={miniCity}>{miniCity}</span>
            <button
              type="button"
              className="mini-close"
              title={t.close}
              onClick={() => void window.salati?.closeMini()}
            >
              ×
            </button>
          </div>

          <div className="mini-center">
            <div className="mini-label">
              {settings.language === 'ar' ? 'التالية' : 'NEXT'} · {nextMini ? ABBR_OF[nextMini.key] : '—'}
            </div>
            {nextMini ? (
              <div className="mini-countdown">{formatMiniCountdown(remaining)}</div>
            ) : (
              <div className="mini-error">{times.error ? t.errorTitle : t.loading}</div>
            )}
          </div>

          <div className="mini-cells">
            {MINI_CELLS.map((cell) => {
              const raw = times.today?.timings[cell.key];
              const active = nextMini?.key === cell.key;
              // Sunrise is informational only: never part of the checklist.
              const isTrackable = cell.key !== 'Sunrise';
              const done = isTrackable && completedToday[cell.key as keyof CompletedMap] === true;
              // Manual Iqama: only prayers with a configured delay get a time.
              const configured = isTrackable && iqama.isConfigured(cell.key as PrayerKey);
              const iqRaw = configured ? iqama.times[cell.key as PrayerKey] : undefined;
              return (
                <div key={cell.key} className={active ? 'mini-cell active' : 'mini-cell'}>
                  <div className="mini-cell-abbr">
                    {cell.abbr}
                    {isTrackable && done && (
                      <span className="mini-cell-check" title={t.completed}>
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="mini-cell-time">{raw ? formatMiniTime(raw, clockFormat) : '--:--'}</div>
                  <div
                    className="mini-cell-iqama"
                    data-configured={configured ? 'true' : 'false'}
                    title={configured ? t.iqama : `${t.iqama} — ${t.iqamaNotConfigured}`}
                  >
                    {iqRaw ?? '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const ABBR_OF: Record<string, string> = Object.fromEntries(
  MINI_CELLS.map((c) => [c.key, c.abbr]),
) as Record<string, string>;
