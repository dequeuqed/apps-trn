import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { Campaign } from './../src/campaigns/campaign.entity.js';

describe('GET/PATCH /api/campaigns/:id (e2e)', () => {
  let app: INestApplication<App>;
  let repo: Repository<Campaign>;
  const createdIds: string[] = [];

  const seed = async (overrides: Partial<Campaign> = {}) => {
    const campaign = await repo.save(
      repo.create({
        name: 'Spring launch',
        supplier: 'Acme Media',
        regionCode: 'UA-30',
        channel: 'tv',
        budgetCents: 1_500_000,
        startDate: '2027-03-01',
        endDate: '2027-03-31',
        status: 'draft',
        ...overrides,
      }),
    );
    createdIds.push(campaign.id);
    return campaign;
  };

  const get = (id: string) =>
    request(app.getHttpServer()).get(`/api/campaigns/${id}`);
  const patch = (id: string, body: object) =>
    request(app.getHttpServer()).patch(`/api/campaigns/${id}`).send(body);

  const fieldErrors = (body: { errors: { field: string | null }[] }) =>
    body.errors.map((e) => e.field);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    repo = app.get(DataSource).getRepository(Campaign);
  });

  afterAll(async () => {
    if (createdIds.length) await repo.delete({ id: In(createdIds) });
    await app.close();
  });

  describe('GET /api/campaigns/:id', () => {
    it('returns 200 with the campaign', async () => {
      const campaign = await seed();

      const res = await get(campaign.id)
        .expect('Content-Type', /json/)
        .expect(200);

      // Round-trip through JSON so Dates compare as the ISO strings sent.
      expect(res.body).toStrictEqual(JSON.parse(JSON.stringify(campaign)));
    });

    it('returns 404 for an unknown id', async () => {
      const res = await get(randomUUID()).expect(404);

      expect(res.body).toMatchObject({ statusCode: 404 });
    });

    it('returns 400 for an id that is not a uuid', async () => {
      const res = await get('not-a-uuid').expect(400);

      expect(fieldErrors(res.body)).toStrictEqual(['id']);
    });
  });

  describe('PATCH /api/campaigns/:id', () => {
    it('saves the change and increments the version', async () => {
      const campaign = await seed();

      const res = await patch(campaign.id, {
        version: 1,
        name: 'Spring relaunch',
        budgetCents: 2_000_000,
      }).expect(200);

      expect(res.body).toMatchObject({
        id: campaign.id,
        name: 'Spring relaunch',
        budgetCents: 2_000_000,
        supplier: campaign.supplier,
        version: 2,
      });
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
        campaign.updatedAt.getTime(),
      );

      const saved = await repo.findOneByOrFail({ id: campaign.id });
      expect(saved).toMatchObject({
        name: 'Spring relaunch',
        budgetCents: 2_000_000,
        version: 2,
      });
    });

    it('accepts consecutive edits that each send the latest version', async () => {
      const campaign = await seed();

      await patch(campaign.id, { version: 1, name: 'Edit one' }).expect(200);
      const res = await patch(campaign.id, {
        version: 2,
        channel: 'radio',
      }).expect(200);

      expect(res.body).toMatchObject({
        name: 'Edit one',
        channel: 'radio',
        version: 3,
      });
    });

    it('returns 409 and changes nothing when the version is stale', async () => {
      const campaign = await seed();
      await patch(campaign.id, { version: 1, name: 'Colleague edit' }).expect(
        200,
      );
      const before = await repo.findOneByOrFail({ id: campaign.id });

      const res = await patch(campaign.id, {
        version: 1,
        name: 'My edit',
      }).expect(409);

      expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
      expect(await repo.findOneByOrFail({ id: campaign.id })).toStrictEqual(
        before,
      );
    });

    it('lets exactly one of two concurrent edits at the same version win', async () => {
      const campaign = await seed();

      const results = await Promise.all([
        patch(campaign.id, { version: 1, name: 'Edit A' }),
        patch(campaign.id, { version: 1, name: 'Edit B' }),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toStrictEqual([
        200, 409,
      ]);
      const winner = results.find((r) => r.status === 200)!;
      const saved = await repo.findOneByOrFail({ id: campaign.id });
      expect(saved).toMatchObject({ name: winner.body.name, version: 2 });
    });

    it('returns 404 for an unknown id', async () => {
      await patch(randomUUID(), { version: 1, name: 'x' }).expect(404);
    });

    it('returns 400 for an id that is not a uuid', async () => {
      const res = await patch('not-a-uuid', { version: 1, name: 'x' }).expect(
        400,
      );

      expect(fieldErrors(res.body)).toStrictEqual(['id']);
    });

    it('returns 400 when version is missing', async () => {
      const campaign = await seed();

      const res = await patch(campaign.id, { name: 'x' }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual(['version']);
    });

    it('returns 400 when there is nothing to update', async () => {
      const campaign = await seed();

      const res = await patch(campaign.id, { version: 1 }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual([null]);
    });

    it('returns 400 for server-owned fields', async () => {
      const campaign = await seed();

      const res = await patch(campaign.id, {
        version: 1,
        status: 'active',
      }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual([null]);
    });

    it('returns 400 and changes nothing when the new endDate is before the stored startDate', async () => {
      const campaign = await seed();

      const res = await patch(campaign.id, {
        version: 1,
        endDate: '2027-02-28',
      }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual(['endDate']);
      expect(await repo.findOneByOrFail({ id: campaign.id })).toMatchObject({
        endDate: campaign.endDate,
        version: 1,
      });
    });

    it('allows moving both dates together', async () => {
      const campaign = await seed();

      const res = await patch(campaign.id, {
        version: 1,
        startDate: '2027-05-01',
        endDate: '2027-05-31',
      }).expect(200);

      expect(res.body).toMatchObject({
        startDate: '2027-05-01',
        endDate: '2027-05-31',
        version: 2,
      });
    });
  });
});
