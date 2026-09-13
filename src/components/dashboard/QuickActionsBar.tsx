import React from 'react';
import { Crown, Building2, UserPlus, CreditCard, FileText } from 'lucide-react';

interface QuickActionsBarProps {
  onCreateMaster: () => void;
  onCreateBroker: () => void;
  onAddClient: () => void;
  onReviewKYC: () => void;
  onViewReports: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  onCreateMaster,
  onCreateBroker,
  onAddClient,
  onReviewKYC,
  onViewReports
}) => {
  const actions = [
    {
      id: 'master',
      label: 'Create Master',
      icon: Crown,
      iconColor: 'text-amber-400',
      action: onCreateMaster
    },
    {
      id: 'broker',
      label: 'Create Broker',
      icon: Building2,
      iconColor: 'text-blue-400',
      action: onCreateBroker
    },
    {
      id: 'client',
      label: 'Add Client',
      icon: UserPlus,
      iconColor: 'text-purple-400',
      action: onAddClient
    },
    {
      id: 'kyc',
      label: 'Review KYC',
      icon: CreditCard,
      iconColor: 'text-cyan-400',
      action: onReviewKYC
    },
    {
      id: 'reports',
      label: 'View Reports',
      icon: FileText,
      iconColor: 'text-emerald-400',
      action: onViewReports
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
      {actions.map(act => {
        const Icon = act.icon;
        return (
          <button
            key={act.id}
            onClick={act.action}
            className="group bg-[#0d1527] border border-[#17233f] hover:border-blue-500/40 hover:bg-[#111c34] p-2.5 sm:p-3 rounded-xl flex items-center justify-center gap-2 sm:gap-2.5 transition-all text-xs font-semibold text-slate-200 shadow-sm last:col-span-2 sm:last:col-span-1"
          >
            <Icon
              size={16}
              className={`sm:w-[17px] sm:h-[17px] ${act.iconColor} transition-transform group-hover:scale-110 shrink-0`}
            />
            <span className="truncate">{act.label}</span>
          </button>
        );
      })}
    </div>
  );
};
