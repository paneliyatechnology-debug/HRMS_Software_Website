import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CompanyAsset, AssetStatus, Role, User } from '../../common/types.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { AssignAssetDto } from './dto/assign-asset.dto.js';
import { ReturnAssetDto } from './dto/return-asset.dto.js';

@Injectable()
export class AssetsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(category?: string, actorUser?: User, companyFilter?: string) {
    let list = this.db.assets;

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        if (actorUser.companyId) {
          list = list.filter((a) => !a.companyId || a.companyId === actorUser.companyId);
        }
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter(
          (a) =>
            !a.companyId ||
            a.companyId === companyFilter ||
            (a.companyCode && a.companyCode.toLowerCase() === companyFilter.toLowerCase()),
        );
      }
    }

    if (category && category !== 'ALL') {
      list = list.filter((a) => a.category === category);
    }

    return list.map((a) => {
      const user = a.assignedToEmployeeId
        ? this.db.users.find((u) => u.id === a.assignedToEmployeeId || u.employeeId === a.assignedToEmployeeId)
        : null;
      const realUserId = user ? user.id : a.assignedToEmployeeId;
      return {
        ...a,
        assignedToEmployeeId: realUserId,
        assignedToUserId: realUserId,
      };
    });
  }

  create(data: CreateAssetDto, actorUser?: User): CompanyAsset {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to register assets.');
    }

    let companyId: string | null = null;
    let companyCode: string | null = null;

    if (actorUser && actorUser.role === Role.ADMIN) {
      companyId = actorUser.companyId || null;
      companyCode = actorUser.companyCode || null;
    } else if (actorUser && actorUser.role === Role.SUPER_ADMIN) {
      if ((data as any).companyId) {
        const comp = this.db.companies.find(
          (c) => c.id === (data as any).companyId || c.companyCode === (data as any).companyId,
        );
        companyId = comp?.id || (data as any).companyId;
        companyCode = comp?.companyCode || null;
      }
    }

    const nextNum = this.db.assets.length + 1;
    const newAsset: CompanyAsset = {
      id: `ast-${Date.now()}`,
      assetCode: data.assetCode || `AST-${String(nextNum).padStart(3, '0')}`,
      name: data.name || 'Company Asset',
      category: data.category || 'Laptop',
      serialNumber: data.serialNumber || `SN-${Date.now()}`,
      condition: data.condition || 'Excellent',
      status: AssetStatus.AVAILABLE,
      purchaseDate: data.purchaseDate || new Date().toISOString().split('T')[0],
      companyId,
      companyCode,
    };

    this.db.assets.unshift(newAsset);
    this.db.persist();
    return newAsset;
  }

  assign(assetId: string, dto: AssignAssetDto, actorUser?: User) {
    const asset = this.db.assets.find((a) => a.id === assetId);
    if (!asset) throw new NotFoundException('Asset not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (asset.companyId && asset.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot assign asset belonging to another company.');
      }
    }

    const targetId = (dto as any).userId || dto.employeeId;
    const user = this.db.resolveUser
      ? this.db.resolveUser(targetId)
      : this.db.users?.find(
          (u) =>
            u.id === targetId ||
            u.employeeId === targetId ||
            (u.email && u.email.toLowerCase() === targetId.toLowerCase()),
        );

    if (!user) throw new NotFoundException('User not found');
    if (actorUser && actorUser.role === Role.ADMIN && user.companyId && user.companyId !== actorUser.companyId) {
      throw new ForbiddenException('Cannot assign asset to employee of another company.');
    }

    const realUserId = user.id;
    const empName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    const actorName = dto.actorName || (actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'IT Admin');
    asset.assignedToEmployeeId = realUserId;
    (asset as any).assignedToUserId = realUserId;
    asset.assignedToEmployeeName = empName;
    asset.assignedDate = new Date().toISOString().split('T')[0];
    asset.status = AssetStatus.ASSIGNED;

    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'ADMIN',
      'ASSET_ASSIGNED',
      'Asset Management',
      `Assigned asset ${asset.name} (${asset.assetCode}) to ${empName}`,
      asset.id,
    );

    this.db.persist();
    return asset;
  }

  returnAsset(assetId: string, dto: ReturnAssetDto, actorUser?: User) {
    const asset = this.db.assets.find((a) => a.id === assetId);
    if (!asset) throw new NotFoundException('Asset not found');

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (asset.companyId && asset.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot return asset belonging to another company.');
      }
    }

    const actorName = dto.actorName || (actorUser ? `${actorUser.firstName} ${actorUser.lastName}` : 'IT Admin');
    const previousEmpName = asset.assignedToEmployeeName || 'Employee';
    asset.assignedToEmployeeId = undefined;
    asset.assignedToEmployeeName = undefined;
    asset.assignedDate = undefined;
    asset.status = AssetStatus.AVAILABLE;
    if (dto.condition) asset.condition = dto.condition;

    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      actorUser?.role || 'ADMIN',
      'ASSET_RETURNED',
      'Asset Management',
      `Returned asset ${asset.name} from ${previousEmpName}`,
      asset.id,
    );

    this.db.persist();
    return asset;
  }
}
