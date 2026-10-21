import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
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
} from '../common/types.js';
import {
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

interface DatabaseSchema {
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
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private dataDir = path.resolve(process.cwd(), 'data');
  private dbFilePath = path.join(this.dataDir, 'database.json');

  public locations: Location[] = [];
  public departments: Department[] = [];
  public designations: Designation[] = [];
  public users: User[] = [];
  public employees: Employee[] = [];
  public holidays: Holiday[] = [];
  public leaveBalances: LeaveBalance[] = [];
  public leaveRequests: LeaveRequest[] = [];
  public attendanceRecords: AttendanceRecord[] = [];
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

  onModuleInit() {
    this.initDatabase();
  }

  private initDatabase() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dbFilePath)) {
        const fileContent = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed: DatabaseSchema = JSON.parse(fileContent);
        this.locations = parsed.locations || initialLocations;
        this.departments = parsed.departments || initialDepartments;
        this.designations = parsed.designations || initialDesignations;
        this.users = parsed.users || initialUsers;
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
        this.logger.log('Database loaded successfully from file.');
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

  private seedInitialData() {
    this.locations = [...initialLocations];
    this.departments = [...initialDepartments];
    this.designations = [...initialDesignations];
    this.users = [...initialUsers];
    this.employees = [...initialEmployees];
    this.holidays = [...initialHolidays];
    this.leaveBalances = [...initialLeaveBalances];
    this.leaveRequests = [...initialLeaveRequests];
    this.attendanceRecords = [...initialAttendanceRecords];
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
      // Re-queue if already in progress
      this.persistTimeout = setTimeout(() => this.executeAtomicPersist(), 30);
      return;
    }

    this.isPersisting = true;
    try {
      const data: DatabaseSchema = {
        locations: this.locations,
        departments: this.departments,
        designations: this.designations,
        users: this.users,
        employees: this.employees,
        holidays: this.holidays,
        leaveBalances: this.leaveBalances,
        leaveRequests: this.leaveRequests,
        attendanceRecords: this.attendanceRecords,
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
    } catch (err) {
      this.logger.error('Failed to persist database file', err);
    } finally {
      this.isPersisting = false;
    }
  }

  public logAudit(userId: string, userName: string, userRole: string, action: string, module: string, details: string, recordId?: string, ipAddress = '127.0.0.1') {
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
