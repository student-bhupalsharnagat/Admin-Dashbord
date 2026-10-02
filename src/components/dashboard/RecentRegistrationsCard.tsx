import React from 'react';

export interface DisplayRegistration {
  client_id: string;
  name: string;
  broker: string;
  kyc_status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'UNDER_REVIEW';
  account_status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  wallet_balance: string;
  pl: string;
  pl_positive?: boolean;
}

const defaultRegistrations: DisplayRegistration[] = [
  {
    client_id: 'CLT001',
    name: 'Alexander Hunt',
    broker: 'Ryan Chen',
    kyc_status: 'APPROVED',
    account_status: 'ACTIVE',
    wallet_balance: '$25,400',
    pl: '+$3,820',
    pl_positive: true
  },
  {
    client_id: 'CLT002',
    name: 'Sophia Lee',
    broker: 'Ryan Chen',
    kyc_status: 'APPROVED',
    account_status: 'ACTIVE',
    wallet_balance: '$12,100',
    pl: '-$540',
    pl_positive: false
  },
  {
    client_id: 'CLT003',
    name: 'Nathan Brooks',
    broker: 'James Okafor',
    kyc_status: 'PENDING',
    account_status: 'PENDING',
    wallet_balance: '$5,000',
    pl: '+$0',
    pl_positive: true
  },
  {
    client_id: 'CLT004',
    name: 'Maya Patel',
    broker: 'Priya Sharma',
    kyc_status: 'APPROVED',
    account_status: 'ACTIVE',
    wallet_balance: '$48,200',
    pl: '+$11,240',
    pl_positive: true
  },
  {
    client_id: 'CLT005',
    name: 'Ethan Clarke',
    broker: 'Sarah Mitchell',
    kyc_status: 'REJECTED',
    account_status: 'SUSPENDED',
    wallet_balance: '$0',
    pl: '+$0'
  }
];

interface RecentRegistrationsCardProps {
  currencySymbol?: string;
  clients?: any[];
  onViewAll: () => void;
  onSelectClient?: (client: any) => void;
}

export const RecentRegistrationsCard: React.FC<RecentRegistrationsCardProps> = ({
  currencySymbol = '$',
  clients,
  onViewAll,
  onSelectClient
}) => {
  const items: DisplayRegistration[] = (clients && clients.length > 0)
    ? clients.slice(0, 5).map(c => ({
        client_id: c.client_code || c.id,
        name: c.name,
        broker: c.broker || c.broker_name || 'Apex Direct',
        kyc_status: (c.kyc_status === 'VERIFIED' ? 'APPROVED' : (c.kyc_status || 'PENDING')) as any,
        account_status: (c.status || 'ACTIVE').toUpperCase() as any,
        wallet_balance: `${currencySymbol}${Number(c.balance || c.wallet_balance || 0).toLocaleString()}`,
        pl: '+₹0',
        pl_positive: true
      }))
    : defaultRegistrations.map(r => ({
        ...r,
        wallet_balance: r.wallet_balance.replace('$', currencySymbol),
        pl: r.pl.replace('$', currencySymbol)
      }));
  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-4 sm:p-5 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Recent Registrations</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
        >
          View all →
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[580px]">
          <thead>
            <tr className="text-slate-400 border-b border-[#16233d] text-[10px] font-bold uppercase tracking-wider">
              <th className="pb-3 font-semibold">CLIENT ID</th>
              <th className="pb-3 font-semibold">NAME</th>
              <th className="pb-3 font-semibold">BROKER</th>
              <th className="pb-3 font-semibold">KYC STATUS</th>
              <th className="pb-3 font-semibold">ACCOUNT STATUS</th>
              <th className="pb-3 font-semibold text-right">WALLET BALANCE</th>
              <th className="pb-3 font-semibold text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#16233d]/60">
            {items.map(client => (
              <tr
                key={client.client_id}
                onClick={() => onSelectClient?.(client)}
                className="hover:bg-[#101b33] transition-colors cursor-pointer group"
              >
                <td className="py-3 font-mono font-medium text-blue-400">
                  {client.client_id}
                </td>
                <td className="py-3 font-medium text-slate-200">
                  {client.name}
                </td>
                <td className="py-3 text-slate-300">
                  {client.broker}
                </td>
                <td className="py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      client.kyc_status === 'APPROVED'
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : client.kyc_status === 'PENDING'
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    }`}
                  >
                    {client.kyc_status}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      client.account_status === 'ACTIVE'
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : client.account_status === 'PENDING'
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                        : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    }`}
                  >
                    {client.account_status}
                  </span>
                </td>
                <td className="py-3 font-mono text-slate-200 text-right">
                  {client.wallet_balance}
                </td>
                <td
                  className={`py-3 font-mono font-semibold text-right ${
                    client.pl.startsWith('+') && client.pl !== '+₹0'
                      ? 'text-emerald-400'
                      : client.pl.startsWith('-')
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {client.pl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
