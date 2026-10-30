import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller.js';

@Module({
  controllers: [SubscriptionsController],
})
export class SubscriptionsModule {}
