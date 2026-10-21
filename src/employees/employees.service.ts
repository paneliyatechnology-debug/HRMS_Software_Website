import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Employee, EmployeeStatus } from '../common/types.js';

@Injectable()
export class EmployeesService {
  constructor(private readonly db: DatabaseService) {}

  findAll(params?: {
    search?: string;
    departmentId?: string;
    status?: string;
    employmentType?: string;
  }) {
    let result = [...this.db.employees];

    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.employeeCode.toLowerCase().includes(q) ||
          e.designationTitle.toLowerCase().includes(q) ||
          e.departmentName.toLowerCase().includes(q) ||
          e.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (params?.departmentId && params.departmentId !== 'ALL') {
      result = result.filter((e) => e.departmentId === params.departmentId);
    }

    if (params?.status && params.status !== 'ALL') {
      result = result.filter((e) => e.status === params.status);
    }

    if (params?.employmentType && params.employmentType !== 'ALL') {
      result = result.filter((e) => e.employmentType === params.employmentType);
    }

    return result;
  }

  findOne(id: string) {
    const employee = this.db.employees.find((e) => e.id === id || e.employeeCode === id);
    if (!employee) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    // Tab aggregate details
    const attendance = this.db.attendanceRecords.filter((a) => a.employeeId === employee.id);
    const leaves = this.db.leaveRequests.filter((l) => l.employeeId === employee.id);
    const leaveBalance = this.db.leaveBalances.find((b) => b.employeeId === employee.id);
    const documents = this.db.documents.filter((d) => d.employeeId === employee.id);
    const assets = this.db.assets.filter((a) => a.assignedToEmployeeId === employee.id);
    const performance = this.db.performanceReviews.filter((p) => p.employeeId === employee.id);
    const trainings = this.db.employeeTrainings.filter((t) => t.employeeId === employee.id);
    const payrolls = this.db.payrollRecords.filter((p) => p.employeeId === employee.id);
    const auditLogs = this.db.auditLogs.filter((l) => l.recordId === employee.id || l.details.includes(employee.firstName));

    return {
      ...employee,
      tabsData: {
        attendance,
        leaves,
        leaveBalance,
        documents,
        assets,
        performance,
        trainings,
        payrolls,
        activity: auditLogs,
      },
    };
  }

  create(data: Partial<Employee>, actorName = 'Admin') {
    const newId = `emp-${Date.now()}`;
    const nextCodeNum = this.db.employees.length + 1;
    const employeeCode = data.employeeCode || `EMP-${nextCodeNum}`;

    const department = this.db.departments.find((d) => d.id === data.departmentId);
    const designation = this.db.designations.find((d) => d.id === data.designationId);
    const location = this.db.locations.find((l) => l.id === data.workLocationId) || this.db.locations[0];

    const basic = data.salary?.basic || 5000;
    const hra = data.salary?.hra || basic * 0.4;
    const allowances = data.salary?.allowances || 1200;
    const bonus = data.salary?.bonus || 500;
    const pf = data.salary?.pf || basic * 0.12;
    const tax = data.salary?.tax || basic * 0.15;
    const professionalTax = 200;
    const gross = basic + hra + allowances + bonus;
    const net = gross - (pf + tax + professionalTax);

    const newEmployee: Employee = {
      id: newId,
      employeeCode,
      firstName: data.firstName || 'New',
      lastName: data.lastName || 'Employee',
      email: data.email || `employee.${Date.now()}@paneliya.com`,
      phone: data.phone || '+1 (555) 000-0000',
      avatarUrl:
        data.avatarUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      gender: data.gender || 'Other',
      dateOfBirth: data.dateOfBirth || '1995-01-01',
      address: data.address || 'Corporate HQ',
      emergencyContact: data.emergencyContact || {
        name: 'Emergency Contact',
        relationship: 'Kin',
        phone: '+1 (555) 999-9999',
      },
      joiningDate: data.joiningDate || new Date().toISOString().split('T')[0],
      employmentType: data.employmentType || 'Full-time',
      status: data.status || EmployeeStatus.PROBATION,
      departmentId: department?.id || 'dept-1',
      departmentName: department?.name || 'Engineering',
      designationId: designation?.id || 'des-4',
      designationTitle: designation?.title || 'Software Engineer',
      reportingManagerId: data.reportingManagerId,
      reportingManagerName: data.reportingManagerName,
      workLocationId: location.id,
      workLocationName: location.name,
      shift: data.shift || 'General Shift (9 AM - 6 PM)',
      bankDetails: data.bankDetails || {
        bankName: 'Silicon Valley Bank',
        accountNumber: '99201948191',
        ifscOrRouting: 'SVB00129',
        accountHolderName: `${data.firstName || 'New'} ${data.lastName || 'Employee'}`,
      },
      taxInformation: data.taxInformation || {
        taxId: `TX-${Math.floor(100000 + Math.random() * 900000)}`,
        panOrSsn: '***-**-0000',
        taxRegime: 'New Regime',
      },
      education: data.education || [{ degree: 'B.S. in Computer Science', institution: 'University', year: 2020 }],
      previousExperience: data.previousExperience || [],
      skills: data.skills || ['JavaScript', 'Communication'],
      salary: {
        basic,
        hra,
        allowances,
        bonus,
        pf,
        tax,
        professionalTax,
        gross,
        net,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.employees.unshift(newEmployee);

    // Create initial leave balance
    this.db.leaveBalances.push({
      id: `bal-${newEmployee.id}`,
      employeeId: newEmployee.id,
      year: 2026,
      casualLeave: { total: 12, used: 0, remaining: 12 },
      sickLeave: { total: 10, used: 0, remaining: 10 },
      paidLeave: { total: 15, used: 0, remaining: 15 },
    });

    // Update department count
    if (department) {
      department.employeeCount += 1;
    }

    this.db.logAudit(
      'sys',
      actorName,
      'HR_ADMIN',
      'EMPLOYEE_CREATED',
      'Employee Management',
      `Created new employee ${newEmployee.firstName} ${newEmployee.lastName} (${newEmployee.employeeCode})`,
      newEmployee.id
    );

    this.db.persist();
    return newEmployee;
  }

  update(id: string, data: Partial<Employee>, actorName = 'Admin') {
    const idx = this.db.employees.findIndex((e) => e.id === id);
    if (idx === -1) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const current = this.db.employees[idx];
    const updated: Employee = {
      ...current,
      ...data,
      salary: {
        ...current.salary,
        ...(data.salary || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    this.db.employees[idx] = updated;

    this.db.logAudit(
      'sys',
      actorName,
      'HR_ADMIN',
      'EMPLOYEE_UPDATED',
      'Employee Management',
      `Updated details for employee ${updated.firstName} ${updated.lastName} (${updated.employeeCode})`,
      updated.id
    );

    this.db.persist();
    return updated;
  }

  remove(id: string, actorName = 'Admin') {
    const employee = this.db.employees.find((e) => e.id === id);
    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    employee.status = EmployeeStatus.INACTIVE;
    employee.updatedAt = new Date().toISOString();

    this.db.logAudit(
      'sys',
      actorName,
      'HR_ADMIN',
      'EMPLOYEE_DEACTIVATED',
      'Employee Management',
      `Marked employee ${employee.firstName} ${employee.lastName} as Inactive`,
      employee.id
    );

    this.db.persist();
    return { success: true, message: `Employee ${employee.employeeCode} deactivated` };
  }
}
