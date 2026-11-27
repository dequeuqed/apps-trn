import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { validationError } from '../common/validation.pipe.js';
import { Campaign } from './campaign.entity.js';
import {
  encodeCursor,
  type ListCampaignsQuery,
} from './list-campaigns.schema.js';

export interface CampaignPage {
  items: Campaign[];
  nextCursor: string | null;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');
import {
  END_BEFORE_START_MESSAGE,
  type CreateCampaignInput,
} from './create-campaign.schema.js';
import type { UpdateCampaignInput } from './update-campaign.schema.js';

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

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaigns.findOneBy({ id });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  /**
   * Optimistic locking: the update only applies if the stored version still
   * equals the one the client read. TypeORM adds `version = version + 1` and
   * `updated_at = now()` to the UPDATE.
   */
  update(
    id: string,
    { version, ...changes }: UpdateCampaignInput,
  ): Promise<Campaign> {
    return this.campaigns.manager.transaction(async (em) => {
      const repo = em.getRepository(Campaign);
      const current = await repo.findOneBy({ id });
      if (!current) throw new NotFoundException('Campaign not found');
      if (current.version !== version) throw staleVersion();

      const startDate = changes.startDate ?? current.startDate;
      const endDate = changes.endDate ?? current.endDate;
      if (endDate < startDate) {
        throw validationError([
          { field: 'endDate', message: END_BEFORE_START_MESSAGE },
        ]);
      }

      const result = await repo
        .createQueryBuilder()
        .update()
        .set(changes)
        .where('id = :id AND version = :version', { id, version })
        .execute();
      // Someone saved between our read and this write.
      if (result.affected !== 1) throw staleVersion();

      // We hold the row lock until commit, so this reads our own write.
      return repo.findOneByOrFail({ id });
    });
  }
}

function staleVersion(): ConflictException {
  return new ConflictException(
    'Campaign was changed by someone else. Reload it and try again.',
  );
}
