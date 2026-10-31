import {
  User,
  Department,
  Designation,
  Location,
  Employee,
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
} from '../common/types.js';

// Strictly zero static mock data. Everything is loaded directly from live MySQL database.
export const initialCompanies: Company[] = [];
export const initialLocations: Location[] = [];
export const initialDepartments: Department[] = [];
export const initialDesignations: Designation[] = [];
export const initialUsers: User[] = [];
export const initialEmployees: Employee[] = [];
export const initialHolidays: Holiday[] = [];
export const initialLeaveBalances: LeaveBalance[] = [];
export const initialLeaveRequests: LeaveRequest[] = [];
export const initialAttendanceRecords: AttendanceRecord[] = [];
export const initialPayrollRecords: PayrollRecord[] = [];
export const initialJobs: JobOpening[] = [];
export const initialCandidates: Candidate[] = [];
export const initialAssets: CompanyAsset[] = [];
export const initialTrainingPrograms: TrainingProgram[] = [];
export const initialEmployeeTrainings: EmployeeTraining[] = [];
export const initialPerformanceCycles: PerformanceCycle[] = [];
export const initialPerformanceReviews: PerformanceReview[] = [];
export const initialResignations: Resignation[] = [];
export const initialAnnouncements: Announcement[] = [];
export const initialNotifications: NotificationItem[] = [];
export const initialDocuments: EmployeeDocument[] = [];
export const initialAuditLogs: AuditLog[] = [];
