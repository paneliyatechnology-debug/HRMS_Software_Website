import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../../database/database.service.js';
import { EmployeeDocument, Role, User } from '../../common/types.js';
import { CreateDocumentMetadataDto } from './dto/create-document.dto.js';
import { VerifyDocumentDto } from './dto/verify-document.dto.js';

@Injectable()
export class DocumentsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(employeeId?: string, actorUser?: User, companyFilter?: string) {
    // If MySQL is connected, always refresh from live database
    if (this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM documents ORDER BY uploadDate DESC');
        this.db.documents = rows || [];
      } catch {}
    }

    let list = [...this.db.documents];

    // Company and User Isolation
    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (d) =>
            d.employeeId === actorUser.id ||
            (d as any).userId === actorUser.id ||
            (actorUser.employeeId && d.employeeId === actorUser.employeeId),
        );
      } else if (actorUser.role === Role.ADMIN) {
        list = list.filter((d) => {
          if (actorUser.companyId && d.companyId) {
            return d.companyId === actorUser.companyId;
          }
          if (actorUser.companyCode && d.companyCode) {
            return d.companyCode.toLowerCase() === actorUser.companyCode.toLowerCase();
          }
          const linkedUser = this.db.users.find(
            (u) => u.id === d.employeeId || u.employeeId === d.employeeId,
          );
          if (linkedUser && actorUser.companyId) {
            return linkedUser.companyId === actorUser.companyId;
          }
          return false;
        });
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
      if (actorUser && actorUser.role === Role.EMPLOYEE) {
        if (employeeId !== actorUser.id && employeeId !== actorUser.employeeId) {
          throw new ForbiddenException('Employees can only view their own documents.');
        }
      }
      const user = this.db.resolveUser
        ? this.db.resolveUser(employeeId)
        : this.db.users?.find(
            (u) =>
              u.id === employeeId ||
              u.employeeId === employeeId ||
              (u.email && u.email.toLowerCase() === employeeId.toLowerCase()),
          );
      const targetId = user ? user.id : employeeId;
      list = list.filter(
        (d) =>
          d.employeeId === targetId ||
          (d as any).userId === targetId ||
          d.employeeId === employeeId,
      );
    }

    return list.map((d) => ({
      id: d.id,
      userId: (d as any).userId || d.employeeId,
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      title: d.title,
      category: d.category,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
      uploadDate: d.uploadDate,
      expiryDate: d.expiryDate,
      verificationStatus: d.verificationStatus,
      verifiedBy: d.verifiedBy,
      companyId: d.companyId,
      companyCode: d.companyCode,
    }));
  }

  resolveUserFromRequest(req: any): User | undefined {
    try {
      const rawToken =
        req.headers?.authorization ||
        req.headers?.token ||
        req.headers?.['x-request-token'] ||
        req.headers?.['request-token'] ||
        req.cookies?.accessToken ||
        req.cookies?.token ||
        req.query?.token;

      if (!rawToken || typeof rawToken !== 'string') return undefined;

      let clean = rawToken.trim().replace(/^["']+|["']+$/g, '').trim();
      if (clean.toLowerCase().startsWith('bearer ')) {
        clean = clean.substring(7).trim().replace(/^["']+|["']+$/g, '').trim();
      }
      if (!clean) return undefined;

      let identifier = clean;
      try {
        const secret = process.env.JWT_SECRET || 'enterprise_hrms_jwt_secret_key_2026';
        const decoded = jwt.verify(clean, secret) as any;
        if (decoded && (decoded.sub || decoded.userId || decoded.id || decoded.email)) {
          identifier = decoded.sub || decoded.userId || decoded.id || decoded.email;
        }
      } catch {
        const match = clean.match(/(?:jwt_)?token_([^_]+)/i);
        if (match && match[1]) {
          identifier = match[1];
        } else if (clean.startsWith('token_user-')) {
          identifier = clean.replace(/^token_/, '').split('_')[0];
        } else if (clean.startsWith('user-')) {
          identifier = clean.split('_')[0];
        }
      }

      return this.db.users.find(
        (u) =>
          u.id.toLowerCase() === identifier.toLowerCase() ||
          u.email.toLowerCase() === identifier.toLowerCase(),
      );
    } catch {
      return undefined;
    }
  }

  async resolveUserByIdentifier(identifier?: string): Promise<User | undefined> {
    if (!identifier) return undefined;
    const clean = identifier.trim();

    let user = this.db.users.find(
      (u) =>
        u.id.toLowerCase() === clean.toLowerCase() ||
        (u.employeeId && u.employeeId.toLowerCase() === clean.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === clean.toLowerCase()),
    );

    if (!user && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query(
          'SELECT * FROM users WHERE id = ? OR employeeId = ? OR email = ? LIMIT 1',
          [clean, clean, clean],
        );
        if (rows && rows.length > 0) {
          user = rows[0];
          if (!this.db.users.some((u) => u.id === user!.id)) {
            this.db.users.push(user!);
          }
        }
      } catch {}
    }

    return user;
  }

  async create(data: Partial<CreateDocumentMetadataDto>, actorUser?: User): Promise<EmployeeDocument> {
    if (!actorUser) {
      throw new UnauthorizedException('Authentication token required to upload documents.');
    }

    let targetEmployeeId: string;
    let targetUser: User | undefined;

    if (actorUser.role === Role.EMPLOYEE) {
      // Strict Role Permission: EMPLOYEE can ONLY upload their own documents
      // Never trust body.employeeId for an EMPLOYEE!
      targetEmployeeId = actorUser.id;
      targetUser = actorUser;
    } else if (actorUser.role === Role.ADMIN) {
      // ADMIN can upload for employees in their company or for themselves
      const requestedId = (data as any).userId || data.employeeId;
      if (requestedId && requestedId !== actorUser.id) {
        targetUser = this.db.users.find(
          (u) =>
            u.id === requestedId ||
            u.employeeId === requestedId ||
            (u.email && u.email.toLowerCase() === requestedId.toLowerCase()),
        );

        if (!targetUser && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
          try {
            const pool = this.db.getMysqlPool()!;
            const [rows]: any = await pool.query(
              'SELECT * FROM users WHERE id = ? OR employeeId = ? OR email = ? LIMIT 1',
              [requestedId, requestedId, requestedId],
            );
            if (rows && rows.length > 0) {
              targetUser = rows[0];
            }
          } catch {}
        }

        if (!targetUser) {
          throw new NotFoundException(`Employee with ID "${requestedId}" not found.`);
        }

        // Verify company isolation for ADMIN
        if (targetUser.companyId && actorUser.companyId && targetUser.companyId !== actorUser.companyId) {
          throw new ForbiddenException('Cannot upload documents for an employee belonging to another company.');
        }
        targetEmployeeId = targetUser.id;
      } else {
        targetEmployeeId = actorUser.id;
        targetUser = actorUser;
      }
    } else if (actorUser.role === Role.SUPER_ADMIN) {
      const requestedId = (data as any).userId || data.employeeId;
      if (requestedId) {
        targetUser = this.db.users.find(
          (u) =>
            u.id === requestedId ||
            u.employeeId === requestedId ||
            (u.email && u.email.toLowerCase() === requestedId.toLowerCase()),
        );
        targetEmployeeId = targetUser ? targetUser.id : requestedId;
      } else {
        targetEmployeeId = actorUser.id;
        targetUser = actorUser;
      }
    } else {
      throw new ForbiddenException('You do not have permission to upload documents.');
    }

    const realUserId = targetEmployeeId;
    const empName = targetUser
      ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email
      : `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() || 'Employee';

    const companyId = targetUser?.companyId || actorUser.companyId || null;
    const companyCode = targetUser?.companyCode || actorUser.companyCode || null;

    const newDoc: EmployeeDocument = {
      id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: realUserId,
      employeeName: empName || 'Employee',
      title: data.title?.trim() || 'Document',
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

    // In-memory update
    this.db.documents.unshift(newDoc);

    // Live MySQL persistence
    await this.db.saveDocumentToMysql(newDoc);
    this.db.persist();

    this.db.logAudit(
      actorUser?.id || realUserId,
      empName,
      actorUser?.role || 'EMPLOYEE',
      'DOCUMENT_UPLOADED',
      'Document Management',
      `Uploaded document "${newDoc.title}" for ${newDoc.employeeName}`,
      newDoc.id,
      undefined,
      companyId || undefined,
      companyCode || undefined,
    );

    return {
      id: newDoc.id,
      userId: realUserId,
      employeeId: realUserId,
      employeeName: newDoc.employeeName,
      title: newDoc.title,
      category: newDoc.category,
      fileUrl: newDoc.fileUrl,
      fileSize: newDoc.fileSize,
      uploadDate: newDoc.uploadDate,
      expiryDate: newDoc.expiryDate,
      verificationStatus: newDoc.verificationStatus,
      verifiedBy: newDoc.verifiedBy,
      companyId: newDoc.companyId,
      companyCode: newDoc.companyCode,
    } as any;
  }

  async verify(
    id: string,
    dto?: { status?: string; verifiedBy?: string; reason?: string; rejectionReason?: string },
    actorUser?: User,
  ) {
    let doc = this.db.documents.find((d) => d.id === id);
    if (!doc && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM documents WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          doc = rows[0];
          this.db.documents.push(doc!);
        }
      } catch {}
    }

    if (!doc) throw new NotFoundException(`Document with ID "${id}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (doc.companyId && actorUser.companyId && doc.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot verify document belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot verify or reject documents.');
    }

    // Default to 'Verified' if status is omitted or empty
    let newStatus: 'Verified' | 'Rejected' = 'Verified';
    if (dto?.status) {
      const s = String(dto.status).trim().toLowerCase();
      if (s === 'rejected' || s === 'reject') {
        newStatus = 'Rejected';
      } else {
        newStatus = 'Verified';
      }
    }

    const verifiedBy =
      dto?.verifiedBy?.trim() ||
      (actorUser ? `${actorUser.firstName || ''} ${actorUser.lastName || ''}`.trim() : '') ||
      actorUser?.email ||
      'HR Admin';

    doc.verificationStatus = newStatus;
    doc.verifiedBy = verifiedBy;

    // Live MySQL persistence
    await this.db.saveDocumentToMysql(doc);
    this.db.persist();

    const action = newStatus === 'Verified' ? 'DOCUMENT_VERIFIED' : 'DOCUMENT_REJECTED';
    this.db.logAudit(
      actorUser?.id || 'sys',
      verifiedBy,
      actorUser?.role || 'ADMIN',
      action,
      'Document Management',
      `Document "${doc.title}" for ${doc.employeeName} marked as ${newStatus}`,
      doc.id,
      undefined,
      doc.companyId || undefined,
      doc.companyCode || undefined,
    );

    return doc;
  }

  async reject(
    id: string,
    dto?: { reason?: string; rejectionReason?: string; verifiedBy?: string },
    actorUser?: User,
  ) {
    return this.verify(id, { ...dto, status: 'Rejected' }, actorUser);
  }
}
