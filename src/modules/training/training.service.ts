import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { TrainingProgram, EmployeeTraining, TrainingStatus, Role, User } from '../../common/types.js';
import { CreateTrainingProgramDto } from './dto/create-program.dto.js';
import { EnrollTrainingDto } from './dto/enroll-training.dto.js';
import { UpdateTrainingProgressDto } from './dto/update-progress.dto.js';

@Injectable()
export class TrainingService {
  constructor(private readonly db: DatabaseService) {}

  getPrograms(actorUser?: User) {
    let list = this.db.trainingPrograms;
    if (actorUser && actorUser.role !== Role.SUPER_ADMIN && actorUser.companyId) {
      list = list.filter((p) => !p.companyId || p.companyId === actorUser.companyId);
    }
    return list;
  }

  createProgram(data: CreateTrainingProgramDto, actorUser?: User): TrainingProgram {
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      throw new ForbiddenException('Employees cannot create training programs');
    }

    const targetCompanyId = actorUser?.companyId || this.db.companies[0]?.id || 'cmp-1';
    const targetCompanyCode =
      actorUser?.companyCode ||
      this.db.companies.find((c) => c.id === targetCompanyId)?.companyCode ||
      '';

    const newProg: TrainingProgram = {
      id: `trn-${Date.now()}`,
      companyId: targetCompanyId,
      companyCode: targetCompanyCode,
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

  getEmployeeTrainings(employeeId?: string, actorUser?: User) {
    let list = this.db.employeeTrainings;

    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (t) =>
            t.employeeId === actorUser.id ||
            (t as any).userId === actorUser.id ||
            (actorUser.employeeId && t.employeeId === actorUser.employeeId),
        );
      } else if (actorUser.role === Role.ADMIN && actorUser.companyId) {
        list = list.filter((t) => {
          if (t.companyId) return t.companyId === actorUser.companyId;
          const u = this.db.users.find(
            (usr) => usr.id === t.employeeId || usr.employeeId === t.employeeId || (t as any).userId === usr.id,
          );
          return u?.companyId === actorUser.companyId;
        });
      }
    }

    if (employeeId) {
      const user = this.db.resolveUser(employeeId);
      const targetId = user ? user.id : employeeId;
      list = list.filter(
        (t) => t.employeeId === targetId || (t as any).userId === targetId || t.employeeId === employeeId,
      );
    }

    return list.map((t) => {
      const user = this.db.users.find(
        (u) => u.id === t.employeeId || u.employeeId === t.employeeId || (t as any).userId === u.id,
      );
      const realUserId = user ? user.id : t.employeeId;
      const { employeeId: _, id: tId, ...rest } = t;
      const resObj: any = {
        id: tId,
        userId: realUserId,
        role: user?.role || 'EMPLOYEE',
        companyId: t.companyId || user?.companyId || '',
        companyCode: t.companyCode || user?.companyCode || '',
        ...rest,
      };
      Object.defineProperty(resObj, 'employeeId', {
        value: realUserId,
        enumerable: false,
        configurable: true,
        writable: true,
      });
      return resObj;
    });
  }

  enroll(dto: EnrollTrainingDto, actorUser?: User) {
    let targetId = (dto as any).userId || dto.employeeId;
    if (actorUser && actorUser.role === Role.EMPLOYEE) {
      targetId = actorUser.id;
    }

    const { trainingId } = dto;
    const program = this.db.trainingPrograms.find((p) => p.id === trainingId);
    if (!program) throw new NotFoundException('Training program not found');

    const user = this.db.resolveUser(targetId);
    if (!user) throw new NotFoundException('User not found');

    if (actorUser && actorUser.role === Role.ADMIN && actorUser.companyId) {
      if (user.companyId && user.companyId !== actorUser.companyId) {
        throw new ForbiddenException('Cannot enroll employee of another company');
      }
    }

    const realUserId = user.id;
    const empName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    const existing = this.db.employeeTrainings.find(
      (t) =>
        t.trainingId === trainingId &&
        (t.employeeId === realUserId || (t as any).userId === realUserId || t.employeeId === targetId),
    );
    if (existing) return existing;

    const targetCompanyId = user.companyId || program.companyId || actorUser?.companyId || '';
    const targetCompanyCode = user.companyCode || program.companyCode || actorUser?.companyCode || '';

    const newEnrollment: EmployeeTraining = {
      id: `et-${Date.now()}`,
      companyId: targetCompanyId,
      companyCode: targetCompanyCode,
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
    program.enrolledCount = (program.enrolledCount || 0) + 1;
    this.db.persist();

    const { employeeId: _, id: etId, ...rest } = newEnrollment;
    const resObj: any = {
      id: etId,
      userId: realUserId,
      ...rest,
    };
    Object.defineProperty(resObj, 'employeeId', {
      value: realUserId,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return resObj;
  }

  updateProgress(id: string, dto: UpdateTrainingProgressDto, actorUser?: User) {
    const enrollment = this.db.employeeTrainings.find((t) => t.id === id);
    if (!enrollment) throw new NotFoundException('Training enrollment not found');

    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        const isOwner =
          enrollment.employeeId === actorUser.id ||
          (enrollment as any).userId === actorUser.id ||
          (actorUser.employeeId && enrollment.employeeId === actorUser.employeeId);
        if (!isOwner) {
          throw new ForbiddenException('Employees can only update their own training progress');
        }
      } else if (actorUser.role === Role.ADMIN && actorUser.companyId && enrollment.companyId) {
        if (enrollment.companyId !== actorUser.companyId) {
          throw new ForbiddenException('Cannot modify enrollment of another company');
        }
      }
    }

    enrollment.progressPercent = Math.min(100, Math.max(0, dto.progressPercent));
    if (enrollment.progressPercent === 100) {
      enrollment.status = TrainingStatus.COMPLETED;
      enrollment.certificateUrl = `/certificates/cert-${enrollment.id}.pdf`;
    } else if (enrollment.progressPercent > 0) {
      enrollment.status = TrainingStatus.IN_PROGRESS;
    }

    this.db.persist();
    return enrollment;
  }
}
