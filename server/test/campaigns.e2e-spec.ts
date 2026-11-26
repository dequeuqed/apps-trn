import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { Campaign } from './../src/campaigns/campaign.entity.js';

describe('POST /api/campaigns (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdIds: string[] = [];

  const validBody = {
    name: 'Spring launch',
    supplier: 'Acme Media',
    regionCode: 'UA-30',
    channel: 'tv',
    budgetCents: 1_500_000,
    startDate: '2027-03-01',
    endDate: '2027-03-31',
  };

  const post = (body: object) =>
    request(app.getHttpServer()).post('/api/campaigns').send(body);

  const validationError = (...errors: { field: string | null }[]) => ({
    statusCode: 400,
    error: 'Bad Request',
    message: 'Validation failed',
    errors: errors.map((e) => ({ ...e, message: expect.any(String) })),
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (createdIds.length) {
      await dataSource.getRepository(Campaign).delete({ id: In(createdIds) });
    }
    await app.close();
  });

  it('creates a draft campaign and returns it with 201', async () => {
    const res = await post(validBody)
      .expect('Content-Type', /json/)
      .expect(201);
    createdIds.push(res.body.id);

    expect(res.body).toStrictEqual({
      ...validBody,
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
      status: 'draft',
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const saved = await dataSource
      .getRepository(Campaign)
      .findOneByOrFail({ id: res.body.id });
    expect(saved).toMatchObject({ ...validBody, status: 'draft', version: 1 });
  });

  it('returns 400 with a field error when endDate is before startDate', async () => {
    const res = await post({ ...validBody, endDate: '2027-02-28' }).expect(400);

    expect(res.body).toStrictEqual(validationError({ field: 'endDate' }));
  });

  it('returns 400 with a field error when a required field is missing', async () => {
    const { name: _name, ...withoutName } = validBody;
    const res = await post(withoutName).expect(400);

    expect(res.body).toStrictEqual(validationError({ field: 'name' }));
  });

  it('returns 400 with a field error for every invalid field', async () => {
    const res = await post({
      ...validBody,
      supplier: '',
      startDate: 'not-a-date',
    }).expect(400);

    expect(res.body).toStrictEqual(
      validationError({ field: 'supplier' }, { field: 'startDate' }),
    );
  });

  it('returns 400 when the budget is negative', async () => {
    const res = await post({ ...validBody, budgetCents: -1 }).expect(400);

    expect(res.body).toStrictEqual(validationError({ field: 'budgetCents' }));
  });

  it('returns 400 when the client tries to set server-owned fields', async () => {
    const res = await post({ ...validBody, status: 'active' }).expect(400);

    expect(res.body).toStrictEqual(validationError({ field: null }));
  });
});
