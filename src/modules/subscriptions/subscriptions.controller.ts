import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service.js';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly db: DatabaseService) {}

  private companyKey(req: any): string {
    return req.user?.companyId || 'global';
  }

  @Get('mine')
  getMine(@Req() req: any) {
    const key = this.companyKey(req);
    return this.db.companyPlans[key] || null;
  }

  @Put('mine')
  saveMine(@Req() req: any, @Body() body: any) {
    const key = this.companyKey(req);
    this.db.companyPlans[key] = {
      companyId: key,
      plan: body?.plan || 'Starter',
      billingCycle: body?.billingCycle || 'Monthly',
      maxEmployees: body?.maxEmployees || 0,
      invoices: Array.isArray(body?.invoices) ? body.invoices : [],
      updatedAt: new Date().toISOString(),
    };
    this.db.persist();
    return this.db.companyPlans[key];
  }
}
