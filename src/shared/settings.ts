import type { Language, NotifMode, PrayerNotifications, Settings } from '../types/prayer';
import { DEFAULT_CITY_ID } from '../data/tunisianCities';

export const CALC_METHOD_TUNISIA = 18;

export const CALC_METHODS: { id: number; label: string; params?: string }[] = [
  { id: CALC_METHOD_TUNISIA, label: 'Tunisia — Ministry of Religious Affairs', params: 'Fajr 18°, Isha 18°' },
  { id: 3, label: 'Muslim World League', params: 'Fajr 18°, Isha 17°' },
  { id: 4, label: 'Umm al-Qura, Makkah', params: 'Fajr 18.5°, Isha 90 min' },
  { id: 5, label: 'Egyptian General Authority', params: 'Fajr 19.5°, Isha 17.5°' },
  { id: 13, label: 'Diyanet (Turkey)', params: 'Fajr 18°, Isha 17°' },
];

export const DEFAULT_SETTINGS: Settings = {
  cityId: DEFAULT_CITY_ID,
  language: 'fr',
  clockFormat: '24h',
  calculationMethod: CALC_METHOD_TUNISIA,
  asrMadhab: 'standard',
  notifications: {
    Fajr: 'atTime',
    Dhuhr: 'atTime',
    Asr: 'atTime',
    Maghrib: 'atTime',
    Isha: 'atTime',
  },
  alwaysOnTop: true,
  startWithWindows: false,
  launchMinimized: false,
  theme: 'dark',
  opacity: 1,
  showFloatingWidget: false,
};

const NOTIF_MODES: NotifMode[] = ['none', 'atTime', '5min', '10min'];
const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
const LANGS: Language[] = ['fr', 'ar', 'en'];

/** Merge arbitrary (possibly persisted junk) input into a full validated Settings object. */
export function validateSettings(input: unknown): Settings {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const notifs = src.notifications as Record<string, unknown> | undefined;

  const notifications = {} as PrayerNotifications;
  for (const k of PRAYER_KEYS) {
    const v = notifs?.[k];
    notifications[k] = NOTIF_MODES.includes(v as NotifMode) ? (v as NotifMode) : 'atTime';
  }

  const cityId = typeof src.cityId === 'string' && /^[a-z-]{2,20}$/.test(src.cityId) ? src.cityId : DEFAULT_SETTINGS.cityId;
  const language = LANGS.includes(src.language as Language) ? (src.language as Language) : 'fr';
  const clockFormat = src.clockFormat === '12h' ? '12h' : '24h';
  const asrMadhab = src.asrMadhab === 'hanafi' ? 'hanafi' : 'standard';
  const methodId = Number(src.calculationMethod);
  const calculationMethod = CALC_METHODS.some((m) => m.id === methodId) ? methodId : DEFAULT_SETTINGS.calculationMethod;
  const theme =
    src.theme === 'light' || src.theme === 'system' || src.theme === 'dark' ? src.theme : 'dark';
  const opacity =
    typeof src.opacity === 'number' && Number.isFinite(src.opacity)
      ? Math.min(1, Math.max(0.6, src.opacity))
      : 1;

  return {
    ...DEFAULT_SETTINGS,
    cityId,
    language,
    clockFormat,
    calculationMethod,
    asrMadhab,
    notifications,
    alwaysOnTop: src.alwaysOnTop === true,
    startWithWindows: src.startWithWindows === true,
    launchMinimized: src.launchMinimized === true,
    theme,
    opacity,
    showFloatingWidget: src.showFloatingWidget === true,
  };
}

/** Persisted mini-widget options (opacity / always-on-top). */
export interface MiniWidgetOptions {
  opacity: number;
  alwaysOnTop: boolean;
}

export const MINI_WIDGET_BOUNDS_KEY = 'miniWidgetBounds';
export const MINI_WIDGET_OPTIONS_KEY = 'miniWidgetOptions';

export function validateMiniOptions(input: unknown): MiniWidgetOptions {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const opacity =
    typeof src.opacity === 'number' && Number.isFinite(src.opacity)
      ? Math.min(1, Math.max(0.35, src.opacity))
      : 1;
  return { opacity, alwaysOnTop: src.alwaysOnTop !== false };
}

/** Name of the persisted window-bounds entry inside the settings store. */
export const WINDOW_BOUNDS_KEY = 'windowBounds';
