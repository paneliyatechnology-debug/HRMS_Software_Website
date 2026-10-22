export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HR_ADMIN = 'HR_ADMIN',
  HR_EXECUTIVE = 'HR_EXECUTIVE',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  RECRUITER = 'RECRUITER',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
}

export enum EmployeeStatus {
  ACTIVE = 'Active',
  PROBATION = 'Probation',
  ON_NOTICE = 'On Notice',
  RESIGNED = 'Resigned',
  TERMINATED = 'Terminated',
  RETIRED = 'Retired',
  INACTIVE = 'Inactive',
}

export enum AttendanceStatus {
  PRESENT = 'Present',
  ABSENT = 'Absent',
  HALF_DAY = 'Half Day',
  LATE = 'Late',
  ON_LEAVE = 'On Leave',
  HOLIDAY = 'Holiday',
  WEEK_OFF = 'Week Off',
}

export enum LeaveType {
  CASUAL = 'Casual Leave',
  SICK = 'Sick Leave',
  PAID = 'Paid Leave',
  EARNED = 'Earned Leave',
  UNPAID = 'Unpaid Leave',
  COMP_OFF = 'Comp Off',
  MATERNITY = 'Maternity Leave',
  PATERNITY = 'Paternity Leave',
}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  CANCELLED = 'Cancelled',
}

export enum CandidateStatus {
  APPLIED = 'Applied',
  SCREENING = 'Screening',
  INTERVIEW = 'Interview',
  SHORTLISTED = 'Shortlisted',
  SELECTED = 'Selected',
  OFFER = 'Offer',
  HIRED = 'Hired',
  REJECTED = 'Rejected',
}

export enum AssetStatus {
  ASSIGNED = 'Assigned',
  AVAILABLE = 'Available',
  UNDER_REPAIR = 'Under Repair',
  RETIRED = 'Retired',
}

export enum TrainingStatus {
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export enum ResignationStatus {
  SUBMITTED = 'Submitted',
  MANAGER_APPROVED = 'Manager Approved',
  HR_APPROVED = 'HR Approved',
  IN_CLEARANCE = 'In Clearance',
  COMPLETED = 'Completed',
  REJECTED = 'Rejected',
}

export interface User {
  id: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: Role;
  employeeId?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headEmployeeId?: string;
  headName?: string;
  employeeCount: number;
  description?: string;
  createdAt: string;
}

export interface Designation {
  id: string;
  title: string;
  departmentId: string;
  departmentName?: string;
  minSalary: number;
  maxSalary: number;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string;
  isHeadquarter: boolean;
}

export interface Employee {
  id: string;
  employeeCode: string;
  userId?: string;
  password?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  gender: 'Male' | 'Female' | 'Other';
  dateOfBirth: string;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  joiningDate: string;
  employmentType: 'Full-time' | 'Remote' | 'Part-time' | 'Contractual' | 'Hourly';
  status: EmployeeStatus;
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationTitle: string;
  reportingManagerId?: string;
  reportingManagerName?: string;
  workLocationId: string;
  workLocationName: string;
  shift: string;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    ifscOrRouting: string;
    accountHolderName: string;
  };
  taxInformation: {
    taxId: string;
    panOrSsn: string;
    taxRegime: string;
  };
  education: Array<{
    degree: string;
    institution: string;
    year: number;
  }>;
  previousExperience: Array<{
    company: string;
    role: string;
    years: number;
  }>;
  skills: string[];
  salary: {
    basic: number;
    hra: number;
    allowances: number;
    bonus: number;
    pf: number;
    tax: number;
    professionalTax: number;
    gross: number;
    net: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  breakDurationMinutes: number;
  workingHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  remarks?: string;
  createdAt: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  departmentName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  isHalfDay: boolean;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  managerApproverId?: string;
  managerApproverName?: string;
  managerApprovedAt?: string;
  hrApproverId?: string;
  hrApprovedAt?: string;
  comments?: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  year: number;
  casualLeave: { total: number; used: number; remaining: number };
  sickLeave: { total: number; used: number; remaining: number };
  paidLeave: { total: number; used: number; remaining: number };
  maternityLeave?: { total: number; used: number; remaining: number };
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  dayOfWeek: string;
  type: 'Public' | 'Optional' | 'Company';
  description: string;
  locationId?: string;
}

export interface PayrollRecord {
  id: string;
  payrollMonth: string; // e.g. "2026-10"
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  designationTitle: string;
  departmentName: string;
  basicSalary: number;
  hra: number;
  allowances: number;
  bonus: number;
  overtimePay: number;
  grossSalary: number;
  pfDeduction: number;
  taxDeduction: number;
  professionalTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  status: 'Draft' | 'Approved' | 'Processed' | 'Paid';
  paymentDate?: string;
  paymentMethod?: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  employeeName?: string;
  title: string;
  category: 'Identity' | 'Tax' | 'Resume' | 'Offer Letter' | 'Appointment' | 'Experience' | 'Education' | 'Salary' | 'Other';
  fileUrl: string;
  fileSize: string;
  uploadDate: string;
  expiryDate?: string;
  verificationStatus: 'Verified' | 'Pending' | 'Rejected';
  verifiedBy?: string;
}

export interface PerformanceCycle {
  id: string;
  title: string;
  year: number;
  period: string; // "Q1 2026", "Annual 2026"
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Active' | 'Under Review' | 'Completed';
}

export interface PerformanceReview {
  id: string;
  cycleId: string;
  cycleTitle: string;
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  goals: Array<{
    title: string;
    description: string;
    weight: number;
    progress: number;
  }>;
  selfRating?: number;
  selfComments?: string;
  managerRating?: number;
  managerFeedback?: string;
  finalRating?: number;
  appraisalRecommended?: string;
  status: 'Goals Set' | 'Self Assessment' | 'Manager Review' | 'Completed';
  completedAt?: string;
}

export interface TrainingProgram {
  id: string;
  title: string;
  description: string;
  trainerName: string;
  skillsCovered: string[];
  startDate: string;
  endDate: string;
  durationHours: number;
  status: 'Upcoming' | 'In Progress' | 'Completed';
  enrolledCount: number;
}

export interface EmployeeTraining {
  id: string;
  trainingId: string;
  trainingTitle: string;
  employeeId: string;
  employeeName: string;
  status: TrainingStatus;
  progressPercent: number;
  completionDate?: string;
  certificateUrl?: string;
}

export interface JobOpening {
  id: string;
  title: string;
  departmentId: string;
  departmentName: string;
  designationTitle: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  openingsCount: number;
  salaryRange: string;
  description: string;
  skillsRequired: string[];
  status: 'Draft' | 'Published' | 'Closed';
  postedDate: string;
  applicantCount: number;
}

export interface Candidate {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  resumeUrl: string;
  experienceYears: number;
  currentCompany?: string;
  skills: string[];
  source: string;
  status: CandidateStatus;
  appliedDate: string;
  rating?: number;
  notes?: string;
  interviews?: Array<{
    id: string;
    round: string;
    interviewerName: string;
    scheduledAt: string;
    status: 'Scheduled' | 'Completed' | 'Cancelled';
    feedback?: string;
    rating?: number;
  }>;
}

export interface CompanyAsset {
  id: string;
  assetCode: string;
  name: string;
  category: 'Laptop' | 'Monitor' | 'Mobile' | 'Access Card' | 'Vehicle' | 'Other';
  serialNumber: string;
  assignedToEmployeeId?: string;
  assignedToEmployeeName?: string;
  assignedDate?: string;
  condition: 'Excellent' | 'Good' | 'Fair' | 'Damaged';
  status: AssetStatus;
  purchaseDate: string;
}

export interface Resignation {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  resignationDate: string;
  lastWorkingDay: string;
  noticePeriodDays: number;
  reason: string;
  status: ResignationStatus;
  managerApproval: {
    status: 'Pending' | 'Approved' | 'Rejected';
    approvedAt?: string;
    notes?: string;
  };
  clearance: {
    departmentClearance: boolean;
    assetReturned: boolean;
    financeSettlement: boolean;
    exitInterviewCompleted: boolean;
  };
  exitFeedback?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  publishDate: string;
  expiryDate?: string;
  targetAudience: 'All' | 'Department' | 'Management';
  departmentId?: string;
  priority: 'Low' | 'Medium' | 'High';
  authorName: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: 'leave' | 'attendance' | 'payroll' | 'performance' | 'system' | 'birthday';
  isRead: boolean;
  createdAt: string;
  link?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  recordId?: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}
