import React from 'react';
import { RecentRegistration } from '../../types';
import { DisplayCurrency, formatMoney, formatSignedMoney } from '../../utils/currency';

interface RecentRegistrationsCardProps {
  registrations?: RecentRegistration[];
  currency?: DisplayCurrency;
  currencySymbol?: string;
  onViewAll: () => void;
  onSelectClient?: (client: RecentRegistration) => void;
}

export const RecentRegistrationsCard: React.FC<RecentRegistrationsCardProps> = ({
  registrations = [],
  currency = 'INR',
  onViewAll,
  onSelectClient
}) => {
  const items = registrations.map(registration => ({
    ...registration,
    walletLabel: formatMoney(registration.wallet_balance, currency),
    plLabel: formatSignedMoney(registration.pl, currency)
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
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No client registrations yet
                </td>
              </tr>
            )}
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
                  {client.walletLabel}
                </td>
                <td
                  className={`py-3 font-mono font-semibold text-right ${
                    client.pl > 0
                      ? 'text-emerald-400'
                      : client.pl < 0
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {client.plLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
