import type { PrayerKey } from '../types/prayer';
import { IQAMA_PRAYER_KEYS } from '../shared/settings';

/**
 * Iqama Focus Mode — single shared source of truth (pure functions, no
 * Electron/React imports) used by the principal widget and the floating
 * widget alike.
 *
 * The active focus session is always DERIVED from real timestamps, never
 * from a decrementing counter:
 *   Focus End  = Iqama timestamp + configured focus duration
 *   Remaining  = max(0, Focus End - now)
 * so sleep/wake, minimization and full app restarts cannot drift, and an
 * expired session simply drops out of the window.
 */

/** Notification window: an Iqama whose time passed longer ago is stale. */
export const IQAMA_NOTIFY_GRACE_MS = 90_000;

export interface FocusSession {
  prayer: PrayerKey;
  /** Absolute epoch ms of the adhan of this prayer (focus context display). */
  prayerAt: number;
  /** Absolute epoch ms of the Iqama (focus start). */
  iqamaAt: number;
  /** Absolute epoch ms of the end of the focus window. */
  focusEndAt: number;
  /** Configured duration in minutes. */
  durationMin: number;
}

/** Focus end timestamp derived from real timestamps (Iqama + duration). */
export function focusEndAt(iqamaAtMs: number, durationMin: number): number {
  const d = Number.isFinite(durationMin) ? Math.max(0, Math.round(durationMin)) : 0;
  return iqamaAtMs + d * 60_000;
}

/**
 * The prayer whose Iqama focus window contains `now`, if any (there can only
 * ever be one when durations are minutes; on overlap the most recent wins).
 */
export function activeFocusSession(
  now: number,
  iqamaTimestamps: Partial<Record<PrayerKey, number>>,
  durationMin: number,
  prayerTimestamps?: Partial<Record<PrayerKey, number>>,
): FocusSession | null {
  let found: FocusSession | null = null;
  for (const prayer of IQAMA_PRAYER_KEYS) {
    const at = iqamaTimestamps[prayer];
    if (typeof at !== 'number') continue;
    const end = focusEndAt(at, durationMin);
    if (now >= at && now < end) {
      found = {
        prayer,
        prayerAt: prayerTimestamps?.[prayer] ?? at,
        iqamaAt: at,
        focusEndAt: end,
        durationMin,
      };
    }
  }
  return found;
}

/** "MM:SS" remaining-time text (e.g. 15:00 → 14:59 … 00:00), clamped at zero. */
export function formatFocusCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 0..1 fraction of remaining focus time (1 = just started, 0 = done). */
export function focusRemainingRatio(
  now: number,
  iqamaAtMs: number,
  durationMin: number,
): number {
  const end = focusEndAt(iqamaAtMs, durationMin);
  const span = end - iqamaAtMs;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (end - now) / span));
}

/**
 * Deterministic notification key: one Iqama notification per prayer per
 * local calendar date. The Iqama timestamp in the key lets the main process
 * apply the staleness grace window; same key ⇒ never duplicates (in-session
 * Set + persisted history in electron/notifications).
 */
export function iqamaNotifyKey(
  cityId: string,
  dateKey: string,
  prayer: PrayerKey,
  iqamaAtMs: number,
): string {
  return `${cityId}|${dateKey}|${prayer}|iqama|${iqamaAtMs}`;
}

/** True when `now` is inside the notification grace of this Iqama. */
export function isIqamaNotificationDue(
  now: number,
  iqamaAtMs: number,
  graceMs: number = IQAMA_NOTIFY_GRACE_MS,
): boolean {
  return now >= iqamaAtMs && now - iqamaAtMs <= graceMs;
}
