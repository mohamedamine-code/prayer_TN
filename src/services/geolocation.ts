import type { City, Language } from '../types/prayer';
import type { StoredLocation } from '../shared/location';
import { geohashId } from '../shared/location';
import { getCity } from '../data/tunisianCities';

/**
 * Geolocation options tuned for a Windows laptop: network accuracy
 * (Wi-Fi/IP) is enough for prayer times, cheap on battery, and results may
 * be reused for up to 10 minutes.
 */
export const GEO_POSITION_OPTS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: 600_000,
};

const FALLBACK_FIX_MAX_AGE_MS = 12 * 60 * 60 * 1000; // stale fixes are ignored

/** Is the stored fix usable as the current position source? */
export function hasUsableFix(loc: StoredLocation | null): loc is StoredLocation & {
  lat: number;
  lon: number;
} {
  if (!loc || loc.lat === null || loc.lon === null) return false;
  if (loc.updatedAt === null || Date.now() - loc.updatedAt > FALLBACK_FIX_MAX_AGE_MS) return false;
  return Number.isFinite(loc.lat) && Number.isFinite(loc.lon);
}

/** Compute the human-readable place label for a geo fix. */
export function placeLabel(loc: StoredLocation, lang: Language): string | null {
  const city = loc.city;
  const country = loc.country;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  switch (lang) {
    case 'ar':
      return 'الموقع الحالي';
    case 'en':
      return 'Current location';
    default:
      return 'Position actuelle';
  }
}

/**
 * City used for prayer calculations. When automatic location is active the
 * real coordinates are used (never the city-centre approximation); otherwise
 * the manually selected city applies untouched.
 */
export function resolveActiveCity(settings: { cityId: string }, loc: StoredLocation | null): City {
  if (loc?.consent === 'granted' && hasUsableFix(loc)) {
    const id = geohashId(loc.lat, loc.lon);
    const lat = loc.lat;
    const lon = loc.lon;
    return { id, lat, lon, nameFr: id, nameAr: id, nameEn: id };
  }
  return getCity(settings.cityId);
}

/* ------------------------------ reverse geocoding ------------------------------ */

const REVERSE_GEO_BASE = 'https://nominatim.openstreetmap.org/reverse';
const REVERSE_GEO_TIMEOUT_MS = 10_000;
const GEO_CACHE_PREFIX = 'salati:geocity:';

export interface ReverseGeoResult {
  city: string;
  country: string;
}

/** Parse a Nominatim reverse-geocoding response into a display label. */
export function parseReverseGeo(body: unknown): ReverseGeoResult | null {
  const data = (body as { address?: Record<string, unknown> } | null)?.address;
  if (typeof data !== 'object' || data === null) return null;
  const city =
    [data.city, data.town, data.municipality, data.village, data.county, data.state_district].find(
      (v): v is string => typeof v === 'string' && v.length > 0,
    ) ?? null;
  const country = typeof data.country === 'string' && data.country ? data.country : null;
  if (!city && !country) return null;
  return { city: city ?? '', country: country ?? '' };
}

export function reverseGeoUrl(lat: number, lon: number, lang: Language): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '10',
    addressdetails: '1',
    'accept-language': lang,
    email: 'salati@example.com',
  });
  return `${REVERSE_GEO_BASE}?${params.toString()}`;
}

function readGeoCache(lat: number, lon: number, lang: Language): ReverseGeoResult | null {
  try {
    const key = GEO_CACHE_PREFIX + `${lat.toFixed(2)},${lon.toFixed(2)}:${lang}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; city?: string; country?: string };
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > 30 * 86_400_000) return null;
    if (typeof parsed.city !== 'string' || typeof parsed.country !== 'string') return null;
    return { city: parsed.city, country: parsed.country };
  } catch {
    return null;
  }
}

function writeGeoCache(lat: number, lon: number, lang: Language, result: ReverseGeoResult): void {
  try {
    const key = GEO_CACHE_PREFIX + `${lat.toFixed(2)},${lon.toFixed(2)}:${lang}`;
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), ...result }));
  } catch {
    // best-effort caching only
  }
}

/**
 * Reverse geocode coordinates into a readable "City, Country" label with the
 * documented OpenStreetMap Nominatim API. Returns null on any failure —
 * the caller must fall back to a generic label, never an invented city name.
 */
export async function reverseGeocode(lat: number, lon: number, lang: Language): Promise<ReverseGeoResult | null> {
  const cached = readGeoCache(lat, lon, lang);
  if (cached) return cached;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REVERSE_GEO_TIMEOUT_MS);
  try {
    const res = await fetch(reverseGeoUrl(lat, lon, lang), { signal: ctrl.signal });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const parsed = parseReverseGeo(body);
    if (parsed) writeGeoCache(lat, lon, lang, parsed);
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
