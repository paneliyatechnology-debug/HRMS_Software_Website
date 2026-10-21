import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('System Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'System health and API status',
    description: 'Returns service vitality, version, and architecture information.',
  })
  @ApiResponse({ status: 200, description: 'API health information' })
  getStatus() {
    return this.appService.getStatus();
  }
}
