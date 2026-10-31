import { Injectable, OnModuleInit, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type mysql from 'mysql2/promise';
import { normalizeEmail, EMAIL_ALREADY_REGISTERED_MESSAGE } from '../common/utils/email.util.js';
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
import { getMysqlPool, initializeMysqlTables, syncDataToMysql } from './mysql-sync.js';
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

  async onModuleInit() {
    this.initDatabase();
    await this.initMysqlSync();
  }

  private initDatabase() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dbFilePath)) {
        const fileContent = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed: DatabaseSchema = JSON.parse(fileContent);
        this.companies =
          parsed.companies && parsed.companies.length > 0
            ? parsed.companies
            : [...initialCompanies];
        this.locations = parsed.locations || initialLocations;
        this.departments = parsed.departments || initialDepartments;
        this.designations = parsed.designations || initialDesignations;
        this.users = parsed.users !== undefined ? parsed.users : initialUsers;
        this.employees = parsed.employees || initialEmployees;
        this.holidays = parsed.holidays || initialHolidays;
        this.leaveBalances = parsed.leaveBalances || initialLeaveBalances;
        this.leaveRequests = parsed.leaveRequests || initialLeaveRequests;
        this.attendanceRecords = parsed.attendanceRecords || initialAttendanceRecords;
        this.payrollRecords = parsed.payrollRecords || initialPayrollRecords;
        this.jobs = parsed.jobs || initialJobs;
        this.candidates = parsed.candidates || initialCandidates;
        this.assets = parsed.assets || initialAssets;
        this.trainingPrograms = parsed.trainingPrograms || initialTrainingPrograms;
        this.employeeTrainings = parsed.employeeTrainings || initialEmployeeTrainings;
        this.performanceCycles = parsed.performanceCycles || initialPerformanceCycles;
        this.performanceReviews = parsed.performanceReviews || initialPerformanceReviews;
        this.resignations = parsed.resignations || initialResignations;
        this.announcements = parsed.announcements || initialAnnouncements;
        this.notifications = parsed.notifications || initialNotifications;
        this.documents = parsed.documents || initialDocuments;
        this.auditLogs = parsed.auditLogs || initialAuditLogs;
        this.workSessions = parsed.workSessions || [];

        // Ensure default company association for existing legacy records
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

        // Ensure geofence configuration on locations
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
        // Normalize any absolute localhost/IP avatar URLs to clean relative paths
        let avatarsNormalized = false;
        for (const u of this.users) {
          if (u.avatarUrl && u.avatarUrl.includes('/uploads/profiles/') && (u.avatarUrl.startsWith('http://') || u.avatarUrl.startsWith('https://'))) {
            const match = u.avatarUrl.match(/\/uploads\/profiles\/([^\s?#]+)/i);
            if (match) {
              u.avatarUrl = `/uploads/profiles/${match[1]}`;
              avatarsNormalized = true;
            }
          }
        }
        for (const emp of this.employees) {
          if (emp.avatarUrl && emp.avatarUrl.includes('/uploads/profiles/') && (emp.avatarUrl.startsWith('http://') || emp.avatarUrl.startsWith('https://'))) {
            const match = emp.avatarUrl.match(/\/uploads\/profiles\/([^\s?#]+)/i);
            if (match) {
              emp.avatarUrl = `/uploads/profiles/${match[1]}`;
              avatarsNormalized = true;
            }
          }
        }

        // Normalize users & employee linkages with unified user IDs
        let usersNormalized = false;
        const legacyEmpMap = new Map<string, string>();
        for (const u of this.users) {
          if (u.role === Role.EMPLOYEE) {
            if (u.employeeId && u.employeeId !== u.id) {
              legacyEmpMap.set(u.employeeId, u.id);
            }
            const tsMatch = u.id.match(/\d+/);
            if (tsMatch) {
              legacyEmpMap.set(`emp-${tsMatch[0]}`, u.id);
            }
            if (u.employeeId !== u.id) {
              u.employeeId = u.id;
              usersNormalized = true;
            }
          }
          if ((u.role === Role.SUPER_ADMIN || u.isSuperAdmin) && !u.permissions) {
            u.permissions = ['*'];
            usersNormalized = true;
          }
        }

        // Keep employees aligned with unified users with role EMPLOYEE
        const employeeUsers = this.users.filter((u) => u.role === Role.EMPLOYEE);
        if (employeeUsers.length > 0) {
          this.employees = employeeUsers.map((u) => ({
            ...u,
            id: u.id,
            userId: u.id,
            employeeId: u.id,
          })) as unknown as Employee[];
        }

        // Migrate any legacy employeeId in related collections to unified user.id
        for (const lr of this.leaveRequests) {
          if (lr.employeeId && (lr.employeeId.startsWith('emp-') || legacyEmpMap.has(lr.employeeId))) {
            const mapped = legacyEmpMap.get(lr.employeeId) || this.users.find(u => u.id === lr.employeeId || u.employeeId === lr.employeeId)?.id;
            if (mapped) {
              lr.employeeId = mapped;
              (lr as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const ar of this.attendanceRecords) {
          if (ar.employeeId && (ar.employeeId.startsWith('emp-') || legacyEmpMap.has(ar.employeeId))) {
            const mapped = legacyEmpMap.get(ar.employeeId) || this.users.find(u => u.id === ar.employeeId || u.employeeId === ar.employeeId)?.id;
            if (mapped) {
              ar.employeeId = mapped;
              (ar as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const pr of this.payrollRecords) {
          if (pr.employeeId && (pr.employeeId.startsWith('emp-') || legacyEmpMap.has(pr.employeeId))) {
            const mapped = legacyEmpMap.get(pr.employeeId) || this.users.find(u => u.id === pr.employeeId || u.employeeId === pr.employeeId)?.id;
            if (mapped) {
              pr.employeeId = mapped;
              (pr as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const ws of this.workSessions) {
          if (ws.employeeId && (ws.employeeId.startsWith('emp-') || legacyEmpMap.has(ws.employeeId))) {
            const mapped = legacyEmpMap.get(ws.employeeId) || this.users.find(u => u.id === ws.employeeId || u.employeeId === ws.employeeId)?.id;
            if (mapped) {
              ws.employeeId = mapped;
              (ws as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const lb of this.leaveBalances) {
          if (lb.employeeId && (lb.employeeId.startsWith('emp-') || legacyEmpMap.has(lb.employeeId))) {
            const mapped = legacyEmpMap.get(lb.employeeId) || this.users.find(u => u.id === lb.employeeId || u.employeeId === lb.employeeId)?.id;
            if (mapped) {
              lb.employeeId = mapped;
              (lb as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const doc of this.documents) {
          if (doc.employeeId && (doc.employeeId.startsWith('emp-') || legacyEmpMap.has(doc.employeeId))) {
            const mapped = legacyEmpMap.get(doc.employeeId) || this.users.find(u => u.id === doc.employeeId || u.employeeId === doc.employeeId)?.id;
            if (mapped) {
              doc.employeeId = mapped;
              (doc as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const r of this.resignations) {
          if (r.employeeId && (r.employeeId.startsWith('emp-') || legacyEmpMap.has(r.employeeId))) {
            const mapped = legacyEmpMap.get(r.employeeId) || this.users.find(u => u.id === r.employeeId || u.employeeId === r.employeeId)?.id;
            if (mapped) {
              r.employeeId = mapped;
              (r as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const a of this.assets) {
          if (a.assignedToEmployeeId && (a.assignedToEmployeeId.startsWith('emp-') || legacyEmpMap.has(a.assignedToEmployeeId))) {
            const mapped = legacyEmpMap.get(a.assignedToEmployeeId) || this.users.find(u => u.id === a.assignedToEmployeeId || u.employeeId === a.assignedToEmployeeId)?.id;
            if (mapped) {
              a.assignedToEmployeeId = mapped;
              (a as any).assignedToUserId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const pr of this.performanceReviews) {
          if (pr.employeeId && (pr.employeeId.startsWith('emp-') || legacyEmpMap.has(pr.employeeId))) {
            const mapped = legacyEmpMap.get(pr.employeeId) || this.users.find(u => u.id === pr.employeeId || u.employeeId === pr.employeeId)?.id;
            if (mapped) {
              pr.employeeId = mapped;
              (pr as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const et of this.employeeTrainings) {
          if (et.employeeId && (et.employeeId.startsWith('emp-') || legacyEmpMap.has(et.employeeId))) {
            const mapped = legacyEmpMap.get(et.employeeId) || this.users.find(u => u.id === et.employeeId || u.employeeId === et.employeeId)?.id;
            if (mapped) {
              et.employeeId = mapped;
              (et as any).userId = mapped;
              usersNormalized = true;
            }
          }
        }
        for (const log of this.auditLogs) {
          if (log.userId && (log.userId.startsWith('emp-') || legacyEmpMap.has(log.userId))) {
            const mapped = legacyEmpMap.get(log.userId) || this.users.find(u => u.id === log.userId || u.employeeId === log.userId)?.id;
            if (mapped) {
              log.userId = mapped;
              usersNormalized = true;
            }
          }
          if (log.recordId && (log.recordId.startsWith('emp-') || legacyEmpMap.has(log.recordId))) {
            const mapped = legacyEmpMap.get(log.recordId) || this.users.find(u => u.id === log.recordId || u.employeeId === log.recordId)?.id;
            if (mapped) {
              log.recordId = mapped;
              usersNormalized = true;
            }
          }
        }

        if (passwordsHashed || avatarsNormalized || usersNormalized) {
          this.persist();
        }

        this.logger.log('Database loaded successfully from file with companies.');
      } else {
        this.seedInitialData();
        this.persist();
        this.logger.log('Database seeded with initial enterprise demo data and persisted.');
      }
    } catch (err) {
      this.logger.error('Failed to initialize database, falling back to seed memory.', err);
      this.seedInitialData();
    }
  }

  private async initMysqlSync() {
    try {
      this.mysqlPool = await getMysqlPool();
      await initializeMysqlTables(this.mysqlPool);
      this.isMysqlConnected = true;
      this.logger.log('Connected to XAMPP MySQL database "hrms". All tables verified.');

      // If MySQL already has companies, load them into memory so phpMyAdmin deletions are respected!
      try {
        const [mysqlCompanies]: any = await this.mysqlPool.query(`SELECT * FROM companies`);
        if (mysqlCompanies && Array.isArray(mysqlCompanies) && mysqlCompanies.length > 0) {
          this.companies = mysqlCompanies.map((c: any) => ({
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
        }
      } catch (loadErr) {
        this.logger.warn('Could not read existing companies from MySQL:', loadErr);
      }

      // Push initial data to MySQL so phpMyAdmin shows all records
      await this.syncToMysql({
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
      });
      this.logger.log('Synchronized records into XAMPP MySQL "hrms" database successfully.');
    } catch (err) {
      this.logger.warn(
        'MySQL connection to "hrms" failed or not reachable. Operating with local file fallback.',
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

  private persistTimeout: any = null;
  private isPersisting = false;

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
      };

      const tempPath = `${this.dbFilePath}.tmp-${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.dbFilePath);

      // Also persist to MySQL
      void this.syncToMysql(data);
    } catch (err) {
      this.logger.error('Failed to persist database file', err);
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

  private inFlightEmailLocks = new Set<string>();

  /**
   * Asserts strict global email uniqueness across all roles (SUPER_ADMIN, ADMIN, EMPLOYEE).
   * Checks both in-memory state and live MySQL users table.
   * Handles concurrent in-flight requests.
   */
  public async assertEmailUnique(
    email: string,
    excludeUserId?: string,
    lockAlreadyAcquired = false,
  ): Promise<string> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new BadRequestException('Email address is required.');
    }

    // 1. Check in-flight lock for concurrent requests
    if (!lockAlreadyAcquired && this.inFlightEmailLocks.has(normalized)) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }

    // 2. Check in-memory users collection
    const userConflict = this.users.find(
      (u) => normalizeEmail(u.email) === normalized && u.id !== excludeUserId,
    );
    if (userConflict) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }

    // 3. Check in-memory employees collection
    const empConflict = this.employees.find(
      (e) =>
        normalizeEmail(e.email) === normalized &&
        e.id !== excludeUserId &&
        e.userId !== excludeUserId,
    );
    if (empConflict) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }

    // 4. Check live MySQL users table (database-level concurrency safety)
    if (this.mysqlPool && this.isMysqlConnected) {
      try {
        const [rows]: any = await this.mysqlPool.query(
          excludeUserId
            ? `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? AND id != ? LIMIT 1`
            : `SELECT id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
          excludeUserId ? [normalized, excludeUserId] : [normalized],
        );
        if (rows && rows.length > 0) {
          throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
        }
      } catch (dbErr) {
        if (dbErr instanceof ConflictException) throw dbErr;
        this.logger.warn(`Could not verify email in MySQL: ${dbErr}`);
      }
    }

    return normalized;
  }

  /**
   * Acquires a lock on the normalized email for the duration of an asynchronous operation
   */
  public acquireEmailLock(email: string): () => void {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new BadRequestException('Email address is required.');
    }
    if (this.inFlightEmailLocks.has(normalized)) {
      throw new ConflictException(EMAIL_ALREADY_REGISTERED_MESSAGE);
    }
    this.inFlightEmailLocks.add(normalized);
    return () => {
      this.inFlightEmailLocks.delete(normalized);
    };
  }
}
