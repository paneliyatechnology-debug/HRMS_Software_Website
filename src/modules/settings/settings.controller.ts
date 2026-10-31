import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get enterprise system settings and policies',
    description: 'Retrieves global company policies, shifts, leave rules, and RBAC matrix.',
  })
  @ApiResponse({ status: 200, description: 'Organization settings and configuration' })
  getSettings(@Req() req: any) {
    return this.settingsService.getSettings(req.user);
  }

  @Put()
  @ApiOperation({
    summary: 'Update system settings and policies',
    description: 'Updates configuration, work hours, and payroll policies.',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  updateSettings(@Body() body: UpdateSettingsDto, @Req() req: any) {
    return this.settingsService.updateSettings(body, req.user);
  }
}
