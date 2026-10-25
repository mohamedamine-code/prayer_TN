import { describe, expect, it } from 'vitest';
import {
  compareDateKeysDesc,
  isValidDateKey,
  pruneCompletions,
  validateCompleteDay,
  validateCompletionsStore,
} from '../src/shared/completions';

describe('isValidDateKey', () => {
  it('accepts real calendar dates in DD-MM-YYYY form', () => {
    expect(isValidDateKey('24-10-2026')).toBe(true);
    expect(isValidDateKey('29-02-2024')).toBe(true); // leap year
  });

  it('rejects impossible dates and malformed keys', () => {
    expect(isValidDateKey('31-02-2026')).toBe(false);
    expect(isValidDateKey('29-02-2025')).toBe(false); // not a leap year
    expect(isValidDateKey('01-13-2026')).toBe(false);
    expect(isValidDateKey('00-05-2026')).toBe(false);
    expect(isValidDateKey('1-1-2026')).toBe(false);
    expect(isValidDateKey('2026-10-24')).toBe(false);
    expect(isValidDateKey('garbage')).toBe(false);
  });
});

describe('validateCompleteDay', () => {
  it('keeps only known prayers set to true', () => {
    const day = validateCompleteDay({ Fajr: true, Dhuhr: false, Maghrib: 1, Isha: true });
    expect(day).toEqual({ Fajr: true, Isha: true });
  });

  it('never stores Sunrise or unknown keys', () => {
    const day = validateCompleteDay({ Sunrise: true, Tahajjud: true, Fajr: true } as Record<string, unknown>);
    expect(day).toEqual({ Fajr: true });
  });

  it('returns an empty map for garbage input', () => {
    expect(validateCompleteDay(null)).toEqual({});
    expect(validateCompleteDay('nope')).toEqual({});
    expect(validateCompleteDay([true])).toEqual({});
  });
});

describe('validateCompletionsStore', () => {
  it('drops invalid days and keeps per-date records intact', () => {
    const store = validateCompletionsStore({
      '24-10-2026': { Fajr: true, Isha: true },
      '31-02-2026': { Fajr: true }, // impossible date
      junk: { Dhuhr: true },
    });
    expect(Object.keys(store)).toEqual(['24-10-2026']);
    expect(store['24-10-2026']).toEqual({ Fajr: true, Isha: true });
  });

  it('accepts a fresh empty store', () => {
    expect(validateCompletionsStore(undefined)).toEqual({});
    expect(validateCompletionsStore({})).toEqual({});
  });

  it('keeps previous days when a new day is added (date-change behaviour)', () => {
    const day1 = validateCompletionsStore({ '24-10-2026': { Fajr: true } });
    const withDay2 = validateCompletionsStore({ ...day1, '25-10-2026': { Maghrib: true } });
    expect(Object.keys(withDay2).sort()).toEqual(['24-10-2026', '25-10-2026']);
  });

  it('prunes by real date order, not lexicographic (month boundary)', () => {
    const pruned = pruneCompletions(
      {
        '31-12-2025': { Fajr: true },
        '01-01-2026': { Dhuhr: true },
        '02-01-2026': { Asr: true },
      },
      2,
    );
    expect(Object.keys(pruned).sort()).toEqual(['01-01-2026', '02-01-2026']);
    expect(Object.keys(pruned)).not.toContain('31-12-2025');
  });

  it('caps history to the retention limit, keeping the newest days', () => {
    const big: Record<string, { Fajr: boolean }> = {};
    for (let i = 1; i <= 405; i++) {
      big[`24-10-${String(2026 - Math.floor(i / 365)).padStart(4, '0')}`] = { Fajr: true };
    }
    // Same dateKey repeated -> collapse test would weaken; build distinct keys instead.
    const distinct: Record<string, { Fajr: boolean }> = {};
    const start = new Date(Date.UTC(2026, 9, 24));
    for (let i = 0; i < 405; i++) {
      const d = new Date(start.getTime() - i * 86_400_000);
      const key = `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${d.getUTCFullYear()}`;
      distinct[key] = { Fajr: true };
    }
    const pruned = validateCompletionsStore(distinct);
    expect(Object.keys(pruned).length).toBe(400);
    // Newest day must survive.
    expect(pruned['24-10-2026']).toEqual({ Fajr: true });
    expect(big).toBeTruthy(); // keep the variable used
  });
});

describe('compareDateKeysDesc', () => {
  it('sorts newest first', () => {
    const keys = ['02-01-2026', '31-12-2025', '24-10-2026'];
    expect([...keys].sort(compareDateKeysDesc)).toEqual(['24-10-2026', '02-01-2026', '31-12-2025']);
  });
});
