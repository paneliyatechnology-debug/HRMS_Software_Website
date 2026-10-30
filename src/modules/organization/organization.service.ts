import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Department, Designation, Location, User, isSuperAdminUser } from '../../common/types.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  private companyScope(actor?: User): string | null {
    if (!actor || isSuperAdminUser(actor)) return null;
    return actor.companyId || null;
  }

  getDepartments(actor?: User): Department[] {
    const companyId = this.companyScope(actor);
    const source = companyId
      ? this.db.departments.filter((dept) => dept.companyId === companyId)
      : this.db.departments;
    return source.map((dept) => {
      const count = this.db.employees.filter(
        (e) => e.departmentId === dept.id && (!companyId || e.companyId === companyId),
      ).length;
      return { ...dept, employeeCount: count };
    });
  }

  createDepartment(data: CreateDepartmentDto, actor?: User): Department {
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: data.name || 'New Department',
      code: data.code || 'DEPT',
      headEmployeeId: data.headEmployeeId,
      headName: data.headName,
      employeeCount: 0,
      description: data.description,
      createdAt: new Date().toISOString(),
      companyId: actor?.companyId || this.db.companies[0]?.id,
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

  getDesignations(actor?: User): Designation[] {
    const companyId = this.companyScope(actor);
    if (!companyId) return this.db.designations;
    return this.db.designations.filter((item) => item.companyId === companyId);
  }

  createDesignation(data: CreateDesignationDto, actor?: User): Designation {
    const dept = this.db.departments.find((d) => d.id === data.departmentId);
    const newDes: Designation = {
      id: `des-${Date.now()}`,
      title: data.title || 'New Title',
      departmentId: data.departmentId || 'dept-1',
      departmentName: dept?.name || 'Engineering',
      minSalary: data.minSalary || 60000,
      maxSalary: data.maxSalary || 90000,
      createdAt: new Date().toISOString(),
      companyId: actor?.companyId || this.db.companies[0]?.id,
    };
    this.db.designations.push(newDes);
    this.db.persist();
    return newDes;
  }

  getLocations(actor?: User): Location[] {
    const companyId = this.companyScope(actor);
    if (!companyId) return this.db.locations;
    return this.db.locations.filter((item) => item.companyId === companyId);
  }

  getHierarchy(actor?: User) {
    const departments = this.getDepartments(actor);
    const companyId = this.companyScope(actor);
    const companyRecord = companyId
      ? this.db.companies.find((c) => c.id === companyId)
      : this.db.companies[0];
    const inCompany = (employeeIdCompany?: string) => !companyId || employeeIdCompany === companyId;
    const company = {
      id: companyRecord?.id || 'org-root',
      name: companyRecord?.companyName || 'Organization',
      title: 'Organization',
      head: companyRecord?.companyName || 'Company',
      departments: departments.map((dept) => {
        const managers = this.db.employees.filter(
          (e) =>
            inCompany(e.companyId) &&
            e.departmentId === dept.id &&
            (e.designationTitle.includes('Head') ||
              e.designationTitle.includes('Director') ||
              e.designationTitle.includes('Lead') ||
              e.designationTitle.includes('VP') ||
              e.designationTitle.includes('Controller')),
        );
        const members = this.db.employees.filter((e) => inCompany(e.companyId) && e.departmentId === dept.id);
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
