import {
  Sunrise as FajrIcon,
  Sun as DhuhrIcon,
  CloudSun as AsrIcon,
  Sunset as MaghribIcon,
  Moon as IshaIcon,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  BellOff,
  Bell,
  BellRing,
} from 'lucide-react';
import type { ClockFormat, NotifMode, PrayerKey } from '../types/prayer';

export type { NotifMode };

export function prayerIcon(key: PrayerKey): LucideIcon {
  switch (key) {
    case 'Fajr':
      return FajrIcon;
    case 'Dhuhr':
      return DhuhrIcon;
    case 'Asr':
      return AsrIcon;
    case 'Maghrib':
      return MaghribIcon;
    case 'Isha':
      return IshaIcon;
  }
}

export function notifIcon(mode: NotifMode): LucideIcon {
  switch (mode) {
    case 'none':
      return BellOff;
    case 'atTime':
      return Bell;
    default:
      return BellRing;
  }
}

export function formatTime(hhmm: string | undefined, format: ClockFormat): string {
  if (!hhmm) return '--:--';
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return hhmm;
  if (format === '24h') {
    return `${m[1]!.padStart(2, '0')}:${m[2]}`;
  }
  const h = Number(m[1]);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

export { Check };
