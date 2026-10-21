import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service.js';
import { CreateHolidayDto } from './dto/create-holiday.dto.js';

@ApiTags('Holidays')
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @ApiOperation({
    summary: 'List all calendar holidays',
    description: 'Retrieves corporate and national paid holidays.',
  })
  @ApiResponse({ status: 200, description: 'List of holidays' })
  findAll() {
    return this.holidaysService.findAll();
  }

  @Post()
  @ApiOperation({
    summary: 'Add company holiday',
    description: 'Creates a holiday on the enterprise calendar.',
  })
  @ApiBody({ type: CreateHolidayDto })
  @ApiResponse({ status: 201, description: 'Holiday created' })
  create(@Body() body: CreateHolidayDto) {
    return this.holidaysService.create(body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete holiday',
    description: 'Removes a holiday record from the corporate calendar.',
  })
  @ApiParam({ name: 'id', description: 'Holiday ID' })
  @ApiResponse({ status: 200, description: 'Holiday removed' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
