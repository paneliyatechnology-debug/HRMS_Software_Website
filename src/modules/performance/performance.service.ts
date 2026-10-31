import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { PerformanceReview, Role, User } from '../../common/types.js';
import { SubmitReviewRatingDto } from './dto/submit-rating.dto.js';

@Injectable()
export class PerformanceService {
  constructor(private readonly db: DatabaseService) {}

  getCycles(actorUser?: User) {
    let list = this.db.performanceCycles;
    if (actorUser && actorUser.role !== Role.SUPER_ADMIN && actorUser.companyId) {
      list = list.filter((c) => !c.companyId || c.companyId === actorUser.companyId);
    }
    return list;
  }

  getReviews(employeeId?: string, actorUser?: User) {
    let list = this.db.performanceReviews;

    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        list = list.filter(
          (r) =>
            r.employeeId === actorUser.id ||
            (r as any).userId === actorUser.id ||
            (actorUser.employeeId && r.employeeId === actorUser.employeeId),
        );
      } else if (actorUser.role === Role.ADMIN && actorUser.companyId) {
        list = list.filter((r) => {
          if (r.companyId) return r.companyId === actorUser.companyId;
          const u = this.db.users.find(
            (usr) => usr.id === r.employeeId || usr.employeeId === r.employeeId || (r as any).userId === usr.id,
          );
          return u?.companyId === actorUser.companyId;
        });
      }
    }

    if (employeeId) {
      const user = this.db.users.find((u) => u.id === employeeId || u.employeeId === employeeId);
      const targetId = user ? user.id : employeeId;
      list = list.filter(
        (r) => r.employeeId === targetId || (r as any).userId === targetId || r.employeeId === employeeId,
      );
    }

    return list.map((r) => {
      const user = this.db.users.find(
        (u) => u.id === r.employeeId || u.employeeId === r.employeeId || (r as any).userId === u.id,
      );
      const realUserId = user ? user.id : r.employeeId;
      const { employeeId: _, id: revId, ...rest } = r;
      const resObj: any = {
        id: revId,
        userId: realUserId,
        role: user?.role || 'EMPLOYEE',
        companyId: r.companyId || user?.companyId || '',
        companyCode: r.companyCode || user?.companyCode || '',
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

  submitRating(id: string, data: SubmitReviewRatingDto, actorUser?: User) {
    const review = this.db.performanceReviews.find((r) => r.id === id);
    if (!review) throw new NotFoundException('Performance review not found');

    if (actorUser) {
      if (actorUser.role === Role.EMPLOYEE) {
        const isOwner =
          review.employeeId === actorUser.id ||
          (review as any).userId === actorUser.id ||
          (actorUser.employeeId && review.employeeId === actorUser.employeeId);
        if (!isOwner) {
          throw new ForbiddenException('Employees can only rate their own performance reviews');
        }
      } else if (actorUser.role === Role.ADMIN && actorUser.companyId && review.companyId) {
        if (review.companyId !== actorUser.companyId) {
          throw new ForbiddenException('Cannot modify performance review of another company');
        }
      }
    }

    const actorName = data.actorName || actorUser?.email || 'Manager';

    if (data.selfRating !== undefined) {
      review.selfRating = data.selfRating;
      review.selfComments = data.selfComments;
      review.status = 'Manager Review';
    }

    if (data.managerRating !== undefined) {
      review.managerRating = data.managerRating;
      review.managerFeedback = data.managerFeedback;
      review.finalRating = review.selfRating
        ? (review.selfRating + data.managerRating) / 2
        : data.managerRating;
      review.finalRating = parseFloat(review.finalRating.toFixed(1));
      review.appraisalRecommended = data.appraisalRecommended;
      review.status = 'Completed';
      review.completedAt = new Date().toISOString();
    }

    this.db.logAudit(
      actorUser?.id || 'sys',
      actorName,
      data.role || actorUser?.role || 'MANAGER',
      'PERFORMANCE_REVIEW_UPDATED',
      'Performance Management',
      `Updated review rating for ${review.employeeName} (Rating: ${review.finalRating || review.managerRating || review.selfRating})`,
      review.id,
    );

    this.db.persist();
    return review;
  }
}
