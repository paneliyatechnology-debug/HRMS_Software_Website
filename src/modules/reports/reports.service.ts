import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { AttendanceStatus, LeaveStatus, Role, User } from '../../common/types.js';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  getDashboardStats(actorUser?: User) {
    let employees = this.db.employees;
    let attendanceRecords = this.db.attendanceRecords;
    let leaveRequests = this.db.leaveRequests;
    let payrollRecords = this.db.payrollRecords;
    let departments = this.db.departments;

    if (actorUser && actorUser.role !== Role.SUPER_ADMIN && actorUser.companyId) {
      const companyId = actorUser.companyId;
      employees = employees.filter((e) => e.companyId === companyId);
      attendanceRecords = attendanceRecords.filter((a) => {
        if (a.companyId) return a.companyId === companyId;
        const u = this.db.users.find(
          (usr) => usr.id === a.employeeId || usr.employeeId === a.employeeId || (a as any).userId === usr.id,
        );
        return u?.companyId === companyId;
      });
      leaveRequests = leaveRequests.filter((l) => {
        if (l.companyId) return l.companyId === companyId;
        const u = this.db.users.find(
          (usr) => usr.id === l.employeeId || usr.employeeId === l.employeeId || (l as any).userId === usr.id,
        );
        return u?.companyId === companyId;
      });
      payrollRecords = payrollRecords.filter((p) => {
        if (p.companyId) return p.companyId === companyId;
        const u = this.db.users.find(
          (usr) => usr.id === p.employeeId || usr.employeeId === p.employeeId || (p as any).userId === usr.id,
        );
        return u?.companyId === companyId;
      });
      departments = departments.filter((d) => !d.companyId || d.companyId === companyId);
    }

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter((e) => e.status === 'Active').length;

    // Attendance stats
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter((a) => a.date === today);
    const presentToday = todayRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE,
    ).length;
    const absentToday = Math.max(0, totalEmployees - presentToday);
    const presentPercent =
      totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 86;

    // Leave stats
    const pendingLeaves = leaveRequests.filter(
      (l) => l.status === LeaveStatus.PENDING,
    ).length;
    const recentLeaves = leaveRequests.slice(0, 5);

    // Payroll stats
    const totalPayrollsSum = payrollRecords.reduce((acc, curr) => acc + curr.netSalary, 0);

    // Employment type breakdown
    const fullTimeCount = employees.filter((e) => e.employmentType === 'Full-time').length;
    const remoteCount = employees.filter((e) => e.employmentType === 'Remote').length;
    const partTimeCount = employees.filter((e) => e.employmentType === 'Part-time').length;
    const contractualCount = employees.filter((e) => e.employmentType === 'Contractual').length;
    const hourlyCount = employees.filter((e) => e.employmentType === 'Hourly').length;

    const employmentBreakdown = [
      { label: 'Full-time', count: fullTimeCount, percent: 50, color: '#3b82f6' },
      { label: 'Remote', count: remoteCount, percent: 25, color: '#f59e0b' },
      { label: 'Part-time', count: partTimeCount, percent: 15, color: '#10b981' },
      { label: 'Contractual', count: contractualCount, percent: 5, color: '#8b5cf6' },
      { label: 'Hourly', count: hourlyCount, percent: 5, color: '#ef4444' },
    ];

    // Performance overview data for bar chart
    const performanceOverview = [
      { month: 'Jan', income: 2100, expense: 1200 },
      { month: 'Feb', income: 2400, expense: 1400 },
      { month: 'Mar', income: 2200, expense: 1300 },
      { month: 'Apr', income: 2500, expense: 1500 },
      { month: 'May', income: 2602, expense: 1814 },
      { month: 'Jun', income: 2700, expense: 1900 },
      { month: 'Jul', income: 2900, expense: 1750 },
      { month: 'Aug', income: 3100, expense: 2100 },
      { month: 'Sep', income: 3000, expense: 2000 },
      { month: 'Oct', income: 3400, expense: 2200 },
      { month: 'Nov', income: 3200, expense: 2100 },
      { month: 'Dec', income: 3600, expense: 2300 },
    ];

    // Department Headcounts
    const departmentStats = departments.map((dept) => ({
      name: dept.name,
      count: employees.filter((e) => e.departmentId === dept.id).length,
    }));

    return {
      kpiCards: {
        totalEmployees: {
          value: totalEmployees,
          growth: '+10%',
          subtext: '10+ Than Last Year',
        },
        todaysPresent: {
          count: presentToday,
          percentage: `${presentPercent}%`,
          subtext: `${presentPercent}% Present Today`,
        },
        totalExpense: {
          value: '$1,600.10',
          growth: '-20%',
          subtext: '-20% Than Last Month',
        },
        totalPayrolls: {
          value: `$${totalPayrollsSum.toLocaleString()}`,
          growth: '+15%',
          subtext: '15+ Than Last Month',
        },
      },
      performanceOverview,
      leaveApplications: recentLeaves,
      employmentBreakdown,
      departmentStats,
      activeEmployees,
      absentToday,
      pendingLeaves,
    };
  }

  getExportData(type: string, actorUser?: User) {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot export aggregate report datasets');
    }

    const companyId = actorUser?.companyId;

    switch (type.toLowerCase()) {
      case 'employees':
        return actorUser && actorUser.role === Role.ADMIN && companyId
          ? this.db.employees.filter((e) => e.companyId === companyId)
          : this.db.employees;
      case 'attendance':
        return actorUser && actorUser.role === Role.ADMIN && companyId
          ? this.db.attendanceRecords.filter((a) => a.companyId === companyId)
          : this.db.attendanceRecords;
      case 'leaves':
        return actorUser && actorUser.role === Role.ADMIN && companyId
          ? this.db.leaveRequests.filter((l) => l.companyId === companyId)
          : this.db.leaveRequests;
      case 'payroll':
        return actorUser && actorUser.role === Role.ADMIN && companyId
          ? this.db.payrollRecords.filter((p) => p.companyId === companyId)
          : this.db.payrollRecords;
      default:
        return this.db.employees;
    }
  }
}
