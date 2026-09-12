/** GeoJSON-style [lng, lat] coordinates along a street route. */
export type RouteCoord = [number, number];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const x = Math.sin(dLng) * Math.cos(p2);
  const y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLng);
  return (Math.atan2(x, y) * (180 / Math.PI) + 360) % 360;
}

/** Shortest-path angle interpolation (degrees). */
export function lerpAngleDegrees(from: number, to: number, t: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/** Project a free GPS fix onto the nearest point on a polyline (keeps buses on-path). */
export function snapToPath(
  coords: RouteCoord[],
  lat: number,
  lng: number,
): { lat: number; lng: number; heading: number; progress: number; metersAlong: number } {
  if (coords.length === 0) return { lat, lng, heading: 0, progress: 0, metersAlong: 0 };
  if (coords.length === 1) {
    return { lat: coords[0][1], lng: coords[0][0], heading: 0, progress: 0, metersAlong: 0 };
  }

  let bestDist = Infinity;
  let bestLat = coords[0][1];
  let bestLng = coords[0][0];
  let bestHeading = 0;
  let bestAlong = 0;
  let total = 0;
  const segs: number[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const d =
      haversineKm(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000;
    segs.push(Math.max(d, 0.01));
    total += segs[i];
  }

  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const vx = lng2 - lng1;
    const vy = lat2 - lat1;
    const wx = lng - lng1;
    const wy = lat - lat1;
    const len2 = vx * vx + vy * vy || 1e-12;
    const t = Math.min(1, Math.max(0, (wx * vx + wy * vy) / len2));
    const plng = lng1 + vx * t;
    const plat = lat1 + vy * t;
    const dist = haversineKm(lat, lng, plat, plng);
    if (dist < bestDist) {
      bestDist = dist;
      bestLat = plat;
      bestLng = plng;
      bestHeading = bearingDegrees(lat1, lng1, lat2, lng2);
      bestAlong = acc + segs[i] * t;
    }
    acc += segs[i];
  }

  return {
    lat: bestLat,
    lng: bestLng,
    heading: bestHeading,
    progress: total > 0 ? bestAlong / total : 0,
    metersAlong: bestAlong,
  };
}

/** Mirror backend interpolate_along — t in [0, 1] by distance along the polyline. */
export function interpolateAlong(
  coords: RouteCoord[],
  t: number,
): { lat: number; lng: number; heading: number; metersAlong: number } {
  const clamped = Math.min(1, Math.max(0, t));
  if (coords.length === 0) return { lat: 0, lng: 0, heading: 0, metersAlong: 0 };
  if (coords.length === 1) {
    return { lat: coords[0][1], lng: coords[0][0], heading: 0, metersAlong: 0 };
  }

  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d =
      haversineKm(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000;
    segs.push(Math.max(d, 0.01));
    total += segs[i];
  }

  const target = clamped * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const d = segs[i];
    if (acc + d >= target) {
      const local = (target - acc) / d;
      const lng = coords[i][0] + (coords[i + 1][0] - coords[i][0]) * local;
      const lat = coords[i][1] + (coords[i + 1][1] - coords[i][1]) * local;
      const heading = bearingDegrees(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]);
      return { lat, lng, heading, metersAlong: target };
    }
    acc += d;
  }

  const lng = coords[coords.length - 1][0];
  const lat = coords[coords.length - 1][1];
  const heading =
    coords.length > 1
      ? bearingDegrees(
          coords[coords.length - 2][1],
          coords[coords.length - 2][0],
          lat,
          lng,
        )
      : 0;
  return { lat, lng, heading, metersAlong: total };
}

/** Position at a given distance (meters) from the route start. */
export function interpolateAtMeters(
  coords: RouteCoord[],
  meters: number,
): { lat: number; lng: number; heading: number; metersAlong: number } {
  const end = interpolateAlong(coords, 1);
  if (end.metersAlong <= 0) return interpolateAlong(coords, 0);
  return interpolateAlong(coords, Math.min(1, Math.max(0, meters / end.metersAlong)));
}

/** Bearing toward a point further along the path — eases turns before corners. */
export function headingAlongPath(coords: RouteCoord[], t: number, lookAheadM = 45): number {
  const here = interpolateAlong(coords, t);
  const ahead = interpolateAtMeters(coords, here.metersAlong + lookAheadM);
  if (Math.abs(here.lat - ahead.lat) < 1e-8 && Math.abs(here.lng - ahead.lng) < 1e-8) {
    return here.heading;
  }
  return bearingDegrees(here.lat, here.lng, ahead.lat, ahead.lng);
}

/** Rough drive duration for demo animation (~22 mph average). */
export function routeDurationMs(coords: RouteCoord[]): number {
  if (coords.length < 2) return 30_000;
  let meters = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    meters += haversineKm(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0]) * 1000;
  }
  const mph = 22;
  const seconds = (meters / 1609.344 / mph) * 3600;
  return Math.min(120_000, Math.max(35_000, seconds * 1000));
}
