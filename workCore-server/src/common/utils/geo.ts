/** Координати точки на поверхні Землі. */
export interface Coords {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Відстань між двома точками в метрах (формула гаверсинуса).
 *
 * Для наших дистанцій (десятки-сотні метрів) сферична модель Землі дає
 * похибку менше метра — суттєво точніше за похибку самого GPS, тож
 * ускладнювати еліпсоїдом (Vincenty) сенсу немає.
 */
export function distanceMeters(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Чи в межах радіуса. Повертає null, коли перевірити неможливо —
 * немає координат відділення, радіус не заданий або працівник не поділився
 * геопозицією. null означає саме «невідомо», а не «порушення»: GPS у
 * приміщенні часто бреше на сотні метрів, тож невідомість не має каратись.
 */
export function isWithinRadius(
  site: { latitude?: number | null; longitude?: number | null },
  radiusM?: number | null,
  actual?: Coords | null,
): { within: boolean; distanceM: number } | null {
  if (!radiusM || radiusM <= 0) return null;
  if (site.latitude == null || site.longitude == null) return null;
  if (!actual) return null;

  const distanceM = distanceMeters(
    { latitude: site.latitude, longitude: site.longitude },
    actual,
  );
  return { within: distanceM <= radiusM, distanceM: Math.round(distanceM) };
}
