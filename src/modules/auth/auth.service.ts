import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { User, Role } from '../../common/types.js';

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  login(email: string, _password?: string) {
    const user = this.db.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials. Please check email and password.');
    }

    const token = `jwt_token_${user.id}_${Date.now()}`;
    this.db.logAudit(
      user.id,
      `${user.firstName} ${user.lastName}`,
      user.role,
      'USER_LOGIN',
      'Authentication',
      `User ${user.email} logged in successfully`,
      user.id,
    );

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        employeeId: user.employeeId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  getCurrentUser(userId: string) {
    const user = this.db.users.find((u) => u.id === userId);
    if (!user) {
      return this.db.users[0]; // fallback to super admin for seamless demo
    }
    return user;
  }

  switchRole(targetRole: Role) {
    const matchedUser = this.db.users.find((u) => u.role === targetRole) || this.db.users[0];
    return {
      accessToken: `jwt_token_${matchedUser.id}_${Date.now()}`,
      user: matchedUser,
    };
  }

  getAllUsers(): User[] {
    return this.db.users.map(({ password: _, ...rest }) => rest as User);
  }
}
