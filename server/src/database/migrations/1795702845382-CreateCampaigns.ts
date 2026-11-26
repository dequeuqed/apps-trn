import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaigns1795702845382 implements MigrationInterface {
  name = 'CreateCampaigns1795702845382';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE campaigns (
        id            uuid          NOT NULL DEFAULT gen_random_uuid(),
        name          varchar(255)  NOT NULL,
        supplier      varchar(255)  NOT NULL,
        region_code   varchar(16)   NOT NULL,
        channel       varchar(32)   NOT NULL,
        budget_cents  bigint        NOT NULL,
        start_date    date          NOT NULL,
        end_date      date          NOT NULL,
        status        varchar(32)   NOT NULL DEFAULT 'draft',
        version       integer       NOT NULL,
        created_at    timestamptz   NOT NULL DEFAULT now(),
        updated_at    timestamptz   NOT NULL DEFAULT now(),

        CONSTRAINT pk_campaigns PRIMARY KEY (id),
        CONSTRAINT chk_campaigns_end_after_start CHECK (end_date >= start_date),
        CONSTRAINT chk_campaigns_status CHECK (status IN ('draft', 'active', 'completed', 'archived')),
        CONSTRAINT chk_campaigns_budget_non_negative CHECK (budget_cents >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_campaigns_region_status_start
        ON campaigns (region_code, status, start_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_campaigns_region_status_start`);
    await queryRunner.query(`DROP TABLE campaigns`);
  }
}
