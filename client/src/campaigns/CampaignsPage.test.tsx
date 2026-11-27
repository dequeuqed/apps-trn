import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Campaign, CampaignPage } from '../api/campaigns.ts';
import {
  fillCampaignForm,
  json,
  makeCampaign,
  mockApi,
  renderWithClient,
  validFormInput,
  type ApiRequest,
} from '../test/utils.tsx';
import { CampaignsPage } from './CampaignsPage.tsx';

const page = (items: Campaign[], nextCursor: string | null = null) =>
  json({ items, nextCursor } satisfies CampaignPage);

const listRequests = (requests: ApiRequest[]) =>
  requests.filter((r) => r.method === 'GET');

const rows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1); // skip the header row

describe('CampaignsPage list states', () => {
  it('shows a loading state while the first page loads', () => {
    mockApi(() => new Promise<Response>(() => {}));
    renderWithClient(<CampaignsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading campaigns…');
  });

  it('shows campaigns with their status and dates', async () => {
    mockApi(() =>
      page([
        makeCampaign({
          name: 'Spring launch',
          status: 'active',
          startDate: '2027-03-01',
          endDate: '2027-03-31',
        }),
        makeCampaign({ name: 'Winter promo', status: 'draft' }),
      ]),
    );
    renderWithClient(<CampaignsPage />);

    const row = (await screen.findByText('Spring launch')).closest('tr')!;
    expect(within(row).getByText('active')).toBeInTheDocument();
    const [start, end] = row.querySelectorAll('time');
    expect(start).toHaveAttribute('dateTime', '2027-03-01');
    expect(end).toHaveAttribute('dateTime', '2027-03-31');
    expect(start.textContent).toMatch(/2027/);
    expect(rows()).toHaveLength(2);
  });

  it('shows an empty state when there are no campaigns', async () => {
    mockApi(() => page([]));
    renderWithClient(<CampaignsPage />);

    expect(await screen.findByText('No campaigns yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create the first one' }),
    ).toBeInTheDocument();
  });

  it('shows a different empty state when filters match nothing', async () => {
    const user = userEvent.setup();
    mockApi(({ url }) =>
      url.searchParams.get('status') === 'archived'
        ? page([])
        : page([makeCampaign({ name: 'Spring launch' })]),
    );
    renderWithClient(<CampaignsPage />);
    await screen.findByText('Spring launch');

    await user.selectOptions(screen.getByLabelText('Status'), 'archived');

    expect(
      await screen.findByText('No campaigns match these filters.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Spring launch')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('shows an error state with a retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi(() =>
      fail
        ? json({ statusCode: 500 }, 500)
        : page([makeCampaign({ name: 'Spring launch' })]),
    );
    renderWithClient(<CampaignsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t load campaigns.',
    );

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Spring launch')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('CampaignsPage paging and filters', () => {
  it('loads the next page with the cursor and appends it', async () => {
    const user = userEvent.setup();
    const { requests } = mockApi(({ url }) =>
      url.searchParams.get('cursor') === 'cursor-1'
        ? page([makeCampaign({ name: 'Page two campaign' })])
        : page([makeCampaign({ name: 'Page one campaign' })], 'cursor-1'),
    );
    renderWithClient(<CampaignsPage />);
    await screen.findByText('Page one campaign');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Page two campaign')).toBeInTheDocument();
    expect(screen.getByText('Page one campaign')).toBeInTheDocument();
    expect(rows()).toHaveLength(2);
    expect(listRequests(requests).at(-1)!.url.searchParams.get('cursor')).toBe(
      'cursor-1',
    );
    // That was the last page.
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
  });

  it('keeps loaded rows and says so when the next page fails', async () => {
    const user = userEvent.setup();
    mockApi(({ url }) =>
      url.searchParams.get('cursor')
        ? json({ statusCode: 500 }, 500)
        : page([makeCampaign({ name: 'Page one campaign' })], 'cursor-1'),
    );
    renderWithClient(<CampaignsPage />);
    await screen.findByText('Page one campaign');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t load more campaigns.',
    );
    expect(screen.getByText('Page one campaign')).toBeInTheDocument();
  });

  it('sends status, region and search to the API', async () => {
    const user = userEvent.setup();
    const { requests } = mockApi(() => page([makeCampaign()]));
    renderWithClient(<CampaignsPage />);
    await screen.findByRole('table');

    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await user.type(screen.getByLabelText('Region'), 'UA-30');
    await user.type(screen.getByLabelText('Search by name'), 'spring');

    await waitFor(() => {
      const params = listRequests(requests).at(-1)!.url.searchParams;
      expect(Object.fromEntries(params)).toStrictEqual({
        limit: '20',
        status: 'active',
        region: 'UA-30',
        q: 'spring',
      });
    });
    // Text filters are debounced rather than sent per keystroke.
    expect(listRequests(requests).length).toBeLessThan(5);
  });
});

describe('CampaignsPage create', () => {
  it('refreshes the list after a successful create', async () => {
    const user = userEvent.setup();
    const existing = makeCampaign({ name: 'Existing campaign' });
    let campaigns = [existing];
    const { requests } = mockApi(({ method, body }) => {
      if (method === 'POST') {
        const created = makeCampaign({
          ...(body as object),
          name: 'Spring launch',
          startDate: '2027-06-01',
        });
        campaigns = [created, ...campaigns];
        return json(created, 201);
      }
      return page(campaigns);
    });
    renderWithClient(<CampaignsPage />);
    await screen.findByText('Existing campaign');

    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    await fillCampaignForm(user, validFormInput);
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));

    const newRow = await within(screen.getByRole('table')).findByText(
      'Spring launch',
    );
    expect(newRow).toBeInTheDocument();
    expect(rows()).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Created “Spring launch” as a draft.',
    );
    expect(
      screen.queryByRole('form', { name: 'New campaign' }),
    ).not.toBeInTheDocument();
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(1);
    expect(listRequests(requests)).toHaveLength(2);
  });
});
