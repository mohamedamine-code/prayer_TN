import { describe, expect, it } from 'vitest';
import type { IqamaDelays } from '../src/types/prayer';
import {
  addMinutesToHHMM,
  hasAnyIqamaDelay,
  isIqamaConfigured,
  resolveIqamaTimestamps,
  resolveManualIqama,
} from '../src/services/iqamaTimes';
import {
  IQAMA_DELAY_MAX,
  IQAMA_DELAY_MIN,
  parseIqamaDelayInput,
  validateFocusDuration,
  validateIqamaDelay,
  validateIqamaDelays,
  validateSettings,
} from '../src/shared/settings';
import { wallClockToMs } from '../src/logic/times';

describe('addMinutesToHHMM', () => {
  it('adds minutes within the hour', () => {
    expect(addMinutesToHHMM('12:05', 10)).toBe('12:15');
    expect(addMinutesToHHMM('04:59', 1)).toBe('05:00');
  });

  it('rolls over the hour and past midnight', () => {
    expect(addMinutesToHHMM('12:55', 10)).toBe('13:05');
    expect(addMinutesToHHMM('23:55', 10)).toBe('00:05');
    expect(addMinutesToHHMM('23:00', 120)).toBe('01:00');
  });

  it('returns null for malformed input', () => {
    expect(addMinutesToHHMM('bad', 5)).toBeNull();
    expect(addMinutesToHHMM('', 5)).toBeNull();
  });
});

describe('resolveManualIqama', () => {
  const timings = {
    Fajr: '04:55',
    Dhuhr: '12:05',
    Asr: '15:30',
    Maghrib: '19:10',
    Isha: '20:45',
  };

  it('computes Iqama = prayer time + configured delay, independently per prayer', () => {
    const delays: IqamaDelays = { Fajr: 5, Dhuhr: 10, Asr: 5, Maghrib: 5, Isha: 15 };
    const out = resolveManualIqama(timings, delays);
    expect(out.Fajr).toBe('05:00');
    expect(out.Dhuhr).toBe('12:15');
    expect(out.Asr).toBe('15:35');
    expect(out.Maghrib).toBe('19:15');
    expect(out.Isha).toBe('21:00');
  });

  it('enforces the 5-minute minimum even when passed a raw low value', () => {
    const out = resolveManualIqama(timings, { ...delaysWithZero() });
    expect(out.Fajr).toBe('05:00'); // 0 → migrated to 5 (04:55 + 5)
    expect(out.Dhuhr).toBe('12:10'); // 3 → migrated to 5 (12:05 + 5)
  });

  it('returns an empty map with no configured delay at all', () => {
    expect(resolveManualIqama(timings, {})).toEqual({});
    expect(resolveManualIqama(timings, { Fajr: null, Isha: null })).toEqual({});
  });

  it('returns an empty map without timings', () => {
    expect(resolveManualIqama(undefined, { Dhuhr: 10 })).toEqual({});
  });

  it('handles the midnight transition (Isha 23:58 + 5)', () => {
    const out = resolveManualIqama({ Isha: '23:58' }, { Isha: 5 });
    expect(out.Isha).toBe('00:03');
  });
});

function delaysWithZero(): IqamaDelays {
  return { Fajr: 0, Dhuhr: 3 };
}

describe('config flags', () => {
  it('isIqamaConfigured reflects per-prayer configuration', () => {
    const delays: IqamaDelays = { Fajr: 5, Dhuhr: null };
    expect(isIqamaConfigured(delays, 'Fajr')).toBe(true);
    expect(isIqamaConfigured(delays, 'Dhuhr')).toBe(false);
    // Any configured value is clamped to the 5-minute minimum.
    const out = resolveManualIqama({ Fajr: '04:55' }, { Fajr: 1 });
    expect(out.Fajr).toBe('05:00');
  });

  it('hasAnyIqamaDelay is true as soon as one prayer is configured', () => {
    expect(hasAnyIqamaDelay({})).toBe(false);
    expect(hasAnyIqamaDelay({ Asr: 5 })).toBe(true);
    expect(hasAnyIqamaDelay({ Asr: null })).toBe(false);
  });
});

describe('resolveIqamaTimestamps (absolute epoch ms)', () => {
  const DATE = '08-11-2026';

  it('equals prayer timestamp + delay', () => {
    const at = wallClockToMs(DATE, 12, 3);
    const out = resolveIqamaTimestamps(DATE, { Dhuhr: '12:03' }, { Dhuhr: 10 } as IqamaDelays);
    expect(out.Dhuhr).toBe(at + 10 * 60_000);
  });

  it('remains correct across midnight (Isha 23:58 + 5 → next day 00:03)', () => {
    const out = resolveIqamaTimestamps(DATE, { Isha: '23:58' }, { Isha: 5 });
    expect(out.Isha).toBe(wallClockToMs(DATE, 23, 58) + 5 * 60_000);
    // And the displayed rolled-over clock matches addMinutesToHHMM.
    expect(addMinutesToHHMM('23:58', 5)).toBe('00:03');
  });
});

describe('settings validation', () => {
  it('enforces the 5-minute minimum; invalid junk migrates to 5', () => {
    expect(validateIqamaDelay(10)).toBe(10);
    expect(validateIqamaDelay(IQAMA_DELAY_MAX)).toBe(IQAMA_DELAY_MAX);
    expect(validateIqamaDelay('18')).toBe(18);
    expect(validateIqamaDelay(0)).toBe(IQAMA_DELAY_MIN);
    expect(validateIqamaDelay(-5)).toBe(IQAMA_DELAY_MIN);
    expect(validateIqamaDelay(4)).toBe(IQAMA_DELAY_MIN);
    expect(validateIqamaDelay(500)).toBe(IQAMA_DELAY_MAX);
    expect(validateIqamaDelay('abc')).toBe(IQAMA_DELAY_MIN);
    expect(validateIqamaDelay(null)).toBe(IQAMA_DELAY_MIN);
    expect(validateIqamaDelay(NaN)).toBe(IQAMA_DELAY_MIN);
  });

  it('rounds fractional minutes to whole minutes', () => {
    expect(validateIqamaDelay(5.4)).toBe(5);
    expect(validateIqamaDelay(9.6)).toBe(10);
  });

  it('defaults to 5-minute delays on fresh installations', () => {
    const s = validateSettings({});
    expect(s.fontSize).toBe('medium');
    expect(s.iqamaDelays).toEqual({ Fajr: 5, Dhuhr: 5, Asr: 5, Maghrib: 5, Isha: 5 });
    expect(s.iqamaFocusEnabled).toBe(true);
    expect(s.focusDurationMinutes).toBe(15);
  });

  it('preserves existing valid delays and migrates sub-5 values to 5', () => {
    const s = validateSettings({
      iqamaDelays: { Fajr: 8, Dhuhr: 3, Asr: '5', Maghrib: 999, Isha: null },
    });
    expect(s.iqamaDelays).toEqual({ Fajr: 8, Dhuhr: 5, Asr: 5, Maghrib: 120, Isha: 5 });
  });

  it('drops unknown keys from iqamaDelays', () => {
    const s = validateSettings({ iqamaDelays: { Sunrise: 3, Isha: 15 } });
    expect('Sunrise' in s.iqamaDelays).toBe(false);
    expect(s.iqamaDelays.Isha).toBe(15);
  });

  it('validateIqamaDelays migrates a pre-5.0 store of nulls to 5', () => {
    expect(validateIqamaDelays({})).toEqual({ Fajr: 5, Dhuhr: 5, Asr: 5, Maghrib: 5, Isha: 5 });
  });
});

describe('parseIqamaDelayInput (settings UI layer)', () => {
  it('accepts whole minutes within range', () => {
    expect(parseIqamaDelayInput('5')).toEqual({ ok: true, value: 5 });
    expect(parseIqamaDelayInput('10')).toEqual({ ok: true, value: 10 });
    expect(parseIqamaDelayInput('30')).toEqual({ ok: true, value: 30 });
    expect(parseIqamaDelayInput('120')).toEqual({ ok: true, value: 120 });
  });

  it('rejects below-minimum, decimal and malformed values', () => {
    expect(parseIqamaDelayInput('0').ok).toBe(false);
    expect(parseIqamaDelayInput('4').ok).toBe(false);
    expect(parseIqamaDelayInput('-3').ok).toBe(false);
    expect(parseIqamaDelayInput('5.5').ok).toBe(false);
    expect(parseIqamaDelayInput('15min').ok).toBe(false);
    expect(parseIqamaDelayInput('abc').ok).toBe(false);
    expect(parseIqamaDelayInput('').ok).toBe(false);
    expect(parseIqamaDelayInput('121').ok).toBe(false);
  });
});

describe('focus duration validation', () => {
  it('accepts only the configured options', () => {
    expect(validateFocusDuration(5)).toBe(5);
    expect(validateFocusDuration(10)).toBe(10);
    expect(validateFocusDuration(20)).toBe(20);
  });

  it('falls back to the 15-minute default otherwise', () => {
    expect(validateFocusDuration(undefined)).toBe(15);
    expect(validateFocusDuration(7)).toBe(15);
    expect(validateFocusDuration('20')).toBe(15);
  });

  it('survives full settings validation', () => {
    const s = validateSettings({ focusDurationMinutes: 20, iqamaFocusEnabled: false });
    expect(s.focusDurationMinutes).toBe(20);
    expect(s.iqamaFocusEnabled).toBe(false);
  });
});
