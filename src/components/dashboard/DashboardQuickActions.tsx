import React from 'react';
import { Plus, Eye, BarChart3, ArrowUpRight } from 'lucide-react';

interface DashboardQuickActionsProps {
  onCreateMaster: () => void;
  onCreateBroker: () => void;
  onAddClient: () => void;
  onReviewKYC: () => void;
  onViewReports: () => void;
}

export const DashboardQuickActions: React.FC<DashboardQuickActionsProps> = ({
  onCreateMaster,
  onCreateBroker,
  onAddClient,
  onReviewKYC,
  onViewReports
}) => {
  const actions = [
    {
      id: 'create-master',
      label: 'Create Master',
      prefixIcon: <Plus size={15} className="text-amber-400" />,
      onClick: onCreateMaster
    },
    {
      id: 'create-broker',
      label: 'Create Broker',
      prefixIcon: <Plus size={15} className="text-blue-400" />,
      onClick: onCreateBroker
    },
    {
      id: 'add-client',
      label: 'Add Client',
      prefixIcon: <Plus size={15} className="text-purple-400" />,
      onClick: onAddClient
    },
    {
      id: 'review-kyc',
      label: 'Review KYC',
      prefixIcon: <Eye size={15} className="text-cyan-400" />,
      onClick: onReviewKYC
    },
    {
      id: 'view-reports',
      label: 'View Reports',
      prefixIcon: <BarChart3 size={15} className="text-emerald-400" />,
      onClick: onViewReports
    }
  ];

  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-5 flex flex-col h-full shadow-sm justify-between">
      {/* Title */}
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white tracking-tight">
          Quick Actions
        </h3>
      </div>

      {/* Stacked list of action buttons */}
      <div className="flex flex-col gap-2.5 flex-1 justify-center">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={action.onClick}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0e172c] border border-[#1a2948] hover:border-blue-500/40 hover:bg-[#13203d] transition-all text-xs font-semibold text-slate-200 hover:text-white group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="shrink-0">{action.prefixIcon}</span>
              <span>{action.label}</span>
            </div>
            <ArrowUpRight
              size={15}
              className="text-slate-400 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
