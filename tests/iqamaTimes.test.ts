import { describe, expect, it } from 'vitest';
import type { IqamaDelays } from '../src/types/prayer';
import {
  addMinutesToHHMM,
  hasAnyIqamaDelay,
  isIqamaConfigured,
  resolveManualIqama,
} from '../src/services/iqamaTimes';
import { IQAMA_DELAY_MAX, validateIqamaDelay, validateSettings } from '../src/shared/settings';

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

  it('leaves prayers without a configured delay out entirely (nothing invented)', () => {
    const delays: IqamaDelays = { Dhuhr: 10 };
    const out = resolveManualIqama(timings, delays);
    expect(out.Dhuhr).toBe('12:15');
    expect(out.Fajr).toBeUndefined();
    expect(out.Isha).toBeUndefined();
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

describe('config flags', () => {
  it('isIqamaConfigured reflects per-prayer configuration', () => {
    const delays: IqamaDelays = { Fajr: 0, Dhuhr: null };
    expect(isIqamaConfigured(delays, 'Fajr')).toBe(true);
    expect(isIqamaConfigured(delays, 'Dhuhr')).toBe(false);
    // 0 is a valid configured value (Iqama at the adhan time).
    const out = resolveManualIqama({ Fajr: '04:55' }, { Fajr: 0 });
    expect(out.Fajr).toBe('04:55');
  });

  it('hasAnyIqamaDelay is true as soon as one prayer is configured', () => {
    expect(hasAnyIqamaDelay({})).toBe(false);
    expect(hasAnyIqamaDelay({ Asr: 5 })).toBe(true);
    expect(hasAnyIqamaDelay({ Asr: null })).toBe(false);
  });
});

describe('settings validation', () => {
  it('clamps delays to a sensible range and coerces junk to null', () => {
    expect(validateIqamaDelay(10)).toBe(10);
    expect(validateIqamaDelay(0)).toBe(0);
    expect(validateIqamaDelay(-5)).toBeNull();
    expect(validateIqamaDelay(500)).toBeNull();
    expect(validateIqamaDelay(IQAMA_DELAY_MAX)).toBe(IQAMA_DELAY_MAX);
    expect(validateIqamaDelay('18')).toBe(18);
    expect(validateIqamaDelay('abc')).toBeNull();
  });

  it('rounds fractional minutes', () => {
    expect(validateIqamaDelay(5.4)).toBe(5);
  });

  it('defaults to medium font size and no explicit iqama delays', () => {
    const s = validateSettings({});
    expect(s.fontSize).toBe('medium');
    expect(s.iqamaDelays.Fajr).toBeNull();
    expect(s.iqamaDelays.Isha).toBeNull();
  });

  it('keeps valid delays through settings:merge validation', () => {
    const s = validateSettings({ iqamaDelays: { Fajr: 5, Dhuhr: 10, Asr: '5', Maghrib: 999, Isha: null } });
    expect(s.iqamaDelays).toEqual({ Fajr: 5, Dhuhr: 10, Asr: 5, Maghrib: null, Isha: null });
  });

  it('drops unknown keys from iqamaDelays', () => {
    const s = validateSettings({ iqamaDelays: { Sunrise: 3, Isha: 15 } });
    expect('Sunrise' in s.iqamaDelays).toBe(false);
    expect(s.iqamaDelays.Isha).toBe(15);
  });
});
