import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmployeesService } from './employees.service.js';
import { Employee } from '../common/types.js';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({ summary: 'List employees with search and filters' })
  findAll(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('employmentType') employmentType?: string,
  ) {
    return this.employeesService.findAll({ search, departmentId, status, employmentType });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee details with all 11 tab summaries' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new employee' })
  create(@Body() body: Partial<Employee>) {
    return this.employeesService.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update employee record' })
  update(@Param('id') id: string, @Body() body: Partial<Employee>) {
    return this.employeesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate employee (soft-delete)' })
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
