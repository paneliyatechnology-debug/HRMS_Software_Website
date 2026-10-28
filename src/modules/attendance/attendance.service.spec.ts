import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import {
  calculateDistanceMeters,
  isWithinGeofence,
  isValidCoordinate,
  formatDurationSeconds,
} from '../../common/utils/geofence.util.js';
import {
  saveBase64Selfie,
  resolveSecureSelfiePath,
} from '../../common/utils/selfie-storage.util.js';

describe('Geofence & Work Timer Utility Unit Tests', () => {
  const officeLat = 21.17024;
  const officeLon = 72.831061;

  describe('Haversine Distance & Geofence Boundary', () => {
    it('should return 0 meters for identical coordinates', () => {
      const distance = calculateDistanceMeters(officeLat, officeLon, officeLat, officeLon);
      expect(Math.round(distance)).toBe(0);
    });

    it('should correctly determine point is inside geofence radius', () => {
      // 50 meters offset approximately
      const nearbyLat = 21.1705;
      const nearbyLon = 72.8312;
      const result = isWithinGeofence(nearbyLat, nearbyLon, officeLat, officeLon, 200);
      expect(result.inside).toBe(true);
      expect(result.distanceMeters).toBeLessThan(200);
    });

    it('should correctly determine point is outside geofence radius', () => {
      // London coordinates (~7000km away)
      const londonLat = 51.5074;
      const londonLon = -0.1278;
      const result = isWithinGeofence(londonLat, londonLon, officeLat, officeLon, 200);
      expect(result.inside).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(100000);
    });

    it('should reject NaN or invalid numerical values in calculation', () => {
      expect(() => calculateDistanceMeters(NaN, officeLon, officeLat, officeLon)).toThrow();
    });
  });

  describe('Coordinate Validation', () => {
    it('should accept valid geographical latitude and longitude', () => {
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(21.17024, 72.831061)).toBe(true);
      expect(isValidCoordinate(-90, 180)).toBe(true);
      expect(isValidCoordinate(90, -180)).toBe(true);
    });

    it('should reject coordinates outside planetary bounds', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(-91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(0, -181)).toBe(false);
      expect(isValidCoordinate(NaN as any, 0)).toBe(false);
      expect(isValidCoordinate('21.17' as any, 72.83)).toBe(false);
    });
  });

  describe('Duration Formatter', () => {
    it('should format seconds into HHh MMm SSs representation', () => {
      expect(formatDurationSeconds(0)).toBe('00h 00m 00s');
      expect(formatDurationSeconds(59)).toBe('00h 00m 59s');
      expect(formatDurationSeconds(65)).toBe('00h 01m 05s');
      expect(formatDurationSeconds(3665)).toBe('01h 01m 05s');
      expect(formatDurationSeconds(28800)).toBe('08h 00m 00s');
    });

    it('should handle negative or invalid duration gracefully', () => {
      expect(formatDurationSeconds(-10)).toBe('00h 00m 00s');
      expect(formatDurationSeconds(NaN)).toBe('00h 00m 00s');
    });
  });

  describe('Secure Selfie Storage & Traversal Protection', () => {
    const validSampleBase64 =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    it('should save valid base64 selfie securely and return safe relative path reference', () => {
      const ref = saveBase64Selfie(validSampleBase64, 'emp-test-unit', 'start');
      expect(ref).toMatch(/^storage\/selfies\/selfie-start-emp-test-unit-/);

      const resolved = resolveSecureSelfiePath(ref);
      expect(resolved).not.toBeNull();
      expect(fs.existsSync(resolved!)).toBe(true);

      // Clean up test file
      if (resolved && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    });

    it('should reject invalid or empty base64 selfie string', () => {
      expect(() => saveBase64Selfie('', 'emp-1', 'start')).toThrow();
      expect(() => saveBase64Selfie('invalid_small_data', 'emp-1', 'start')).toThrow();
    });

    it('should prevent directory traversal attacks in resolveSecureSelfiePath', () => {
      expect(resolveSecureSelfiePath('../../package.json')).toBeNull();
      expect(resolveSecureSelfiePath('../../../Windows/System32/drivers/etc/hosts')).toBeNull();
      expect(resolveSecureSelfiePath('')).toBeNull();
    });
  });
});
