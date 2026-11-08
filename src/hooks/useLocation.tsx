import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { City, Language } from '../types/prayer';
import type { StoredLocation } from '../shared/location';
import { DEFAULT_LOCATION, isMeaningfulMove } from '../shared/location';
import { GEO_POSITION_OPTS, hasUsableFix, placeLabel, reverseGeocode } from '../services/geolocation';
import { getCity, DEFAULT_CITY_ID } from '../data/tunisianCities';
import { geohashId } from '../shared/location';
import { getDict, type Dict } from '../i18n';

/** UI state machine derived from consent + enablement + runtime geolocation. */
export type LocStatus =
  | 'denied' // user chose Not Now / permission refused
  | 'disabled' // automatic location off in settings
  | 'prompt' // not asked yet (first-use dialog pending)
  | 'detecting' // consent given, waiting for the first fix
  | 'active' // fix available
  | 'unavailable'; // error (no fix, timeout, hardware/OS unavailable)

const GEO_ERROR_KEY: Record<number, keyof Dict> = {
  1: 'locErrPermission',
  2: 'locErrUnavailable',
  3: 'locErrTimeout',
};

export interface LocationApi {
  state: StoredLocation;
  status: LocStatus;
  errorDetail: string | null;
  t: Dict;
  /** City used for prayer calculations right now (geo fix or manual choice). */
  activeCity: City;
  /** True when prayer times currently come from real coordinates. */
  usingGeo: boolean;
  /** Readable label for the geo fix (reverse-geocoded, or a generic label). */
  placeLabel: string | null;
  /** Manual city shown to the user when location is off. */
  manualCity: City;
  dialogOpen: boolean;
  allowLocation(): void;
  notNow(): void;
  setEnabled(v: boolean): void;
  refresh(): void;
  clearStored(): void;
  /** Switch back to the manually selected city (turns auto location off). */
  useManualCity(): void;
  openDialog(): void;
  dismissDialog(): void;
}

const LocationCtx = createContext<LocationApi | null>(null);

function statusOf(loc: StoredLocation, enabled: boolean, detecting: boolean): LocStatus {
  if (loc.consent === 'declined') return 'denied';
  if (!enabled) return 'disabled';
  if (loc.consent === 'unset') return 'prompt';
  // consent granted:
  if (loc.updatedAt === null) return detecting ? 'detecting' : 'unavailable';
  if (detecting) return 'detecting';
  return hasUsableFix(loc) ? 'active' : 'unavailable';
}

/** Geographic City built from real coordinates (never city-centre values). */
function geoCity(loc: StoredLocation, label: string | null): City {
  const lat = loc.lat as number;
  const lon = loc.lon as number;
  const id = geohashId(lat, lon);
  return { id, lat, lon, nameFr: label ?? id, nameAr: label ?? id, nameEn: label ?? id };
}

/**
 * Location context.
 *
 * Exactly one renderer (the main window) passes `driver={true}`: it owns
 * `navigator.geolocation` calls and pushes accepted fixes to the main
 * process, which validates, stores and broadcasts them to every window
 * (including the mini widget, rendered with `driver={false}`).
 *
 * No `navigator.geolocation` call is made before the stored consent equals
 * 'granted' — the real Electron permission system is the gate
 * (see electron/location.ts).
 */
export function LocationProvider({
  driver = false,
  children,
}: {
  driver?: boolean;
  children: ReactNode;
}): JSX.Element {
  const [loc, setLoc] = useState<StoredLocation>(DEFAULT_LOCATION);
  const [enabled, setEnabledState] = useState(false);
  const [lang, setLang] = useState<Language>('fr');
  const [cityId, setCityId] = useState<string>(DEFAULT_CITY_ID);
  const [runtimeDetecting, setRuntimeDetecting] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [restartTick, setRestartTick] = useState(0);

  const dialogShownRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const lastFixRef = useRef<{ lat: number; lon: number } | null>(null);
  const langRef = useRef<Language>('fr');

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  /* Boot: pull the stored location + related settings, subscribe to updates. */
  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;

    const unsubLoc = window.salati?.onLocationChanged((s) => {
      if (!cancelled) setLoc(s);
    });
    void window.salati
      ?.getLocation()
      .then((s) => {
        if (!cancelled) setLoc(s);
        // First-run explanation: exactly once per session, main window only.
        if (!cancelled && s.consent === 'unset' && driver && !dialogShownRef.current) {
          dialogShownRef.current = true;
          setDialogOpen(true);
        }
      })
      .catch(() => undefined);

    const readSettings = () => {
      void window.salati
        ?.getSettings()
        .then((s) => {
          if (cancelled) return;
          setEnabledState(s.locationEnabled);
          setLang((prev) => (prev === s.language ? prev : s.language));
          setCityId((prev) => (prev === s.cityId ? prev : s.cityId));
        })
        .catch(() => undefined);
    };
    readSettings();
    const unsubSettings = window.salati?.onChanged(readSettings);

    return () => {
      cancelled = true;
      aliveRef.current = false;
      unsubLoc?.();
      unsubSettings?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  /* Stop the watcher when the driver renderer itself goes away. */
  useEffect(() => {
    return () => {
      if (driver) {
        const id = watchIdRef.current;
        if (id !== null && navigator.geolocation) navigator.geolocation.clearWatch(id);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver]);

  const onFix = useCallback(
    (pos: GeolocationPosition) => {
      if (!aliveRef.current || !driver) return;
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const moved =
        !lastFixRef.current ||
        isMeaningfulMove({ lat: lastFixRef.current.lat, lon: lastFixRef.current.lon }, lat, lon);
      lastFixRef.current = { lat, lon };
      setRuntimeDetecting(false);
      setErrorDetail(null);

      void window.salati
        ?.pushLocationFix({
          lat,
          lon,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 0,
          timestamp: pos.timestamp,
        })
        .catch(() => undefined);

      if (moved) {
        void reverseGeocode(lat, lon, langRef.current)
          .then((r) => (r ? window.salati?.setLocationCity(r) : undefined))
          .catch(() => undefined);
      }
    },
    [driver],
  );

  const onFixError = useCallback(
    (err: GeolocationPositionError) => {
      if (!aliveRef.current || !driver) return;
      const d = getDict(langRef.current);
      setErrorDetail(d[GEO_ERROR_KEY[err.code] ?? 'locErrUnavailable'] ?? null);
      setRuntimeDetecting(false);
      if (err.code === 1) {
        // Explicit permission refusal: stop every watch, never auto-retry.
        const id = watchIdRef.current;
        if (id !== null && navigator.geolocation) navigator.geolocation.clearWatch(id);
        watchIdRef.current = null;
      }
    },
    [driver],
  );

  /* Start / stop monitoring following consent + the settings toggle. */
  useEffect(() => {
    if (!driver) return undefined;

    const stop = (): void => {
      const id = watchIdRef.current;
      if (id !== null && navigator.geolocation) navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
      setRuntimeDetecting(false);
    };

    const start = (): void => {
      if (!navigator.geolocation) {
        const d = getDict(langRef.current);
        setErrorDetail(d.locErrUnsupported ?? null);
        return;
      }
      setRuntimeDetecting(true);
      navigator.geolocation.getCurrentPosition(onFix, onFixError, GEO_POSITION_OPTS);
      watchIdRef.current = navigator.geolocation.watchPosition(onFix, onFixError, GEO_POSITION_OPTS);
    };

    let started = false;
    if (loc.consent === 'granted' && enabled) {
      if (watchIdRef.current === null) {
        start();
        started = true;
      }
      if (restartTick > 0) {
        stop();
        start();
        started = true;
      }
    }
    if (!started) stop();
    return stop;
  }, [driver, loc.consent, enabled, restartTick, onFix, onFixError]);

  const status = useMemo(
    () => statusOf(loc, enabled, runtimeDetecting),
    [loc, enabled, runtimeDetecting],
  );

  const writeEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    void window.salati?.saveSettings({ locationEnabled: v }).catch(() => undefined);
  }, []);

  const allowLocation = useCallback(() => {
    setDialogOpen(false);
    // 1) record explicit consent, 2) enable automatic location; the driver
    // effect then fires the REAL geolocation permission request —
    // coordinates become retrievable only once Electron approves it.
    void window.salati?.setLocationConsent('granted').catch(() => undefined);
    writeEnabled(true);
  }, [writeEnabled]);

  const notNow = useCallback(() => {
    setDialogOpen(false);
    // No coordinates are ever requested after "Not Now"; no auto re-prompt.
    void window.salati?.setLocationConsent('declined').catch(() => undefined);
    writeEnabled(false);
  }, [writeEnabled]);

  const setEnabled = useCallback(
    (v: boolean) => {
      if (v && loc.consent !== 'granted') {
        // Enabling requires consent first: open the explanation dialog.
        dialogShownRef.current = true;
        setDialogOpen(true);
        return;
      }
      if (!v) {
        lastFixRef.current = null;
        void window.salati?.clearLocation().catch(() => undefined);
      }
      writeEnabled(v);
    },
    [loc.consent, writeEnabled],
  );

  const refresh = useCallback(() => setRestartTick((n) => n + 1), []);

  const clearStored = useCallback(() => {
    void window.salati?.clearLocation().catch(() => undefined);
  }, []);

  const useManualCity = useCallback(() => {
    lastFixRef.current = null;
    writeEnabled(false);
  }, [writeEnabled]);

  const dismissDialog = useCallback(() => setDialogOpen(false), []);
  const openDialog = useCallback(() => {
    dialogShownRef.current = true;
    setDialogOpen(true);
  }, []);

  const t = useMemo(() => getDict(lang), [lang]);
  const manualCity = useMemo(() => getCity(cityId), [cityId]);

  const usingGeo = loc.consent === 'granted' && enabled && hasUsableFix(loc);
  const activeCity = useMemo(
    () =>
      usingGeo
        ? geoCity(loc, placeLabel(loc, lang))
        : manualCity,
    [usingGeo, loc, lang, manualCity],
  );
  const placeName = usingGeo ? placeLabel(loc, lang) : null;

  const api = useMemo<LocationApi>(
    () => ({
      state: loc,
      status,
      errorDetail,
      t,
      activeCity,
      usingGeo,
      placeLabel: placeName,
      manualCity,
      dialogOpen: dialogOpen && driver,
      allowLocation,
      notNow,
      setEnabled,
      refresh,
      clearStored,
      useManualCity,
      openDialog,
      dismissDialog,
    }),
    [
      loc,
      status,
      errorDetail,
      t,
      activeCity,
      usingGeo,
      placeName,
      manualCity,
      dialogOpen,
      driver,
      allowLocation,
      notNow,
      setEnabled,
      refresh,
      clearStored,
      useManualCity,
      openDialog,
      dismissDialog,
    ],
  );

  return <LocationCtx.Provider value={api}>{children}</LocationCtx.Provider>;
}

const FALLBACK_API: LocationApi = {
  state: DEFAULT_LOCATION,
  status: 'disabled',
  errorDetail: null,
  t: getDict('fr'),
  activeCity: getCity(DEFAULT_CITY_ID),
  usingGeo: false,
  placeLabel: null,
  manualCity: getCity(DEFAULT_CITY_ID),
  dialogOpen: false,
  allowLocation: () => undefined,
  notNow: () => undefined,
  setEnabled: () => undefined,
  refresh: () => undefined,
  clearStored: () => undefined,
  useManualCity: () => undefined,
  openDialog: () => undefined,
  dismissDialog: () => undefined,
};

export function useLocation(): LocationApi {
  return useContext(LocationCtx) ?? FALLBACK_API;
}
