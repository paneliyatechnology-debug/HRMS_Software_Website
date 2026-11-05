import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UnauthorizedException,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentsService } from './documents.service.js';
import { CreateDocumentMetadataDto } from './dto/create-document.dto.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List documents, optionally by userId',
    description: 'Retrieves verified and pending employee documents for authenticated company.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID (legacy alias for userId)' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT Bearer token required' })
  findAll(
    @Query('userId') userId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') companyFilter?: string,
    @Req() req?: any,
  ) {
    const actorUser = req?.user;
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    return this.documentsService.findAll(userId || employeeId, actorUser, companyFilter);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload document metadata',
    description: 'Registers document entry in employee dossier.',
  })
  @ApiBody({ type: CreateDocumentMetadataDto })
  @ApiResponse({ status: 201, description: 'Document registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT Bearer token required' })
  create(@Body() body: CreateDocumentMetadataDto, @Req() req: any) {
    const actorUser = req?.user;
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    return this.documentsService.create(body, actorUser);
  }

  @Post('upload')
  @ApiOperation({
    summary: 'Upload actual physical document file',
    description: 'Handles multipart file upload, stores safely in uploads/documents, and registers file URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @ApiResponse({ status: 201, description: 'Document file uploaded and registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT Bearer token required' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'document', maxCount: 1 },
        { name: 'doc', maxCount: 1 },
        { name: 'attachment', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = path.extname(file.originalname);
            const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
            cb(null, `doc-${cleanBase}-${uniqueSuffix}${ext}`);
          },
        }),
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB limit
        },
        fileFilter: (req, file, cb) => {
          if (!file.originalname.match(/\.(pdf|doc|docx|png|jpg|jpeg|txt)$/i)) {
            return cb(
              new BadRequestException('Only PDF, Word documents, and images are supported'),
              false,
            );
          }
          cb(null, true);
        },
      },
    ),
  )
  uploadFile(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      document?: Express.Multer.File[];
      doc?: Express.Multer.File[];
      attachment?: Express.Multer.File[];
    },
    @Body()
    body: {
      employeeId?: string;
      userId?: string;
      title?: string;
      category?: string;
      expiryDate?: string;
    },
    @Req() req: Request,
  ) {
    const file =
      files?.file?.[0] ||
      files?.document?.[0] ||
      files?.doc?.[0] ||
      files?.attachment?.[0];

    if (!file) {
      throw new BadRequestException('No document file provided. Please attach a file (supported field names: "file", "document").');
    }

    const actorUser = (req as any).user || this.documentsService.resolveUserFromRequest(req);
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }

    const fileSizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const dynamicBaseUrl = `${req.protocol}://${req.get('host')}`;

    return this.documentsService.create(
      {
        employeeId: body.employeeId || (body as any).userId,
        title: body.title || file.originalname,
        category: (body.category as any) || 'Other',
        fileUrl: `${dynamicBaseUrl}/uploads/documents/${file.filename}`,
        fileSize: fileSizeFormatted,
        expiryDate: body.expiryDate,
      },
      actorUser,
    );
  }

  @Put(':id/verify')
  @ApiOperation({
    summary: 'Verify uploaded document',
    description: 'Marks document as Verified (defaults to Verified if body is omitted or empty).',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: VerifyDocumentDto, required: false })
  @ApiResponse({ status: 200, description: 'Document marked as Verified successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN or SUPER_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  verify(@Param('id') id: string, @Body() body: VerifyDocumentDto, @Req() req: any) {
    const actorUser = req?.user;
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    return this.documentsService.verify(id, body || {}, actorUser);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify uploaded document (POST alias)' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  verifyPost(@Param('id') id: string, @Body() body: VerifyDocumentDto, @Req() req: any) {
    return this.verify(id, body, req);
  }

  @Put(':id/reject')
  @ApiOperation({
    summary: 'Reject uploaded document',
    description: 'Marks document as Rejected with audit record.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: VerifyDocumentDto, required: false })
  @ApiResponse({ status: 200, description: 'Document marked as Rejected successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN or SUPER_ADMIN role required' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  reject(@Param('id') id: string, @Body() body: VerifyDocumentDto, @Req() req: any) {
    const actorUser = req?.user;
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token is required.');
    }
    return this.documentsService.reject(id, body || {}, actorUser);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject uploaded document (POST alias)' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  rejectPost(@Param('id') id: string, @Body() body: VerifyDocumentDto, @Req() req: any) {
    return this.reject(id, body, req);
  }
}
