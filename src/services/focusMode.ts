import type { PrayerKey } from '../types/prayer';

/**
 * Iqama Focus Mode — single shared source of truth (pure functions, no
 * Electron/React imports) used by the principal widget and the floating
 * widget alike.
 *
 * One state machine, three(states):
 *   STATE 1 (Normal):      now <  prayerAt
 *   STATE 2 (Focus):  prayerAt <= now < iqamaAt      ← focus duration = iqama − prayer
 *   STATE 3 (Iqama reached): iqamaAt <= now
 *
 * The active focus session is always DERIVED from real timestamps, never
 * from a decrementing counter:
 *   Focus End  = Iqama timestamp
 *   Remaining  = max(0, Focus End - now)
 * so sleep/wake, minimization and full app restarts cannot drift, an expired
 * session simply drops out of the window, and a session started mid-window
 * (app launch / wake between Adhan and Iqama) restores exactly.
 */

/** Notification window: an Iqama whose time passed longer ago is stale. */
export const IQAMA_NOTIFY_GRACE_MS = 90_000;

/** One focus candidate: adhan and its configured Iqama (absolute epoch ms). */
export interface FocusWindow {
  prayer: PrayerKey;
  /** Official prayer (Adhan) timestamp — Focus Mode STARTS here. */
  prayerAt: number;
  /** Iqama timestamp — Focus Mode ENDS here. */
  iqamaAt: number;
}

export interface FocusSession extends FocusWindow {
  /** Absolute epoch ms of the end of the focus window (= iqamaAt). */
  focusEndAt: number;
  /** Active duration in minutes = (iqamaAt - prayerAt) / 60_000. */
  durationMin: number;
}

/**
 * STATE 2 rule: the focus window whose [adhan, iqama) interval contains
 * `now`, if any (windows are disjoint). Expired sessions (now >= iqamaAt)
 * and not-yet-started sessions (now < prayerAt) return null — Normal Mode.
 */
export function activeFocusSession(
  now: number,
  windows: readonly FocusWindow[],
): FocusSession | null {
  let found: FocusSession | null = null;
  for (const w of windows) {
    if (!(w.iqamaAt > w.prayerAt)) continue;
    if (now >= w.prayerAt && now < w.iqamaAt) {
      found = {
        prayer: w.prayer,
        prayerAt: w.prayerAt,
        iqamaAt: w.iqamaAt,
        focusEndAt: w.iqamaAt,
        durationMin: (w.iqamaAt - w.prayerAt) / 60_000,
      };
    }
  }
  return found;
}

/** "HH:MM:SS" remaining-time text (17 min left → "00:17:00"), clamped at zero. */
export function formatFocusCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 0..1 fraction of remaining focus time; span = iqamaAt − prayerAt. */
export function focusRemainingRatio(now: number, prayerAt: number, iqamaAt: number): number {
  const span = iqamaAt - prayerAt;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (iqamaAt - now) / span));
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
