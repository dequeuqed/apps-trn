import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Campaign } from './campaign.entity.js';
import { CampaignsService } from './campaigns.service.js';
import {
  createCampaignSchema,
  type CreateCampaignInput,
} from './create-campaign.schema.js';
import {
  campaignIdParamsSchema,
  updateCampaignSchema,
  type CampaignIdParams,
  type UpdateCampaignInput,
} from './update-campaign.schema.js';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @Body({ schema: createCampaignSchema }) body: CreateCampaignInput,
  ): Promise<Campaign> {
    return this.campaignsService.create(body);
  }

  @Get(':id')
  findOne(
    @Param({ schema: campaignIdParamsSchema }) { id }: CampaignIdParams,
  ): Promise<Campaign> {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param({ schema: campaignIdParamsSchema }) { id }: CampaignIdParams,
    @Body({ schema: updateCampaignSchema }) body: UpdateCampaignInput,
  ): Promise<Campaign> {
    return this.campaignsService.update(id, body);
  }
}
