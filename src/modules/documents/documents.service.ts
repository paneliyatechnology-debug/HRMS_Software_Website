import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { EmployeeDocument } from '../../common/types.js';
import { CreateDocumentMetadataDto } from './dto/create-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(employeeId?: string) {
    if (employeeId) {
      return this.db.documents.filter((d) => d.employeeId === employeeId);
    }
    return this.db.documents;
  }

  create(data: Partial<CreateDocumentMetadataDto>): EmployeeDocument {
    const employee = this.db.employees.find((e) => e.id === data.employeeId);
    const newDoc: EmployeeDocument = {
      id: `doc-${Date.now()}`,
      employeeId: data.employeeId || 'emp-8',
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Employee',
      title: data.title || 'Document',
      category: (data.category as any) || 'Other',
      fileUrl: data.fileUrl || '/docs/sample.pdf',
      fileSize: data.fileSize || '1.2 MB',
      uploadDate: new Date().toISOString().split('T')[0],
      expiryDate: data.expiryDate,
      verificationStatus: 'Pending',
    };

    this.db.documents.unshift(newDoc);
    this.db.persist();
    return newDoc;
  }

  verify(id: string, dto: VerifyDocumentDto) {
    const doc = this.db.documents.find((d) => d.id === id);
    if (!doc) throw new NotFoundException('Document not found');

    const verifiedBy = dto.verifiedBy || 'HR Admin';
    doc.verificationStatus = dto.status;
    doc.verifiedBy = verifiedBy;

    this.db.logAudit(
      'sys',
      verifiedBy,
      'ADMIN',
      'DOCUMENT_VERIFIED',
      'Document Management',
      `Document "${doc.title}" for ${doc.employeeName} marked as ${dto.status}`,
      doc.id,
    );

    this.db.persist();
    return doc;
  }
}
