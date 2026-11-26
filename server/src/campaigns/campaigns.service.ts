import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './campaign.entity.js';
import type { CreateCampaignInput } from './create-campaign.schema.js';

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
}
