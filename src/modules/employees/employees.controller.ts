import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { QueryEmployeeDto } from './dto/query-employee.dto.js';

@ApiTags('Employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @ApiOperation({
    summary: 'List employees with search and filters',
    description: 'Retrieves all employees with optional filters for full-text search, department, status, and employment type.',
  })
  @ApiResponse({ status: 200, description: 'Filtered list of employees' })
  findAll(@Query() query: QueryEmployeeDto) {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get employee details with all 11 tab summaries',
    description: 'Retrieves full profile, attendance, leaves, payroll, documents, assets, and performance records.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID or Employee Code (e.g., EMP-1)' })
  @ApiResponse({ status: 200, description: 'Complete employee dossier' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new employee',
    description: 'Onboards a new employee, initializes default leave balances, and logs an audit record.',
  })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  create(@Body() body: CreateEmployeeDto) {
    return this.employeesService.create(body);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update employee record',
    description: 'Updates employee details including salary, department, contact info, and tax settings.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  update(@Param('id') id: string, @Body() body: UpdateEmployeeDto) {
    return this.employeesService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate employee (soft-delete)',
    description: 'Marks employee status as Inactive for compliance and audit preservation.',
  })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({ status: 200, description: 'Employee marked inactive' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
