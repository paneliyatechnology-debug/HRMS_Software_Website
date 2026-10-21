import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ResignationsService } from './resignations.service.js';
import { Resignation } from '../common/types.js';

@ApiTags('Resignations')
@Controller('resignations')
export class ResignationsController {
  constructor(private readonly resService: ResignationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all resignation records' })
  findAll() {
    return this.resService.findAll();
  }

  @Post('submit')
  @ApiOperation({ summary: 'Employee submit resignation' })
  submit(@Body() body: { employeeId: string; noticePeriodDays?: number; reason: string }) {
    return this.resService.submit(body);
  }

  @Put(':id/clearance')
  @ApiOperation({ summary: 'Update exit clearance checklist' })
  updateClearance(
    @Param('id') id: string,
    @Body() body: { clearance: Partial<Resignation['clearance']>; actorName?: string },
  ) {
    return this.resService.updateClearance(id, body.clearance, body.actorName);
  }
}
