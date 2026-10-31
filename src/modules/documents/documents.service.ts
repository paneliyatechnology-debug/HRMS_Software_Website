import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { EmployeeDocument, Role, User } from '../../common/types.js';
import { CreateDocumentMetadataDto } from './dto/create-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(employeeId?: string, actorUser?: User, companyFilter?: string) {
    let list = [...this.db.documents];

    // Tenant isolation
    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter((d) => d.employeeId === actorUser.id || (d as any).userId === actorUser.id);
      } else if (actorUser.role === Role.ADMIN) {
        if (actorUser.companyId) {
          list = list.filter((d) => !d.companyId || d.companyId === actorUser.companyId);
        }
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter(
          (d) =>
            !d.companyId ||
            d.companyId === companyFilter ||
            (d.companyCode && d.companyCode.toLowerCase() === companyFilter.toLowerCase()),
        );
      }
    }

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
      list = list.filter((d) => d.employeeId === targetId || (d as any).userId === targetId || d.employeeId === employeeId);
    }

    return list.map((d) => {
      const { employeeId: _, id: docId, ...rest } = d;
      const resObj: any = { id: docId, userId: (d as any).userId || d.employeeId, ...rest };
      Object.defineProperty(resObj, 'employeeId', { value: resObj.userId, enumerable: false, configurable: true, writable: true });
      return resObj;
    });
  }

  create(data: Partial<CreateDocumentMetadataDto>, actorUser?: User): EmployeeDocument {
    const targetId = (data as any).userId || data.employeeId;
    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );
    const realUserId = user ? user.id : (actorUser?.id || this.db.users[0]?.id || 'user-default');
    const empName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : (actorUser ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() : 'Employee');

    const companyId = user?.companyId || actorUser?.companyId || null;
    const companyCode = user?.companyCode || actorUser?.companyCode || null;

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
      companyId,
      companyCode,
    };
    (newDoc as any).userId = realUserId;

    this.db.documents.unshift(newDoc);
    this.db.persist();

    const { employeeId: _, id: docId, ...rest } = newDoc;
    const resObj: any = { id: docId, userId: realUserId, ...rest };
    Object.defineProperty(resObj, 'employeeId', { value: realUserId, enumerable: false, configurable: true, writable: true });
    return resObj;
  }

  verify(id: string, dto: VerifyDocumentDto, actorUser?: User) {
    const doc = this.db.documents.find((d) => d.id === id);
    if (!doc) throw new NotFoundException('Document not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (doc.companyId && doc.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot verify document belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot verify documents.');
    }

    const verifiedBy = dto.verifiedBy || (actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'HR Admin');
    doc.verificationStatus = dto.status;
    doc.verifiedBy = verifiedBy;

    this.db.logAudit(
      actorUser?.id || 'sys',
      verifiedBy,
      actorUser?.role || 'ADMIN',
      'DOCUMENT_VERIFIED',
      'Document Management',
      `Document "${doc.title}" for ${doc.employeeName} marked as ${dto.status}`,
      doc.id,
    );

    this.db.persist();
    return doc;
  }
}
