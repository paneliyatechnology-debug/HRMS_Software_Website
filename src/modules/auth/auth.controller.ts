import { Controller, Post, Get, Body, Headers, Query, Req } from '@nestjs/common';
import { CreateCompanyDto } from '../super-admin/dto/create-company.dto.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SwitchRoleDto } from './dto/switch-role.dto.js';
import { Public } from '../../common/guards/public.decorator.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register new user account',
    description: 'Creates a new user credentials account with password and initializes their employee profile.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully with JWT access token' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('register-company')
  @ApiOperation({
    summary: 'Register a company and its first admin',
    description: 'Public company signup. Creates the company and admin user. No existing token is required.',
  })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({ status: 201, description: 'Company registered successfully' })
  registerCompany(@Body() body: CreateCompanyDto) {
    return this.authService.registerCompany(body);
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Login user and receive JWT session',
    description: 'Authenticates with email OR mobile number and password, returning a bearer JWT access token with full user details.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Authentication successful with JWT token' })
  @ApiResponse({ status: 401, description: 'Invalid email/mobile number or password' })
  login(@Body() body: LoginDto) {
    const identifier = body.identifier || body.email || body.phone || '';
    return this.authService.login(identifier, body.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current logged-in user profile',
    description: 'Retrieves current user profile. Pass token in Authorization header, or as query param ?token=...',
  })
  @ApiQuery({ name: 'token', required: false, description: 'Token can also be passed as query parameter (?token=...)' })
  @ApiHeader({ name: 'authorization', required: false, description: 'Bearer <token>' })
  @ApiResponse({ status: 200, description: 'Current user profile information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(
    @Headers('authorization') authHeader?: string,
    @Headers('token') tokenHeader?: string,
    @Query('token') queryToken?: string,
    @Req() req?: any,
  ) {
    const rawToken =
      authHeader ||
      tokenHeader ||
      queryToken ||
      req?.headers?.authorization ||
      req?.headers?.token ||
      req?.query?.token;
    return this.authService.getCurrentUser(rawToken);
  }

  @Post('switch-role')
  @ApiOperation({
    summary: 'Instantly switch active session role for testing RBAC perspectives',
    description: 'Allows live evaluation of multi-role perspectives (Super Admin, HR, Manager, Employee, etc.).',
  })
  @ApiBody({ type: SwitchRoleDto })
  @ApiResponse({ status: 200, description: 'Role switched successfully with updated token' })
  switchRole(@Body() body: SwitchRoleDto, @Req() req: any) {
    return this.authService.switchRole(body.role, req.user);
  }

  @Public()
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
