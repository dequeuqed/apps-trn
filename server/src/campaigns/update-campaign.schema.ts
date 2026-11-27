import { z } from 'zod';
import { campaignFields } from './create-campaign.schema.js';

export const campaignIdParamsSchema = z.object({ id: z.uuid() });

export type CampaignIdParams = z.infer<typeof campaignIdParamsSchema>;

/**
 * Any subset of the editable fields, plus the version the client last read.
 * endDate >= startDate is checked in the service against the stored values,
 * since a patch may change only one of the two dates.
 */
export const updateCampaignSchema = campaignFields
  .partial()
  .extend({ version: z.int().positive() })
  .refine((patch) => Object.keys(patch).some((key) => key !== 'version'), {
    message: 'At least one field to update is required',
    // Skip when the body already failed, e.g. it only had unknown keys.
    when: (payload) => !payload.issues.length,
  });

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
