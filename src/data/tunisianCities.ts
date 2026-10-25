import type { City } from '../types/prayer';

/**
 * Coordinates are approximate city-centre values (WGS84).
 * Prayer times differ by up to ~2 minutes across the country, so each city
 * uses its own latitude/longitude when contacting the Aladhan API.
 */
export const TUNISIAN_CITIES: City[] = [
  { id: 'tunis', nameFr: 'Tunis', nameAr: 'تونس', nameEn: 'Tunis', lat: 36.8188, lon: 10.1658 },
  { id: 'sfax', nameFr: 'Sfax', nameAr: 'صفاقس', nameEn: 'Sfax', lat: 34.7406, lon: 10.7603 },
  { id: 'sousse', nameFr: 'Sousse', nameAr: 'سوسة', nameEn: 'Sousse', lat: 35.8256, lon: 10.6084 },
  { id: 'gabes', nameFr: 'Gabès', nameAr: 'قابس', nameEn: 'Gabès', lat: 33.8815, lon: 10.0982 },
  { id: 'monastir', nameFr: 'Monastir', nameAr: 'المنستير', nameEn: 'Monastir', lat: 35.7778, lon: 10.8262 },
  { id: 'bizerte', nameFr: 'Bizerte', nameAr: 'بنزرت', nameEn: 'Bizerte', lat: 37.2745, lon: 9.8739 },
  { id: 'kairouan', nameFr: 'Kairouan', nameAr: 'القيروان', nameEn: 'Kairouan', lat: 35.6781, lon: 10.0962 },
  { id: 'gafsa', nameFr: 'Gafsa', nameAr: 'قفصة', nameEn: 'Gafsa', lat: 33.9251, lon: 8.7746 },
  { id: 'tozeur', nameFr: 'Tozeur', nameAr: 'توزر', nameEn: 'Tozeur', lat: 33.9202, lon: 8.1334 },
  { id: 'medenine', nameFr: 'Médenine', nameAr: 'مدنين', nameEn: 'Médenine', lat: 33.3549, lon: 10.5055 },
  { id: 'djerba', nameFr: 'Djerba / Houmt Souk', nameAr: 'جربة / حومة السوق', nameEn: 'Djerba / Houmt Souk', lat: 33.8869, lon: 10.8695 },
  { id: 'tataouine', nameFr: 'Tataouine', nameAr: 'تطاوين', nameEn: 'Tataouine', lat: 33.1242, lon: 10.4266 },
  { id: 'kasserine', nameFr: 'Kasserine', nameAr: 'القصرين', nameEn: 'Kasserine', lat: 35.1676, lon: 8.8363 },
  { id: 'beja', nameFr: 'Béja', nameAr: 'باجة', nameEn: 'Béja', lat: 36.7256, lon: 9.1817 },
  { id: 'nabeul', nameFr: 'Nabeul', nameAr: 'نابل', nameEn: 'Nabeul', lat: 36.4544, lon: 10.7357 },
  { id: 'mahdia', nameFr: 'Mahdia', nameAr: 'المهدية', nameEn: 'Mahdia', lat: 35.5047, lon: 11.0643 },
];

export const DEFAULT_CITY_ID = 'tunis';

export function getCity(id: string | undefined): City {
  return (
    TUNISIAN_CITIES.find((c) => c.id === id) ??
    TUNISIAN_CITIES.find((c) => c.id === DEFAULT_CITY_ID)!
  );
}

/** Cities whose governorate lies in Tunisia's Sahel / south-east (Farqad school is common there,
 *  but the official national method is used everywhere — this list is informational only). */
export const SOUTHERN_CITIES: ReadonlySet<string> = new Set([
  'gabes',
  'tozeur',
  'medenine',
  'djerba',
  'tataouine',
]);
