import { randomBytes } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource, In } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import {
  CAMPAIGN_STATUSES,
  Campaign,
} from './../src/campaigns/campaign.entity.js';
import { CampaignsService } from './../src/campaigns/campaigns.service.js';
import { listCampaignsSchema } from './../src/campaigns/list-campaigns.schema.js';

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

const indexesUsed = (node: PlanNode): string[] => [
  ...(node['Index Name'] ? [node['Index Name']] : []),
  ...(node.Plans ?? []).flatMap(indexesUsed),
];

const byListOrder = (a: Campaign, b: Campaign) =>
  b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id);

describe('GET /api/campaigns (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const tag = randomBytes(4).toString('hex').toUpperCase();
  const mainRegion = `L${tag}`;
  const otherRegion = `M${tag}`;
  let mainSeeds: Campaign[];

  const list = (query: Record<string, string | number>) =>
    request(app.getHttpServer()).get('/api/campaigns').query(query);

  const fieldErrors = (body: { errors: { field: string | null }[] }) =>
    body.errors.map((e) => e.field);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    dataSource = app.get(DataSource);
    const repo = dataSource.getRepository(Campaign);

    mainSeeds = await repo.save(
      Array.from({ length: 50 }, (_, i) => {
        const day = String(1 + Math.floor(i / 5)).padStart(2, '0');
        return repo.create({
          name: `Main campaign ${i}`,
          supplier: 'Acme Media',
          regionCode: mainRegion,
          channel: 'tv',
          budgetCents: 1000,
          startDate: `2027-04-${day}`,
          endDate: '2027-05-31',
          status: CAMPAIGN_STATUSES[i % CAMPAIGN_STATUSES.length],
        });
      }),
    );

    await repo.save(
      [
        ['Black Friday Blitz', 'active'],
        ['black friday recap', 'draft'],
        ['Cyber 100% Off', 'active'],
        ['Cyber 1000 Off', 'active'],
        ['Promo a_b', 'active'],
        ['Promo axb', 'active'],
      ].map(([name, status]) =>
        repo.create({
          name,
          supplier: 'Acme Media',
          regionCode: otherRegion,
          channel: 'web',
          budgetCents: 1000,
          startDate: '2027-04-01',
          endDate: '2027-05-31',
          status: status as Campaign['status'],
        }),
      ),
    );
  });

  afterAll(async () => {
    await dataSource
      .getRepository(Campaign)
      .delete({ regionCode: In([mainRegion, otherRegion]) });
    await app.close();
  });

  describe('cursor pagination', () => {
    it('pages through 50 campaigns in order with no duplicates or gaps', async () => {
      const first = await list({ region: mainRegion, limit: 20 }).expect(200);
      expect(first.body.items).toHaveLength(20);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await list({
        region: mainRegion,
        limit: 20,
        cursor: first.body.nextCursor,
      }).expect(200);
      expect(second.body.items).toHaveLength(20);
      expect(second.body.nextCursor).toEqual(expect.any(String));

      const third = await list({
        region: mainRegion,
        limit: 20,
        cursor: second.body.nextCursor,
      }).expect(200);
      expect(third.body.items).toHaveLength(10);
      expect(third.body.nextCursor).toBeNull();

      const ids = [first, second, third].flatMap((res) =>
        res.body.items.map((c: Campaign) => c.id),
      );
      expect(ids).toStrictEqual(
        [...mainSeeds].sort(byListOrder).map((c) => c.id),
      );
    });

    it('defaults to 20 items per page', async () => {
      const res = await list({ region: mainRegion }).expect(200);

      expect(res.body.items).toHaveLength(20);
      expect(res.body.nextCursor).toEqual(expect.any(String));
    });

    it('returns no cursor when everything fits on one page', async () => {
      const res = await list({ region: mainRegion, limit: 50 }).expect(200);

      expect(res.body.items).toHaveLength(50);
      expect(res.body.nextCursor).toBeNull();
    });

    it('returns campaigns in the same shape as create', async () => {
      const res = await list({ region: mainRegion, limit: 1 }).expect(200);

      expect(res.body.items[0]).toStrictEqual({
        id: expect.any(String),
        name: expect.any(String),
        supplier: 'Acme Media',
        regionCode: mainRegion,
        channel: 'tv',
        budgetCents: 1000,
        startDate: '2027-04-10',
        endDate: '2027-05-31',
        status: expect.any(String),
        version: 1,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });

  describe('filters', () => {
    it('returns only campaigns matching status and region', async () => {
      const res = await list({
        region: mainRegion,
        status: 'active',
        limit: 100,
      }).expect(200);

      const expected = mainSeeds
        .filter((c) => c.status === 'active')
        .sort(byListOrder)
        .map((c) => c.id);
      expect(expected.length).toBeGreaterThan(0);
      expect(res.body.items.map((c: Campaign) => c.id)).toStrictEqual(expected);
    });

    it('keeps filters applied across pages', async () => {
      const first = await list({
        region: mainRegion,
        status: 'draft',
        limit: 5,
      }).expect(200);
      const second = await list({
        region: mainRegion,
        status: 'draft',
        limit: 5,
        cursor: first.body.nextCursor,
      }).expect(200);

      const items: Campaign[] = [...first.body.items, ...second.body.items];
      expect(items).toHaveLength(10);
      expect(items.every((c) => c.status === 'draft')).toBe(true);
      expect(items.every((c) => c.regionCode === mainRegion)).toBe(true);
      expect(new Set(items.map((c) => c.id)).size).toBe(10);
    });

    it('searches by name, ignoring case', async () => {
      const res = await list({ region: otherRegion, q: 'FRIDAY' }).expect(200);

      expect(res.body.items.map((c: Campaign) => c.name).sort()).toStrictEqual([
        'Black Friday Blitz',
        'black friday recap',
      ]);
    });

    it('treats % and _ in the search as literal characters', async () => {
      const percent = await list({ region: otherRegion, q: '100%' }).expect(
        200,
      );
      expect(percent.body.items.map((c: Campaign) => c.name)).toStrictEqual([
        'Cyber 100% Off',
      ]);

      const underscore = await list({ region: otherRegion, q: 'a_b' }).expect(
        200,
      );
      expect(underscore.body.items.map((c: Campaign) => c.name)).toStrictEqual([
        'Promo a_b',
      ]);
    });

    it('ignores a blank search', async () => {
      const res = await list({ region: otherRegion, q: '  ' }).expect(200);

      expect(res.body.items).toHaveLength(6);
    });
  });

  describe('validation', () => {
    it('returns 400 when limit is above 100', async () => {
      const res = await list({ limit: 500 }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual(['limit']);
    });

    it.each(['0', '-1', '2.5', 'abc'])(
      'returns 400 when limit is %s',
      async (limit) => {
        const res = await list({ limit }).expect(400);

        expect(fieldErrors(res.body)).toStrictEqual(['limit']);
      },
    );

    it('returns 400 for an unknown status', async () => {
      const res = await list({ status: 'paused' }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual(['status']);
    });

    it.each([
      'not-a-cursor',
      Buffer.from('{"a":1}').toString('base64url'),
      Buffer.from('["2027-01-01","nope"]').toString('base64url'),
    ])('returns 400 for a malformed cursor %s', async (cursor) => {
      const res = await list({ cursor }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual(['cursor']);
    });

    it('returns 400 for unknown query parameters', async () => {
      const res = await list({ regoin: mainRegion }).expect(400);

      expect(fieldErrors(res.body)).toStrictEqual([null]);
    });
  });

  describe('query plan', () => {
    it('uses idx_campaigns_region_status_start for region + status filters', async () => {
      const service = app.get(CampaignsService);
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();

      try {
        // Enough rows for the planner to prefer the index over a seq scan:
        // 20k campaigns over 20 regions x 4 statuses x 365 start dates.
        await runner.query(`
          INSERT INTO campaigns
            (name, supplier, region_code, channel, budget_cents,
             start_date, end_date, status, version)
          SELECT 'Bulk ' || g, 'Bulk', 'BULK-' || (g % 20), 'tv', 1000,
                 DATE '2026-01-01' + (g % 365), DATE '2027-01-01',
                 (ARRAY['draft','active','completed','archived'])[1 + (g / 20) % 4],
                 1
          FROM generate_series(1, 20000) AS g
        `);
        await runner.query('ANALYZE campaigns');

        const explain = async (raw: Record<string, string>) => {
          const [sql, params] = service
            .listQuery(listCampaignsSchema.parse(raw))
            .getQueryAndParameters();
          const [row] = await runner.query(
            `EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`,
            params,
          );
          return indexesUsed(row['QUERY PLAN'][0].Plan);
        };

        const firstPage = { region: 'BULK-3', status: 'active' };
        expect(await explain(firstPage)).toContain(
          'idx_campaigns_region_status_start',
        );

        const [lastOnPage] = await runner.query(
          `SELECT start_date::text AS "startDate", id FROM campaigns
           WHERE region_code = 'BULK-3' AND status = 'active'
           ORDER BY start_date DESC, id LIMIT 1 OFFSET 19`,
        );
        const cursor = Buffer.from(
          JSON.stringify([lastOnPage.startDate, lastOnPage.id]),
        ).toString('base64url');
        expect(await explain({ ...firstPage, cursor })).toContain(
          'idx_campaigns_region_status_start',
        );
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });
  });
});
