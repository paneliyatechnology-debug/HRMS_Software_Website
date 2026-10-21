import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { AssignAssetDto } from './dto/assign-asset.dto.js';
import { ReturnAssetDto } from './dto/return-asset.dto.js';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({
    summary: 'List company assets',
    description: 'Retrieves company devices, laptops, and hardware inventory filtered by category.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Category (Laptop, Monitor, etc.)' })
  @ApiResponse({ status: 200, description: 'List of assets' })
  findAll(@Query('category') category?: string) {
    return this.assetsService.findAll(category);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new hardware/device asset',
    description: 'Adds physical equipment to inventory registry.',
  })
  @ApiBody({ type: CreateAssetDto })
  @ApiResponse({ status: 201, description: 'Asset created' })
  create(@Body() body: CreateAssetDto) {
    return this.assetsService.create(body);
  }

  @Put(':id/assign')
  @ApiOperation({
    summary: 'Assign asset to employee',
    description: 'Allocates company hardware to a specific employee for workstation setup.',
  })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiBody({ type: AssignAssetDto })
  @ApiResponse({ status: 200, description: 'Asset assigned successfully' })
  @ApiResponse({ status: 404, description: 'Asset or employee not found' })
  assign(@Param('id') id: string, @Body() body: AssignAssetDto) {
    return this.assetsService.assign(id, body);
  }

  @Put(':id/return')
  @ApiOperation({
    summary: 'Mark asset returned from employee',
    description: 'Releases asset back into available pool with physical condition inspection.',
  })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiBody({ type: ReturnAssetDto })
  @ApiResponse({ status: 200, description: 'Asset returned successfully' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  returnAsset(@Param('id') id: string, @Body() body: ReturnAssetDto) {
    return this.assetsService.returnAsset(id, body);
  }
}
