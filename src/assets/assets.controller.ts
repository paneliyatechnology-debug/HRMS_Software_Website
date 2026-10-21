import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AssetsService } from './assets.service.js';
import { CompanyAsset } from '../common/types.js';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List company assets' })
  findAll(@Query('category') category?: string) {
    return this.assetsService.findAll(category);
  }

  @Post()
  @ApiOperation({ summary: 'Create new hardware/device asset' })
  create(@Body() body: Partial<CompanyAsset>) {
    return this.assetsService.create(body);
  }

  @Put(':id/assign')
  @ApiOperation({ summary: 'Assign asset to employee' })
  assign(
    @Param('id') id: string,
    @Body() body: { employeeId: string; actorName?: string },
  ) {
    return this.assetsService.assign(id, body.employeeId, body.actorName);
  }

  @Put(':id/return')
  @ApiOperation({ summary: 'Mark asset returned from employee' })
  returnAsset(
    @Param('id') id: string,
    @Body() body: { condition?: 'Excellent' | 'Good' | 'Fair' | 'Damaged'; actorName?: string },
  ) {
    return this.assetsService.returnAsset(id, body.condition, body.actorName);
  }
}
