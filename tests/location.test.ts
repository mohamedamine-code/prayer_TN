import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCATION,
  distanceKm,
  geohashId,
  isMeaningfulMove,
  validateLocationState,
} from '../src/shared/location';
import { parseReverseGeo } from '../src/services/geolocation';

describe('parseReverseGeo (Nominatim)', () => {
  it('extracts city + country from a Nominatim response', () => {
    const r = parseReverseGeo({
      address: { city: 'Sousse', state: 'Sousse', country: 'Tunisia' },
    });
    expect(r).toEqual({ city: 'Sousse', country: 'Tunisia' });
  });

  it('falls back through town/village/county levels', () => {
    expect(parseReverseGeo({ address: { town: 'Hammamet', country: 'Tunisia' } })).toEqual({
      city: 'Hammamet',
      country: 'Tunisia',
    });
    expect(parseReverseGeo({ address: { county: 'Kairouan', country: 'Tunisia' } })).toEqual({
      city: 'Kairouan',
      country: 'Tunisia',
    });
  });

  it('returns null for unusable responses (caller must show a fallback)', () => {
    expect(parseReverseGeo(null)).toBeNull();
    expect(parseReverseGeo({})).toBeNull();
    expect(parseReverseGeo({ address: {} })).toBeNull();
  });
});

describe('validateLocationState', () => {
  it('keeps junk input to the safe defaults', () => {
    const bad = validateLocationState({
      consent: 'yes-plz',
      lat: 'naboo',
      lon: Infinity,
      accuracyM: -5,
      updatedAt: -1,
      city: 42,
      country: 'a'.repeat(200),
    });
    expect(bad).toEqual(DEFAULT_LOCATION);
  });

  it('accepts and normalizes a valid fix', () => {
    const s = validateLocationState({
      consent: 'granted',
      lat: 35.825612345,
      lon: 10.608398765,
      accuracyM: 63.7,
      updatedAt: Date.now() - 1000,
      city: 'Sousse',
      country: 'Tunisia',
    });
    expect(s.consent).toBe('granted');
    expect(s.lat).toBeCloseTo(35.8256, 4);
    expect(s.lon).toBeCloseTo(10.6084, 4);
    expect(s.accuracyM).toBe(64);
    expect(s.city).toBe('Sousse');
    expect(s.country).toBe('Tunisia');
  });

  it('rejects out-of-range coordinates', () => {
    const s = validateLocationState({ consent: 'granted', lat: 95, lon: 10 });
    expect(s.lat).toBeNull();
    expect(s.lon).toBeNull();
  });

  it('rejects unpaired halves and forbids control characters', () => {
    const s = validateLocationState({ lat: 10, consent: 'granted' });
    expect(s.lat).toBeNull();
    expect(s.lon).toBeNull();
    const c = validateLocationState({ city: 'Sous\u0000se', consent: 'granted', lat: 1, lon: 1 });
    expect(c.city).toBe('Sousse'); // control characters are stripped, not stored
    const ar = validateLocationState({ city: 'تونس', country: 'تونس', consent: 'granted', lat: 1, lon: 1 });
    expect(ar.city).toBe('تونس');
  });

  it('never trusts chronology from the future', () => {
    const s = validateLocationState({ updatedAt: Date.now() + 600_000, consent: 'granted' });
    expect(s.updatedAt).toBeNull();
  });
});

describe('meaningful-move detection', () => {
  it('always accepts the first fix', () => {
    expect(isMeaningfulMove({ lat: null, lon: null }, 36.8, 10.1)).toBe(true);
  });

  it('ignores jitter under the threshold', () => {
    // ~1.1 km apart: less than the 3 km prayer-difference threshold.
    expect(isMeaningfulMove({ lat: 35.82, lon: 10.6 }, 35.8256, 10.6084)).toBe(false);
  });

  it('accepts real city-scale moves', () => {
    // Sousse -> Tunis (~120 km).
    expect(isMeaningfulMove({ lat: 35.8256, lon: 10.6084 }, 36.8188, 10.1658)).toBe(true);
  });
});

describe('distanceKm', () => {
  it('matches known city distances', () => {
    const Tunis = { lat: 36.8188, lon: 10.1658 };
    const Sousse = { lat: 35.8256, lon: 10.6084 };
    const d = distanceKm(Tunis.lat, Tunis.lon, Sousse.lat, Sousse.lon);
    expect(d).toBeGreaterThan(115);
    expect(d).toBeLessThan(125);
  });
});

describe('geohashId', () => {
  it('is coordinate-stable on a ~1.1 km grid', () => {
    expect(geohashId(35.82561, 10.6084)).toBe('geo:35.83_10.61');
    expect(geohashId(35.82, 10.6)).toBe('geo:35.82_10.60');
    expect(geohashId(35.82561, 10.6084)).toBe(geohashId(35.82562, 10.6083));
    expect(geohashId(36.01, 10.0)).not.toBe(geohashId(36.0, 10.0));
  });
});
