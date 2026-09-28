import React from 'react';
import { FileText, Wallet, CreditCard, BarChart3, ArrowUpRight } from 'lucide-react';

interface PendingAlertsStripProps {
  pendingKYC?: number;
  pendingDeposits?: number;
  pendingWithdrawals?: number;
  openTickets?: number;
  onNavigateKYC?: () => void;
  onNavigateDeposits?: () => void;
  onNavigateWithdrawals?: () => void;
  onNavigateTickets?: () => void;
}

export const PendingAlertsStrip: React.FC<PendingAlertsStripProps> = ({
  pendingKYC = 0,
  pendingDeposits = 0,
  pendingWithdrawals = 0,
  openTickets = 0,
  onNavigateKYC,
  onNavigateDeposits,
  onNavigateWithdrawals,
  onNavigateTickets
}) => {
  const alerts = [
    {
      id: 'kyc',
      label: 'Pending KYC',
      value: pendingKYC,
      icon: FileText,
      borderColor: 'border-[#422e11]',
      hoverBorder: 'hover:border-[#784d12]',
      bgColor: 'bg-[#181308]',
      textColor: 'text-[#eab308]',
      iconColor: 'text-[#ca8a04]',
      onClick: onNavigateKYC
    },
    {
      id: 'deposits',
      label: 'Pending Deposits',
      value: pendingDeposits,
      icon: Wallet,
      borderColor: 'border-[#152a4e]',
      hoverBorder: 'hover:border-[#254b8c]',
      bgColor: 'bg-[#091325]',
      textColor: 'text-[#3b82f6]',
      iconColor: 'text-[#2563eb]',
      onClick: onNavigateDeposits
    },
    {
      id: 'withdrawals',
      label: 'Pending Withdrawals',
      value: pendingWithdrawals,
      icon: CreditCard,
      borderColor: 'border-[#3e1f0e]',
      hoverBorder: 'hover:border-[#6e3518]',
      bgColor: 'bg-[#190e06]',
      textColor: 'text-[#f97316]',
      iconColor: 'text-[#ea580c]',
      onClick: onNavigateWithdrawals
    },
    {
      id: 'tickets',
      label: 'Open Support Tickets',
      value: openTickets,
      icon: BarChart3,
      borderColor: 'border-[#3f131a]',
      hoverBorder: 'hover:border-[#6e1e2c]',
      bgColor: 'bg-[#1c080d]',
      textColor: 'text-[#f43f5e]',
      iconColor: 'text-[#e11d48]',
      onClick: onNavigateTickets
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {alerts.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            onClick={item.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.onClick?.();
              }
            }}
            title={`View ${item.label} in ${item.id === 'kyc' ? 'KYC Management' : item.id === 'tickets' ? 'Support' : 'Funds Management'}`}
            className={`${item.bgColor} border ${item.borderColor} ${item.hoverBorder} rounded-xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm group`}
          >
            {/* Top row: Label on left, Icon with arrow on right */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                {item.label}
              </span>
              <div className="flex items-center gap-1 text-slate-500 group-hover:text-slate-300 transition-colors">
                <Icon size={14} className={item.iconColor} />
                <ArrowUpRight size={13} />
              </div>
            </div>

            {/* Bottom row: Large colored number */}
            <div className={`text-2xl font-bold font-mono tracking-tight ${item.textColor}`}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
};
