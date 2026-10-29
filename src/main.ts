import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe with automatic transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Ensure uploads directories exist
  const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const profilesDir = path.join(process.cwd(), 'uploads', 'profiles');
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }

  // Serve static files from /uploads and /api/uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Redirect root '/' to Swagger Documentation
  app.getHttpAdapter().get('/', (_req: any, res: any) => {
    res.redirect('/api/docs');
  });

  // Automatically normalize redundant slashes (e.g. /api//auth/login -> /api/auth/login)
  app.use((req: any, _res: any, next: any) => {
    if (req.url) {
      req.url = req.url.replace(/\/{2,}/g, '/');
    }
    next();
  });

  // Global API Prefix
  app.setGlobalPrefix('api');

  // Swagger OpenAPI Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Paneliya Enterprise HRMS API')
    .setDescription(
      'Clean Architecture Modular REST API for Paneliya HRMS with full lifecycle coverage.\n\n' +
      '### Architecture Highlights:\n' +
      '- **Clean Architecture**: Folder-wise modular structure under `src/modules/`\n' +
      '- **Full Lifecycle Coverage**: Authentication, Employees, Organization, Attendance, Leaves, Payroll, Recruitment, Performance, Training, Assets, Resignations, Holidays, Documents, Announcements, Notifications, Audit Logs, Reports & Analytics, and Settings\n' +
      '- **Real-time WebSockets**: Socket.IO Gateway on port 4000\n' +
      '- **Type-Safe Validation**: Interactive DTO schemas with class-validator & Swagger decorators',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('System Health', 'API status and system vitality')
    .addTag('Authentication', 'JWT authentication, RBAC session switching, user accounts')
    .addTag('Super Admin', 'Master Super Admin operations, full cross-module access, system health, user RBAC, and maintenance')
    .addTag('Employees', 'Employee profiles, 11-tab records, directory search')
    .addTag('Organization', 'Departments, designations, branch locations, visual org hierarchy')
    .addTag('Attendance', 'Punch clock, biometric reader sync, manual regularizations')
    .addTag('Leaves', 'Leave applications, quotas & balance calculation, multi-level approvals')
    .addTag('Payroll', 'Automated monthly payroll runs, salary slips, disbursement status')
    .addTag('Recruitment', 'Job requisitions, ATS applicant pipeline, interview scheduling, 1-click hire')
    .addTag('Performance', 'Appraisal review cycles, KPI scores, manager feedback & ratings')
    .addTag('Training', 'Corporate programs, employee course enrollment, certification tracking')
    .addTag('Assets', 'Hardware equipment registry, laptop assignment & returns')
    .addTag('Resignations', 'Exit management, notice periods, multi-department clearance workflow')
    .addTag('Holidays', 'Corporate and national public calendar holidays')
    .addTag('Documents', 'Employee dossier records, multipart file uploads, compliance verification')
    .addTag('Announcements', 'Company-wide notices and broadcast alerts')
    .addTag('Notifications', 'In-app real-time notification items and mark-as-read')
    .addTag('Audit Logs', 'Security and state-change audit trail logs')
    .addTag('Reports & Analytics', 'Executive dashboard metrics, charts, and CSV export')
    .addTag('Settings', 'Enterprise organization policies, shifts, and RBAC matrix')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'none',
    },
  });

  function getNetworkIps(): string[] {
    const ips: string[] = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);

  const networkIps = getNetworkIps();
  console.log(`Enterprise HRMS Backend is active at:`);
  console.log(`  - Local:   http://localhost:${port}/api`);
  for (const ip of networkIps) {
    console.log(`  - Network: http://${ip}:${port}/api`);
  }
  console.log(`Swagger OpenAPI documentation:`);
  console.log(`  - Local:   http://localhost:${port}/api/docs`);
  for (const ip of networkIps) {
    console.log(`  - Network: http://${ip}:${port}/api/docs`);
  }
}
await bootstrap();
