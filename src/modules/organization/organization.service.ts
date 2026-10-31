import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Department, Designation, Location, Role, User } from '../../common/types.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  getDepartments(actorUser?: User, companyFilter?: string): Department[] {
    let list = [...this.db.departments];

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        if (actorUser.companyId) {
          list = list.filter((d) => d.companyId === actorUser.companyId);
        }
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter(
          (d) =>
            d.companyId === companyFilter ||
            (d.companyCode && d.companyCode.toLowerCase() === companyFilter.toLowerCase()),
        );
      }
    }

    return list.map((dept) => {
      const count = this.db.users.filter(
        (u) =>
          u.role === 'EMPLOYEE' &&
          u.departmentId === dept.id &&
          (!dept.companyId || u.companyId === dept.companyId),
      ).length;
      return { ...dept, employeeCount: count };
    });
  }

  createDepartment(data: CreateDepartmentDto, actorUser?: User): Department {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create departments.');
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
      companyId,
      companyCode,
      createdAt: new Date().toISOString(),
    };
    this.db.departments.push(newDept);
    this.db.persist();
    return newDept;
  }

  updateDepartment(id: string, data: UpdateDepartmentDto, actorUser?: User): Department {
    const idx = this.db.departments.findIndex((d) => d.id === id);
    if (idx === -1) throw new NotFoundException('Department not found');

    const current = this.db.departments[idx];
    if (actorUser && actorUser.role === Role.ADMIN) {
      if (current.companyId && current.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify department belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update departments.');
    }

    this.db.departments[idx] = {
      ...current,
      ...(data as any),
      id: current.id,
      companyId: current.companyId,
      companyCode: current.companyCode,
    };
    this.db.persist();
    return this.db.departments[idx];
  }

  getDesignations(actorUser?: User, companyFilter?: string): Designation[] {
    let list = [...this.db.designations];

    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
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

    return list;
  }

  createDesignation(data: CreateDesignationDto, actorUser?: User): Designation {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create designations.');
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

    const dept = this.db.departments.find((d) => d.id === data.departmentId);
    const newDes: Designation = {
      id: `des-${Date.now()}`,
      title: data.title || 'New Title',
      departmentId: data.departmentId || 'dept-1',
      departmentName: dept?.name || 'Engineering',
      minSalary: data.minSalary || 60000,
      maxSalary: data.maxSalary || 90000,
      companyId,
      companyCode,
      createdAt: new Date().toISOString(),
    };
    this.db.designations.push(newDes);
    this.db.persist();
    return newDes;
  }

  getLocations(actorUser?: User, companyFilter?: string): Location[] {
    let list = [...this.db.locations];
    if (actorUser) {
      if (actorUser.role === Role.ADMIN || actorUser.role === Role.EMPLOYEE) {
        if (actorUser.companyId) {
          list = list.filter((l) => !l.companyId || l.companyId === actorUser.companyId);
        }
      } else if (actorUser.role === Role.SUPER_ADMIN && companyFilter) {
        list = list.filter((l) => !l.companyId || l.companyId === companyFilter);
      }
    }
    return list;
  }

  getHierarchy(actorUser?: User) {
    const targetCompanyId = actorUser?.companyId || (this.db.companies[0]?.id || 'cmp-1');
    const matchedCompany = this.db.companies.find((c) => c.id === targetCompanyId);
    const companyName = matchedCompany?.companyName || 'Paneliya Technology Inc.';

    const companyDepts = this.db.departments.filter(
      (d) => !d.companyId || d.companyId === targetCompanyId,
    );

    const company = {
      id: 'org-root',
      companyId: targetCompanyId,
      name: companyName,
      title: 'Global Enterprise Organization',
      head: 'Corporate Management',
      departments: companyDepts.map((dept) => {
        const managers = this.db.employees.filter(
          (e) =>
            e.companyId === targetCompanyId &&
            e.departmentId === dept.id &&
            (e.designationTitle.includes('Head') ||
              e.designationTitle.includes('Director') ||
              e.designationTitle.includes('Lead') ||
              e.designationTitle.includes('VP') ||
              e.designationTitle.includes('Controller')),
        );
        const members = this.db.employees.filter(
          (e) => e.companyId === targetCompanyId && e.departmentId === dept.id,
        );
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
