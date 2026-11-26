import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AppService } from './../src/app.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  it('GET /api/health returns ok when the database is up', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toStrictEqual({ status: 'ok', db: 'up' });
  });

  it('GET /api/health returns 503 when the database is down', async () => {
    vi.spyOn(app.get(AppService), 'checkDatabase').mockResolvedValue(false);

    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(503);

    expect(res.body).toStrictEqual({ status: 'error' });
  });
});
