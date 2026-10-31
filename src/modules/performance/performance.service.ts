import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { PerformanceReview } from '../../common/types.js';
import { SubmitReviewRatingDto } from './dto/submit-rating.dto.js';

@Injectable()
export class PerformanceService {
  constructor(private readonly db: DatabaseService) {}

  getCycles() {
    return this.db.performanceCycles;
  }

  getReviews(employeeId?: string) {
    let list = this.db.performanceReviews;
    if (employeeId) {
      const user = this.db.users.find((u) => u.id === employeeId || u.employeeId === employeeId);
      const targetId = user ? user.id : employeeId;
      list = list.filter((r) => r.employeeId === targetId || (r as any).userId === targetId || r.employeeId === employeeId);
    }
    return list.map((r) => {
      const user = this.db.users.find((u) => u.id === r.employeeId || u.employeeId === r.employeeId || (r as any).userId === u.id);
      const realUserId = user ? user.id : r.employeeId;
      return {
        ...r,
        userId: realUserId,
        employeeId: realUserId,
        role: user?.role || 'EMPLOYEE',
      };
    });
  }

  submitRating(id: string, data: SubmitReviewRatingDto) {
    const review = this.db.performanceReviews.find((r) => r.id === id);
    if (!review) throw new NotFoundException('Performance review not found');

    const actorName = data.actorName || 'Manager';

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
      'sys',
      actorName,
      data.role || 'MANAGER',
      'PERFORMANCE_REVIEW_UPDATED',
      'Performance Management',
      `Updated review rating for ${review.employeeName} (Rating: ${review.finalRating || review.managerRating || review.selfRating})`,
      review.id,
    );

    this.db.persist();
    return review;
  }
}
