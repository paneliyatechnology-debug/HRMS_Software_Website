import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { TrainingProgram, EmployeeTraining, TrainingStatus } from '../../common/types.js';
import { CreateTrainingProgramDto } from './dto/create-program.dto.js';
import { EnrollTrainingDto } from './dto/enroll-training.dto.js';
import { UpdateTrainingProgressDto } from './dto/update-progress.dto.js';

@Injectable()
export class TrainingService {
  constructor(private readonly db: DatabaseService) {}

  getPrograms() {
    return this.db.trainingPrograms;
  }

  createProgram(data: CreateTrainingProgramDto): TrainingProgram {
    const newProg: TrainingProgram = {
      id: `trn-${Date.now()}`,
      title: data.title || 'New Course',
      description: data.description || 'Course description',
      trainerName: data.trainerName || 'Corporate Trainer',
      skillsCovered: data.skillsCovered || ['Professional Skills'],
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      endDate: data.endDate || new Date().toISOString().split('T')[0],
      durationHours: data.durationHours || 4,
      status: 'Upcoming',
      enrolledCount: 0,
    };
    this.db.trainingPrograms.unshift(newProg);
    this.db.persist();
    return newProg;
  }

  getEmployeeTrainings(employeeId?: string) {
    let list = this.db.employeeTrainings;
    if (employeeId) {
      const user = this.db.resolveUser(employeeId);
      const targetId = user ? user.id : employeeId;
      list = list.filter((t) => t.employeeId === targetId || (t as any).userId === targetId || t.employeeId === employeeId);
    }
    return list.map((t) => {
      const user = this.db.users.find((u) => u.id === t.employeeId || u.employeeId === t.employeeId || (t as any).userId === u.id);
      const realUserId = user ? user.id : t.employeeId;
      return {
        ...t,
        userId: realUserId,
        employeeId: realUserId,
        role: user?.role || 'EMPLOYEE',
      };
    });
  }

  enroll(dto: EnrollTrainingDto) {
    const targetId = (dto as any).userId || dto.employeeId;
    const { trainingId } = dto;
    const program = this.db.trainingPrograms.find((p) => p.id === trainingId);
    if (!program) throw new NotFoundException('Training program not found');

    const user = this.db.resolveUser(targetId);
    if (!user) throw new NotFoundException('User not found');

    const realUserId = user.id;
    const empName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    const existing = this.db.employeeTrainings.find(
      (t) => t.trainingId === trainingId && (t.employeeId === realUserId || (t as any).userId === realUserId || t.employeeId === targetId),
    );
    if (existing) return existing;

    const newEnrollment: EmployeeTraining = {
      id: `et-${Date.now()}`,
      trainingId,
      trainingTitle: program.title,
      employeeId: realUserId,
      employeeName: empName || 'Employee',
      status: TrainingStatus.ASSIGNED,
      progressPercent: 0,
    };
    (newEnrollment as any).userId = realUserId;
    (newEnrollment as any).role = user?.role || 'EMPLOYEE';

    this.db.employeeTrainings.unshift(newEnrollment);
    program.enrolledCount += 1;
    this.db.persist();
    return newEnrollment;
  }

  updateProgress(enrollmentId: string, dto: UpdateTrainingProgressDto) {
    const record = this.db.employeeTrainings.find((t) => t.id === enrollmentId);
    if (!record) throw new NotFoundException('Enrollment not found');

    record.progressPercent = dto.progressPercent;
    if (dto.progressPercent >= 100) {
      record.status = TrainingStatus.COMPLETED;
      record.completionDate = new Date().toISOString().split('T')[0];
      record.certificateUrl = `/certificates/cert-${record.id}.pdf`;
    } else if (dto.progressPercent > 0) {
      record.status = TrainingStatus.IN_PROGRESS;
    }

    this.db.persist();
    return record;
  }
}
