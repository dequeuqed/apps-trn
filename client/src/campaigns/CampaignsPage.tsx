import { useId, useState } from 'react';
import {
  CAMPAIGN_STATUSES,
  type Campaign,
  type CampaignFilters,
  type CampaignStatus,
} from '../api/campaigns.ts';
import { useDebouncedValue } from '../hooks/useDebouncedValue.ts';
import { CampaignForm } from './CampaignForm.tsx';
import { CampaignsTable } from './CampaignsTable.tsx';
import { useCampaigns } from './queries.ts';

const SEARCH_DEBOUNCE_MS = 300;

export function CampaignsPage() {
  const id = useId();
  const [status, setStatus] = useState<CampaignStatus | ''>('');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Campaign | null>(null);

  const debouncedRegion = useDebouncedValue(region.trim(), SEARCH_DEBOUNCE_MS);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const filters: CampaignFilters = {
    status: status || undefined,
    region: debouncedRegion || undefined,
    q: debouncedSearch || undefined,
  };
  const hasFilters = Boolean(status || region.trim() || search.trim());

  const campaigns = useCampaigns(filters);
  const items = campaigns.data?.pages.flatMap((page) => page.items) ?? [];

  const clearFilters = () => {
    setStatus('');
    setRegion('');
    setSearch('');
  };

  const openForm = () => {
    setCreated(null);
    setCreating(true);
  };

  return (
    <main className="page">
      <header className="page-header">
        <h1>Campaigns</h1>
        {!creating && (
          <button
            type="button"
            className="button button-primary"
            onClick={openForm}
          >
            New campaign
          </button>
        )}
      </header>

      {creating && (
        <section className="panel" aria-labelledby={`${id}-new`}>
          <h2 id={`${id}-new`}>New campaign</h2>
          <CampaignForm
            onCreated={(campaign) => {
              setCreated(campaign);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </section>
      )}

      {created && (
        <p className="notice" role="status">
          Created “{created.name}” as a draft.
        </p>
      )}

      <section aria-label="Filters" className="filters">
        <div className="field">
          <label htmlFor={`${id}-q`}>Search by name</label>
          <input
            id={`${id}-q`}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-status`}>Status</label>
          <select
            id={`${id}-status`}
            value={status}
            onChange={(e) => setStatus(e.target.value as CampaignStatus | '')}
          >
            <option value="">All statuses</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-region`}>Region</label>
          <input
            id={`${id}-region`}
            value={region}
            placeholder="e.g. UA-30"
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
      </section>

      <section
        aria-label="Campaign list"
        aria-busy={campaigns.isFetching}
        className={campaigns.isPlaceholderData ? 'results is-stale' : 'results'}
      >
        {campaigns.isPending ? (
          <p className="state" role="status">
            Loading campaigns…
          </p>
        ) : campaigns.isError && !campaigns.isFetchNextPageError ? (
          <div className="state state-error" role="alert">
            <p>Couldn’t load campaigns.</p>
            <button
              type="button"
              className="button"
              onClick={() => void campaigns.refetch()}
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="state">
            {hasFilters ? (
              <>
                <p>No campaigns match these filters.</p>
                <button type="button" className="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p>No campaigns yet.</p>
                {!creating && (
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={openForm}
                  >
                    Create the first one
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <CampaignsTable campaigns={items} />
            {campaigns.isFetchNextPageError && (
              <p className="form-error" role="alert">
                Couldn’t load more campaigns. Try again.
              </p>
            )}
            {campaigns.hasNextPage && (
              <div className="load-more">
                <button
                  type="button"
                  className="button"
                  disabled={campaigns.isFetchingNextPage}
                  onClick={() => void campaigns.fetchNextPage()}
                >
                  {campaigns.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
