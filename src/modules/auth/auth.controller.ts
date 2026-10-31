import { Controller, Post, Get, Body, Headers, Query, Req, Res, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SwitchRoleDto } from './dto/switch-role.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { SetEmployeePasswordDto } from './dto/set-employee-password.dto.js';
import { RegisterCompanyRequestDto } from '../companies/dto/register-company-request.dto.js';
import { SuperAdminService } from '../super-admin/super-admin.service.js';
import { Public } from '../../common/guards/public.decorator.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly superAdminService: SuperAdminService,
  ) {}

  @Public()
  @Post('register-company')
  @ApiOperation({
    summary: 'Register new company (Public - No Token Required, Awaiting Super Admin Approval)',
    description: 'Submits company information and owner account details. Company is created once Super Admin approves.',
  })
  @ApiBody({ type: RegisterCompanyRequestDto })
  @ApiResponse({ status: 201, description: 'Company registration request submitted successfully (Pending Approval)' })
  registerCompany(@Body() body: RegisterCompanyRequestDto) {
    return this.superAdminService.createCompanyRegistrationRequest(body);
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register new user account',
    description: 'Creates a new user credentials account with password and initializes their employee profile.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully with JWT access token' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res?: any) {
    const result = await this.authService.register(body);
    if (res && result.refreshToken) {
      this.authService.setRefreshCookie(res, result.refreshToken);
    }
    return result;
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
  @ApiResponse({ status: 409, description: 'Multiple accounts exist across companies; specify companyCode' })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res?: any) {
    const identifier = body.identifier || body.email || body.phone || '';
    const result = await this.authService.login(identifier, body.password, body.companyCode || body.companyId);
    if (res && result.refreshToken) {
      this.authService.setRefreshCookie(res, result.refreshToken);
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary: 'Renew access token using rotating refresh token',
    description: 'Validates refresh token from HttpOnly cookie or body, rotates the refresh token, and returns a new 30-minute access token.',
  })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({ status: 200, description: 'Token renewed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or reused refresh token' })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) res?: any,
  ) {
    // CSRF & Origin Validation: If Origin or Referer header is present, ensure it belongs to allowed origins
    const requestOrigin = req.headers['origin'] || req.headers['referer'];
    if (requestOrigin) {
      const defaultAllowed = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:4000',
        'http://127.0.0.1:4000',
      ];
      const envAllowed = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
        : [];
      const allowedSet = new Set([...defaultAllowed, ...envAllowed]);
      try {
        const originUrl = requestOrigin.startsWith('http') ? new URL(requestOrigin).origin : requestOrigin;
        if (!allowedSet.has(originUrl)) {
          throw new ForbiddenException('CSRF check failed: Request origin is not permitted');
        }
      } catch (err) {
        if (err instanceof ForbiddenException) throw err;
        throw new ForbiddenException('CSRF check failed: Invalid request origin');
      }
    }

    const rawRefreshToken = req?.cookies?.refreshToken || body?.refreshToken;
    const result = await this.authService.refresh(rawRefreshToken);
    if (res && result.refreshToken) {
      this.authService.setRefreshCookie(res, result.refreshToken);
    }

    // In production, when using HttpOnly cookie, omit refreshToken from response body to prevent browser JS exposure
    const isProduction = process.env.NODE_ENV === 'production';
    const isExplicitTesting = !!body?.refreshToken || process.env.EXPOSE_REFRESH_TOKEN_IN_BODY === 'true';
    if (isProduction && !isExplicitTesting) {
      const { refreshToken: _, ...sanitized } = result;
      return sanitized;
    }

    return result;
  }

  @Public()
  @Post('logout')
  @ApiOperation({
    summary: 'Logout user and revoke refresh session',
    description: 'Revokes the active refresh token session and clears the HttpOnly cookie.',
  })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  async logout(
    @Body() body: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) res?: any,
    @Headers('authorization') authHeader?: string,
  ) {
    const rawRefreshToken = req?.cookies?.refreshToken || body?.refreshToken;
    let userId: string | undefined;
    if (authHeader) {
      try {
        userId = this.authService.extractUserId(authHeader);
      } catch {}
    }
    if (res) {
      this.authService.clearRefreshCookie(res);
    }
    return this.authService.logout(rawRefreshToken, userId);
  }

  @Public()
  @Post('employee/set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set up employee account password using email invitation token',
    description:
      'Validates the single-use 30-minute invitation token hash and securely sets the employee password.',
  })
  @ApiBody({ type: SetEmployeePasswordDto })
  @ApiResponse({ status: 200, description: 'Password created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid, expired, or reused token' })
  async setEmployeePassword(@Body() body: SetEmployeePasswordDto) {
    return this.authService.setEmployeePassword(body);
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

  @Public()
  @Post('switch-role')
  @ApiOperation({
    summary: 'Instantly switch active session role for testing RBAC perspectives',
    description: 'Allows live evaluation of multi-role perspectives (Super Admin, HR, Manager, Employee, etc.).',
  })
  @ApiBody({ type: SwitchRoleDto })
  @ApiResponse({ status: 200, description: 'Role switched successfully with updated token' })
  async switchRole(@Body() body: SwitchRoleDto, @Res({ passthrough: true }) res?: any) {
    const result = await this.authService.switchRole(body.role);
    if (res && result.refreshToken) {
      this.authService.setRefreshCookie(res, result.refreshToken);
    }
    return result;
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
