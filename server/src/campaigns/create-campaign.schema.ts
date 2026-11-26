import { z } from 'zod';

const campaignFields = z.strictObject({
  name: z.string().trim().min(1).max(255),
  supplier: z.string().trim().min(1).max(255),
  regionCode: z.string().trim().min(1).max(16),
  channel: z.string().trim().min(1).max(32),
  budgetCents: z.int().nonnegative(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

const dateRange = z.object({
  startDate: campaignFields.shape.startDate,
  endDate: campaignFields.shape.endDate,
});

export const createCampaignSchema = campaignFields.refine(
  (campaign) => campaign.endDate >= campaign.startDate,
  {
    message: 'Must be on or after startDate',
    path: ['endDate'],
    when: (payload) => dateRange.safeParse(payload.value).success,
  },
);

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
