import type { Campaign } from '../api/campaigns.ts';
import { formatBudget, formatDate } from './format.ts';

export function CampaignsTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="table-scroll">
      <table className="campaigns-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
            <th scope="col">Region</th>
            <th scope="col">Channel</th>
            <th scope="col">Dates</th>
            <th scope="col" className="numeric">
              Budget
            </th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <th scope="row">
                <span className="campaign-name">{campaign.name}</span>
                <span className="campaign-supplier">{campaign.supplier}</span>
              </th>
              <td>
                <span className={`status status-${campaign.status}`}>
                  {campaign.status}
                </span>
              </td>
              <td>{campaign.regionCode}</td>
              <td>{campaign.channel}</td>
              <td className="dates">
                <time dateTime={campaign.startDate}>
                  {formatDate(campaign.startDate)}
                </time>
                {' – '}
                <time dateTime={campaign.endDate}>
                  {formatDate(campaign.endDate)}
                </time>
              </td>
              <td className="numeric">{formatBudget(campaign.budgetCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
