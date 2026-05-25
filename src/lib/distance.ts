export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1609.344;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function hasValidCoordinates(value: {
  latitude?: unknown;
  longitude?: unknown;
}): value is Coordinates {
  return isValidCoordinate(value.latitude) && isValidCoordinate(value.longitude);
}

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function distanceMiles(from: Coordinates, to: Coordinates): number {
  return distanceMeters(from, to) / METERS_PER_MILE;
}

export function roundDistanceMiles(value: number): number {
  return Math.round(value * 10) / 10;
}
