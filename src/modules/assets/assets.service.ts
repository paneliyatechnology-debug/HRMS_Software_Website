import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CompanyAsset, AssetStatus } from '../../common/types.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { AssignAssetDto } from './dto/assign-asset.dto.js';
import { ReturnAssetDto } from './dto/return-asset.dto.js';

@Injectable()
export class AssetsService {
  constructor(private readonly db: DatabaseService) {}

  findAll(category?: string) {
    let list = this.db.assets;
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

  create(data: CreateAssetDto): CompanyAsset {
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
    };

    this.db.assets.unshift(newAsset);
    this.db.persist();
    return newAsset;
  }

  assign(assetId: string, dto: AssignAssetDto) {
    const asset = this.db.assets.find((a) => a.id === assetId);
    if (!asset) throw new NotFoundException('Asset not found');

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

    const realUserId = user.id;
    const empName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    const actorName = dto.actorName || 'IT Admin';
    asset.assignedToEmployeeId = realUserId;
    (asset as any).assignedToUserId = realUserId;
    asset.assignedToEmployeeName = empName;
    asset.assignedDate = new Date().toISOString().split('T')[0];
    asset.status = AssetStatus.ASSIGNED;

    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'ASSET_ASSIGNED',
      'Asset Management',
      `Assigned asset ${asset.name} (${asset.assetCode}) to ${empName}`,
      asset.id,
    );

    this.db.persist();
    return asset;
  }

  returnAsset(assetId: string, dto: ReturnAssetDto) {
    const asset = this.db.assets.find((a) => a.id === assetId);
    if (!asset) throw new NotFoundException('Asset not found');

    const actorName = dto.actorName || 'IT Admin';
    const previousEmpName = asset.assignedToEmployeeName || 'Employee';
    asset.assignedToEmployeeId = undefined;
    asset.assignedToEmployeeName = undefined;
    asset.assignedDate = undefined;
    asset.status = AssetStatus.AVAILABLE;
    if (dto.condition) asset.condition = dto.condition;

    this.db.logAudit(
      'sys',
      actorName,
      'ADMIN',
      'ASSET_RETURNED',
      'Asset Management',
      `Returned asset ${asset.name} from ${previousEmpName}`,
      asset.id,
    );

    this.db.persist();
    return asset;
  }
}
