import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { AttendanceStatus, LeaveStatus } from '../common/types.js';

@Injectable()
export class ReportsService {
  constructor(private readonly db: DatabaseService) {}

  getDashboardStats() {
    const totalEmployees = this.db.employees.length;
    const activeEmployees = this.db.employees.filter((e) => e.status === 'Active').length;

    // Attendance stats
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = this.db.attendanceRecords.filter((a) => a.date === today);
    const presentToday = todayRecords.filter(
      (a) => a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE
    ).length;
    const absentToday = Math.max(0, totalEmployees - presentToday);
    const presentPercent = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 86;

    // Leave stats
    const pendingLeaves = this.db.leaveRequests.filter((l) => l.status === LeaveStatus.PENDING).length;
    const recentLeaves = this.db.leaveRequests.slice(0, 5);

    // Payroll stats
    const totalPayrollsSum = this.db.payrollRecords.reduce((acc, curr) => acc + curr.netSalary, 0);

    // Employment type breakdown matching mockup
    const fullTimeCount = this.db.employees.filter((e) => e.employmentType === 'Full-time').length;
    const remoteCount = this.db.employees.filter((e) => e.employmentType === 'Remote').length;
    const partTimeCount = this.db.employees.filter((e) => e.employmentType === 'Part-time').length;
    const contractualCount = this.db.employees.filter((e) => e.employmentType === 'Contractual').length;
    const hourlyCount = this.db.employees.filter((e) => e.employmentType === 'Hourly').length;

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
    const departmentStats = this.db.departments.map((dept) => ({
      name: dept.name,
      count: this.db.employees.filter((e) => e.departmentId === dept.id).length,
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
      totalCandidates: this.db.candidates.length,
      openJobs: this.db.jobs.filter((j) => j.status === 'Published').length,
    };
  }

  getExportData(type: string) {
    if (type === 'attendance') {
      return this.db.attendanceRecords;
    }
    if (type === 'leaves') {
      return this.db.leaveRequests;
    }
    if (type === 'payroll') {
      return this.db.payrollRecords;
    }
    return this.db.employees;
  }
}
