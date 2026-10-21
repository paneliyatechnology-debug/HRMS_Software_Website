import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Department, Designation, Location } from '../common/types.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  getDepartments(): Department[] {
    // dynamically recalculate employee count
    return this.db.departments.map((dept) => {
      const count = this.db.employees.filter((e) => e.departmentId === dept.id).length;
      return { ...dept, employeeCount: count };
    });
  }

  createDepartment(data: Partial<Department>): Department {
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: data.name || 'New Department',
      code: data.code || 'DEPT',
      headEmployeeId: data.headEmployeeId,
      headName: data.headName,
      employeeCount: 0,
      description: data.description,
      createdAt: new Date().toISOString(),
    };
    this.db.departments.push(newDept);
    this.db.persist();
    return newDept;
  }

  updateDepartment(id: string, data: Partial<Department>): Department {
    const idx = this.db.departments.findIndex((d) => d.id === id);
    if (idx === -1) throw new NotFoundException('Department not found');
    this.db.departments[idx] = { ...this.db.departments[idx], ...data };
    this.db.persist();
    return this.db.departments[idx];
  }

  getDesignations(): Designation[] {
    return this.db.designations;
  }

  createDesignation(data: Partial<Designation>): Designation {
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
    // Org Chart structure: VP / Leadership -> Departments -> Managers -> Individual Contributors
    const company = {
      id: 'org-root',
      name: 'Paneliya Technology Inc.',
      title: 'Global Enterprise Organization',
      head: 'John Deo (VP of Engineering & Interim CEO)',
      departments: this.db.departments.map((dept) => {
        const managers = this.db.employees.filter(
          (e) => e.departmentId === dept.id && (e.designationTitle.includes('Head') || e.designationTitle.includes('Director') || e.designationTitle.includes('Lead') || e.designationTitle.includes('VP') || e.designationTitle.includes('Controller'))
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
