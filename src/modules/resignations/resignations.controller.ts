import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ResignationsService } from './resignations.service.js';
import { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import { UpdateClearanceDto } from './dto/update-clearance.dto.js';

@ApiTags('Resignations')
@Controller('resignations')
export class ResignationsController {
  constructor(private readonly resService: ResignationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all resignation records',
    description: 'Retrieves employee exit filings, notice periods, and clearance tracking checklists.',
  })
  @ApiResponse({ status: 200, description: 'List of resignations' })
  findAll() {
    return this.resService.findAll();
  }

  @Post('submit')
  @ApiOperation({
    summary: 'Employee submit resignation',
    description: 'Files resignation with notice period calculation and transitions employee status to On Notice.',
  })
  @ApiBody({ type: SubmitResignationDto })
  @ApiResponse({ status: 201, description: 'Resignation submitted successfully' })
  submit(@Body() body: SubmitResignationDto) {
    return this.resService.submit(body);
  }

  @Put(':id/clearance')
  @ApiOperation({
    summary: 'Update exit clearance checklist',
    description: 'Marks off department, asset return, finance settlement, and exit interview clearances. Automatically transitions status to Resigned once complete.',
  })
  @ApiParam({ name: 'id', description: 'Resignation ID' })
  @ApiBody({ type: UpdateClearanceDto })
  @ApiResponse({ status: 200, description: 'Exit clearance checklist updated' })
  @ApiResponse({ status: 404, description: 'Resignation record not found' })
  updateClearance(@Param('id') id: string, @Body() body: UpdateClearanceDto) {
    return this.resService.updateClearance(id, body);
  }
}
