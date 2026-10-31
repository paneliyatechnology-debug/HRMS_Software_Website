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
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import { DocumentsService } from './documents.service.js';
import { CreateDocumentMetadataDto } from './dto/create-document.dto.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List documents, optionally by userId',
    description: 'Retrieves verified and pending employee documents.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID (legacy alias for userId)' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  findAll(@Query('userId') userId?: string, @Query('employeeId') employeeId?: string) {
    return this.documentsService.findAll(userId || employeeId);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload document metadata',
    description: 'Registers document entry in employee dossier.',
  })
  @ApiBody({ type: CreateDocumentMetadataDto })
  @ApiResponse({ status: 201, description: 'Document registered' })
  create(@Body() body: CreateDocumentMetadataDto) {
    return this.documentsService.create(body);
  }

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
        destination: './uploads/documents',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
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
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      employeeId?: string;
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

    const actorUser = (req as any).user;
    return this.documentsService.create({
      employeeId: body.employeeId || actorUser?.id || (body as any).userId,
      userId: (body as any).userId || body.employeeId || actorUser?.id,
      title: body.title || file.originalname,
      category: (body.category as any) || 'Other',
      fileUrl: `${dynamicBaseUrl}/uploads/documents/${file.filename}`,
      fileSize: fileSizeFormatted,
      expiryDate: body.expiryDate,
    });
  }

  @Put(':id/verify')
  @ApiOperation({
    summary: 'Verify or reject uploaded document',
    description: 'Marks document as Verified or Rejected with audit signature.',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiBody({ type: VerifyDocumentDto })
  @ApiResponse({ status: 200, description: 'Document verification updated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  verify(@Param('id') id: string, @Body() body: VerifyDocumentDto) {
    return this.documentsService.verify(id, body);
  }
}
