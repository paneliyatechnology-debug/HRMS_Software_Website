import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { Role, EmployeeStatus, WorkSessionStatus } from '../src/common/types.js';
import { signAccessToken } from '../src/common/utils/jwt.util.js';

describe('Geo-Fenced Employee Work Timer (e2e)', () => {
  let app: INestApplication<App>;
  let db: DatabaseService;

  // Test credentials & tokens
  const sampleSelfie =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  // Surat HQ Coordinates for loc-1
  const officeLat = 21.17024;
  const officeLon = 72.831061;

  // Remote / Outside coordinates (London)
  const outsideLat = 51.5074;
  const outsideLon = -0.1278;

  let emp1Token: string;
  let emp2Token: string;
  let admin2Token: string;
  let emp1Id: string;
  let emp2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    db = app.get(DatabaseService);

    // Setup Test Data in Company 1 (cmp-1) and Company 2 (cmp-1793180626095)
    // 1. Employee 1: Keyur in Company 1 (cmp-1)
    const emp1User = db.users.find((u) => u.email === 'keyur@gmail.com') || db.users[0];
    emp1Id = emp1User.employeeId || 'emp-1793009147556';
    emp1Token = `Bearer ${signAccessToken(emp1User.id)}`;

    // Ensure emp1 has loc-1 as assigned office with correct coordinates
    const emp1 = db.employees.find((e) => e.id === emp1Id);
    if (emp1) {
      emp1.workLocationId = 'loc-1';
      emp1.companyId = 'cmp-1';
      emp1.status = EmployeeStatus.ACTIVE;
    }

    const loc1 = db.locations.find((l) => l.id === 'loc-1');
    if (loc1) {
      loc1.latitude = officeLat;
      loc1.longitude = officeLon;
      loc1.radiusMeters = 200;
      loc1.companyId = 'cmp-1';
      loc1.isActive = true;
    }

    // 2. Setup Employee 2 in Company 2
    emp2Id = 'emp-test-company2-worker';
    const emp2UserId = 'user-test-company2-worker';
    db.users.push({
      id: emp2UserId,
      email: 'worker2@company2.com',
      firstName: 'Worker',
      lastName: 'Two',
      role: Role.EMPLOYEE,
      companyId: 'cmp-1793180626095',
      companyCode: 'CMP-000002',
      employeeId: emp2Id,
      status: 'Active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    db.employees.push({
      id: emp2Id,
      employeeCode: 'EMP-000099',
      companyId: 'cmp-1793180626095',
      companyCode: 'CMP-000002',
      userId: emp2UserId,
      firstName: 'Worker',
      lastName: 'Two',
      email: 'worker2@company2.com',
      phone: '1234567890',
      avatarUrl: '',
      gender: 'Other',
      dateOfBirth: '',
      address: '',
      emergencyContact: { name: '', relationship: '', phone: '' },
      joiningDate: '2026-01-01',
      employmentType: 'Full-time',
      status: EmployeeStatus.ACTIVE,
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      designationId: 'des-1',
      designationTitle: 'Software Engineer',
      workLocationId: 'loc-1',
      workLocationName: 'Corporate HQ',
      shift: 'General',
      bankDetails: { bankName: '', accountNumber: '', ifscOrRouting: '', accountHolderName: '' },
      taxInformation: { taxId: '', panOrSsn: '', taxRegime: '' },
      education: [],
      previousExperience: [],
      skills: [],
      salary: { basic: 0, hra: 0, allowances: 0, bonus: 0, pf: 0, tax: 0, professionalTax: 0, gross: 0, net: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    emp2Token = `Bearer ${signAccessToken(emp2UserId)}`;

    // 3. Admin in Company 2
    const admin2User = db.users.find((u) => u.email === 'ravi@gmail.com') || db.users.find((u) => u.role === Role.ADMIN);
    admin2Token = `Bearer ${signAccessToken(admin2User!.id)}`;

    // Clear any previous work sessions for clean test state
    db.workSessions = [];
  });

  afterAll(async () => {
    await app.close();
  });

  // 11. Missing or invalid JWT
  describe('Authentication & Security Guards', () => {
    it('11a. Should reject request when JWT is missing', async () => {
      const res = await request(app.getHttpServer()).get('/api/attendance/work/status');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Authentication token is required/i);
    });

    it('11b. Should reject request with invalid JWT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/attendance/work/status')
        .set('Authorization', 'Bearer invalid_garbage_token_99999');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid or expired session token/i);
    });
  });

  // 1. Successful start inside the office geofence with a selfie
  describe('Start Work Session', () => {
    it('1. Should successfully start work session inside the office geofence with selfie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
          deviceInfo: 'Vitest Automated Browser Test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe(WorkSessionStatus.ACTIVE);
      expect(res.body.sessionId).toBeDefined();
      expect(res.body.startTime).toBeDefined();
      expect(res.body.officeLocation.id).toBe('loc-1');
      expect(res.body.distanceMeters).toBeLessThanOrEqual(200);

      // Verify session exists in DB
      const session = db.workSessions.find((s) => s.id === res.body.sessionId);
      expect(session).toBeDefined();
      expect(session?.employeeId).toBe(emp1Id);
      expect(session?.status).toBe(WorkSessionStatus.ACTIVE);
    });

    // 5. Rejected duplicate active sessions
    it('5. Should reject duplicate start when an active session already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already has an active work session/i);
    });

    // 2. Rejected start outside the geofence
    it('2. Should reject start when outside the allowed office boundary', async () => {
      // Clear sessions to test start from outside
      db.workSessions = [];

      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: outsideLat,
          longitude: outsideLon,
          accuracy: 15,
          selfie: sampleSelfie,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Outside allowed office boundary/i);
    });

    // 3. Rejected start without location
    it('3. Should reject start request without location coordinates', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          selfie: sampleSelfie,
        });

      expect(res.status).toBe(400);
    });

    // 4. Rejected start without a required selfie
    it('4. Should reject start without a required selfie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 12,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Selfie capture is required/i);
    });

    it('Should reject start when GPS accuracy is too imprecise (>150m)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 500, // Exceeds threshold
          selfie: sampleSelfie,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/GPS accuracy reading too low/i);
    });
  });

  // 6. Successful stop inside geofence with selfie
  // 7. Rejected stop outside geofence
  // 8. Rejected stop without an active session
  describe('Stop Work Session', () => {
    beforeEach(async () => {
      // Start a fresh active session for emp1 before each stop test
      db.workSessions = [];
      await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });
    });

    it('7. Should reject stop when employee is outside the office geofence', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/stop')
        .set('Authorization', emp1Token)
        .send({
          latitude: outsideLat,
          longitude: outsideLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Outside allowed office boundary/i);
    });

    it('Should reject stop without required stop selfie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/stop')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Selfie capture is required to stop work/i);
    });

    it('6. Should successfully stop inside geofence with selfie and compute authoritative duration', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/stop')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 15,
          selfie: sampleSelfie,
          remarks: 'Daily tasks complete',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe(WorkSessionStatus.COMPLETED);
      expect(res.body.endTime).toBeDefined();
      expect(typeof res.body.durationSeconds).toBe('number');
      expect(res.body.durationFormatted).toBeDefined();
    });

    it('8. Should reject stop when employee has no active session', async () => {
      // Stop the session first
      await request(app.getHttpServer())
        .post('/api/attendance/work/stop')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });

      // Now attempt to stop again when no active session exists
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/stop')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No active work session found/i);
    });
  });

  // 12. Concurrent start/stop requests and duration calculation
  describe('Concurrency & Race-Condition Safety', () => {
    it('12. Should serialize concurrent start requests so only one succeeds', async () => {
      db.workSessions = [];

      // Send 2 start requests at the exact same millisecond
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/attendance/work/start')
          .set('Authorization', emp1Token)
          .send({
            latitude: officeLat,
            longitude: officeLon,
            accuracy: 10,
            selfie: sampleSelfie,
          }),
        request(app.getHttpServer())
          .post('/api/attendance/work/start')
          .set('Authorization', emp1Token)
          .send({
            latitude: officeLat,
            longitude: officeLon,
            accuracy: 10,
            selfie: sampleSelfie,
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must be 201 Created, and one must be 400 Bad Request
      expect(statuses).toEqual([201, 400]);

      // Verify in DB there is exactly 1 active session
      const activeSessions = db.workSessions.filter(
        (s) => s.employeeId === emp1Id && s.status === WorkSessionStatus.ACTIVE,
      );
      expect(activeSessions.length).toBe(1);
    });
  });

  // 13. Recovery after frontend refresh or network failure
  describe('State Recovery & Live Status', () => {
    it('13. Should recover active session state after frontend reload or reconnect', async () => {
      // Ensure emp1 has an active session
      db.workSessions = [];
      const startRes = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });
      expect(startRes.status).toBe(201);

      // Frontend refreshes / requests status
      const statusRes = await request(app.getHttpServer())
        .get('/api/attendance/work/status')
        .set('Authorization', emp1Token);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.hasActiveSession).toBe(true);
      expect(statusRes.body.activeSession.id).toBe(startRes.body.sessionId);
      expect(statusRes.body.activeSession.status).toBe(WorkSessionStatus.ACTIVE);
      expect(statusRes.body.serverTime).toBeDefined();
      expect(typeof statusRes.body.activeSession.elapsedSeconds).toBe('number');
      expect(statusRes.body.assignedOffice.id).toBe('loc-1');
      expect(statusRes.body.todaySummary.totalSessionsToday).toBeGreaterThanOrEqual(1);
    });
  });

  // 9. Employee isolation between different companies
  // 10. Admin access restricted to their own company
  describe('Multi-Company Isolation & Role Boundaries', () => {
    beforeAll(async () => {
      // Create completed sessions for both emp1 (Company 1) and emp2 (Company 2)
      db.workSessions = [];

      // Emp1 session (Company 1)
      db.workSessions.push({
        id: 'ws-comp1-test',
        employeeId: emp1Id,
        employeeName: 'Keyur Sangani',
        companyId: 'cmp-1',
        officeLocationId: 'loc-1',
        officeLocationName: 'Corporate HQ',
        status: WorkSessionStatus.COMPLETED,
        startTime: '2026-10-28T09:00:00.000Z',
        endTime: '2026-10-28T17:00:00.000Z',
        durationSeconds: 28800,
        durationFormatted: '08h 00m 00s',
        startLatitude: officeLat,
        startLongitude: officeLon,
        startDistanceMeters: 10,
        startSelfieUrl: 'storage/selfies/test1.jpg',
        createdAt: '2026-10-28T09:00:00.000Z',
        updatedAt: '2026-10-28T17:00:00.000Z',
      });

      // Emp2 session (Company 2)
      db.workSessions.push({
        id: 'ws-comp2-test',
        employeeId: emp2Id,
        employeeName: 'Worker Two',
        companyId: 'cmp-1793180626095',
        officeLocationId: 'loc-1',
        officeLocationName: 'Corporate HQ',
        status: WorkSessionStatus.COMPLETED,
        startTime: '2026-10-28T10:00:00.000Z',
        endTime: '2026-10-28T18:00:00.000Z',
        durationSeconds: 28800,
        durationFormatted: '08h 00m 00s',
        startLatitude: officeLat,
        startLongitude: officeLon,
        startDistanceMeters: 15,
        startSelfieUrl: 'storage/selfies/test2.jpg',
        createdAt: '2026-10-28T10:00:00.000Z',
        updatedAt: '2026-10-28T18:00:00.000Z',
      });
    });

    it('9. Employee can only access their own sessions (cross-company & peer isolation)', async () => {
      // Emp1 asks for history
      const res = await request(app.getHttpServer())
        .get('/api/attendance/work/history')
        .set('Authorization', emp1Token);

      expect(res.status).toBe(200);
      expect(res.body.sessions.length).toBe(1);
      expect(res.body.sessions[0].employeeId).toBe(emp1Id);

      // Emp2 in Company 2 asks for history using emp2Token
      const res2 = await request(app.getHttpServer())
        .get('/api/attendance/work/history')
        .set('Authorization', emp2Token);

      expect(res2.status).toBe(200);
      expect(res2.body.sessions.length).toBe(1);
      expect(res2.body.sessions[0].employeeId).toBe(emp2Id);
      expect(res2.body.sessions[0].companyId).toBe('cmp-1793180626095');

      // Emp1 tries to pass query parameter for Emp2 (different company)
      const tamperedRes = await request(app.getHttpServer())
        .get(`/api/attendance/work/history?employeeId=${emp2Id}`)
        .set('Authorization', emp1Token);

      expect(tamperedRes.status).toBe(200);
      // Still only returns Emp1's sessions because employee identity is derived from token
      expect(tamperedRes.body.sessions.every((s: any) => s.employeeId === emp1Id)).toBe(true);
    });

    it('10. Admin can only view sessions within their own company and cannot access other companies', async () => {
      // Admin2 (Company 2) queries history
      const adminRes = await request(app.getHttpServer())
        .get('/api/attendance/work/history')
        .set('Authorization', admin2Token);

      expect(adminRes.status).toBe(200);
      // All returned sessions must strictly belong to Company 2
      expect(adminRes.body.sessions.every((s: any) => s.companyId === 'cmp-1793180626095')).toBe(true);

      // Admin2 attempts to query Employee 1 from Company 1
      const crossCompanyRes = await request(app.getHttpServer())
        .get(`/api/attendance/work/history?employeeId=${emp1Id}`)
        .set('Authorization', admin2Token);

      expect(crossCompanyRes.status).toBe(403);
      expect(crossCompanyRes.body.message).toMatch(/Access denied/i);
    });
  });

  // 7. Database Persistence across backend restarts
  describe('7. Database Persistence Across Server Restarts', () => {
    it('Should persist work session data to disk and reload accurately after backend restart', async () => {
      // Clear sessions and start a new session
      db.workSessions = [];
      const startRes = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
          deviceInfo: 'Persistence Verification Test',
        });
      expect(startRes.status).toBe(201);
      const createdSessionId = startRes.body.sessionId;

      // Force atomic persist to data/database.json
      db.persist();
      await new Promise((r) => setTimeout(r, 100));

      // Simulate backend restart by calling onModuleInit() on DatabaseService
      await db.onModuleInit();

      // Verify the session reloaded from data/database.json into memory
      const reloaded = db.workSessions.find((s) => s.id === createdSessionId);
      expect(reloaded).toBeDefined();
      expect(reloaded?.status).toBe(WorkSessionStatus.ACTIVE);
      expect(reloaded?.employeeId).toBe(emp1Id);
    });
  });

  // 8. Secure selfie storage and view authorization
  describe('8. Secure Selfie Storage & Authorization Boundary', () => {
    let testSessionId: string;

    beforeAll(async () => {
      db.workSessions = [];
      const res = await request(app.getHttpServer())
        .post('/api/attendance/work/start')
        .set('Authorization', emp1Token)
        .send({
          latitude: officeLat,
          longitude: officeLon,
          accuracy: 10,
          selfie: sampleSelfie,
        });
      testSessionId = res.body.sessionId;
    });

    it('8a. Should allow authorized employee to retrieve their own selfie image stream', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/attendance/work/selfie/${testSessionId}/start`)
        .set('Authorization', emp1Token);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/(jpeg|jpg|png)/);
    });

    it('8b. Should reject unauthorized employee from retrieving another employee selfie', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/attendance/work/selfie/${testSessionId}/start`)
        .set('Authorization', emp2Token);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('8c. Should reject cross-company Admin from viewing employee selfie of another company', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/attendance/work/selfie/${testSessionId}/start`)
        .set('Authorization', admin2Token);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    it('8d. Should reject unauthenticated selfie request', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/attendance/work/selfie/${testSessionId}/start`);

      expect(res.status).toBe(401);
    });
  });
});
