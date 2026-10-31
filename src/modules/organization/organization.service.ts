import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Department, Designation, Location } from '../../common/types.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  getDepartments(): Department[] {
    return this.db.departments.map((dept) => {
      const count = this.db.users.filter((u) => u.role === 'EMPLOYEE' && u.departmentId === dept.id).length;
      return { ...dept, employeeCount: count };
    });
  }

  createDepartment(data: CreateDepartmentDto): Department {
    const user = data.headEmployeeId
      ? this.db.users.find((u) => u.id === data.headEmployeeId || u.employeeId === data.headEmployeeId)
      : null;
    const realHeadId = user ? user.id : data.headEmployeeId;
    const realHeadName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : data.headName;

    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: data.name || 'New Department',
      code: data.code || 'DEPT',
      headEmployeeId: realHeadId,
      headName: realHeadName,
      employeeCount: 0,
      description: data.description,
      createdAt: new Date().toISOString(),
    };
    this.db.departments.push(newDept);
    this.db.persist();
    return newDept;
  }

  updateDepartment(id: string, data: UpdateDepartmentDto): Department {
    const idx = this.db.departments.findIndex((d) => d.id === id);
    if (idx === -1) throw new NotFoundException('Department not found');
    this.db.departments[idx] = { ...this.db.departments[idx], ...(data as any) };
    this.db.persist();
    return this.db.departments[idx];
  }

  getDesignations(): Designation[] {
    return this.db.designations;
  }

  createDesignation(data: CreateDesignationDto): Designation {
    const dept = this.db.departments.find((d) => d.id === data.departmentId);
    const newDes: Designation = {
      id: `des-${Date.now()}`,
      title: data.title || 'New Title',
      departmentId: data.departmentId || 'dept-1',
      departmentName: dept?.name || 'Engineering',
      minSalary: data.minSalary || 60000,
      maxSalary: data.maxSalary || 90000,
      createdAt: new Date().toISOString(),
    };
    this.db.designations.push(newDes);
    this.db.persist();
    return newDes;
  }

  getLocations(): Location[] {
    return this.db.locations;
  }

  getHierarchy() {
    const company = {
      id: 'org-root',
      name: 'Paneliya Technology Inc.',
      title: 'Global Enterprise Organization',
      head: 'John Deo (VP of Engineering & Interim CEO)',
      departments: this.db.departments.map((dept) => {
        const managers = this.db.employees.filter(
          (e) =>
            e.departmentId === dept.id &&
            (e.designationTitle.includes('Head') ||
              e.designationTitle.includes('Director') ||
              e.designationTitle.includes('Lead') ||
              e.designationTitle.includes('VP') ||
              e.designationTitle.includes('Controller')),
        );
        const members = this.db.employees.filter((e) => e.departmentId === dept.id);
        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          headName: dept.headName,
          headEmployeeId: dept.headEmployeeId,
          totalHeadcount: members.length,
          managers: managers.map((m) => ({
            id: m.id,
            name: `${m.firstName} ${m.lastName}`,
            title: m.designationTitle,
            avatarUrl: m.avatarUrl,
            reports: members
              .filter((e) => e.reportingManagerId === m.id)
              .map((r) => ({
                id: r.id,
                name: `${r.firstName} ${r.lastName}`,
                title: r.designationTitle,
                avatarUrl: r.avatarUrl,
              })),
          })),
        };
      }),
    };

    return company;
  }
}
