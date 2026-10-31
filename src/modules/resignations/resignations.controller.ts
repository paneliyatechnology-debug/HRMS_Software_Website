import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ResignationsService } from './resignations.service.js';
import { SubmitResignationDto } from './dto/submit-resignation.dto.js';
import { UpdateClearanceDto } from './dto/update-clearance.dto.js';

@ApiTags('Resignations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resignations')
export class ResignationsController {
  constructor(private readonly resService: ResignationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all resignation records',
    description: 'Retrieves employee exit filings, notice periods, and clearance tracking checklists.',
  })
  @ApiResponse({ status: 200, description: 'List of resignations' })
  findAll(@Req() req: any) {
    return this.resService.findAll(req.user);
  }

  @Post('submit')
  @ApiOperation({
    summary: 'Employee submit resignation',
    description: 'Files resignation with notice period calculation and transitions employee status to On Notice.',
  })
  @ApiBody({ type: SubmitResignationDto })
  @ApiResponse({ status: 201, description: 'Resignation submitted successfully' })
  submit(@Body() body: SubmitResignationDto, @Req() req: any) {
    return this.resService.submit(body, req.user);
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
  updateClearance(@Param('id') id: string, @Body() body: UpdateClearanceDto, @Req() req: any) {
    return this.resService.updateClearance(id, body, req.user);
  }
}
