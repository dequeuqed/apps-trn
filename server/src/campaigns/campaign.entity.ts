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

@Entity({ name: 'campaigns' })
@Index('idx_campaigns_region_status_start', [
  'regionCode',
  'status',
  'startDate',
])
@Check('chk_campaigns_end_after_start', '"end_date" >= "start_date"')
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

  // Postgres bigint exceeds Number.MAX_SAFE_INTEGER, so the driver returns it as a string.
  @Column({ name: 'budget_cents', type: 'bigint' })
  budgetCents: string;

  // `date` columns come back as 'YYYY-MM-DD' strings, with no timezone shift.
  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', length: 32 })
  status: string;

  @VersionColumn({ type: 'integer' })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
