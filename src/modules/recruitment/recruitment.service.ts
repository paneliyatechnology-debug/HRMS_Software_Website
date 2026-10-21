import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { JobOpening, Candidate, CandidateStatus, EmployeeStatus } from '../../common/types.js';
import { CreateJobOpeningDto } from './dto/create-job.dto.js';
import { CreateCandidateDto } from './dto/create-candidate.dto.js';
import { UpdateCandidateStatusDto } from './dto/update-candidate-status.dto.js';
import { ScheduleInterviewDto } from './dto/schedule-interview.dto.js';
import { ConvertCandidateDto } from './dto/convert-candidate.dto.js';

@Injectable()
export class RecruitmentService {
  constructor(private readonly db: DatabaseService) {}

  getJobs() {
    return this.db.jobs.map((job) => {
      const applicantCount = this.db.candidates.filter((c) => c.jobId === job.id).length;
      return { ...job, applicantCount };
    });
  }

  createJob(data: CreateJobOpeningDto): JobOpening {
    const newJob: JobOpening = {
      id: `job-${Date.now()}`,
      title: data.title || 'Untitled Role',
      departmentId: data.departmentId || 'dept-1',
      departmentName: data.departmentName || 'Engineering',
      designationTitle: data.designationTitle || 'Engineer',
      location: data.location || 'San Francisco, CA (Hybrid)',
      employmentType: data.employmentType || 'Full-time',
      experienceLevel: data.experienceLevel || 'Mid-Level',
      openingsCount: data.openingsCount || 1,
      salaryRange: data.salaryRange || '$90,000 - $130,000',
      description: data.description || 'Job description',
      skillsRequired: data.skillsRequired || ['Communication'],
      status: 'Published',
      postedDate: new Date().toISOString().split('T')[0],
      applicantCount: 0,
    };

    this.db.jobs.unshift(newJob);
    this.db.persist();
    return newJob;
  }

  getCandidates(jobId?: string) {
    if (jobId && jobId !== 'ALL') {
      return this.db.candidates.filter((c) => c.jobId === jobId);
    }
    return this.db.candidates;
  }

  createCandidate(data: CreateCandidateDto): Candidate {
    const job = this.db.jobs.find((j) => j.id === data.jobId);
    const newCandidate: Candidate = {
      id: `cand-${Date.now()}`,
      jobId: data.jobId || 'job-1',
      jobTitle: job?.title || data.jobTitle || 'Senior Full Stack Engineer',
      fullName: data.fullName || 'Candidate Name',
      email: data.email || 'candidate@example.com',
      phone: data.phone || '+1 (555) 000-1111',
      resumeUrl: data.resumeUrl || '/resumes/sample.pdf',
      experienceYears: data.experienceYears || 3,
      currentCompany: data.currentCompany || 'Current Tech Co',
      skills: data.skills || ['JavaScript'],
      source: data.source || 'Website',
      status: CandidateStatus.APPLIED,
      appliedDate: new Date().toISOString().split('T')[0],
      rating: 4.0,
      notes: data.notes,
      interviews: [],
    };

    this.db.candidates.unshift(newCandidate);
    this.db.persist();
    return newCandidate;
  }

  updateCandidateStatus(id: string, dto: UpdateCandidateStatusDto) {
    const candidate = this.db.candidates.find((c) => c.id === id);
    if (!candidate) throw new NotFoundException('Candidate not found');

    const oldStatus = candidate.status;
    candidate.status = dto.status;
    const actorName = dto.actorName || 'Recruiter';

    this.db.logAudit(
      'sys',
      actorName,
      'RECRUITER',
      'CANDIDATE_STATUS_CHANGED',
      'Recruitment',
      `Moved candidate ${candidate.fullName} from ${oldStatus} to ${dto.status}`,
      candidate.id,
    );

    this.db.persist();
    return candidate;
  }

  scheduleInterview(candidateId: string, dto: ScheduleInterviewDto) {
    const candidate = this.db.candidates.find((c) => c.id === candidateId);
    if (!candidate) throw new NotFoundException('Candidate not found');

    if (!candidate.interviews) candidate.interviews = [];

    const interview = {
      id: `int-${Date.now()}`,
      round: dto.round,
      interviewerName: dto.interviewerName,
      scheduledAt: dto.scheduledAt,
      status: 'Scheduled' as const,
    };

    candidate.interviews.push(interview);
    candidate.status = CandidateStatus.INTERVIEW;

    this.db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Interview Scheduled',
      message: `Interview for ${candidate.fullName} with ${dto.interviewerName} scheduled for ${dto.scheduledAt}`,
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/recruitment',
    });

    this.db.persist();
    return candidate;
  }

  convertToEmployee(candidateId: string, dto?: ConvertCandidateDto) {
    const candidate = this.db.candidates.find((c) => c.id === candidateId);
    if (!candidate) throw new NotFoundException('Candidate not found');

    candidate.status = CandidateStatus.HIRED;

    const nextCodeNum = this.db.employees.length + 1;
    const employeeCode = `PAN-${String(nextCodeNum).padStart(3, '0')}`;
    const [firstName, ...rest] = candidate.fullName.split(' ');
    const lastName = rest.join(' ') || 'Employee';
    const actorName = dto?.actorName || 'HR Admin';

    const newEmployee = {
      id: `emp-${Date.now()}`,
      employeeCode,
      firstName,
      lastName,
      email: candidate.email,
      phone: candidate.phone,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      gender: 'Other' as const,
      dateOfBirth: '1995-01-01',
      address: 'Corporate HQ',
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Kin',
        phone: candidate.phone,
      },
      joiningDate: new Date().toISOString().split('T')[0],
      employmentType: 'Full-time' as const,
      status: EmployeeStatus.PROBATION,
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      designationId: 'des-3',
      designationTitle: candidate.jobTitle,
      workLocationId: 'loc-1',
      workLocationName: 'Corporate Headquarters',
      shift: 'General Shift (9 AM - 6 PM)',
      bankDetails: {
        bankName: 'Silicon Valley Bank',
        accountNumber: '99201948191',
        ifscOrRouting: 'SVB00129',
        accountHolderName: `${firstName} ${lastName}`,
      },
      taxInformation: {
        taxId: `TX-${Math.floor(100000 + Math.random() * 900000)}`,
        panOrSsn: '***-**-4910',
        taxRegime: 'New Regime',
      },
      education: [{ degree: 'B.S. in Computer Science', institution: 'University', year: 2018 }],
      previousExperience: [
        {
          company: candidate.currentCompany || 'Prior Tech Co',
          role: candidate.jobTitle,
          years: candidate.experienceYears,
        },
      ],
      skills: candidate.skills,
      salary: {
        basic: 6500,
        hra: 2600,
        allowances: 1600,
        bonus: 800,
        pf: 780,
        tax: 1100,
        professionalTax: 200,
        gross: 11500,
        net: 9420,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.employees.unshift(newEmployee);

    this.db.logAudit(
      'sys',
      actorName,
      'HR_ADMIN',
      'CANDIDATE_CONVERTED_TO_EMPLOYEE',
      'Recruitment',
      `Converted candidate ${candidate.fullName} into employee ${newEmployee.employeeCode}`,
      newEmployee.id,
    );

    this.db.persist();
    return {
      success: true,
      employee: newEmployee,
      message: `Candidate ${candidate.fullName} successfully converted to Employee (${newEmployee.employeeCode})`,
    };
  }
}
