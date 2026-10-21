import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service.js';
import { Holiday } from '../common/types.js';

@ApiTags('Holidays')
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'List all calendar holidays' })
  findAll() {
    return this.holidaysService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Add company holiday' })
  create(@Body() body: Partial<Holiday>) {
    return this.holidaysService.create(body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete holiday' })
  remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}
