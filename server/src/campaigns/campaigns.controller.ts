import { Body, Controller, Post } from '@nestjs/common';
import { Campaign } from './campaign.entity.js';
import { CampaignsService } from './campaigns.service.js';
import {
  createCampaignSchema,
  type CreateCampaignInput,
} from './create-campaign.schema.js';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @Body({ schema: createCampaignSchema }) body: CreateCampaignInput,
  ): Promise<Campaign> {
    return this.campaignsService.create(body);
  }
}
