import type { PrayerKey } from '../types/prayer';
import { PRAYER_ORDER } from '../types/prayer';

/** Completions for a single day: only boolean-true entries are stored. */
export type CompletedMap = Partial<Record<PrayerKey, boolean>>;

/** All tracked days, keyed "DD-MM-YYYY" (matches the Aladhan dateKey format). */
export type CompletionsStore = Record<string, CompletedMap>;

/** History retention: ~13 months of daily records, then oldest days are dropped. */
export const COMPLETIONS_MAX_DAYS = 400;

const DATE_KEY_RE = /^\d{2}-\d{2}-\d{4}$/;

/** Calendar check (rejects 31-02-2026): month/day must exist. */
export function isValidDateKey(dateKey: string): boolean {
  if (!DATE_KEY_RE.test(dateKey)) return false;
  const parsed = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateKey);
  if (!parsed) return false;
  const d = Number(parsed[1]);
  const m = Number(parsed[2]);
  const y = Number(parsed[3]);
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}

/** Keeps only known prayer keys set to exactly `true` (Sunrise is not trackable). */
export function validateCompleteDay(raw: unknown): CompletedMap {
  const out: CompletedMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const key of PRAYER_ORDER) {
    if (obj[key] === true) out[key] = true;
  }
  return out;
}

/** Chronological comparison for "DD-MM-YYYY" keys (a string sort would be wrong). */
export function compareDateKeysDesc(a: string, b: string): number {
  const pa = /^(\d{2})-(\d{2})-(\d{4})$/.exec(a);
  const pb = /^(\d{2})-(\d{2})-(\d{4})$/.exec(b);
  const va = pa ? Number(pa[3]) * 10000 + Number(pa[2]) * 100 + Number(pa[1]) : -1;
  const vb = pb ? Number(pb[3]) * 10000 + Number(pb[2]) * 100 + Number(pb[1]) : -1;
  return vb - va;
}

/** Drops the oldest days beyond retention (newest first, then slice). */
export function pruneCompletions(store: CompletionsStore, maxDays = COMPLETIONS_MAX_DAYS): CompletionsStore {
  const keys = Object.keys(store).sort(compareDateKeysDesc);
  if (keys.length <= maxDays) return store;
  const out: CompletionsStore = {};
  for (const k of keys.slice(0, maxDays)) out[k] = store[k]!;
  return out;
}

/** Validates and bounds an entire completions store coming from persistence. */
export function validateCompletionsStore(raw: unknown, maxDays = COMPLETIONS_MAX_DAYS): CompletionsStore {
  const out: CompletionsStore = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidDateKey(key)) continue;
    const day = validateCompleteDay(value);
    if (Object.keys(day).length > 0) out[key] = day;
  }
  return pruneCompletions(out, maxDays);
}
