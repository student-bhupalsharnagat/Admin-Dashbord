import React from 'react';
import { KYCRecord } from '../../types';

interface PendingKYCCardProps {
  kycList: KYCRecord[];
  onViewAll: () => void;
  onReviewKYC?: (kyc: KYCRecord) => void;
}

export const PendingKYCCard: React.FC<PendingKYCCardProps> = ({
  kycList,
  onViewAll,
  onReviewKYC
}) => {
  const getStatusBadge = (status: KYCRecord['kyc_status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Pending
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Under Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Rejected
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Approved
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-4 sm:p-5 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Pending KYC</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[380px]">
          <thead>
            <tr className="text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase tracking-wider">
              <th className="pb-3 font-semibold">CLIENT</th>
              <th className="pb-3 font-semibold">ID</th>
              <th className="pb-3 font-semibold">STATUS</th>
              <th className="pb-3 font-semibold text-right">SUBMITTED</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#17233f]/60">
            {kycList.slice(0, 3).map(kyc => (
              <tr
                key={kyc.id}
                onClick={() => onReviewKYC?.(kyc)}
                className="hover:bg-[#111c34] transition-colors cursor-pointer group"
              >
                <td className="py-3 font-medium text-slate-200">
                  {kyc.client_name}
                </td>
                <td className="py-3 font-mono text-slate-400">
                  {kyc.client_id.replace('CLT-', 'CLT00')}
                </td>
                <td className="py-3">
                  {getStatusBadge(kyc.kyc_status)}
                </td>
                <td className="py-3 text-right font-mono text-slate-400">
                  {kyc.submitted_date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
