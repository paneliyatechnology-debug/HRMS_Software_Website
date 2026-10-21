import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EmployeeDocument } from '../common/types.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(employeeId?: string) {
    if (employeeId) {
      return this.db.documents.filter((d) => d.employeeId === employeeId);
    }
    return this.db.documents;
  }

  create(data: Partial<EmployeeDocument>): EmployeeDocument {
    const employee = this.db.employees.find((e) => e.id === data.employeeId);
    const newDoc: EmployeeDocument = {
      id: `doc-${Date.now()}`,
      employeeId: data.employeeId || 'emp-8',
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Employee',
      title: data.title || 'Document',
      category: data.category || 'Other',
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

  verify(id: string, status: 'Verified' | 'Rejected', verifiedBy = 'HR Admin') {
    const doc = this.db.documents.find((d) => d.id === id);
    if (!doc) throw new NotFoundException('Document not found');

    doc.verificationStatus = status;
    doc.verifiedBy = verifiedBy;

    this.db.logAudit(
      'sys',
      verifiedBy,
      'HR_ADMIN',
      'DOCUMENT_VERIFIED',
      'Document Management',
      `Document "${doc.title}" for ${doc.employeeName} marked as ${status}`,
      doc.id
    );

    this.db.persist();
    return doc;
  }
}
