import { Controller, Post, Get, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Role } from '../common/types.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user and receive JWT session' })
  login(@Body() body: { email: string; password?: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  getProfile(@Headers('authorization') authHeader?: string) {
    const userId = authHeader?.replace('Bearer jwt_token_', '').split('_')[0] || 'user-1';
    return this.authService.getCurrentUser(userId);
  }

  @Post('switch-role')
  @ApiOperation({ summary: 'Instantly switch active session role for testing RBAC perspectives' })
  switchRole(@Body() body: { role: Role }) {
    return this.authService.switchRole(body.role);
  }

  @Get('users')
  @ApiOperation({ summary: 'List all demo users' })
  getUsers() {
    return this.authService.getAllUsers();
  }
}
