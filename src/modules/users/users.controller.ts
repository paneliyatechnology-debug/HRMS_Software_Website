import {
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import type { Request } from 'express';
import { UsersService } from './users.service.js';
import { UpdateProfilePhotoDto } from './dto/update-profile-photo.dto.js';

const profilesUploadDir = path.resolve(process.cwd(), 'uploads', 'profiles');
if (!fs.existsSync(profilesUploadDir)) {
  fs.mkdirSync(profilesUploadDir, { recursive: true });
}

export const profilePhotoMulterOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(profilesUploadDir)) {
        fs.mkdirSync(profilesUploadDir, { recursive: true });
      }
      cb(null, profilesUploadDir);
    },
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
        ? ext === '.jpeg' ? '.jpg' : ext
        : '.jpg';

      const actor = (req as any)?.user;
      const userPrefix = actor?.id ? String(actor.id).replace(/[^a-zA-Z0-9_-]/g, '_') : 'user';
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `profile-${userPrefix}-${uniqueSuffix}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!allowedMimes.includes(file.mimetype?.toLowerCase()) || !allowedExts.includes(ext)) {
      return cb(
        new BadRequestException('Invalid file format. Only JPEG, PNG, and WebP images are allowed.'),
        false,
      );
    }
    cb(null, true);
  },
};

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({
    summary: 'Get current logged-in user profile',
    description: 'Retrieves authenticated user profile information.',
  })
  @ApiResponse({ status: 200, description: 'User profile dossier' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user);
  }

  @Patch('profile/photo')
  @ApiOperation({
    summary: 'Upload user profile picture (PATCH)',
    description:
      'Uploads a JPEG, PNG, or WebP profile photo (up to 5 MB) for the authenticated user and updates their avatar URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateProfilePhotoDto })
  @ApiResponse({ status: 200, description: 'Profile picture updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image format or size exceeds 5 MB' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('profilePhoto', profilePhotoMulterOptions))
  uploadPhotoPatch(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No image file provided. Please upload a file with field name "profilePhoto".',
      );
    }
    return this.usersService.updateProfilePhoto((req as any).user, file, req);
  }

  @Post('profile/photo')
  @ApiOperation({
    summary: 'Upload user profile picture (POST alias)',
    description: 'POST alias for PATCH /api/users/profile/photo.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateProfilePhotoDto })
  @ApiResponse({ status: 200, description: 'Profile picture updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image format or size exceeds 5 MB' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('profilePhoto', profilePhotoMulterOptions))
  uploadPhotoPost(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No image file provided. Please upload a file with field name "profilePhoto".',
      );
    }
    return this.usersService.updateProfilePhoto((req as any).user, file, req);
  }
}
