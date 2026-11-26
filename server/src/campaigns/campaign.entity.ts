import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export type CampaignStatus = 'draft' | 'active' | 'completed' | 'archived';

@Entity({ name: 'campaigns' })
@Index('idx_campaigns_region_status_start', [
  'regionCode',
  'status',
  'startDate',
])
@Check('chk_campaigns_end_after_start', '"end_date" >= "start_date"')
@Check(
  'chk_campaigns_status',
  `"status" IN ('draft', 'active', 'completed', 'archived')`,
)
@Check('chk_campaigns_budget_non_negative', '"budget_cents" >= 0')
export class Campaign {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_campaigns' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  supplier: string;

  @Column({ name: 'region_code', type: 'varchar', length: 16 })
  regionCode: string;

  @Column({ type: 'varchar', length: 32 })
  channel: string;

  @Column({
    name: 'budget_cents',
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  budgetCents: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: CampaignStatus;

  @VersionColumn({ type: 'integer' })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
