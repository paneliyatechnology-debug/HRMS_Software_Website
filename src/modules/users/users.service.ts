import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { Request } from 'express';
import { DatabaseService } from '../../database/database.service.js';
import { User, Role } from '../../common/types.js';
import { normalizeAvatarUrl } from '../../common/utils/url.util.js';
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
} from '../../common/utils/cloudinary.util.js';

/**
 * Validates file magic bytes (binary signatures) to prevent file extension spoofing
 * and reject executable or malicious payloads.
 */
function validateImageMagicBytes(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size < 12) return false;

    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    // JPEG: 0xFF, 0xD8, 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }

    // PNG: 0x89, 0x50, 0x4E, 0x47 (0x89 'P' 'N' 'G')
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return true;
    }

    // WebP: RIFF (0x52, 0x49, 0x46, 0x46) ... WEBP (0x57, 0x45, 0x42, 0x50) at offset 8
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns current authenticated user profile
   */
  getProfile(actor?: User) {
    if (!actor || !actor.id) {
      throw new UnauthorizedException('Authentication required. Please login first.');
    }

    const user = this.db.users.find(
      (u) =>
        u.id.toLowerCase() === actor.id.toLowerCase() ||
        (u.email && actor.email && u.email.toLowerCase() === actor.email.toLowerCase()),
    );

    if (!user) {
      throw new UnauthorizedException('User account not found. Please login again.');
    }

    const { password: _, ...safeUser } = user;
    return {
      ...safeUser,
      avatarUrl: normalizeAvatarUrl(user.avatarUrl),
      isSuperAdmin: user.isSuperAdmin ?? (user.role === Role.SUPER_ADMIN),
      status: user.status || 'Active',
    };
  }

  /**
   * Updates the authenticated user's profile photo.
   * Target user is strictly derived from the authenticated token session (actor).
   */
  async updateProfilePhoto(actor: User, file: Express.Multer.File, req: Request) {
    if (!actor || !actor.id) {
      if (file?.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new UnauthorizedException('Authentication required. Please login first.');
    }

    const user = this.db.users.find(
      (u) =>
        u.id.toLowerCase() === actor.id.toLowerCase() ||
        (u.email && actor.email && u.email.toLowerCase() === actor.email.toLowerCase()),
    );

    if (!user) {
      if (file?.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new UnauthorizedException('Authenticated user record not found in system database.');
    }

    if (user.status && user.status.toLowerCase() === 'inactive') {
      if (file?.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new UnauthorizedException('Your user account is deactivated. Contact administrator.');
    }

    if (!file) {
      throw new BadRequestException(
        'No image file provided. Please upload a file with field name "profilePhoto".',
      );
    }

    // 1. File size check (5 MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new BadRequestException('File size exceeds the 5 MB limit.');
    }

    // 2. Extension validation
    const ext = (path.extname(file.originalname || file.filename) || '').toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowedExts.includes(ext)) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new BadRequestException('Invalid file format. Only JPEG, PNG, and WebP images are allowed.');
    }

    // 3. MIME validation
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype?.toLowerCase())) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new BadRequestException('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    // 4. Magic bytes validation (verifies real image bytes, rejects executable and text files)
    if (file.path && !validateImageMagicBytes(file.path)) {
      if (fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      throw new BadRequestException(
        'Invalid image content. File signature does not match allowed image formats (JPEG, PNG, WebP).',
      );
    }

    // 5. Cloudinary Upload (or fallback to local disk)
    let finalAvatarUrl = `/uploads/profiles/${file.filename}`;
    let isCloudinary = false;

    if (isCloudinaryConfigured()) {
      try {
        const actorId = actor.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const publicId = `profile-${actorId}-${Date.now()}`;
        const uploadRes = await uploadToCloudinary(file.path, 'hrms/profiles', publicId);
        if (uploadRes?.secure_url) {
          finalAvatarUrl = uploadRes.secure_url;
          isCloudinary = true;
          // Safely delete local temp copy since file is stored on Cloudinary CDN
          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkErr) {
              this.logger.warn(`Could not remove temp file after Cloudinary upload: ${unlinkErr}`);
            }
          }
        }
      } catch (err) {
        this.logger.warn(`Cloudinary upload failed, falling back to local storage: ${err}`);
      }
    }

    // 6. Delete old profile image if it was stored locally in uploads/profiles
    if (user.avatarUrl && user.avatarUrl.includes('/uploads/profiles/')) {
      try {
        const oldFilename = path.basename(user.avatarUrl);
        const oldFilePath = path.resolve(process.cwd(), 'uploads', 'profiles', oldFilename);
        if (
          fs.existsSync(oldFilePath) &&
          oldFilename !== file.filename &&
          oldFilePath.startsWith(path.resolve(process.cwd(), 'uploads', 'profiles'))
        ) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (cleanErr) {
        this.logger.warn(`Could not remove old profile photo: ${cleanErr}`);
      }
    }

    // 7. Update User in DB
    user.avatarUrl = finalAvatarUrl;
    user.updatedAt = new Date().toISOString();

    // 8. Update linked Employee record if present
    const matchedEmployee = this.db.employees.find(
      (e) =>
        (user.employeeId && e.id === user.employeeId) ||
        (user.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
        e.userId === user.id,
    );

    if (matchedEmployee) {
      matchedEmployee.avatarUrl = finalAvatarUrl;
      matchedEmployee.updatedAt = new Date().toISOString();
    }

    // 9. Audit log
    this.db.logAudit(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.role,
      'PROFILE_PHOTO_UPDATED',
      'Users',
      `User ${user.email} updated profile photo (${isCloudinary ? 'Cloudinary' : file.filename})`,
      user.id,
    );

    // 10. Persist and sync directly with MySQL
    this.db.persist();

    // 11. Return response
    const { password: _, ...safeUser } = user;
    return {
      message: 'Profile picture updated successfully',
      avatarUrl: finalAvatarUrl,
      photoUrl: finalAvatarUrl,
      ...(isCloudinary ? { cloudinaryUrl: finalAvatarUrl } : { relativePath: finalAvatarUrl }),
      user: {
        ...safeUser,
        avatarUrl: finalAvatarUrl,
        isSuperAdmin: user.isSuperAdmin ?? (user.role === Role.SUPER_ADMIN),
        status: user.status || 'Active',
      },
    };
  }
}
