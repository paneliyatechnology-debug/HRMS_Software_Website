import { Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { AssignAssetDto } from './dto/assign-asset.dto.js';
import { ReturnAssetDto } from './dto/return-asset.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@ApiTags('Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({
    summary: 'List company assets',
    description: 'Retrieves company devices, laptops, and hardware inventory filtered by category for authenticated company.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Category (Laptop, Monitor, etc.)' })
  @ApiQuery({ name: 'companyId', required: false, description: 'Company filter for Super Admin' })
  @ApiResponse({ status: 200, description: 'List of assets' })
  findAll(
    @Query('category') category?: string,
    @Query('companyId') companyFilter?: string,
    @Req() req?: any,
  ) {
    return this.assetsService.findAll(category, req?.user, companyFilter);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new hardware/device asset',
    description: 'Adds physical equipment to inventory registry isolated to authenticated company.',
  })
  @ApiBody({ type: CreateAssetDto })
  @ApiResponse({ status: 201, description: 'Asset created' })
  create(@Body() body: CreateAssetDto, @Req() req: any) {
    return this.assetsService.create(body, req.user);
  }

  @Put(':id/assign')
  @ApiOperation({
    summary: 'Assign asset to employee',
    description: 'Allocates company hardware to a specific employee for workstation setup.',
  })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiBody({ type: AssignAssetDto })
  @ApiResponse({ status: 200, description: 'Asset assigned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset or employee not found' })
  assign(@Param('id') id: string, @Body() body: AssignAssetDto, @Req() req: any) {
    return this.assetsService.assign(id, body, req.user);
  }

  @Put(':id/return')
  @ApiOperation({
    summary: 'Mark asset returned from employee',
    description: 'Releases asset back into available pool with physical condition inspection.',
  })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiBody({ type: ReturnAssetDto })
  @ApiResponse({ status: 200, description: 'Asset returned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  returnAsset(@Param('id') id: string, @Body() body: ReturnAssetDto, @Req() req: any) {
    return this.assetsService.returnAsset(id, body, req.user);
  }
}
