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
  BadRequestException,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentsService } from './documents.service.js';
import { CreateDocumentMetadataDto } from './dto/create-document.dto.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Public } from '../../common/guards/public.decorator.js';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List documents, optionally by userId',
    description: 'Retrieves verified and pending employee documents for authenticated company.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID (legacy alias for userId)' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  async findAll(
    @Query('userId') userId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') companyFilter?: string,
    @Req() req?: any,
  ) {
    let actorUser = req?.user;
    if (!actorUser && req) {
      actorUser = this.documentsService.resolveUserFromRequest(req);
    }
    const targetEmployeeId = userId || employeeId;
    if (!actorUser && targetEmployeeId) {
      actorUser = await this.documentsService.resolveUserByIdentifier(targetEmployeeId);
    }
    return this.documentsService.findAll(targetEmployeeId, actorUser, companyFilter);
  }

  @Public()
  @Post()
  @ApiOperation({
    summary: 'Upload document metadata',
    description: 'Registers document entry in employee dossier.',
  })
  @ApiBody({ type: CreateDocumentMetadataDto })
  @ApiResponse({ status: 201, description: 'Document registered' })
  async create(@Body() body: CreateDocumentMetadataDto, @Req() req: any) {
    let actorUser = req?.user;
    if (!actorUser && req) {
      actorUser = this.documentsService.resolveUserFromRequest(req);
    }
    const targetId = (body as any)?.userId || body.employeeId;
    if (!actorUser && targetId) {
      actorUser = await this.documentsService.resolveUserByIdentifier(targetId);
    }
    return this.documentsService.create(body, actorUser);
  }

  @Public()
  @Post('upload')
  @ApiOperation({
    summary: 'Upload actual physical document file',
    description: 'Handles multipart file upload, stores safely in uploads/documents, and registers file URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @UseInterceptors(
    FileInterceptor('file', {
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
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
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
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const fileSizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const dynamicBaseUrl = `${req.protocol}://${req.get('host')}`;

    let actorUser = (req as any).user;
    if (!actorUser) {
      actorUser = this.documentsService.resolveUserFromRequest(req);
    }
    const targetEmployeeId = body.employeeId || body.userId;
    if (!actorUser && targetEmployeeId) {
      actorUser = await this.documentsService.resolveUserByIdentifier(targetEmployeeId);
    }

    return this.documentsService.create(
      {
        employeeId: targetEmployeeId || actorUser?.id,
        userId: targetEmployeeId || actorUser?.id,
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
    summary: 'Verify or reject uploaded document',
    description: 'Marks document as Verified or Rejected with audit signature.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: VerifyDocumentDto })
  @ApiResponse({ status: 200, description: 'Document verification updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  verify(@Param('id') id: string, @Body() body: VerifyDocumentDto, @Req() req: any) {
    return this.documentsService.verify(id, body, req?.user);
  }
}
