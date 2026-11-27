import { z } from 'zod';
import type { CreateCampaignInput } from '../api/campaigns.ts';

/**
 * Same rules as the server's createCampaignSchema
 * (server/src/campaigns/create-campaign.schema.ts). The one difference is
 * budget: people type an amount like "1500.50", which becomes budgetCents.
 */
const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

const budget = z
  .string()
  .trim()
  .min(1, 'Budget is required')
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 1500 or 1500.50')
  .transform((amount) => Math.round(Number(amount) * 100))
  .refine(Number.isSafeInteger, 'Budget is too large');

const date = (label: string) =>
  z.iso.date({ error: `${label} is required` });

const fields = z.object({
  name: text('Name', 255),
  supplier: text('Supplier', 255),
  regionCode: text('Region', 16),
  channel: text('Channel', 32),
  budget,
  startDate: date('Start date'),
  endDate: date('End date'),
});

export const END_BEFORE_START_MESSAGE = 'End date must be on or after start date';

export const campaignFormSchema = fields
  .refine((values) => values.endDate >= values.startDate, {
    message: END_BEFORE_START_MESSAGE,
    path: ['endDate'],
    // Only compare once both dates are valid.
    when: (payload) =>
      fields
        .pick({ startDate: true, endDate: true })
        .safeParse(payload.value).success,
  })
  .transform(
    ({ budget, ...rest }): CreateCampaignInput => ({
      ...rest,
      budgetCents: budget,
    }),
  );

export type CampaignFormValues = z.input<typeof campaignFormSchema>;

export const emptyCampaignForm: CampaignFormValues = {
  name: '',
  supplier: '',
  regionCode: '',
  channel: '',
  budget: '',
  startDate: '',
  endDate: '',
};

/** Maps API field names onto form field names. */
export function formFieldFor(
  apiField: string,
): keyof CampaignFormValues | undefined {
  if (apiField === 'budgetCents') return 'budget';
  return apiField in emptyCampaignForm
    ? (apiField as keyof CampaignFormValues)
    : undefined;
}
