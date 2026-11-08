/**
 * Location feature — shared state shape + validation.
 *
 * Persisted in the main-process electron-store under the `location` key and
 * mirrored into every renderer via `location:changed` broadcasts.
 *
 * Privacy rules enforced here:
 *  - coordinates are rounded to 4 decimals (~10 m) — nothing finer is stored,
 *  - city/country are short, free-of-control-character display strings,
 *  - no consent = no coordinates are ever written (the renderer never pushes
 *    a fix before the user allowed location access).
 */

export type LocationConsent = 'unset' | 'granted' | 'declined';

export interface StoredLocation {
  consent: LocationConsent;
  /** WGS84 latitude (4 decimals) or null when not yet obtained/cleared. */
  lat: number | null;
  /** WGS84 longitude (4 decimals) or null. */
  lon: number | null;
  /** Position accuracy in meters, as reported by the geolocation API. */
  accuracyM: number | null;
  /** Epoch ms of the last accepted fix. */
  updatedAt: number | null;
  /** Reverse-geocoded display city (e.g. "Sousse"), null when unknown. */
  city: string | null;
  /** Reverse-geocoded country (e.g. "Tunisia"), null when unknown. */
  country: string | null;
}

export const LOCATION_STORE_KEY = 'location';

export const DEFAULT_LOCATION: StoredLocation = {
  consent: 'unset',
  lat: null,
  lon: null,
  accuracyM: null,
  updatedAt: null,
  city: null,
  country: null,
};

const CONSENTS: ReadonlySet<LocationConsent> = new Set(['unset', 'granted', 'declined']);

const DISPLAY_STRING = /^[\p{L}\p{M}\p{N}]([.'’\-\s\p{L}\p{M}\p{N}]){0,59}$/u;

function roundCoord(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function displayText(input: unknown, max = 60): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!trimmed || trimmed.length > max || !DISPLAY_STRING.test(trimmed)) return null;
  return trimmed;
}

/** Merge arbitrary persisted/IPC input into a fully validated StoredLocation. */
export function validateLocationState(input: unknown): StoredLocation {
  const src = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

  const consent = CONSENTS.has(src.consent as LocationConsent)
    ? (src.consent as LocationConsent)
    : 'unset';

  const latIn = typeof src.lat === 'number' ? src.lat : NaN;
  const lonIn = typeof src.lon === 'number' ? src.lon : NaN;
  const lat = Number.isFinite(latIn) && latIn >= -90 && latIn <= 90 ? roundCoord(latIn) : null;
  const lon = Number.isFinite(lonIn) && lonIn >= -180 && lonIn <= 180 ? roundCoord(lonIn) : null;

  const accIn = typeof src.accuracyM === 'number' ? src.accuracyM : NaN;
  const accuracyM = Number.isFinite(accIn) && accIn >= 0 && accIn <= 100_000 ? Math.round(accIn) : null;

  const tsIn = typeof src.updatedAt === 'number' ? src.updatedAt : NaN;
  const updatedAt =
    Number.isFinite(tsIn) && tsIn > 0 && tsIn <= Date.now() + 60_000 ? Math.round(tsIn) : null;

  // Coordinates for one hemisphere only: never store a mismatched pair.
  const paired = (lat === null) === (lon === null);

  return {
    consent,
    lat: paired ? lat : null,
    lon: paired ? lon : null,
    accuracyM: accuracyM,
    updatedAt: paired ? updatedAt : null,
    city: displayText(src.city),
    country: displayText(src.country),
  };
}

/** Great-circle distance in km (haversine), rounded to sane precision. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/** A fix is "meaningfully new" when it moved far enough to change prayer minutes. */
export const MEANINGFUL_MOVE_KM = 3;

export function isMeaningfulMove(
  prev: { lat: number | null; lon: number | null },
  lat: number,
  lon: number,
): boolean {
  if (prev.lat === null || prev.lon === null) return true;
  return distanceKm(prev.lat, prev.lon, lat, lon) >= MEANINGFUL_MOVE_KM;
}

/** Stable cache/storage id for coordinates (~1.1 km grid). */
export function geohashId(lat: number, lon: number): string {
  return `geo:${lat.toFixed(2)}_${lon.toFixed(2)}`;
}
