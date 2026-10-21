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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import { DocumentsService } from './documents.service.js';
import { EmployeeDocument } from '../common/types.js';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents, optionally by employeeId' })
  findAll(@Query('employeeId') employeeId?: string) {
    return this.documentsService.findAll(employeeId);
  }

  @Post()
  @ApiOperation({ summary: 'Upload document metadata' })
  create(@Body() body: Partial<EmployeeDocument>) {
    return this.documentsService.create(body);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload actual physical document file' })
  @ApiConsumes('multipart/form-data')
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
          return cb(new BadRequestException('Only PDF, Word documents, and images are supported'), false);
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
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const fileSizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    return this.documentsService.create({
      employeeId: body.employeeId || 'emp-8',
      title: body.title || file.originalname,
      category: (body.category as any) || 'Other',
      fileUrl: `http://localhost:4000/uploads/documents/${file.filename}`,
      fileSize: fileSizeFormatted,
      expiryDate: body.expiryDate,
    });
  }

  @Put(':id/verify')
  @ApiOperation({ summary: 'Verify or reject uploaded document' })
  verify(
    @Param('id') id: string,
    @Body() body: { status: 'Verified' | 'Rejected'; verifiedBy?: string },
  ) {
    return this.documentsService.verify(id, body.status, body.verifiedBy);
  }
}
