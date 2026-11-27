import { z } from 'zod';
import { CAMPAIGN_STATUSES } from './campaign.entity.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface CampaignCursor {
  startDate: string;
  id: string;
}

const cursorPayload = z.tuple([z.iso.date(), z.uuid()]);

export function encodeCursor({ startDate, id }: CampaignCursor): string {
  return Buffer.from(JSON.stringify([startDate, id])).toString('base64url');
}

function decodeCursor(raw: string): CampaignCursor | null {
  try {
    const json: unknown = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    );
    const parsed = cursorPayload.safeParse(json);
    return parsed.success
      ? { startDate: parsed.data[0], id: parsed.data[1] }
      : null;
  } catch {
    return null;
  }
}

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const listCampaignsSchema = z.strictObject({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  region: z.string().trim().min(1).max(16).optional(),
  q: z.preprocess(blankToUndefined, z.string().trim().max(255).optional()),
  cursor: z
    .string()
    .transform((raw, ctx) => {
      const cursor = decodeCursor(raw);
      if (!cursor) {
        ctx.addIssue({ code: 'custom', message: 'Invalid cursor' });
        return z.NEVER;
      }
      return cursor;
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsSchema>;
