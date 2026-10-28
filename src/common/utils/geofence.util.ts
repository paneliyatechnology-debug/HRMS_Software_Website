/**
 * Geofencing calculations and GPS validation utilities
 */

export const DEFAULT_MAX_GPS_ACCURACY_METERS = 150;

/**
 * Calculates the great-circle distance between two GPS coordinates using the Haversine formula.
 * @returns distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    Number.isNaN(lat1) ||
    Number.isNaN(lon1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lon2)
  ) {
    throw new Error('Coordinates must be valid non-NaN numbers');
  }

  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Verifies if coordinates are within the configured circular geofence boundary.
 */
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  officeLat: number,
  officeLon: number,
  radiusMeters: number,
): { inside: boolean; distanceMeters: number } {
  const distance = calculateDistanceMeters(userLat, userLon, officeLat, officeLon);
  const rounded = Math.round(distance * 100) / 100;
  return {
    inside: distance <= radiusMeters,
    distanceMeters: rounded,
  };
}

/**
 * Validates that latitude and longitude fall within acceptable planetary ranges.
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

/**
 * Formats a duration in seconds into a human-readable HH:mm:ss string.
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (totalSeconds < 0 || Number.isNaN(totalSeconds)) return '00h 00m 00s';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

