import { request } from './http.ts';

export const CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'completed',
  'archived',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Mirrors the server's Campaign entity as serialized to JSON. */
export interface Campaign {
  id: string;
  name: string;
  supplier: string;
  regionCode: string;
  channel: string;
  budgetCents: number;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPage {
  items: Campaign[];
  nextCursor: string | null;
}

export interface CampaignFilters {
  status?: CampaignStatus;
  region?: string;
  q?: string;
}

export interface CreateCampaignInput {
  name: string;
  supplier: string;
  regionCode: string;
  channel: string;
  budgetCents: number;
  startDate: string;
  endDate: string;
}

export const PAGE_SIZE = 20;

export function listCampaigns(
  filters: CampaignFilters,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<CampaignPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filters.status) params.set('status', filters.status);
  if (filters.region) params.set('region', filters.region);
  if (filters.q) params.set('q', filters.q);
  if (cursor) params.set('cursor', cursor);

  return request<CampaignPage>(`/campaigns?${params}`, { signal });
}

export function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return request<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
