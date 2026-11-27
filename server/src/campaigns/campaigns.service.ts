import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validationError } from '../common/validation.pipe.js';
import { Campaign } from './campaign.entity.js';
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
