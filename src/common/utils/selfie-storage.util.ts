import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';

const SECURE_SELFIE_DIR = path.resolve(process.cwd(), 'storage', 'selfies');

/**
 * Ensures the secure storage directory exists.
 */
export function ensureSecureSelfieDirectory(): string {
  if (!fs.existsSync(SECURE_SELFIE_DIR)) {
    fs.mkdirSync(SECURE_SELFIE_DIR, { recursive: true });
  }
  return SECURE_SELFIE_DIR;
}

/**
 * Saves a base64 encoded selfie image to secure local storage.
 * @returns relative storage path reference (e.g. "storage/selfies/selfie-start-emp1-1730000.jpg")
 */
export function saveBase64Selfie(
  base64Data: string,
  employeeId: string,
  type: 'start' | 'stop',
): string {
  ensureSecureSelfieDirectory();

  if (!base64Data || typeof base64Data !== 'string') {
    throw new BadRequestException('Invalid selfie data provided.');
  }

  // Handle data URI format (e.g. "data:image/jpeg;base64,...")
  let mimeMatch = base64Data.match(/^data:image\/(jpeg|jpg|png|webp);base64,/i);
  let pureBase64 = base64Data;
  let extension = 'jpg';

  if (mimeMatch) {
    const rawExt = mimeMatch[1].toLowerCase();
    extension = rawExt === 'jpeg' ? 'jpg' : rawExt;
    pureBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/i, '');
  }

  const cleanBase64 = pureBase64.trim().replace(/\s/g, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  // Verify buffer length and size (max 5MB)
  if (buffer.length < 100) {
    throw new BadRequestException('Selfie image data is invalid or empty.');
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new BadRequestException('Selfie image exceeds maximum allowed size of 5MB.');
  }

  const sanitizedEmpId = employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `selfie-${type}-${sanitizedEmpId}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;
  const absolutePath = path.join(SECURE_SELFIE_DIR, filename);

  fs.writeFileSync(absolutePath, buffer);
  return `storage/selfies/${filename}`;
}

/**
 * Saves an uploaded Multer file to the secure selfie directory.
 */
export function saveMulterSelfie(
  file: Express.Multer.File,
  employeeId: string,
  type: 'start' | 'stop',
): string {
  ensureSecureSelfieDirectory();

  if (!file) {
    throw new BadRequestException('No selfie file uploaded.');
  }

  const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    throw new BadRequestException('Only JPG, PNG, and WebP selfie images are accepted.');
  }

  const sanitizedEmpId = employeeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const normalizedExt = ext === '.jpeg' ? '.jpg' : ext;
  const filename = `selfie-${type}-${sanitizedEmpId}-${Date.now()}-${Math.floor(Math.random() * 10000)}${normalizedExt}`;
  const targetPath = path.join(SECURE_SELFIE_DIR, filename);

  if (file.buffer) {
    fs.writeFileSync(targetPath, file.buffer);
  } else if (file.path && fs.existsSync(file.path)) {
    fs.copyFileSync(file.path, targetPath);
    try {
      fs.unlinkSync(file.path);
    } catch {
      // Ignore cleanup error
    }
  } else {
    throw new BadRequestException('Uploaded selfie file stream could not be read.');
  }

  return `storage/selfies/${filename}`;
}

/**
 * Resolves the absolute path for a stored selfie reference, preventing directory traversal.
 */
export function resolveSecureSelfiePath(storedRef: string): string | null {
  if (!storedRef) return null;
  const basename = path.basename(storedRef);
  const resolved = path.resolve(SECURE_SELFIE_DIR, basename);

  // Security check: ensure path is within SECURE_SELFIE_DIR
  if (!resolved.startsWith(SECURE_SELFIE_DIR)) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}

