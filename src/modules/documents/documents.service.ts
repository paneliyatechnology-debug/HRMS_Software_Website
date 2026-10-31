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
      const user = this.db.resolveUser
        ? this.db.resolveUser(employeeId)
        : this.db.users?.find(
            (u) =>
              u.id === employeeId ||
              u.employeeId === employeeId ||
              (u.email && u.email.toLowerCase() === employeeId.toLowerCase()),
          );
      const targetId = user ? user.id : employeeId;
      const list = this.db.documents.filter((d) => d.employeeId === targetId || (d as any).userId === targetId || d.employeeId === employeeId);
      return list.map((d) => {
        const { employeeId: _, id: docId, ...rest } = d;
        const resObj: any = { id: docId, userId: (d as any).userId || d.employeeId, ...rest };
        Object.defineProperty(resObj, 'employeeId', { value: resObj.userId, enumerable: false, configurable: true, writable: true });
        return resObj;
      });
    }
    return this.db.documents.map((d) => {
      const { employeeId: _, id: docId, ...rest } = d;
      const resObj: any = { id: docId, userId: (d as any).userId || d.employeeId, ...rest };
      Object.defineProperty(resObj, 'employeeId', { value: resObj.userId, enumerable: false, configurable: true, writable: true });
      return resObj;
    });
  }

  create(data: Partial<CreateDocumentMetadataDto>): EmployeeDocument {
    const targetId = (data as any).userId || data.employeeId;
    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );
    const realUserId = user ? user.id : (this.db.users[0]?.id || 'user-default');
    const empName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : 'Employee';

    const newDoc: EmployeeDocument = {
      id: `doc-${Date.now()}`,
      employeeId: realUserId,
      employeeName: empName || 'Employee',
      title: data.title || 'Document',
      category: (data.category as any) || 'Other',
      fileUrl: data.fileUrl || '/docs/sample.pdf',
      fileSize: data.fileSize || '1.2 MB',
      uploadDate: new Date().toISOString().split('T')[0],
      expiryDate: data.expiryDate,
      verificationStatus: 'Pending',
    };
    (newDoc as any).userId = realUserId;

    this.db.documents.unshift(newDoc);
    this.db.persist();

    const { employeeId: _, id: docId, ...rest } = newDoc;
    const resObj: any = { id: docId, userId: realUserId, ...rest };
    Object.defineProperty(resObj, 'employeeId', { value: realUserId, enumerable: false, configurable: true, writable: true });
    return resObj;
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
