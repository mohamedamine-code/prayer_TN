import type {
  ApiError,
  AsrMadhab,
  City,
  DayPrayerTimes,
  TimingRow,
} from '../types/prayer';

const API_BASE = 'https://api.aladhan.com/v1';
const FETCH_TIMEOUT_MS = 12_000;
const MONTH_CACHE_PREFIX = 'salati:month:';
const DAY_CACHE_PREFIX = 'salati:day:';

export interface MonthCache {
  cityId: string;
  method: number;
  school: number;
  year: number;
  month: number;
  fetchedAt: number;
  days: Record<string, DayPrayerTimes>; // key: "DD-MM-YYYY"
}

function asTimingRow(t: unknown): TimingRow | null {
  if (typeof t !== 'object' || t === null) return null;
  const row = t as Record<string, unknown>;
  const pick = (k: string): string | null => {
    const v = row[k];
    if (typeof v !== 'string') return null;
    const cleaned = v.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return /^(\d{1,2}):(\d{2})$/.test(cleaned) ? cleaned : null;
  };
  const Fajr = pick('Fajr');
  const Dhuhr = pick('Dhuhr');
  const Asr = pick('Asr');
  const Maghrib = pick('Maghrib');
  const Isha = pick('Isha');
  if (!Fajr || !Dhuhr || !Asr || !Maghrib || !Isha) return null;
  return { Fajr, Sunrise: pick('Sunrise') ?? undefined, Dhuhr, Asr, Maghrib, Isha };
}

function asHijri(h: unknown) {
  if (typeof h !== 'object' || h === null) return null;
  const o = h as Record<string, unknown>;
  const day = o.day;
  const year = o.year;
  const month = (typeof o.month === 'object' && o.month !== null ? o.month : {}) as Record<
    string,
    unknown
  >;
  if (typeof day !== 'string' || typeof year !== 'string') return null;
  if (typeof month.number !== 'number' || typeof month.en !== 'string' || typeof month.ar !== 'string')
    return null;
  return {
    day,
    monthNumber: month.number,
    monthEn: month.en,
    monthAr: month.ar,
    year,
  };
}

function apiError(kind: ApiError['kind'], message: string): ApiError {
  return { kind, message };
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } catch (e) {
      if (ctrl.signal.aborted) throw apiError('timeout', 'Request timed out');
      throw apiError('network', `Network error: ${String(e)}`);
    }
    if (!res.ok) {
      throw apiError('invalid', `HTTP ${res.status} for ${url}`);
    }
    try {
      return await res.json();
    } catch {
      throw apiError('parse', 'Response was not valid JSON');
    }
  } finally {
    clearTimeout(timer);
  }
}

export function schoolFromMadhab(madhab: AsrMadhab): 0 | 1 {
  return madhab === 'hanafi' ? 1 : 0;
}

export function monthUrl(city: City, method: number, school: 0 | 1, y: number, m: number): string {
  return `${API_BASE}/calendar?latitude=${city.lat}&longitude=${city.lon}&method=${method}&school=${school}&month=${m}&year=${y}`;
}

export function dayUrl(city: City, method: number, school: 0 | 1, dateKey: string): string {
  const [d, mo, y] =
    /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateKey)?.slice(1) ?? ['1', '1', '2026'];
  return `${API_BASE}/timings/${d}-${mo}-${y}?latitude=${city.lat}&longitude=${city.lon}&method=${method}&school=${school}`;
}

function parseMonthResponse(body: unknown, cache: MonthCache): MonthCache {
  const root = (body as { data?: unknown })?.data;
  if (!Array.isArray(root) || root.length === 0) {
    throw apiError('parse', 'Unexpected calendar response');
  }
  for (const item of root) {
    const it = item as {
      timings?: unknown;
      date?: {
        gregorian?: { date?: string };
        hijri?: unknown;
      };
    };
    const dateKey = it.date?.gregorian?.date;
    const timings = asTimingRow(it.timings);
    const hijri = asHijri(it.date?.hijri);
    if (!dateKey || !timings || !hijri) {
      throw apiError('parse', 'Malformed calendar day entry');
    }
    cache.days[dateKey] = { dateKey, timings, hijri };
  }
  return cache;
}

function parseDayResponse(body: unknown, dateKey: string): DayPrayerTimes {
  const data = (body as { data?: unknown })?.data as
    | { timings?: unknown; date?: { hijri?: unknown } }
    | undefined;
  const timings = data ? asTimingRow(data.timings) : null;
  const hijri = data ? asHijri(data.date?.hijri) : null;
  if (!timings || !hijri) throw apiError('parse', 'Malformed timings response');
  return { dateKey, timings, hijri };
}

function readMonthCache(cityId: string, method: number, school: 0 | 1, y: number, m: number): MonthCache | null {
  try {
    const key = MONTH_CACHE_PREFIX + `${cityId}:${method}:${school}:${y}-${String(m).padStart(2, '0')}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MonthCache;
    if (
      parsed.cityId !== cityId ||
      parsed.method !== method ||
      parsed.school !== school ||
      parsed.year !== y ||
      parsed.month !== m ||
      typeof parsed.days !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeMonthCache(cache: MonthCache): void {
  try {
    const key =
      MONTH_CACHE_PREFIX +
      `${cache.cityId}:${cache.method}:${cache.school}:${cache.year}-${String(cache.month).padStart(2, '0')}`;
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // Storage full/unavailable: caching is best-effort.
  }
}

function readDayCache(cityId: string, method: number, school: 0 | 1, dateKey: string): DayPrayerTimes | null {
  try {
    const key = DAY_CACHE_PREFIX + `${cityId}:${method}:${school}:${dateKey}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cityId?: string; method?: number; school?: number; day?: DayPrayerTimes };
    if (
      parsed.cityId !== cityId ||
      parsed.method !== method ||
      parsed.school !== school ||
      !parsed.day ||
      parsed.day.dateKey !== dateKey
    ) {
      return null;
    }
    return parsed.day;
  } catch {
    return null;
  }
}

function writeDayCache(cityId: string, method: number, school: 0 | 1, day: DayPrayerTimes): void {
  try {
    const key = DAY_CACHE_PREFIX + `${cityId}:${method}:${school}:${day.dateKey}`;
    localStorage.setItem(key, JSON.stringify({ cityId, method, school, day }));
  } catch {
    // best-effort
  }
}

export interface GetDayResult {
  day: DayPrayerTimes | null;
  fromCache: boolean;
  error: ApiError | null;
}

/**
 * Fetch prayer times for one dateKey (DD-MM-YYYY, city timezone).
 * Cache-first: persisted month cache -> persisted day cache -> network
 * (full-month fetch when a month cache exists, otherwise single-day fetch).
 * With `force` the network is always contacted; on failure the cache is used.
 */
export async function getDay(
  city: City,
  method: number,
  madhab: AsrMadhab,
  dateKey: string,
  force = false,
): Promise<GetDayResult> {
  const school = schoolFromMadhab(madhab);
  let [d, mo, y]: [number, number, number] = [NaN, NaN, NaN];
  const parts = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateKey);
  if (!parts) return { day: null, fromCache: false, error: apiError('invalid', 'Bad dateKey') };
  d = Number(parts[1]);
  mo = Number(parts[2]);
  y = Number(parts[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) {
    return { day: null, fromCache: false, error: apiError('invalid', 'Date out of range') };
  }

  const monthCache = readMonthCache(city.id, method, school, y, mo);
  const cachedDay = monthCache?.days[dateKey] ?? readDayCache(city.id, method, school, dateKey);

  if (!force && cachedDay && 'dateKey' in cachedDay) {
    return { day: cachedDay, fromCache: true, error: null };
  }

  try {
    let fresh: DayPrayerTimes;
    if (monthCache) {
      const body = await fetchJson(monthUrl(city, method, school, y, mo));
      const updated = parseMonthResponse(body, {
        ...monthCache,
        days: {},
        fetchedAt: Date.now(),
      });
      writeMonthCache(updated);
      const day = updated.days[dateKey];
      if (!day) throw apiError('invalid', 'Date missing in calendar response');
      fresh = day;
    } else {
      const body = await fetchJson(dayUrl(city, method, school, dateKey));
      fresh = parseDayResponse(body, dateKey);
      writeDayCache(city.id, method, school, fresh);
    }
    return { day: fresh, fromCache: false, error: null };
  } catch (err) {
    const error = err as ApiError;
    if (cachedDay && 'dateKey' in cachedDay) {
      return { day: cachedDay, fromCache: true, error };
    }
    return { day: null, fromCache: false, error };
  }
}

/** Pre-fetch a whole month (called on startup when close to month end, or after wake). */
export async function prefetchMonth(
  city: City,
  method: number,
  madhab: AsrMadhab,
  y: number,
  m: number,
): Promise<boolean> {
  const school = schoolFromMadhab(madhab);
  const cache: MonthCache = {
    cityId: city.id,
    method,
    school,
    year: y,
    month: m,
    fetchedAt: Date.now(),
    days: {},
  };
  try {
    const body = await fetchJson(monthUrl(city, method, school, y, m));
    writeMonthCache(parseMonthResponse(body, cache));
    return true;
  } catch {
    return false;
  }
}

export function clearOutdatedCaches(cityId: string, method: number, school: 0 | 1): void {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(MONTH_CACHE_PREFIX) || k.startsWith(DAY_CACHE_PREFIX)) {
        const rest = k.slice('salati:'.length);
        // Keep only entries matching the current city/method/school prefix.
        if (!rest.startsWith(`month:${cityId}:${method}:${school}:`) && !rest.startsWith(`day:${cityId}:${method}:${school}:`)) {
          remove.push(k);
        }
      }
    }
    remove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
