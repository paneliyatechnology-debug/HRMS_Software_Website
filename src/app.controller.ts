import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Public } from './common/guards/public.decorator.js';

@ApiTags('System Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'API Root vitality',
    description: 'Returns service vitality information at /api.',
  })
  @ApiResponse({ status: 200, description: 'API health information' })
  getRoot() {
    return this.appService.getStatus();
  }

  @Public()
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
