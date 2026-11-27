import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import type { Campaign } from '../api/campaigns.ts';

export function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

export interface ApiRequest {
  method: string;
  url: URL;
  body: unknown;
}

/** Replaces global fetch with `handler`; returns the mock to inspect calls. */
export function mockApi(
  handler: (req: ApiRequest) => Response | Promise<Response>,
) {
  const requests: ApiRequest[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const req: ApiRequest = {
        method: init?.method ?? 'GET',
        url: new URL(String(input), 'http://localhost'),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      requests.push(req);
      return handler(req);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, requests };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let seq = 0;
export function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    name: `Campaign ${seq}`,
    supplier: 'Acme Media',
    regionCode: 'UA-30',
    channel: 'tv',
    budgetCents: 150_000,
    startDate: '2027-03-01',
    endDate: '2027-03-31',
    status: 'draft',
    version: 1,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export interface CampaignFormInput {
  name: string;
  supplier: string;
  regionCode: string;
  channel: string;
  budget: string;
  startDate: string;
  endDate: string;
}

export const validFormInput: CampaignFormInput = {
  name: 'Spring launch',
  supplier: 'Acme Media',
  regionCode: 'UA-30',
  channel: 'tv',
  budget: '15000.50',
  startDate: '2027-03-01',
  endDate: '2027-03-31',
};

const formLabels: Record<keyof CampaignFormInput, string> = {
  name: 'Name',
  supplier: 'Supplier',
  regionCode: 'Region',
  channel: 'Channel',
  budget: 'Budget',
  startDate: 'Start date',
  endDate: 'End date',
};

export const campaignForm = () =>
  screen.getByRole('form', { name: 'New campaign' });

/** A create-form field by its label, scoped so page filters don't match. */
export const formField = (name: keyof CampaignFormInput) =>
  within(campaignForm()).getByLabelText(formLabels[name]);

export async function fillCampaignForm(
  user: UserEvent,
  values: Partial<CampaignFormInput>,
) {
  for (const [name, value] of Object.entries(values) as [
    keyof CampaignFormInput,
    string,
  ][]) {
    const input = formField(name);
    await user.clear(input);
    if (value) await user.type(input, value);
  }
}
