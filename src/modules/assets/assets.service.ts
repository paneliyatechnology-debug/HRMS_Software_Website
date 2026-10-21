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
    if (category && category !== 'ALL') {
      return this.db.assets.filter((a) => a.category === category);
    }
    return this.db.assets;
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
    const employee = this.db.employees.find((e) => e.id === dto.employeeId);
    if (!employee) throw new NotFoundException('Employee not found');

    const actorName = dto.actorName || 'IT Admin';
    asset.assignedToEmployeeId = employee.id;
    asset.assignedToEmployeeName = `${employee.firstName} ${employee.lastName}`;
    asset.assignedDate = new Date().toISOString().split('T')[0];
    asset.status = AssetStatus.ASSIGNED;

    this.db.logAudit(
      'sys',
      actorName,
      'HR_ADMIN',
      'ASSET_ASSIGNED',
      'Asset Management',
      `Assigned asset ${asset.name} (${asset.assetCode}) to ${employee.firstName} ${employee.lastName}`,
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
      'HR_ADMIN',
      'ASSET_RETURNED',
      'Asset Management',
      `Returned asset ${asset.name} from ${previousEmpName}`,
      asset.id,
    );

    this.db.persist();
    return asset;
  }
}
