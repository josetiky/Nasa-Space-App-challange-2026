import type { GeoPoint } from "../types";
import { MARS } from "./constants";

const DEG = Math.PI / 180;

export function normalizeLon(lon: number): number {
  let value = ((lon + 180) % 360 + 360) % 360 - 180;
  if (Object.is(value, -0)) value = 0;
  return value;
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/** Great-circle distance on the Mars mean sphere (km). */
export function distanceKm(a: GeoPoint, b: GeoPoint, radiusM: number = MARS.radiusM): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return (2 * radiusM * Math.asin(Math.min(1, Math.sqrt(h)))) / 1000;
}

/** Initial bearing from a to b (deg clockwise from north). */
export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const y = Math.sin((b.lon - a.lon) * DEG) * Math.cos(b.lat * DEG);
  const x = Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) - Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((b.lon - a.lon) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** Points along the great circle between a and b (inclusive). */
export function greatCirclePoints(a: GeoPoint, b: GeoPoint, steps = 64): GeoPoint[] {
  const φ1 = a.lat * DEG;
  const λ1 = a.lon * DEG;
  const φ2 = b.lat * DEG;
  const λ2 = b.lon * DEG;
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [a, b];
  const points: GeoPoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    points.push({ lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG, lon: normalizeLon(Math.atan2(y, x) / DEG) });
  }
  return points;
}

/**
 * Unit-sphere position matching three.js SphereGeometry UVs, so an
 * equirectangular texture starting at −180° lines up with real coordinates.
 */
export function latLonToXYZ(point: GeoPoint, radius = 1): [number, number, number] {
  const phi = ((normalizeLon(point.lon) + 180) / 360) * 2 * Math.PI;
  const theta = ((90 - point.lat) / 180) * Math.PI;
  return [-radius * Math.cos(phi) * Math.sin(theta), radius * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta)];
}

export function xyzToLatLon(x: number, y: number, z: number): GeoPoint {
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  const theta = Math.acos(Math.max(-1, Math.min(1, y / r)));
  const phi = Math.atan2(z, -x);
  const lon = normalizeLon((((phi + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI)) * 360 - 180);
  return { lat: 90 - (theta / Math.PI) * 180, lon };
}

export function formatLatLon(point: GeoPoint, digits = 2): string {
  const lat = `${Math.abs(point.lat).toFixed(digits)}°${point.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(point.lon).toFixed(digits)}°${point.lon >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}
