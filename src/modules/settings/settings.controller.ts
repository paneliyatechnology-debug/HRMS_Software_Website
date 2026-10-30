import { Controller, Get, Put, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

@ApiTags('Settings')
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
    return this.settingsService.getSettings(req.user?.companyId);
  }

  @Put()
  @ApiOperation({
    summary: 'Update system settings and policies',
    description: 'Updates configuration, work hours, and payroll policies.',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  updateSettings(@Body() body: UpdateSettingsDto, @Req() req: any) {
    return this.settingsService.updateSettings(body, req.user?.firstName || 'Admin', req.user?.companyId);
  }
}
