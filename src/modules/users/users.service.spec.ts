import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Role } from '../../common/types.js';

describe('UsersService - Profile Picture Upload', () => {
  let service: UsersService;
  let mockDb: any;
  const testDir = path.resolve(process.cwd(), 'uploads', 'test-profiles');

  const mockAdminUser = {
    id: 'user-admin-123',
    email: 'admin.test@paneliya.com',
    firstName: 'Admin',
    lastName: 'Tester',
    role: Role.ADMIN,
    status: 'Active',
    companyId: 'cmp-1',
    avatarUrl: '',
    updatedAt: '',
  };

  const mockEmployeeUser = {
    id: 'user-emp-456',
    email: 'employee.test@paneliya.com',
    firstName: 'Emp',
    lastName: 'Tester',
    role: Role.EMPLOYEE,
    status: 'Active',
    companyId: 'cmp-1',
    employeeId: 'emp-456',
    avatarUrl: '',
    updatedAt: '',
  };

  const mockEmployeeRecord = {
    id: 'emp-456',
    employeeCode: 'EMP-000456',
    firstName: 'Emp',
    lastName: 'Tester',
    email: 'employee.test@paneliya.com',
    avatarUrl: '',
    updatedAt: '',
  };

  let originalSecret: string | undefined;
  let originalUrl: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.CLOUDINARY_API_SECRET;
    originalUrl = process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_URL;

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    mockDb = {
      users: [{ ...mockAdminUser }, { ...mockEmployeeUser }],
      employees: [{ ...mockEmployeeRecord }],
      logAudit: () => {},
      persist: () => {},
    };

    service = new UsersService(mockDb as any);
  });

  afterEach(() => {
    if (originalSecret !== undefined) process.env.CLOUDINARY_API_SECRET = originalSecret;
    if (originalUrl !== undefined) process.env.CLOUDINARY_URL = originalUrl;

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Helper to create a dummy valid JPEG file with JPEG magic bytes (FF D8 FF)
  function createDummyJpeg(filename: string, sizeBytes = 1024): string {
    const filePath = path.join(testDir, filename);
    const buf = Buffer.alloc(sizeBytes);
    // Write JPEG magic bytes: FF D8 FF E0
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    buf[3] = 0xe0;
    fs.writeFileSync(filePath, buf);
    return filePath;
  }

  // Helper to create a dummy valid PNG file with PNG magic bytes (89 50 4E 47)
  function createDummyPng(filename: string, sizeBytes = 1024): string {
    const filePath = path.join(testDir, filename);
    const buf = Buffer.alloc(sizeBytes);
    buf[0] = 0x89;
    buf[1] = 0x50;
    buf[2] = 0x4e;
    buf[3] = 0x47;
    fs.writeFileSync(filePath, buf);
    return filePath;
  }

  it('1. ADMIN profile picture upload succeeds and updates avatarUrl', async () => {
    const filePath = createDummyJpeg('admin-avatar.jpg');
    const mockFile: Express.Multer.File = {
      fieldname: 'profilePhoto',
      originalname: 'admin-avatar.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      destination: testDir,
      filename: 'admin-avatar.jpg',
      path: filePath,
      buffer: Buffer.alloc(0),
      stream: null as any,
    };

    const mockReq = {
      headers: {},
      protocol: 'http',
      get: () => 'localhost:4000',
    } as any;

    const res = await service.updateProfilePhoto(mockAdminUser as any, mockFile, mockReq);
    expect(res.avatarUrl).toBe('/uploads/profiles/admin-avatar.jpg');
    expect(res.avatarUrl).not.toContain('http');
    expect(res.avatarUrl).not.toContain('localhost');
    expect(res.user.avatarUrl).toBe('/uploads/profiles/admin-avatar.jpg');
    expect(res.user.role).toBe(Role.ADMIN);

    const userInDb = mockDb.users.find((u: any) => u.id === mockAdminUser.id);
    expect(userInDb.avatarUrl).toBe('/uploads/profiles/admin-avatar.jpg');
  });

  it('2. EMPLOYEE profile picture upload succeeds and updates both user and employee record', async () => {
    const filePath = createDummyPng('emp-avatar.png');
    const mockFile: Express.Multer.File = {
      fieldname: 'profilePhoto',
      originalname: 'emp-avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 2048,
      destination: testDir,
      filename: 'emp-avatar.png',
      path: filePath,
      buffer: Buffer.alloc(0),
      stream: null as any,
    };

    const mockReq = {
      headers: {},
      protocol: 'http',
      get: () => 'localhost:4000',
    } as any;

    const res = await service.updateProfilePhoto(mockEmployeeUser as any, mockFile, mockReq);
    expect(res.avatarUrl).toBe('/uploads/profiles/emp-avatar.png');
    expect(res.avatarUrl).not.toContain('http');
    expect(res.avatarUrl).not.toContain('localhost');

    const empInDb = mockDb.employees.find((e: any) => e.id === mockEmployeeRecord.id);
    expect(empInDb.avatarUrl).toBe('/uploads/profiles/emp-avatar.png');
  });

  it('3. Invalid file type rejection (e.g. .pdf or text/plain)', async () => {
    const filePath = path.join(testDir, 'resume.pdf');
    fs.writeFileSync(filePath, 'PDF-content-not-image');

    const mockFile: Express.Multer.File = {
      fieldname: 'profilePhoto',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 500,
      destination: testDir,
      filename: 'resume.pdf',
      path: filePath,
      buffer: Buffer.alloc(0),
      stream: null as any,
    };

    const mockReq = { headers: {}, protocol: 'http', get: () => 'localhost:4000' } as any;

    await expect(
      service.updateProfilePhoto(mockAdminUser as any, mockFile, mockReq),
    ).rejects.toThrow(BadRequestException);
  });

  it('4. Oversized file rejection (> 5 MB)', async () => {
    const filePath = createDummyJpeg('huge.jpg', 6 * 1024 * 1024);
    const mockFile: Express.Multer.File = {
      fieldname: 'profilePhoto',
      originalname: 'huge.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 6 * 1024 * 1024,
      destination: testDir,
      filename: 'huge.jpg',
      path: filePath,
      buffer: Buffer.alloc(0),
      stream: null as any,
    };

    const mockReq = { headers: {}, protocol: 'http', get: () => 'localhost:4000' } as any;

    await expect(
      service.updateProfilePhoto(mockAdminUser as any, mockFile, mockReq),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. Unauthorized request rejection when actor is missing', async () => {
    const filePath = createDummyJpeg('test.jpg');
    const mockFile: Express.Multer.File = {
      fieldname: 'profilePhoto',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      destination: testDir,
      filename: 'test.jpg',
      path: filePath,
      buffer: Buffer.alloc(0),
      stream: null as any,
    };

    const mockReq = { headers: {}, protocol: 'http', get: () => 'localhost:4000' } as any;

    await expect(
      service.updateProfilePhoto(null as any, mockFile, mockReq),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('6. Cloudinary utility recognizes configured credentials and fallback', async () => {
    const { isCloudinaryConfigured } = await import('../../common/utils/cloudinary.util.js');
    // Without secret, it safely reports false and keeps local storage safe
    const previousSecret = process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_URL;
    expect(isCloudinaryConfigured()).toBe(false);

    // With credentials, it reports true
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = '932995489739298';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    expect(isCloudinaryConfigured()).toBe(true);

    // Restore
    delete process.env.CLOUDINARY_CLOUD_NAME;
    if (previousSecret) {
      process.env.CLOUDINARY_API_SECRET = previousSecret;
    } else {
      delete process.env.CLOUDINARY_API_SECRET;
    }
  });
});
