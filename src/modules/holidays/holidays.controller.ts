import { Controller, Get, Post, Put, Delete, Body, Param, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @ApiOperation({
    summary: 'List calendar holidays',
    description: 'Retrieves corporate and national paid holidays for the authenticated user company.',
  })
  @ApiQuery({ name: 'companyId', required: false, description: 'Optional company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of holidays' })
  findAll(@Req() req: any, @Query('companyId') companyFilter?: string) {
    return this.holidaysService.findAll(req.user, companyFilter);
  }

  @Post()
  @ApiOperation({
    summary: 'Add company holiday',
    description: 'Creates a holiday on the enterprise calendar isolated to the authenticated company.',
  })
  @ApiBody({ type: CreateHolidayDto })
  @ApiResponse({ status: 201, description: 'Holiday created' })
  create(@Body() body: CreateHolidayDto, @Req() req: any) {
    return this.holidaysService.create(body, req.user);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update company holiday',
    description: 'Updates a holiday record on the corporate calendar.',
  })
  @ApiParam({ name: 'id', description: 'Holiday ID' })
  @ApiResponse({ status: 200, description: 'Holiday updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.holidaysService.update(id, body, req.user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete holiday',
    description: 'Removes a holiday record from the corporate calendar.',
  })
  @ApiParam({ name: 'id', description: 'Holiday ID' })
  @ApiResponse({ status: 200, description: 'Holiday removed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.holidaysService.remove(id, req.user);
  }
}
