import { Notification } from 'electron';

/**
 * Deduplication design:
 * - The renderer ticks every second and asks the main process to show a
 *   notification when a prayer event point is crossed.
 * - Events are identified by a deterministic key:
 *     "city|dateKey|prayer|offset|eventTimeMs"
 * - Both a renderer restart and a full app restart must not redisplay the
 *   same notification: an in-memory Set plus a small persisted history of
 *   recently fired keys handle that.
 * - A grace window means notifications fired long before the app even opened
 *   (e.g. PC was off) are never replayed.
 */

const HISTORY_SIZE = 30;
const GRACE_MS = 90_000;

let recentKeys = new Set<string>();
let store: { set: (key: unknown, value?: unknown) => void; get: (key: unknown, def?: unknown) => unknown } | null =
  null;

export function initNotificationDedup(s: {
  get: (key: unknown, def?: unknown) => unknown;
  set: (key: unknown, value?: unknown) => void;
}): void {
  store = s;
  const saved = s.get('notifiedKeys', []);
  if (Array.isArray(saved)) {
    recentKeys = new Set(
      saved.filter((x): x is string => typeof x === 'string').slice(-HISTORY_SIZE),
    );
  }
}

export function clearNotificationHistory(): void {
  recentKeys = new Set();
  if (store) store.set('notifiedKeys', []);
}

/** Internal: notifications are "at most ~90 s late" allowed, never stale. */
function shouldFire(key: string, eventTimeMs: number, now: number): boolean {
  return !recentKeys.has(key) && now - eventTimeMs <= GRACE_MS;
}

function markFired(key: string): void {
  recentKeys.add(key);
  if (store) store.set('notifiedKeys', [...recentKeys].slice(-HISTORY_SIZE));
}

/** Event key: "city|dateKey|prayer|offset|eventTimeMs". eventTimeMs lets the
 *  main process decide whether this event is still within the grace window. */
export function decodeEventTimeMs(key: string): number {
  const t = Number(key.split('|').pop());
  return Number.isFinite(t) ? t : 0;
}

let onClickShowWidget: (() => void) | null = null;

/** Wire the notification "click" action (opens the widget). */
export function setNotificationClickHandler(fn: () => void): void {
  onClickShowWidget = fn;
}

export function showPrayerNotification(key: string, title: string, body: string): boolean {
  if (!Notification.isSupported()) return false;
  if (key.length > 200 || title.length > 120 || body.length > 250) return false;
  if (!shouldFire(key, decodeEventTimeMs(key), Date.now())) return false;

  const notification = new Notification({
    title,
    body,
    silent: true,
  });

  notification.on('click', () => {
    onClickShowWidget?.();
  });

  notification.show();
  markFired(key);
  return true;
}
