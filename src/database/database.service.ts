import {
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type mysql from 'mysql2/promise';
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
} from '../common/types.js';
import {
  initialCompanies,
  initialLocations,
  initialDepartments,
  initialDesignations,
  initialUsers,
  initialEmployees,
  initialHolidays,
  initialLeaveBalances,
  initialLeaveRequests,
  initialAttendanceRecords,
  initialPayrollRecords,
  initialJobs,
  initialCandidates,
  initialAssets,
  initialTrainingPrograms,
  initialEmployeeTrainings,
  initialPerformanceCycles,
  initialPerformanceReviews,
  initialResignations,
  initialAnnouncements,
  initialNotifications,
  initialDocuments,
  initialAuditLogs,
} from './seed-data.js';
import {
  getMysqlPool,
  initializeMysqlTables,
  syncDataToMysql,
  loadAllDataFromMysql,
} from './mysql-sync.js';
import { hashPassword } from '../common/utils/password.util.js';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private mysqlPool: mysql.Pool | null = null;
  private isMysqlConnected = false;

  private pendingPersist = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

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
  public chatByCompany: Record<string, { conversations: any[]; messages: Record<string, any[]> }> = {};
  public companySchedules: Record<string, any> = {};
  public companyPlans: Record<string, any> = {};
  public systemSettings: any = null;

  constructor() {
    // Ensure any legacy database.json files are removed and not created
    this.cleanLegacyFiles();
  }

  private cleanLegacyFiles() {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'backend', 'data', 'database.json'),
        path.resolve(process.cwd(), 'backend', 'data', 'database.backup.json'),
        path.resolve(process.cwd(), 'data', 'database.json'),
        path.resolve(process.cwd(), 'data', 'database.backup.json'),
      ];
      for (const file of candidates) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          this.logger.log(`Removed legacy file: ${file}`);
        }
      }
    } catch {}
  }

  async onModuleInit() {
    // 1. Initialize baseline in-memory state
    this.seedInitialData();

    // 2. Connect to MySQL and synchronize data
    await this.initMysqlSync();

    // 3. Post-load adjustments
    this.runPostLoadNormalizations();
  }

  private async initMysqlSync() {
    try {
      this.mysqlPool = await getMysqlPool();
      await initializeMysqlTables(this.mysqlPool);
      this.isMysqlConnected = true;
      this.logger.log('Connected to XAMPP MySQL database "hrms". All tables verified.');

      // Load persistent state directly from MySQL
      const loaded = await loadAllDataFromMysql(this.mysqlPool);
      if (loaded && loaded.companies && loaded.companies.length > 0) {
        this.companies = loaded.companies;
        this.locations = loaded.locations || this.locations;
        this.departments = loaded.departments || this.departments;
        this.designations = loaded.designations || this.designations;
        this.users = loaded.users || this.users;
        this.employees = loaded.employees || this.employees;
        this.holidays = loaded.holidays || this.holidays;
        this.leaveBalances = loaded.leaveBalances || this.leaveBalances;
        this.leaveRequests = loaded.leaveRequests || this.leaveRequests;
        this.attendanceRecords = loaded.attendanceRecords || this.attendanceRecords;
        this.workSessions = loaded.workSessions || this.workSessions;
        this.payrollRecords = loaded.payrollRecords || this.payrollRecords;
        this.jobs = loaded.jobs || this.jobs;
        this.candidates = loaded.candidates || this.candidates;
        this.assets = loaded.assets || this.assets;
        this.trainingPrograms = loaded.trainingPrograms || this.trainingPrograms;
        this.employeeTrainings = loaded.employeeTrainings || this.employeeTrainings;
        this.performanceCycles = loaded.performanceCycles || this.performanceCycles;
        this.performanceReviews = loaded.performanceReviews || this.performanceReviews;
        this.resignations = loaded.resignations || this.resignations;
        this.announcements = loaded.announcements || this.announcements;
        this.notifications = loaded.notifications || this.notifications;
        this.documents = loaded.documents || this.documents;
        this.auditLogs = loaded.auditLogs || this.auditLogs;
        this.systemSettings = loaded.systemSettings || this.systemSettings;
        this.logger.log(`Loaded ${this.companies.length} companies and ${this.users.length} users from MySQL.`);
      } else {
        // MySQL is fresh/empty: push baseline in-memory data to MySQL
        await this.syncToMysql(this.getCurrentData());
        this.logger.log('Seeded initial enterprise records into MySQL database.');
      }
    } catch (err: any) {
      this.logger.warn(
        `MySQL connection to "hrms" failed or not reachable (${err?.code || err?.message || 'offline'}). Operating in-memory.`,
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

  private runPostLoadNormalizations() {
    const ownerCompanyId = this.companies[0]?.id;
    if (ownerCompanyId) {
      for (const dept of this.departments) {
        if (!dept.companyId) dept.companyId = ownerCompanyId;
      }
      for (const des of this.designations) {
        if (!des.companyId) des.companyId = ownerCompanyId;
      }
      for (const loc of this.locations) {
        if (!loc.companyId) loc.companyId = ownerCompanyId;
      }
      for (const notice of this.announcements) {
        if (!notice.companyId) notice.companyId = ownerCompanyId;
      }
    }

    // Default company association for legacy records
    const defaultCompany = this.companies[0];
    if (defaultCompany) {
      for (const emp of this.employees) {
        if (!emp.companyId) {
          emp.companyId = defaultCompany.id;
          emp.companyCode = defaultCompany.companyCode;
        }
      }
      for (const u of this.users) {
        if (u.role !== Role.SUPER_ADMIN && !u.companyId) {
          u.companyId = defaultCompany.id;
          u.companyCode = defaultCompany.companyCode;
        }
      }
    }

    // Geofence configuration on locations
    for (const loc of this.locations) {
      if (loc.latitude === undefined || loc.longitude === undefined || loc.radiusMeters === undefined) {
        if (loc.city?.toLowerCase().includes('surat') || loc.address?.toLowerCase().includes('surat')) {
          loc.latitude = loc.latitude ?? 21.17024;
          loc.longitude = loc.longitude ?? 72.831061;
        } else if (loc.city?.toLowerCase().includes('new york')) {
          loc.latitude = loc.latitude ?? 40.712776;
          loc.longitude = loc.longitude ?? -74.005974;
        } else if (loc.city?.toLowerCase().includes('san francisco')) {
          loc.latitude = loc.latitude ?? 37.774929;
          loc.longitude = loc.longitude ?? -122.419416;
        } else {
          loc.latitude = loc.latitude ?? 21.17024;
          loc.longitude = loc.longitude ?? 72.831061;
        }
        loc.radiusMeters = loc.radiusMeters ?? 200;
        loc.isActive = loc.isActive ?? true;
        loc.companyId = loc.companyId || defaultCompany?.id || 'cmp-1';
      }
    }

    // Auto-encrypt/hash any plain text passwords
    let passwordsHashed = false;
    for (const u of this.users) {
      if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
        u.password = hashPassword(u.password);
        passwordsHashed = true;
      }
    }
    for (const emp of this.employees) {
      if (emp.password && !emp.password.startsWith('$2a$') && !emp.password.startsWith('$2b$')) {
        emp.password = hashPassword(emp.password);
        passwordsHashed = true;
      }
    }

    // Normalize avatar URLs
    let avatarsNormalized = false;
    for (const u of this.users) {
      if (
        u.avatarUrl &&
        u.avatarUrl.includes('/uploads/profiles/') &&
        (u.avatarUrl.startsWith('http://') || u.avatarUrl.startsWith('https://'))
      ) {
        const match = u.avatarUrl.match(/\/uploads\/profiles\/([^\s?#]+)/i);
        if (match) {
          u.avatarUrl = `/uploads/profiles/${match[1]}`;
          avatarsNormalized = true;
        }
      }
    }
    for (const emp of this.employees) {
      if (
        emp.avatarUrl &&
        emp.avatarUrl.includes('/uploads/profiles/') &&
        (emp.avatarUrl.startsWith('http://') || emp.avatarUrl.startsWith('https://'))
      ) {
        const match = emp.avatarUrl.match(/\/uploads\/profiles\/([^\s?#]+)/i);
        if (match) {
          emp.avatarUrl = `/uploads/profiles/${match[1]}`;
          avatarsNormalized = true;
        }
      }
    }

    if (passwordsHashed || avatarsNormalized) {
      this.persist();
    }
  }

  public getCurrentData() {
    return {
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
      chatByCompany: this.chatByCompany,
      companySchedules: this.companySchedules,
      companyPlans: this.companyPlans,
      systemSettings: this.systemSettings,
    };
  }

  private seedInitialData() {
    this.companies = [...initialCompanies];
    this.locations = [...initialLocations];
    this.departments = [...initialDepartments];
    this.designations = [...initialDesignations];
    this.users = [...initialUsers];
    this.employees = [...initialEmployees];
    this.holidays = [...initialHolidays];
    this.leaveBalances = [...initialLeaveBalances];
    this.leaveRequests = [...initialLeaveRequests];
    this.attendanceRecords = [...initialAttendanceRecords];
    this.workSessions = [];
    this.payrollRecords = [...initialPayrollRecords];
    this.jobs = [...initialJobs];
    this.candidates = [...initialCandidates];
    this.assets = [...initialAssets];
    this.trainingPrograms = [...initialTrainingPrograms];
    this.employeeTrainings = [...initialEmployeeTrainings];
    this.performanceCycles = [...initialPerformanceCycles];
    this.performanceReviews = [...initialPerformanceReviews];
    this.resignations = [...initialResignations];
    this.announcements = [...initialAnnouncements];
    this.notifications = [...initialNotifications];
    this.documents = [...initialDocuments];
    this.auditLogs = [...initialAuditLogs];
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

  public persist(): void {
    this.pendingPersist = true;
    if (this.debounceTimer) {
      return;
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flushPersist();
    }, 50);
  }

  public async persistAsync(): Promise<void> {
    this.pendingPersist = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.flushPersist();
  }

  public persistSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingPersist = false;
    void this.syncToMysql(this.getCurrentData());
  }

  private async flushPersist(): Promise<void> {
    if (!this.pendingPersist || this.isSyncing) return;
    this.pendingPersist = false;
    this.isSyncing = true;
    try {
      await this.syncToMysql(this.getCurrentData());
    } finally {
      this.isSyncing = false;
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
  ) {
    const log: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
}
