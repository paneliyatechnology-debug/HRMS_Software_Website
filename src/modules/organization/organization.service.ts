import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Department, Designation, Location, Role, User } from '../../common/types.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { UpdateDepartmentDto } from './dto/update-department.dto.js';
import { CreateDesignationDto } from './dto/create-designation.dto.js';
import { UpdateDesignationDto } from './dto/update-designation.dto.js';
import { AddDesignationMemberDto } from './dto/add-designation-member.dto.js';
import { UpdateDesignationMemberDto } from './dto/update-designation-member.dto.js';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  async getDepartments(actorUser?: User, companyFilter?: string): Promise<Department[]> {
    // 1. Refresh live from MySQL if connected
    if (this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM departments ORDER BY createdAt DESC');
        if (rows) {
          this.db.departments = rows;
        }
      } catch {}
    }

    let list = [...this.db.departments];

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

  async createDepartment(data: CreateDepartmentDto, actorUser?: User): Promise<Department> {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create departments.');
    }

    const name = (data.name || '').trim();
    if (!name) {
      throw new BadRequestException('Department name is required.');
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
      name: name,
      code: (data.code || 'DEPT').trim().toUpperCase(),
      headEmployeeId: realHeadId || undefined,
      headName: realHeadName || undefined,
      employeeCount: 0,
      description: data.description || '',
      companyId,
      companyCode,
      createdAt: new Date().toISOString(),
    };

    this.db.departments.unshift(newDept);
    await this.db.saveDepartmentToMysql(newDept);
    this.db.persist();

    return newDept;
  }

  async updateDepartment(id: string, data: UpdateDepartmentDto, actorUser?: User): Promise<Department> {
    let dept = this.db.departments.find((d) => d.id === id);
    if (!dept && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM departments WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          dept = rows[0];
          this.db.departments.push(dept!);
        }
      } catch {}
    }

    if (!dept) throw new NotFoundException(`Department with ID "${id}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (dept.companyId && actorUser.companyId && dept.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify department belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update departments.');
    }

    if (data.name !== undefined) dept.name = data.name.trim();
    if (data.code !== undefined) dept.code = data.code.trim().toUpperCase();
    if (data.description !== undefined) dept.description = data.description;
    if (data.headEmployeeId !== undefined) {
      const user = this.db.users.find((u) => u.id === data.headEmployeeId || u.employeeId === data.headEmployeeId);
      dept.headEmployeeId = user ? user.id : data.headEmployeeId;
      dept.headName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : data.headName;
    } else if (data.headName !== undefined) {
      dept.headName = data.headName;
    }

    await this.db.saveDepartmentToMysql(dept);
    this.db.persist();

    return dept;
  }

  async deleteDepartment(id: string, actorUser?: User): Promise<{ success: boolean; message: string }> {
    let dept = this.db.departments.find((d) => d.id === id);
    if (!dept && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM departments WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          dept = rows[0];
        }
      } catch {}
    }

    if (!dept) throw new NotFoundException(`Department with ID "${id}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (dept.companyId && actorUser.companyId && dept.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot delete department belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot delete departments.');
    }

    this.db.departments = this.db.departments.filter((d) => d.id !== id);
    await this.db.deleteDepartmentFromMysql(id);
    this.db.persist();

    return { success: true, message: `Department "${dept.name}" deleted successfully.` };
  }

  async getDesignations(actorUser?: User, companyFilter?: string): Promise<Designation[]> {
    // 1. Refresh live from MySQL if connected
    if (this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations ORDER BY createdAt DESC');
        if (rows) {
          this.db.designations = rows.map((r: any) => ({
            ...r,
            minSalary: Number(r.minSalary) || 0,
            maxSalary: Number(r.maxSalary) || 0,
          }));
        }
      } catch {}
    }

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

  async createDesignation(data: CreateDesignationDto, actorUser?: User): Promise<Designation> {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to create designations.');
    }

    const title = (data.title || (data as any).name || (data as any).designation || '').trim();
    if (!title) {
      throw new BadRequestException('Designation title is required.');
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

    // Resolve department details
    const deptId = (data.departmentId || '').trim();
    const dept = deptId ? this.db.departments.find((d) => d.id === deptId) : null;
    const departmentName = (data.departmentName || (data as any).department || dept?.name || 'General').trim();

    const newDes: Designation = {
      id: `des-${Date.now()}`,
      title: title,
      departmentId: dept?.id || deptId || '',
      departmentName: departmentName,
      minSalary: Number(data.minSalary) || 0,
      maxSalary: Number(data.maxSalary) || 0,
      companyId,
      companyCode,
      createdAt: new Date().toISOString(),
    };

    // Save in memory
    this.db.designations.unshift(newDes);

    // Persist immediately to live MySQL
    await this.db.saveDesignationToMysql(newDes);
    this.db.persist();

    return newDes;
  }

  async updateDesignation(id: string, data: UpdateDesignationDto, actorUser?: User): Promise<Designation> {
    let des = this.db.designations.find((d) => d.id === id);
    if (!des && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          des = {
            ...rows[0],
            minSalary: Number(rows[0].minSalary) || 0,
            maxSalary: Number(rows[0].maxSalary) || 0,
          };
          this.db.designations.push(des!);
        }
      } catch {}
    }

    if (!des) throw new NotFoundException(`Designation with ID "${id}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (des.companyId && actorUser.companyId && des.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify designation belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot update designations.');
    }

    const title = (data.title || (data as any).name || (data as any).designation || '').trim();
    if (title) des.title = title;

    if (data.departmentId !== undefined) {
      des.departmentId = data.departmentId.trim();
      const dept = this.db.departments.find((d) => d.id === des!.departmentId);
      if (dept) des.departmentName = dept.name;
    }
    if (data.departmentName !== undefined) {
      des.departmentName = data.departmentName.trim();
    }
    if (data.minSalary !== undefined) {
      des.minSalary = Number(data.minSalary) || 0;
    }
    if (data.maxSalary !== undefined) {
      des.maxSalary = Number(data.maxSalary) || 0;
    }

    await this.db.saveDesignationToMysql(des);
    this.db.persist();

    return des;
  }

  async deleteDesignation(id: string, actorUser?: User): Promise<{ success: boolean; message: string }> {
    let des = this.db.designations.find((d) => d.id === id);
    if (!des && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations WHERE id = ? LIMIT 1', [id]);
        if (rows && rows.length > 0) {
          des = rows[0];
        }
      } catch {}
    }

    if (!des) throw new NotFoundException(`Designation with ID "${id}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (des.companyId && actorUser.companyId && des.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot delete designation belonging to another company.');
      }
    } else if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot delete designations.');
    }

    this.db.designations = this.db.designations.filter((d) => d.id !== id);
    await this.db.deleteDesignationFromMysql(id);
    this.db.persist();

    return { success: true, message: `Designation "${des.title}" deleted successfully.` };
  }

  // -----------------------------------------------------------------
  // DESIGNATION MEMBERSHIP MANAGEMENT (Add, List, Edit, Delete)
  // -----------------------------------------------------------------

  async getDesignationMembers(designationId: string, actorUser?: User) {
    let des = this.db.designations.find((d) => d.id === designationId);
    if (!des && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations WHERE id = ? LIMIT 1', [designationId]);
        if (rows && rows.length > 0) {
          des = rows[0];
          this.db.designations.push(des!);
        }
      } catch {}
    }
    if (!des) throw new NotFoundException(`Designation with ID "${designationId}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (des.companyId && actorUser.companyId && des.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot view members of a designation belonging to another company.');
      }
    }

    const targetCompanyId = actorUser?.role === Role.ADMIN ? actorUser.companyId : (des.companyId || undefined);

    const members = this.db.users.filter(
      (u) =>
        u.role === Role.EMPLOYEE &&
        (!targetCompanyId || u.companyId === targetCompanyId) &&
        (u.designationId === designationId ||
          (!u.designationId &&
            u.designationTitle &&
            des!.title &&
            u.designationTitle.trim().toLowerCase() === des!.title.trim().toLowerCase())),
    );

    return {
      designationId: des.id,
      designationTitle: des.title,
      departmentId: des.departmentId || '',
      departmentName: des.departmentName || '',
      companyId: des.companyId || null,
      companyCode: des.companyCode || null,
      totalMembers: members.length,
      members: members.map((m) => ({
        id: m.id,
        userId: m.id,
        employeeId: m.employeeId || m.id,
        employeeCode: m.employeeCode || '',
        firstName: m.firstName,
        lastName: m.lastName,
        fullName: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email,
        email: m.email,
        phone: m.phone || '',
        avatarUrl: m.avatarUrl || '',
        status: m.status || 'Active',
        departmentId: m.departmentId || '',
        departmentName: m.departmentName || '',
        designationId: des!.id,
        designationTitle: des!.title,
        joiningDate: m.joiningDate || '',
      })),
    };
  }

  async addDesignationMember(designationId: string, dto: AddDesignationMemberDto, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to assign members.');
    }

    let des = this.db.designations.find((d) => d.id === designationId);
    if (!des && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations WHERE id = ? LIMIT 1', [designationId]);
        if (rows && rows.length > 0) {
          des = rows[0];
          this.db.designations.push(des!);
        }
      } catch {}
    }
    if (!des) throw new NotFoundException(`Designation with ID "${designationId}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (des.companyId && actorUser.companyId && des.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot assign members to a designation belonging to another company.');
      }
    }

    const userIds: string[] = [];
    if (dto.userId) userIds.push(dto.userId.trim());
    if (dto.employeeId && !userIds.includes(dto.employeeId.trim())) userIds.push(dto.employeeId.trim());
    if (Array.isArray(dto.userIds)) {
      for (const uid of dto.userIds) {
        if (uid && typeof uid === 'string' && !userIds.includes(uid.trim())) {
          userIds.push(uid.trim());
        }
      }
    }

    if (userIds.length === 0) {
      throw new BadRequestException('At least one userId or employeeId is required.');
    }

    const targetCompanyId = actorUser?.role === Role.ADMIN ? actorUser.companyId : (des.companyId || undefined);
    const assignedUsers: any[] = [];

    for (const targetId of userIds) {
      let user = this.db.users.find(
        (u) => u.id === targetId || u.employeeId === targetId || (u as any).employeeCode === targetId,
      );

      if (!user && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
        try {
          const pool = this.db.getMysqlPool()!;
          const [rows]: any = await pool.query(
            'SELECT * FROM users WHERE id = ? OR employeeId = ? OR employeeCode = ? LIMIT 1',
            [targetId, targetId, targetId],
          );
          if (rows && rows.length > 0) {
            user = rows[0];
            this.db.users.push(user!);
          }
        } catch {}
      }

      if (!user) {
        throw new NotFoundException(`Employee/User with ID "${targetId}" not found.`);
      }

      if (targetCompanyId && user.companyId && user.companyId !== targetCompanyId) {
        throw new ForbiddenException(`Employee "${user.firstName} ${user.lastName}" belongs to a different company.`);
      }

      // Update designation fields
      user.designationId = des.id;
      user.designationTitle = des.title;

      // Also inherit department if user doesn't have one and designation does
      if (!user.departmentId && des.departmentId) {
        user.departmentId = des.departmentId;
        user.departmentName = des.departmentName;
      }

      // Update employee record
      const emp = this.db.employees.find((e) => e.userId === user!.id || e.id === user!.id);
      if (emp) {
        emp.designationId = des.id;
        emp.designationTitle = des.title;
        if (user.departmentId) {
          emp.departmentId = user.departmentId;
          emp.departmentName = user.departmentName || '';
        }
      }

      // Persist live to MySQL
      await this.db.saveUserToMysql(user);

      assignedUsers.push({
        id: user.id,
        userId: user.id,
        employeeId: user.employeeId || user.id,
        employeeCode: user.employeeCode || '',
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        designationId: des.id,
        designationTitle: des.title,
        departmentName: user.departmentName || des.departmentName || '',
      });
    }

    this.db.persist();

    return {
      success: true,
      message: `Successfully assigned ${assignedUsers.length} member(s) to designation "${des.title}".`,
      designation: {
        id: des.id,
        title: des.title,
      },
      assignedCount: assignedUsers.length,
      assignedMembers: assignedUsers,
    };
  }

  async updateDesignationMember(
    designationId: string,
    userId: string,
    dto: UpdateDesignationMemberDto,
    actorUser?: User,
  ) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to update member designations.');
    }

    let des = this.db.designations.find((d) => d.id === designationId);
    if (!des && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations WHERE id = ? LIMIT 1', [designationId]);
        if (rows && rows.length > 0) des = rows[0];
      } catch {}
    }
    if (!des) throw new NotFoundException(`Designation with ID "${designationId}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (des.companyId && actorUser.companyId && des.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot modify members of a designation belonging to another company.');
      }
    }

    const cleanUserId = userId.trim();
    const user = this.db.users.find(
      (u) => u.id === cleanUserId || u.employeeId === cleanUserId || (u as any).employeeCode === cleanUserId,
    );
    if (!user) throw new NotFoundException(`Employee/User with ID "${cleanUserId}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN && user.companyId && user.companyId !== actorUser.companyId) {
      throw new ForbiddenException('Cannot update employee belonging to another company.');
    }

    // If transferring to another designation
    if (dto.designationId && dto.designationId.trim() !== designationId) {
      const targetDesId = dto.designationId.trim();
      const newDes = this.db.designations.find((d) => d.id === targetDesId);
      if (!newDes) throw new NotFoundException(`Target Designation with ID "${targetDesId}" not found.`);
      if (actorUser && actorUser.role === Role.ADMIN && newDes.companyId && newDes.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot transfer employee to a designation belonging to another company.');
      }
      user.designationId = newDes.id;
      user.designationTitle = newDes.title;
      if (newDes.departmentId && !user.departmentId) {
        user.departmentId = newDes.departmentId;
        user.departmentName = newDes.departmentName;
      }
    }

    if (dto.departmentId) {
      const dept = this.db.departments.find((d) => d.id === dto.departmentId!.trim());
      user.departmentId = dto.departmentId.trim();
      if (dept) user.departmentName = dept.name;
    }

    if (dto.status) {
      user.status = dto.status.trim();
    }

    const emp = this.db.employees.find((e) => e.userId === user.id || e.id === user.id);
    if (emp) {
      emp.designationId = user.designationId || '';
      emp.designationTitle = user.designationTitle || '';
      if (user.departmentId) {
        emp.departmentId = user.departmentId;
        emp.departmentName = user.departmentName || '';
      }
      if (user.status) emp.status = user.status as any;
    }

    await this.db.saveUserToMysql(user);
    this.db.persist();

    return {
      success: true,
      message: `Employee "${user.firstName} ${user.lastName}" designation details updated successfully.`,
      member: {
        id: user.id,
        userId: user.id,
        employeeId: user.employeeId || user.id,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        designationId: user.designationId,
        designationTitle: user.designationTitle,
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        status: user.status,
      },
    };
  }

  async removeDesignationMember(designationId: string, userId: string, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees are not authorized to remove members.');
    }

    let des = this.db.designations.find((d) => d.id === designationId);
    if (!des && this.db.getMysqlPool() && this.db.isConnectedToMysql) {
      try {
        const pool = this.db.getMysqlPool()!;
        const [rows]: any = await pool.query('SELECT * FROM designations WHERE id = ? LIMIT 1', [designationId]);
        if (rows && rows.length > 0) des = rows[0];
      } catch {}
    }
    if (!des) throw new NotFoundException(`Designation with ID "${designationId}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN) {
      if (des.companyId && actorUser.companyId && des.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot remove members from a designation belonging to another company.');
      }
    }

    const cleanUserId = userId.trim();
    const user = this.db.users.find(
      (u) => u.id === cleanUserId || u.employeeId === cleanUserId || (u as any).employeeCode === cleanUserId,
    );
    if (!user) throw new NotFoundException(`Employee/User with ID "${cleanUserId}" not found.`);

    if (actorUser && actorUser.role === Role.ADMIN && user.companyId && user.companyId !== actorUser.companyId) {
      throw new ForbiddenException('Cannot remove employee belonging to another company.');
    }

    user.designationId = '';
    user.designationTitle = '';

    const emp = this.db.employees.find((e) => e.userId === user.id || e.id === user.id);
    if (emp) {
      emp.designationId = '';
      emp.designationTitle = '';
    }

    await this.db.saveUserToMysql(user);
    this.db.persist();

    return {
      success: true,
      message: `Employee "${user.firstName} ${user.lastName}" removed from designation "${des.title}" successfully.`,
    };
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
