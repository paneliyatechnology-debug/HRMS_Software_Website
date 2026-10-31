import { Injectable, OnModuleInit, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type mysql from 'mysql2/promise';
import { normalizeEmail, EMAIL_ALREADY_REGISTERED_MESSAGE } from '../common/utils/email.util.js';
import {
  normalizePhone,
  arePhoneNumbersEqual,
  extractComparablePhoneDigits,
  PHONE_ALREADY_REGISTERED_MESSAGE,
} from '../common/utils/phone.util.js';
import {
  User,
  Employee,
  Department,
  Designation,
  Location,
  AttendanceRecord,
  LeaveRequest,
  LeaveBalance,
  Holiday,
  PayrollRecord,
  EmployeeDocument,
  PerformanceCycle,
  PerformanceReview,
  TrainingProgram,
  EmployeeTraining,
  JobOpening,
  Candidate,
  CompanyAsset,
  Resignation,
  Announcement,
  NotificationItem,
  AuditLog,
  Company,
  Role,
  WorkSession,
  RefreshToken,
  EmployeeInvitation,
  CompanyRegistrationRequest,
} from '../common/types.js';
import { getMysqlPool, initializeMysqlTables, syncDataToMysql, purgeOrphanedData } from './mysql-sync.js';
import { hashPassword } from '../common/utils/password.util.js';

interface DatabaseSchema {
  companies?: Company[];
  locations: Location[];
  departments: Department[];
  designations: Designation[];
  users: User[];
  employees: Employee[];
  holidays: Holiday[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  jobs: JobOpening[];
  candidates: Candidate[];
  assets: CompanyAsset[];
  trainingPrograms: TrainingProgram[];
  employeeTrainings: EmployeeTraining[];
  performanceCycles: PerformanceCycle[];
  performanceReviews: PerformanceReview[];
  resignations: Resignation[];
  announcements: Announcement[];
  notifications: NotificationItem[];
  documents: EmployeeDocument[];
  auditLogs: AuditLog[];
  workSessions?: WorkSession[];
  refreshTokens?: RefreshToken[];
  employeeInvitations?: EmployeeInvitation[];
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private dataDir = path.resolve(process.cwd(), 'data');
  private dbFilePath = path.join(this.dataDir, 'database.json');
  private mysqlPool: mysql.Pool | null = null;
  private isMysqlConnected = false;

  public companies: Company[] = [];
  public locations: Location[] = [];
  public departments: Department[] = [];
  public designations: Designation[] = [];
  public users: User[] = [];
  public employees: Employee[] = [];
  public holidays: Holiday[] = [];
  public leaveBalances: LeaveBalance[] = [];
  public leaveRequests: LeaveRequest[] = [];
  public attendanceRecords: AttendanceRecord[] = [];
  public workSessions: WorkSession[] = [];
  public payrollRecords: PayrollRecord[] = [];
  public jobs: JobOpening[] = [];
  public candidates: Candidate[] = [];
  public assets: CompanyAsset[] = [];
  public trainingPrograms: TrainingProgram[] = [];
  public employeeTrainings: EmployeeTraining[] = [];
  public performanceCycles: PerformanceCycle[] = [];
  public performanceReviews: PerformanceReview[] = [];
  public resignations: Resignation[] = [];
  public announcements: Announcement[] = [];
  public notifications: NotificationItem[] = [];
  public documents: EmployeeDocument[] = [];
  public auditLogs: AuditLog[] = [];
  public refreshTokens: RefreshToken[] = [];
  public employeeInvitations: EmployeeInvitation[] = [];
  public companyRegistrationRequests: CompanyRegistrationRequest[] = [];

  async onModuleInit() {
    this.initDatabase();
    await this.initMysqlSync();
  }

  private initDatabase() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        try { fs.unlinkSync(this.dbFilePath); } catch {}
        this.logger.log('Permanently removed data/database.json. Operating 100% on live MySQL.');
      }
      this.logger.log('Ready for live XAMPP MySQL sync. Zero static mock data.');
    } catch (err) {
      this.logger.error('Failed to initialize database defaults', err);
    }
  }

  private async initMysqlSync() {
    try {
      this.mysqlPool = await getMysqlPool();
      await initializeMysqlTables(this.mysqlPool);
      this.isMysqlConnected = true;
      this.logger.log('Connected to XAMPP MySQL database "hrms". All tables verified.');

      // Automatically purge any residual orphaned data in MySQL whose company was deleted
      await purgeOrphanedData(this.mysqlPool);

      // Load companies
      try {
        const [mysqlCompanies]: any = await this.mysqlPool.query(`SELECT * FROM companies`);
        this.companies = (mysqlCompanies || []).map((c: any) => ({
          id: c.id,
          companyCode: c.companyCode,
          companyName: c.companyName,
          name: c.companyName,
          email: c.email || '',
          phone: c.phone || '',
          address: c.address || '',
          status: c.status || 'Active',
          adminUserId: c.adminUserId || null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        }));
        this.logger.log(`Synced ${this.companies.length} companies from live MySQL.`);
      } catch (loadErr) {
        this.logger.warn('Could not read existing companies from MySQL:', loadErr);
      }

      // Load users & employees
      try {
        const [mysqlUsers]: any = await this.mysqlPool.query(`SELECT * FROM users`);
        this.users = (mysqlUsers || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          phone: u.phone || '',
          password: u.password,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          role: u.role || 'EMPLOYEE',
          isSuperAdmin: u.isSuperAdmin === 1 || u.isSuperAdmin === true || u.role === 'SUPER_ADMIN',
          status: u.status || 'Active',
          companyId: u.companyId || null,
          companyCode: u.companyCode || null,
          employeeId: u.employeeId || u.id,
          employeeCode: u.employeeCode || null,
          permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions || [],
          avatarUrl: u.avatarUrl || '',
          gender: u.gender || 'Other',
          dateOfBirth: u.dateOfBirth || '',
          address: u.address || '',
          joiningDate: u.joiningDate || '',
          employmentType: u.employmentType || 'Full-time',
          departmentId: u.departmentId || '',
          departmentName: u.departmentName || '',
          designationId: u.designationId || '',
          designationTitle: u.designationTitle || '',
          reportingManagerId: u.reportingManagerId || '',
          reportingManagerName: u.reportingManagerName || '',
          workLocationId: u.workLocationId || '',
          workLocationName: u.workLocationName || '',
          shift: u.shift || 'General Shift (9 AM - 6 PM)',
          emergencyContact: typeof u.emergencyContact === 'string' ? JSON.parse(u.emergencyContact) : u.emergencyContact || {},
          bankDetails: typeof u.bankDetails === 'string' ? JSON.parse(u.bankDetails) : u.bankDetails || {},
          taxInformation: typeof u.taxInformation === 'string' ? JSON.parse(u.taxInformation) : u.taxInformation || {},
          education: typeof u.education === 'string' ? JSON.parse(u.education) : u.education || [],
          previousExperience: typeof u.previousExperience === 'string' ? JSON.parse(u.previousExperience) : u.previousExperience || [],
          skills: typeof u.skills === 'string' ? JSON.parse(u.skills) : u.skills || [],
          salary: typeof u.salary === 'string' ? JSON.parse(u.salary) : u.salary || {},
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString(),
        }));

        this.employees = this.users
          .filter((u) => u.role === 'EMPLOYEE' || u.employeeId || u.employeeCode)
          .map((u) => ({
            id: u.employeeId || u.id,
            userId: u.id,
            employeeCode: u.employeeCode || '',
            companyId: u.companyId || '',
            companyCode: u.companyCode || '',
            password: u.password,
            isSuperAdmin: false,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone || '',
            avatarUrl: u.avatarUrl || '',
            gender: u.gender as any,
            dateOfBirth: u.dateOfBirth || '',
            address: u.address || '',
            emergencyContact: u.emergencyContact as any,
            joiningDate: u.joiningDate || '',
            employmentType: u.employmentType as any,
            status: u.status as any,
            departmentId: u.departmentId || '',
            departmentName: u.departmentName || '',
            designationId: u.designationId || '',
            designationTitle: u.designationTitle || '',
            reportingManagerId: u.reportingManagerId || '',
            reportingManagerName: u.reportingManagerName || '',
            workLocationId: u.workLocationId || '',
            workLocationName: u.workLocationName || '',
            shift: u.shift || 'General Shift (9 AM - 6 PM)',
            bankDetails: u.bankDetails as any,
            taxInformation: u.taxInformation as any,
            education: u.education as any,
            previousExperience: u.previousExperience as any,
            skills: u.skills as any,
            salary: u.salary as any,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          }));

        this.logger.log(`Loaded ${this.users.length} users and ${this.employees.length} employees directly from live MySQL.`);
      } catch (userLoadErr: any) {
        this.logger.warn('Could not read existing users from MySQL:', userLoadErr.message);
      }

      // Load all other collections directly from live MySQL (strictly no static seed data)
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM locations`); this.locations = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM departments`); this.departments = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM designations`); this.designations = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM holidays`); this.holidays = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM leave_balances`); this.leaveBalances = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM leave_requests`); this.leaveRequests = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM attendance_records`); this.attendanceRecords = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM work_sessions`); this.workSessions = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM payroll_records`); this.payrollRecords = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM job_openings`); this.jobs = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM candidates`); this.candidates = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM company_assets`); this.assets = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM training_programs`); this.trainingPrograms = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM employee_trainings`); this.employeeTrainings = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM performance_cycles`); this.performanceCycles = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM performance_reviews`); this.performanceReviews = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM resignations`); this.resignations = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM announcements`); this.announcements = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM notifications`); this.notifications = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM documents`); this.documents = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM audit_logs`); this.auditLogs = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM refresh_tokens`); this.refreshTokens = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM employee_invitations`); this.employeeInvitations = rows || []; } catch {}
      try { const [rows]: any = await this.mysqlPool.query(`SELECT * FROM company_registration_requests`); this.companyRegistrationRequests = rows || []; } catch {}

      // Sanitize runtime memory: purge any orphaned data whose company does not exist (preserving SUPER_ADMIN)
      const validCompanyIds = new Set(this.companies.map((c) => (c.id || '').toLowerCase()));
      const validCompanyCodes = new Set(this.companies.map((c) => (c.companyCode || '').toLowerCase()).filter(Boolean));

      const belongsToExistingCompany = (item: any) => {
        if (!item) return false;
        const cId = (item.companyId || '').toLowerCase();
        const cCode = (item.companyCode || '').toLowerCase();
        if (cId && validCompanyIds.has(cId)) return true;
        if (cCode && validCompanyCodes.has(cCode)) return true;
        return false;
      };

      this.users = this.users.filter(
        (u) => u.isSuperAdmin || u.role === Role.SUPER_ADMIN || belongsToExistingCompany(u),
      );
      const validUserIds = new Set(this.users.map((u) => u.id));
      const validEmployeeIds = new Set(this.users.map((u) => u.employeeId).filter(Boolean));

      this.employees = this.employees.filter(
        (e) => (e.userId ? validUserIds.has(e.userId) : false) || (e.id ? validEmployeeIds.has(e.id) : false),
      );
      this.departments = this.departments.filter(belongsToExistingCompany);
      this.designations = this.designations.filter(belongsToExistingCompany);
      this.locations = this.locations.filter(belongsToExistingCompany);
      this.holidays = this.holidays.filter(belongsToExistingCompany);
      this.leaveBalances = this.leaveBalances.filter(
        (lb) => (lb.employeeId ? (validUserIds.has(lb.employeeId) || validEmployeeIds.has(lb.employeeId)) : false),
      );
      this.leaveRequests = this.leaveRequests.filter(belongsToExistingCompany);
      this.attendanceRecords = this.attendanceRecords.filter(belongsToExistingCompany);
      this.workSessions = this.workSessions.filter(belongsToExistingCompany);
      this.payrollRecords = this.payrollRecords.filter(belongsToExistingCompany);
      this.jobs = this.jobs.filter(belongsToExistingCompany);
      this.candidates = this.candidates.filter(belongsToExistingCompany);
      this.assets = this.assets.filter(belongsToExistingCompany);
      this.trainingPrograms = this.trainingPrograms.filter(belongsToExistingCompany);
      this.employeeTrainings = this.employeeTrainings.filter(belongsToExistingCompany);
      this.performanceCycles = this.performanceCycles.filter(belongsToExistingCompany);
      this.performanceReviews = this.performanceReviews.filter(belongsToExistingCompany);
      this.resignations = this.resignations.filter(belongsToExistingCompany);
      this.announcements = this.announcements.filter(belongsToExistingCompany);
      this.notifications = this.notifications.filter((n) => n.userId ? validUserIds.has(n.userId) : false);
      this.documents = this.documents.filter(belongsToExistingCompany);
      this.refreshTokens = this.refreshTokens.filter((rt) => rt.userId ? validUserIds.has(rt.userId) : false);
      this.employeeInvitations = this.employeeInvitations.filter(belongsToExistingCompany);

      this.logger.log('Live MySQL state loaded and validated. Zero orphaned company data.');
    } catch (err) {
      this.logger.warn(
        'MySQL connection to "hrms" failed or not reachable.',
        err,
      );
      this.isMysqlConnected = false;
    }
  }

  private isReconnecting = false;
  private async syncToMysql(data: any) {
    if (!this.mysqlPool || !this.isMysqlConnected) {
      if (!this.isReconnecting) {
        this.isReconnecting = true;
        try {
          await this.initMysqlSync();
        } catch {
          // Fallback
        } finally {
          this.isReconnecting = false;
        }
      }
    }

    if (this.mysqlPool && this.isMysqlConnected) {
      try {
        await syncDataToMysql(this.mysqlPool, data);
      } catch (err) {
        this.logger.error('Failed to sync changes to MySQL "hrms":', err);
      }
    }
  }

  public generateNextCompanyCode(): string {
    let maxNum = 0;
    for (const c of this.companies) {
      if (c.companyCode) {
        const match = c.companyCode.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
    }
    const nextNum = maxNum + 1;
    return `CMP-${String(nextNum).padStart(6, '0')}`;
  }

  public purgeFromMemoryOnly(companyId: string, companyCode?: string) {
    const cleanId = (companyId || '').trim();
    const cleanCode = (companyCode || '').trim();
    if (!cleanId && !cleanCode) return;

    const matchesTargetCompany = (item: any): boolean => {
      if (!item) return false;
      if (cleanId && item.companyId && String(item.companyId).toLowerCase() === cleanId.toLowerCase()) return true;
      if (cleanCode && item.companyCode && String(item.companyCode).toLowerCase() === cleanCode.toLowerCase()) return true;
      if (cleanId && item.id && String(item.id).toLowerCase() === cleanId.toLowerCase()) return true;
      if (cleanCode && item.id && String(item.id).toLowerCase() === cleanCode.toLowerCase()) return true;
      return false;
    };

    this.companies = this.companies.filter(
      (c) =>
        (cleanId ? c.id?.toLowerCase() !== cleanId.toLowerCase() : true) &&
        (cleanCode ? c.companyCode?.toLowerCase() !== cleanCode.toLowerCase() : true),
    );

    const purgedUserIds = new Set<string>();
    this.users = this.users.filter((u) => {
      if (u.role === Role.SUPER_ADMIN || u.isSuperAdmin) return true;
      if (matchesTargetCompany(u)) {
        purgedUserIds.add(u.id);
        if (u.employeeId) purgedUserIds.add(u.employeeId);
        return false;
      }
      return true;
    });

    this.employees = this.employees.filter((e) => {
      if ((e.id && purgedUserIds.has(e.id)) || (e.userId && purgedUserIds.has(e.userId))) return false;
      return !matchesTargetCompany(e);
    });

    this.locations = this.locations.filter((l) => !matchesTargetCompany(l));
    this.departments = this.departments.filter((d) => !matchesTargetCompany(d));
    this.designations = this.designations.filter((d) => !matchesTargetCompany(d));
    this.holidays = this.holidays.filter((h) => !matchesTargetCompany(h));
    this.leaveBalances = this.leaveBalances.filter(
      (lb) => !matchesTargetCompany(lb) && (!lb.employeeId || !purgedUserIds.has(lb.employeeId)),
    );
    this.leaveRequests = this.leaveRequests.filter(
      (lr) => !matchesTargetCompany(lr) && (!lr.employeeId || !purgedUserIds.has(lr.employeeId)),
    );
    this.attendanceRecords = this.attendanceRecords.filter(
      (ar) => !matchesTargetCompany(ar) && (!ar.employeeId || !purgedUserIds.has(ar.employeeId)),
    );
    this.workSessions = this.workSessions.filter(
      (ws) => !matchesTargetCompany(ws) && (!ws.employeeId || !purgedUserIds.has(ws.employeeId)),
    );
    this.payrollRecords = this.payrollRecords.filter(
      (pr) => !matchesTargetCompany(pr) && (!pr.employeeId || !purgedUserIds.has(pr.employeeId)),
    );
    this.jobs = this.jobs.filter((j) => !matchesTargetCompany(j));
    this.candidates = this.candidates.filter((c) => !matchesTargetCompany(c));
    this.assets = this.assets.filter((a) => !matchesTargetCompany(a));
    this.trainingPrograms = this.trainingPrograms.filter((tp) => !matchesTargetCompany(tp));
    this.employeeTrainings = this.employeeTrainings.filter(
      (et) => !matchesTargetCompany(et) && (!et.employeeId || !purgedUserIds.has(et.employeeId)),
    );
    this.performanceCycles = this.performanceCycles.filter((pc) => !matchesTargetCompany(pc));
    this.performanceReviews = this.performanceReviews.filter(
      (pr) => !matchesTargetCompany(pr) && (!pr.employeeId || !purgedUserIds.has(pr.employeeId)),
    );
    this.resignations = this.resignations.filter(
      (r) => !matchesTargetCompany(r) && (!r.employeeId || !purgedUserIds.has(r.employeeId)),
    );
    this.announcements = this.announcements.filter((a) => !matchesTargetCompany(a));
    this.notifications = this.notifications.filter(
      (n) => !matchesTargetCompany(n) && (!n.userId || !purgedUserIds.has(n.userId)),
    );
    this.documents = this.documents.filter(
      (d) => !matchesTargetCompany(d) && (!d.employeeId || !purgedUserIds.has(d.employeeId)),
    );
    this.auditLogs = this.auditLogs.filter(
      (al) => !matchesTargetCompany(al) && (!al.userId || !purgedUserIds.has(al.userId)),
    );
    this.refreshTokens = this.refreshTokens.filter(
      (rt) => !matchesTargetCompany(rt) && (!rt.userId || !purgedUserIds.has(rt.userId)),
    );
    this.employeeInvitations = this.employeeInvitations.filter((ei) => !matchesTargetCompany(ei));
    this.companyRegistrationRequests = this.companyRegistrationRequests.filter(
      (cr) =>
        (cleanId ? cr.approvedCompanyId?.toLowerCase() !== cleanId.toLowerCase() : true) &&
        (cleanCode ? cr.approvedCompanyCode?.toLowerCase() !== cleanCode.toLowerCase() : true),
    );
  }

  /**
   * Completely and irreversibly wipes out a company and all associated records
   * (users, employees, departments, designations, locations, attendance, leaves, payroll,
   * assets, recruitment, resignations, announcements, tokens, documents, audit logs)
   * from both live MySQL tables and runtime memory arrays.
   */
  public async purgeCompanyCompletely(companyId: string, companyCode?: string) {
    const cleanId = (companyId || '').trim();
    const cleanCode = (companyCode || '').trim();
    if (!cleanId && !cleanCode) return;

    this.logger.log(`Executing 100% cascade purge for company id="${cleanId}" code="${cleanCode}"`);

    // 1. Purge from runtime memory
    this.purgeFromMemoryOnly(cleanId, cleanCode);

    // 2. Direct MySQL cascade deletion
    if (this.mysqlPool && this.isMysqlConnected) {
      try {
        const pool = this.mysqlPool;
        const targetId = cleanId || '___none___';
        const targetCode = cleanCode || '___none___';

        await pool.query(
          `DELETE FROM users 
           WHERE (companyId = ? OR companyCode = ?) 
             AND role != 'SUPER_ADMIN' 
             AND isSuperAdmin = 0`,
          [targetId, targetCode],
        );

        const companyTables = [
          'departments', 'designations', 'locations', 'holidays', 'leave_balances',
          'leave_requests', 'attendance_records', 'work_sessions', 'payroll_records',
          'job_openings', 'candidates', 'company_assets', 'training_programs',
          'employee_trainings', 'performance_cycles', 'performance_reviews',
          'resignations', 'announcements', 'notifications', 'documents',
          'audit_logs', 'refresh_tokens', 'employee_invitations'
        ];

        for (const tbl of companyTables) {
          try {
            await pool.query(
              `DELETE FROM ${tbl} WHERE companyId = ? OR companyCode = ?`,
              [targetId, targetCode],
            );
          } catch {}
        }

        try {
          await pool.query(
            `DELETE FROM company_registration_requests WHERE approvedCompanyId = ? OR approvedCompanyCode = ?`,
            [targetId, targetCode],
          );
        } catch {}

        try {
          await pool.query(
            `DELETE FROM companies WHERE id = ? OR companyCode = ?`,
            [targetId, targetCode],
          );
        } catch {}

        await purgeOrphanedData(pool);
        this.logger.log(`Purged company id="${cleanId}" code="${cleanCode}" completely from all MySQL tables.`);
      } catch (sqlErr) {
        this.logger.error('Error during MySQL complete company purge:', sqlErr);
      }
    }
  }

  private persistTimeout: any = null;
  private isPersisting = false;

  public get isPersistPending(): boolean {
    return this.persistTimeout !== null || this.isPersisting;
  }

  public async flushPersist(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    const data: DatabaseSchema = {
      companies: this.companies,
      locations: this.locations,
      departments: this.departments,
      designations: this.designations,
      users: this.users,
      employees: this.employees,
      holidays: this.holidays,
      leaveBalances: this.leaveBalances,
      leaveRequests: this.leaveRequests,
      attendanceRecords: this.attendanceRecords,
      workSessions: this.workSessions,
      payrollRecords: this.payrollRecords,
      jobs: this.jobs,
      candidates: this.candidates,
      assets: this.assets,
      trainingPrograms: this.trainingPrograms,
      employeeTrainings: this.employeeTrainings,
      performanceCycles: this.performanceCycles,
      performanceReviews: this.performanceReviews,
      resignations: this.resignations,
      announcements: this.announcements,
      notifications: this.notifications,
      documents: this.documents,
      auditLogs: this.auditLogs,
      refreshTokens: this.refreshTokens,
      employeeInvitations: this.employeeInvitations,
    };
    await this.syncToMysql(data);
  }

  public persist() {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(() => {
      this.executeAtomicPersist();
    }, 40);
  }

  private executeAtomicPersist() {
    if (this.isPersisting) {
      this.persistTimeout = setTimeout(() => this.executeAtomicPersist(), 30);
      return;
    }

    this.isPersisting = true;
    try {
      const data: DatabaseSchema = {
        companies: this.companies,
        locations: this.locations,
        departments: this.departments,
        designations: this.designations,
        users: this.users,
        employees: this.employees,
        holidays: this.holidays,
        leaveBalances: this.leaveBalances,
        leaveRequests: this.leaveRequests,
        attendanceRecords: this.attendanceRecords,
        workSessions: this.workSessions,
        payrollRecords: this.payrollRecords,
        jobs: this.jobs,
        candidates: this.candidates,
        assets: this.assets,
        trainingPrograms: this.trainingPrograms,
        employeeTrainings: this.employeeTrainings,
        performanceCycles: this.performanceCycles,
        performanceReviews: this.performanceReviews,
        resignations: this.resignations,
        announcements: this.announcements,
        notifications: this.notifications,
        documents: this.documents,
        auditLogs: this.auditLogs,
        refreshTokens: this.refreshTokens,
        employeeInvitations: this.employeeInvitations,
      };

      // NO database.json writing! 100% Pure MySQL!
      if (fs.existsSync(this.dbFilePath)) {
        try { fs.unlinkSync(this.dbFilePath); } catch {}
      }

      // Persist directly and strictly to live MySQL
      void this.syncToMysql(data);
    } catch (err) {
      this.logger.error('Failed to sync to MySQL', err);
    } finally {
      this.isPersisting = false;
    }
  }

  public logAudit(
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    module: string,
    details: string,
    recordId?: string,
    ipAddress = '127.0.0.1',
    companyId?: string,
    companyCode?: string,
  ) {
    const user = this.users.find((u) => u.id === userId || u.employeeId === userId);
    const cId = companyId || user?.companyId || 'cmp-1';
    const cCode = companyCode || user?.companyCode || 'CMP-000001';
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      companyId: cId,
      companyCode: cCode,
      userId,
      userName,
      userRole,
      action,
      module,
      recordId,
      details,
      ipAddress,
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    this.persist();
    return log;
  }

  /**
   * Universally resolves any user identifier (userId, legacy employeeId 'emp-...', employeeCode, or email)
   * into the active User entity from the unified users table.
   */
  public resolveUser(targetId?: string): User | undefined {
    if (!targetId || typeof targetId !== 'string') return undefined;
    const clean = targetId.trim();
    if (!clean) return undefined;

    // 1. Direct match on user.id
    let user = this.users.find((u) => u.id === clean);
    if (user) return user;

    // 2. Direct match on user.employeeId
    user = this.users.find((u) => u.employeeId === clean);
    if (user) return user;

    // 3. Match on legacy 'emp-' transformed to 'user-'
    if (clean.startsWith('emp-')) {
      const mappedId = clean.replace('emp-', 'user-');
      user = this.users.find((u) => u.id === mappedId || u.employeeId === mappedId);
      if (user) return user;
    }

    // 4. Match on email
    user = this.users.find((u) => u.email && u.email.toLowerCase() === clean.toLowerCase());
    if (user) return user;

    // 5. Match on employeeCode
    user = this.users.find(
      (u) => u.employeeCode && u.employeeCode.toLowerCase() === clean.toLowerCase(),
    );
    if (user) return user;

    // 6. Match via employees list
    const emp = this.employees.find(
      (e) =>
        e.id === clean ||
        e.userId === clean ||
        (clean.startsWith('emp-') && e.id === clean.replace('emp-', 'user-')),
    );
    if (emp) {
      user = this.users.find((u) => u.id === emp.userId || u.id === emp.id);
      if (user) return user;
    }

    return undefined;
  }

  /**
   * Asserts strict global uniqueness for company name, email, and phone number.
   * Two companies cannot have the same name, email, or phone.
   * Email comparison is case-insensitive and trimmed.
   * Company name comparison is case-insensitive and trimmed.
   * Phone number is normalized before comparison.
   * Throws 409 ConflictException when duplicate is detected.
   */
  public async assertCompanyUnique(
    data: { companyName?: string; name?: string; email?: string; phone?: string },
    excludeCompanyId?: string,
  ): Promise<void> {
    const rawName = (data.companyName || data.name || '').trim();
    const rawEmail = (data.email || '').trim();
    const rawPhone = (data.phone || '').trim();

    // 1. Company Name Uniqueness
    if (rawName) {
      const lowerName = rawName.toLowerCase();
      const nameConflict = this.companies.find(
        (c) =>
          c.id !== excludeCompanyId &&
          (c.companyName?.trim().toLowerCase() === lowerName || c.name?.trim().toLowerCase() === lowerName),
      );
      if (nameConflict) {
        throw new ConflictException(`A company with the name "${rawName}" already exists.`);
      }

      if (this.mysqlPool && this.isMysqlConnected) {
        try {
          const [rows]: any = await this.mysqlPool.query(
            excludeCompanyId
              ? `SELECT id FROM companies WHERE (LOWER(TRIM(companyName)) = ? OR LOWER(TRIM(name)) = ?) AND id != ? LIMIT 1`
              : `SELECT id FROM companies WHERE (LOWER(TRIM(companyName)) = ? OR LOWER(TRIM(name)) = ?) LIMIT 1`,
            excludeCompanyId ? [lowerName, lowerName, excludeCompanyId] : [lowerName, lowerName],
          );
          if (rows && rows.length > 0) {
            throw new ConflictException(`A company with the name "${rawName}" already exists.`);
          }
        } catch (dbErr) {
          if (dbErr instanceof ConflictException) throw dbErr;
          this.logger.warn(`Could not verify company name in MySQL: ${dbErr}`);
        }
      }
    }

    // 2. Company Email Uniqueness
    if (rawEmail) {
      const normalizedEmail = normalizeEmail(rawEmail);
      const emailConflict = this.companies.find(
        (c) => c.id !== excludeCompanyId && normalizeEmail(c.email) === normalizedEmail,
      );
      if (emailConflict) {
        throw new ConflictException(`A company with the email address "${rawEmail}" already exists.`);
      }

      if (this.mysqlPool && this.isMysqlConnected) {
        try {
          const [rows]: any = await this.mysqlPool.query(
            excludeCompanyId
              ? `SELECT id FROM companies WHERE LOWER(TRIM(email)) = ? AND id != ? LIMIT 1`
              : `SELECT id FROM companies WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
            excludeCompanyId ? [normalizedEmail, excludeCompanyId] : [normalizedEmail],
          );
          if (rows && rows.length > 0) {
            throw new ConflictException(`A company with the email address "${rawEmail}" already exists.`);
          }
        } catch (dbErr) {
          if (dbErr instanceof ConflictException) throw dbErr;
          this.logger.warn(`Could not verify company email in MySQL: ${dbErr}`);
        }
      }
    }

    // 3. Company Phone Uniqueness
    if (rawPhone) {
      const normalizedPhone = normalizePhone(rawPhone);
      const phoneConflict = this.companies.find(
        (c) => c.id !== excludeCompanyId && arePhoneNumbersEqual(c.phone, normalizedPhone),
      );
      if (phoneConflict) {
        throw new ConflictException(`A company with the phone number "${rawPhone}" already exists.`);
      }

      if (this.mysqlPool && this.isMysqlConnected) {
        try {
          const [rows]: any = await this.mysqlPool.query(
            excludeCompanyId
              ? `SELECT id, phone FROM companies WHERE phone IS NOT NULL AND phone != '' AND id != ?`
              : `SELECT id, phone FROM companies WHERE phone IS NOT NULL AND phone != ''`,
            excludeCompanyId ? [excludeCompanyId] : [],
          );
          if (rows && Array.isArray(rows)) {
            for (const r of rows) {
              if (arePhoneNumbersEqual(r.phone, normalizedPhone)) {
                throw new ConflictException(`A company with the phone number "${rawPhone}" already exists.`);
              }
            }
          }
        } catch (dbErr) {
          if (dbErr instanceof ConflictException) throw dbErr;
          this.logger.warn(`Could not verify company phone in MySQL: ${dbErr}`);
        }
      }
    }
  }

  private inFlightEmailLocks = new Set<string>();

  /**
   * Asserts company-scoped email uniqueness across users and employees.
   * Within the SAME company, duplicate email is rejected (409 Conflict).
   * Across DIFFERENT companies, duplicate email is allowed.
   */
  public async assertEmailUnique(
    email: string,
    companyId?: string | null,
    excludeUserId?: string,
    lockAlreadyAcquired = false,
  ): Promise<string> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new BadRequestException('Email address is required.');
    }

    const lockKey = `${companyId || 'global'}:${normalized}`;

    // 1. Check in-flight lock for concurrent requests
    if (!lockAlreadyAcquired && this.inFlightEmailLocks.has(lockKey)) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }

    // 2. Live MySQL Check: When MySQL (XAMPP) is connected, MySQL is the single source of truth!
    if (this.mysqlPool && this.isMysqlConnected) {
      try {
        let query = '';
        let params: any[] = [];
        if (companyId) {
          query = excludeUserId
            ? `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND companyId = ? AND id != ? LIMIT 1`
            : `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND companyId = ? LIMIT 1`;
          params = excludeUserId ? [normalized, companyId, excludeUserId] : [normalized, companyId];
        } else {
          query = excludeUserId
            ? `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND (companyId IS NULL OR companyId = '') AND id != ? LIMIT 1`
            : `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND (companyId IS NULL OR companyId = '') LIMIT 1`;
          params = excludeUserId ? [normalized, excludeUserId] : [normalized];
        }

        const [rows]: any = await this.mysqlPool.query(query, params);
        if (rows && rows.length > 0) {
          throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
        } else {
          // If the record does not exist in MySQL (e.g. deleted in XAMPP phpMyAdmin), purge it from in-memory cache!
          this.purgeEmailFromMemory(normalized, companyId);
          return normalized;
        }
      } catch (dbErr) {
        if (dbErr instanceof ConflictException) throw dbErr;
        this.logger.warn(`Could not verify email in MySQL: ${dbErr}`);
      }
    }

    // 3. In-memory check (Fallback only when MySQL is not connected/offline)
    const userConflict = this.users.find((u) => {
      if (u.id === excludeUserId) return false;
      if (normalizeEmail(u.email) !== normalized) return false;
      if (companyId) {
        return u.companyId === companyId;
      } else {
        return !u.companyId || u.isSuperAdmin || u.role === Role.SUPER_ADMIN;
      }
    });
    if (userConflict) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }

    const empConflict = this.employees.find((e) => {
      if (e.id === excludeUserId || e.userId === excludeUserId) return false;
      if (normalizeEmail(e.email) !== normalized) return false;
      if (companyId) {
        return e.companyId === companyId;
      } else {
        return !e.companyId;
      }
    });
    if (empConflict) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }

    return normalized;
  }

  /**
   * Acquires a lock on the normalized email for the duration of an asynchronous operation
   */
  public acquireEmailLock(email: string, companyId?: string | null): () => void {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new BadRequestException('Email address is required.');
    }
    const lockKey = `${companyId || 'global'}:${normalized}`;
    if (this.inFlightEmailLocks.has(lockKey)) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }
    this.inFlightEmailLocks.add(lockKey);
    return () => {
      this.inFlightEmailLocks.delete(lockKey);
    };
  }

  private inFlightPhoneLocks = new Set<string>();

  /**
   * Asserts company-scoped phone/mobile number uniqueness across users and employees.
   * Within the SAME company, duplicate phone is rejected (409 Conflict).
   * Across DIFFERENT companies, duplicate phone is allowed.
   */
  public async assertPhoneUnique(
    phone?: string | null,
    companyId?: string | null,
    excludeUserId?: string,
    lockAlreadyAcquired = false,
  ): Promise<string> {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return '';
    }

    const comparableDigits = extractComparablePhoneDigits(normalized);
    const lockKey = `${companyId || 'global'}:${normalized}`;
    const digitLockKey = comparableDigits ? `${companyId || 'global'}:${comparableDigits}` : '';

    // 1. In-flight lock for concurrent requests
    if (!lockAlreadyAcquired) {
      if (
        this.inFlightPhoneLocks.has(lockKey) ||
        (digitLockKey && this.inFlightPhoneLocks.has(digitLockKey))
      ) {
        throw new ConflictException(PHONE_ALREADY_REGISTERED_MESSAGE);
      }
    }

    // 2. Live MySQL Check: When MySQL (XAMPP) is connected, MySQL is the single source of truth!
    if (this.mysqlPool && this.isMysqlConnected) {
      try {
        let query = '';
        let params: any[] = [];
        if (companyId) {
          query = excludeUserId
            ? `SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND companyId = ? AND id != ?`
            : `SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND companyId = ?`;
          params = excludeUserId ? [companyId, excludeUserId] : [companyId];
        } else {
          query = excludeUserId
            ? `SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND (companyId IS NULL OR companyId = '') AND id != ?`
            : `SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != '' AND (companyId IS NULL OR companyId = '')`;
          params = excludeUserId ? [excludeUserId] : [];
        }

        const [rows]: any = await this.mysqlPool.query(query, params);
        let conflictFound = false;
        if (rows && Array.isArray(rows)) {
          for (const r of rows) {
            if (arePhoneNumbersEqual(r.phone, normalized)) {
              conflictFound = true;
              break;
            }
          }
        }

        if (conflictFound) {
          throw new ConflictException(PHONE_ALREADY_REGISTERED_MESSAGE);
        } else {
          // If the record does not exist in MySQL (e.g. deleted in XAMPP phpMyAdmin), purge it from in-memory cache!
          this.purgePhoneFromMemory(normalized, companyId);
          return normalized;
        }
      } catch (dbErr) {
        if (dbErr instanceof ConflictException) throw dbErr;
        this.logger.warn(`Could not verify phone in MySQL: ${dbErr}`);
      }
    }

    // 3. In-memory check (Fallback only when MySQL is not connected/offline)
    const userConflict = this.users.find((u) => {
      if (u.id === excludeUserId) return false;
      if (companyId && u.companyId !== companyId) return false;
      if (!companyId && u.companyId) return false;
      return arePhoneNumbersEqual(u.phone, normalized);
    });
    if (userConflict) {
      throw new ConflictException(PHONE_ALREADY_REGISTERED_MESSAGE);
    }

    const empConflict = this.employees.find((e) => {
      if (e.id === excludeUserId || e.userId === excludeUserId) return false;
      if (companyId && e.companyId !== companyId) return false;
      if (!companyId && e.companyId) return false;
      return arePhoneNumbersEqual(e.phone, normalized);
    });
    if (empConflict) {
      throw new ConflictException(PHONE_ALREADY_REGISTERED_MESSAGE);
    }

    return normalized;
  }

  /**
   * Returns the live MySQL pool instance
   */
  public getMysqlPool(): mysql.Pool | null {
    return this.mysqlPool;
  }

  /**
   * Returns whether live MySQL is currently connected
   */
  public get isConnectedToMysql(): boolean {
    return this.isMysqlConnected;
  }

  /**
   * Purges an email from in-memory users, employees, and cache
   * when it has been deleted directly from XAMPP phpMyAdmin.
   */
  public purgeEmailFromMemory(normalizedEmail: string, companyId?: string | null) {
    let purged = false;
    const initialUserLen = this.users.length;
    this.users = this.users.filter((u) => {
      if (normalizeEmail(u.email) === normalizedEmail) {
        if (!companyId || u.companyId === companyId) {
          purged = true;
          return false;
        }
      }
      return true;
    });

    const initialEmpLen = this.employees.length;
    this.employees = this.employees.filter((e) => {
      if (normalizeEmail(e.email) === normalizedEmail) {
        if (!companyId || e.companyId === companyId) {
          purged = true;
          return false;
        }
      }
      return true;
    });

    if (purged) {
      this.logger.log(`Purged email "${normalizedEmail}" from memory/cache (deleted from XAMPP MySQL).`);
      this.executeAtomicPersist();
    }
  }

  /**
   * Purges a phone from in-memory users, employees, and cache
   * when it has been deleted directly from XAMPP phpMyAdmin.
   */
  public purgePhoneFromMemory(normalizedPhone: string, companyId?: string | null) {
    let purged = false;
    this.users = this.users.filter((u) => {
      if (u.phone && arePhoneNumbersEqual(u.phone, normalizedPhone)) {
        if (!companyId || u.companyId === companyId) {
          purged = true;
          return false;
        }
      }
      return true;
    });

    this.employees = this.employees.filter((e) => {
      if (e.phone && arePhoneNumbersEqual(e.phone, normalizedPhone)) {
        if (!companyId || e.companyId === companyId) {
          purged = true;
          return false;
        }
      }
      return true;
    });

    if (purged) {
      this.logger.log(`Purged phone "${normalizedPhone}" from memory/cache (deleted from XAMPP MySQL).`);
      this.executeAtomicPersist();
    }
  }

  /**
   * Permanently deletes a user from live MySQL, invitations, and balances.
   * Ensures deletion in API deletes immediately from live XAMPP MySQL as well.
   */
  public async deleteUserFromMysql(userId: string, email?: string) {
    if (this.mysqlPool && this.isMysqlConnected) {
      try {
        await this.mysqlPool.query(`DELETE FROM users WHERE id = ? OR (email = ? AND email != '')`, [userId, email || '']);
        await this.mysqlPool.query(`DELETE FROM employee_invitations WHERE userId = ? OR (email = ? AND email != '')`, [userId, email || '']);
        await this.mysqlPool.query(`DELETE FROM leave_balances WHERE employeeId = ?`, [userId]);
        this.logger.log(`Permanently deleted user "${userId}" (${email || ''}) from live MySQL.`);
      } catch (err: any) {
        this.logger.warn(`Could not delete user ${userId} from MySQL: ${err.message}`);
      }
    }
  }

  /**
   * Acquires a lock on the normalized phone number for the duration of an asynchronous operation
   */
  public acquirePhoneLock(phone?: string | null, companyId?: string | null): () => void {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return () => {};
    }
    const comparableDigits = extractComparablePhoneDigits(normalized);
    const lockKey = `${companyId || 'global'}:${normalized}`;
    const digitLockKey = comparableDigits ? `${companyId || 'global'}:${comparableDigits}` : '';

    if (
      this.inFlightPhoneLocks.has(lockKey) ||
      (digitLockKey && this.inFlightPhoneLocks.has(digitLockKey))
    ) {
      throw new ConflictException(PHONE_ALREADY_REGISTERED_MESSAGE);
    }
    this.inFlightPhoneLocks.add(lockKey);
    if (digitLockKey) {
      this.inFlightPhoneLocks.add(digitLockKey);
    }
    return () => {
      this.inFlightPhoneLocks.delete(lockKey);
      if (digitLockKey) {
        this.inFlightPhoneLocks.delete(digitLockKey);
      }
    };
  }
}
