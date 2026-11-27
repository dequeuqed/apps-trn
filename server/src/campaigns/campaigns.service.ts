import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Campaign } from './campaign.entity.js';
import type { CreateCampaignInput } from './create-campaign.schema.js';
import {
  encodeCursor,
  type ListCampaignsQuery,
} from './list-campaigns.schema.js';

export interface CampaignPage {
  items: Campaign[];
  nextCursor: string | null;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
  ) {}

  create(input: CreateCampaignInput): Promise<Campaign> {
    const campaign = this.campaigns.create({ ...input, status: 'draft' });
    return this.campaigns.save(campaign);
  }

  async list(query: ListCampaignsQuery): Promise<CampaignPage> {
    const rows = await this.listQuery(query).getMany();
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const last = items.at(-1);

    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
  }

  listQuery({
    status,
    region,
    q,
    cursor,
    limit,
  }: ListCampaignsQuery): SelectQueryBuilder<Campaign> {
    const qb = this.campaigns
      .createQueryBuilder('c')
      .orderBy('c.startDate', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);

    if (region) qb.andWhere('c.regionCode = :region', { region });
    if (status) qb.andWhere('c.status = :status', { status });
    if (q) qb.andWhere('c.name ILIKE :q', { q: `%${escapeLike(q)}%` });

    if (cursor) {
      qb.andWhere('c.startDate <= :cursorDate', {
        cursorDate: cursor.startDate,
      }).andWhere('(c.startDate < :cursorDate OR c.id > :cursorId)', {
        cursorId: cursor.id,
      });
    }

    return qb;
  }
}
