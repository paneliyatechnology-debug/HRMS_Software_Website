import { Controller, Post, Get, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SwitchRoleDto } from './dto/switch-role.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login user and receive JWT session',
    description: 'Authenticates with email/password and returns a bearer JWT access token with full user details.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Authentication successful with JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current logged-in user profile',
    description: 'Retrieves the current authenticated user session data using the Bearer token.',
  })
  @ApiHeader({ name: 'authorization', required: false, description: 'Bearer <token>' })
  @ApiResponse({ status: 200, description: 'Current user profile information' })
  getProfile(@Headers('authorization') authHeader?: string) {
    const userId = authHeader?.replace('Bearer jwt_token_', '').split('_')[0] || 'user-1';
    return this.authService.getCurrentUser(userId);
  }

  @Post('switch-role')
  @ApiOperation({
    summary: 'Instantly switch active session role for testing RBAC perspectives',
    description: 'Allows live evaluation of multi-role perspectives (Super Admin, HR, Manager, Employee, etc.).',
  })
  @ApiBody({ type: SwitchRoleDto })
  @ApiResponse({ status: 200, description: 'Role switched successfully with updated token' })
  switchRole(@Body() body: SwitchRoleDto) {
    return this.authService.switchRole(body.role);
  }

  @Get('users')
  @ApiOperation({
    summary: 'List all demo users',
    description: 'Returns available demo users configured for testing different system roles.',
  })
  @ApiResponse({ status: 200, description: 'List of all system users' })
  getUsers() {
    return this.authService.getAllUsers();
  }
}
