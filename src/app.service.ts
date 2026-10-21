import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      name: 'Paneliya Enterprise HRMS API',
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      architecture: 'Clean Architecture (Modular)',
      documentation: '/api/docs',
    };
  }
}
