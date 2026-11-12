import type { Language, NotifMode, PrayerNotifications, Settings } from '../types/prayer';
import type { IqamaDelays, FontSizeMode, PrayerKey, FocusDuration } from '../types/prayer';
import { DEFAULT_CITY_ID } from '../data/tunisianCities';

export const CALC_METHOD_TUNISIA = 18;

export const CALC_METHODS: { id: number; label: string; params?: string }[] = [
  { id: CALC_METHOD_TUNISIA, label: 'Tunisia — Ministry of Religious Affairs', params: 'Fajr 18°, Isha 18°' },
  { id: 3, label: 'Muslim World League', params: 'Fajr 18°, Isha 17°' },
  { id: 4, label: 'Umm al-Qura, Makkah', params: 'Fajr 18.5°, Isha 90 min' },
  { id: 5, label: 'Egyptian General Authority', params: 'Fajr 19.5°, Isha 17.5°' },
  { id: 13, label: 'Diyanet (Turkey)', params: 'Fajr 18°, Isha 17°' },
];

/**
 * Iqama delays are configured manually per prayer (minutes after the adhan).
 * The mandatory minimum is 5 minutes: the user may delay the Iqama further
 * but can never shorten it below the adhan + 5 min. Nothing is fetched from
 * an external API. Missing/invalid values migrate to the 5-minute default.
 */
export const IQAMA_DELAY_MIN = 5;
/** Sensible upper bound so a fat-fingered value can't break the UI/watchdogs. */
export const IQAMA_DELAY_MAX = 120;

export const IQAMA_PRAYER_KEYS: readonly PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Fresh installation: every Iqama delay is 5 minutes after the adhan. */
export const DEFAULT_IQAMA_DELAYS: IqamaDelays = {
  Fajr: IQAMA_DELAY_MIN,
  Dhuhr: IQAMA_DELAY_MIN,
  Asr: IQAMA_DELAY_MIN,
  Maghrib: IQAMA_DELAY_MIN,
  Isha: IQAMA_DELAY_MIN,
};

/** Allowed Iqama Focus durations (minutes). Distinct from the Iqama delay. */
export const FOCUS_DURATIONS: readonly FocusDuration[] = [5, 10, 15, 20];
export const DEFAULT_FOCUS_DURATION: FocusDuration = 15;

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
  fontSize: 'medium',
  opacity: 1,
  showFloatingWidget: false,
  iqamaDelays: DEFAULT_IQAMA_DELAYS,
  iqamaFocusEnabled: true,
  focusDurationMinutes: DEFAULT_FOCUS_DURATION,
  /** Off by default: location only becomes active via explicit user consent. */
  locationEnabled: false,
};

const NOTIF_MODES: NotifMode[] = ['none', 'atTime', '5min', '10min'];
const PRAYER_KEYS = IQAMA_PRAYER_KEYS;
const LANGS: Language[] = ['fr', 'ar', 'en'];
const FONT_SIZES: FontSizeMode[] = ['small', 'medium', 'big'];

/**
 * Design-token scale shared by both windows. The principal window scales the
 * whole UI via the CSS `--ui-scale` token; the floating widget scales its
 * fixed-size panel (window geometry AND text) by the same factor so nothing
 * clips at any font size.
 */
export const PANEL_SCALE: Record<FontSizeMode, number> = { small: 0.9, medium: 1, big: 1.15 };

export function panelScaleFor(mode: unknown): number {
  const m = FONT_SIZES.includes(mode as FontSizeMode) ? (mode as FontSizeMode) : 'medium';
  return PANEL_SCALE[m] ?? 1;
}

/**
 * Validate one Iqama delay: whole minutes only, answers in [5, 120].
 * Missing/invalid junk migrates to the 5-minute default, values below 5
 * migrate up to 5, decimals round to the nearest whole minute.
 */
export function validateIqamaDelay(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return IQAMA_DELAY_MIN;
  const int = Math.round(n);
  return Math.min(IQAMA_DELAY_MAX, Math.max(IQAMA_DELAY_MIN, int));
}

/** Validate an IqamaDelays map: unknown keys dropped, each value validated. */
export function validateIqamaDelays(input: unknown): IqamaDelays {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const out: IqamaDelays = { ...DEFAULT_IQAMA_DELAYS };
  for (const k of IQAMA_PRAYER_KEYS) out[k] = validateIqamaDelay(src[k]);
  return out;
}

/** Whole-minute Focus duration (5/10/15/20); anything else → default 15. */
export function validateFocusDuration(value: unknown): FocusDuration {
  return FOCUS_DURATIONS.includes(value as FocusDuration)
    ? (value as FocusDuration)
    : DEFAULT_FOCUS_DURATION;
}

export type IqamaInputResult =
  | { ok: true; value: number }
  | { ok: false; error: 'invalid' | 'min' | 'max' };

/** Validate one raw settings-input string for the Iqama delay field. */
export function parseIqamaDelayInput(raw: string): IqamaInputResult {
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) return { ok: false, error: 'invalid' };
  const n = Number(text);
  if (n < IQAMA_DELAY_MIN) return { ok: false, error: 'min' };
  if (n > IQAMA_DELAY_MAX) return { ok: false, error: 'max' };
  return { ok: true, value: n };
}

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
    src.theme === 'light' || src.theme === 'system' || src.theme === 'dark' || src.theme === 'emerald-glass'
      ? src.theme
      : 'dark';
  const fontSize: FontSizeMode = FONT_SIZES.includes(src.fontSize as FontSizeMode)
    ? (src.fontSize as FontSizeMode)
    : 'medium';
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
    fontSize,
    opacity,
    showFloatingWidget: src.showFloatingWidget === true,
    locationEnabled: src.locationEnabled === true,
    iqamaDelays: validateIqamaDelays(src.iqamaDelays),
    iqamaFocusEnabled: src.iqamaFocusEnabled !== false,
    focusDurationMinutes: validateFocusDuration(src.focusDurationMinutes),
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
