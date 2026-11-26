import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './campaign.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign])],
  exports: [TypeOrmModule],
})
export class CampaignsModule {}
