export type PrayerKey = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export const PRAYER_ORDER: readonly PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export type NotifMode = 'none' | 'atTime' | '5min' | '10min';

export type Language = 'fr' | 'ar' | 'en';

export type ClockFormat = '12h' | '24h';

export type ThemeMode = 'dark' | 'light' | 'system';

export type AsrMadhab = 'standard' | 'hanafi';

/** Offset in minutes before the prayer that a notification should fire. */
export const NOTIF_OFFSET_MINUTES: Record<NotifMode, number> = {
  none: -1,
  atTime: 0,
  '5min': 5,
  '10min': 10,
};

export type PrayerNotifications = Record<PrayerKey, NotifMode>;

export interface Settings {
  cityId: string;
  language: Language;
  clockFormat: ClockFormat;
  calculationMethod: number;
  asrMadhab: AsrMadhab;
  notifications: PrayerNotifications;
  alwaysOnTop: boolean;
  startWithWindows: boolean;
  launchMinimized: boolean;
  theme: ThemeMode;
  opacity: number;
  /** Floating mini-widget window ON/OFF (desktop widget with layout design). */
  showFloatingWidget: boolean;
}

export interface MiniOptions {
  opacity: number;
  alwaysOnTop: boolean;
}

export interface TimingRow {
  Fajr: string;
  Sunrise?: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface HijriDateInfo {
  day: string;
  monthNumber: number;
  monthEn: string;
  monthAr: string;
  year: string;
}

export interface DayPrayerTimes {
  /** Gregorian date in the city timezone, "DD-MM-YYYY". */
  dateKey: string;
  timings: TimingRow;
  hijri: HijriDateInfo;
}

export interface City {
  id: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lon: number;
}

export type ApiError = {
  kind: 'network' | 'timeout' | 'parse' | 'invalid';
  message: string;
};
