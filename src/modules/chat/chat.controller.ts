import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../../database/database.service.js';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly db: DatabaseService) {}

  private companyKey(req: any): string {
    return req.user?.companyId || 'global';
  }

  @Get('state')
  getState(@Req() req: any) {
    const key = this.companyKey(req);
    return (
      this.db.chatByCompany[key] || {
        conversations: [],
        messages: {},
      }
    );
  }

  @Put('state')
  saveState(
    @Req() req: any,
    @Body() body: { conversations?: any[]; messages?: Record<string, any[]> },
  ) {
    const key = this.companyKey(req);
    this.db.chatByCompany[key] = {
      conversations: Array.isArray(body?.conversations) ? body.conversations : [],
      messages: body?.messages && typeof body.messages === 'object' ? body.messages : {},
    };
    this.db.persist();
    return this.db.chatByCompany[key];
  }
}
