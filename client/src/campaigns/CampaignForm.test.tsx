import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  campaignForm,
  fillCampaignForm,
  formField,
  json,
  makeCampaign,
  mockApi,
  renderWithClient,
  validFormInput,
} from '../test/utils.tsx';
import { CampaignForm } from './CampaignForm.tsx';

function renderForm() {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  renderWithClient(<CampaignForm onCreated={onCreated} onCancel={onCancel} />);
  return { user, onCreated, onCancel };
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create campaign' }));

const errorFor = (input: HTMLElement) => {
  const ids = input.getAttribute('aria-describedby')?.split(' ') ?? [];
  const errorId = ids.find((id) => id.endsWith('-error'));
  return errorId ? document.getElementById(errorId)?.textContent : undefined;
};

describe('CampaignForm validation', () => {
  it('shows a field error when a required field loses focus empty', async () => {
    const { fetchMock } = mockApi(() => json({}));
    const { user } = renderForm();

    await user.click(formField('name'));
    await user.tab();

    expect(formField('name')).toHaveAttribute('aria-invalid', 'true');
    expect(errorFor(formField('name'))).toBe('Name is required');
    // Untouched fields stay quiet.
    expect(formField('supplier')).toHaveAttribute('aria-invalid', 'false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears the error as soon as the field becomes valid', async () => {
    mockApi(() => json({}));
    const { user } = renderForm();

    await user.click(formField('name'));
    await user.tab();
    await user.type(formField('name'), 'Spring');

    expect(formField('name')).toHaveAttribute('aria-invalid', 'false');
    expect(errorFor(formField('name'))).toBeUndefined();
  });

  it('shows every field error on submit and does not send the request', async () => {
    const { fetchMock } = mockApi(() => json({}));
    const { user, onCreated } = renderForm();

    await submit(user);

    const form = within(campaignForm());
    for (const message of [
      'Name is required',
      'Supplier is required',
      'Region is required',
      'Channel is required',
      'Budget is required',
      'Start date is required',
      'End date is required',
    ]) {
      expect(form.getByText(message)).toBeInTheDocument();
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    const { fetchMock } = mockApi(() => json({}));
    const { user } = renderForm();

    await fillCampaignForm(user, {
      ...validFormInput,
      startDate: '2027-03-10',
      endDate: '2027-03-09',
    });
    await user.tab();

    expect(errorFor(formField('endDate'))).toBe(
      'End date must be on or after start date',
    );

    await submit(user);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-checks the end date when the start date moves', async () => {
    mockApi(() => json({}));
    const { user } = renderForm();

    await fillCampaignForm(user, {
      startDate: '2027-03-10',
      endDate: '2027-03-09',
    });
    await user.tab();
    expect(errorFor(formField('endDate'))).toBeDefined();

    await fillCampaignForm(user, { startDate: '2027-03-01' });

    await waitFor(() =>
      expect(formField('endDate')).toHaveAttribute('aria-invalid', 'false'),
    );
  });

  it.each(['-5', '12.345', 'abc', '1,000'])(
    'rejects budget %s',
    async (budget) => {
      const { fetchMock } = mockApi(() => json({}));
      const { user } = renderForm();

      await fillCampaignForm(user, { ...validFormInput, budget });
      await submit(user);

      expect(errorFor(formField('budget'))).toBe(
        'Enter an amount like 1500 or 1500.50',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects values longer than the API allows', async () => {
    const { fetchMock } = mockApi(() => json({}));
    const { user } = renderForm();

    await fillCampaignForm(user, {
      ...validFormInput,
      regionCode: 'R'.repeat(17),
    });
    await submit(user);

    expect(errorFor(formField('regionCode'))).toBe(
      'Region must be at most 16 characters',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CampaignForm submit', () => {
  it('sends the campaign with the budget in cents', async () => {
    const created = makeCampaign({ name: 'Spring launch' });
    const { requests } = mockApi(() => json(created, 201));
    const { user, onCreated } = renderForm();

    await fillCampaignForm(user, { ...validFormInput, name: '  Spring launch ' });
    await submit(user);

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url.pathname).toBe('/api/campaigns');
    expect(requests[0].body).toStrictEqual({
      name: 'Spring launch',
      supplier: 'Acme Media',
      regionCode: 'UA-30',
      channel: 'tv',
      budgetCents: 1_500_050,
      startDate: '2027-03-01',
      endDate: '2027-03-31',
    });
  });

  it('shows server field errors on the matching fields', async () => {
    mockApi(() =>
      json(
        {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          errors: [{ field: 'budgetCents', message: 'Budget over limit' }],
        },
        400,
      ),
    );
    const { user, onCreated } = renderForm();

    await fillCampaignForm(user, validFormInput);
    await submit(user);

    await waitFor(() =>
      expect(errorFor(formField('budget'))).toBe('Budget over limit'),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows a form-level error when the server fails', async () => {
    mockApi(() => json({ statusCode: 500 }, 500));
    const { user, onCreated } = renderForm();

    await fillCampaignForm(user, validFormInput);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't create the campaign. Try again.",
    );
    expect(onCreated).not.toHaveBeenCalled();
  });
});
