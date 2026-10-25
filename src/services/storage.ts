import { parseDateKey } from '../logic/times';
import {
  validateCompletionsStore,
  validateCompleteDay,
  type CompletedMap,
  type CompletionsStore,
} from '../shared/completions';

export type { CompletedMap, CompletionsStore } from '../shared/completions';

const PREFIX = 'salati:done:';

function hasBridge(): boolean {
  return typeof window !== 'undefined' && !!window.salati;
}

function keyFor(dateKey: string): string {
  return PREFIX + dateKey;
}

function readLegacyMap(dateKey: string): CompletedMap {
  try {
    const raw = localStorage.getItem(keyFor(dateKey));
    if (!raw) return {};
    return validateCompleteDay(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeLegacyMap(dateKey: string, map: CompletedMap): void {
  try {
    localStorage.setItem(keyFor(dateKey), JSON.stringify(map));
    pruneLegacy();
  } catch {
    // best-effort
  }
}

/** Calendar-ordered prune of the legacy localStorage entries (keeps 60 days). */
function pruneLegacy(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
    keys.sort((a, b) => {
      const pa = parseDateKey(a);
      const pb = parseDateKey(b);
      if (!pa || !pb) return 0;
      return pb[0] * 10000 + pb[1] * 100 + pb[2] - (pa[0] * 10000 + pa[1] * 100 + pa[2]);
    });
    keys.slice(60).forEach((k) => localStorage.removeItem(keyFor(k)));
  } catch {
    // ignore
  }
}

let migrated = false;

/** One-time migration: import any pre-existing localStorage records into the
 *  main-process store, then remove the legacy keys. */
async function migrateLegacy(): Promise<void> {
  if (migrated || !hasBridge()) return;
  migrated = true;
  let legacy: CompletionsStore;
  try {
    legacy = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) {
        const day = readLegacyMap(k.slice(PREFIX.length));
        if (Object.keys(day).length > 0) legacy[k.slice(PREFIX.length)] = day;
      }
    }
  } catch {
    return;
  }
  if (Object.keys(legacy).length === 0) {
    // Nothing to migrate: still clean up legacy keys, then leave.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
      }
    } catch {
      // ignore
    }
    return;
  }
  try {
    const current = validateCompletionsStore(await window.salati.getCompleted());
    for (const [dateKey, day] of Object.entries(legacy)) {
      if (!current[dateKey]) current[dateKey] = day;
    }
    await window.salati.setCompletedAll(pruneCompletionsFor(current));
    for (const dateKey of Object.keys(legacy)) localStorage.removeItem(keyFor(dateKey));
  } catch {
    migrated = false; // retried on the next call
  }
}

function pruneCompletionsFor(store: CompletionsStore): CompletionsStore {
  return validateCompletionsStore(store);
}

/** All completion records known to the store (validated) plus today's entry. */
export async function loadCompleted(dateKey: string): Promise<CompletedMap> {
  if (!dateKey) return {};
  if (hasBridge()) {
    await migrateLegacy();
    const store = validateCompletionsStore(await window.salati.getCompleted());
    return store[dateKey] ?? readLegacyMap(dateKey);
  }
  return readLegacyMap(dateKey);
}

/** Persist one day's checklist (per-date records; other days are untouched). */
export async function saveCompleted(dateKey: string, map: CompletedMap): Promise<void> {
  if (!dateKey) return;
  const day = validateCompleteDay(map);
  if (hasBridge()) {
    try {
      await window.salati.setCompleted(dateKey, day);
      try {
        localStorage.removeItem(keyFor(dateKey));
      } catch {
        // ignore
      }
    } catch {
      writeLegacyMap(dateKey, day);
    }
    return;
  }
  writeLegacyMap(dateKey, day);
}
