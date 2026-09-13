import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, AlertCircle, FileText, User } from 'lucide-react';
import { KYCRecord } from '../../types';

interface ReviewKYCModalProps {
  isOpen: boolean;
  onClose: () => void;
  kyc: KYCRecord | null;
  onUpdateStatus: (id: string, status: KYCRecord['kyc_status'], notes?: string) => Promise<void>;
}

export const ReviewKYCModal: React.FC<ReviewKYCModalProps> = ({
  isOpen,
  onClose,
  kyc,
  onUpdateStatus
}) => {
  const [notes, setNotes] = useState(kyc?.notes || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !kyc) return null;

  const handleAction = async (status: KYCRecord['kyc_status']) => {
    setLoading(true);
    try {
      await onUpdateStatus(kyc.id, status, notes);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#0e1629] border border-[#1b2b4e] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#18243e] sticky top-0 bg-[#0e1629] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">KYC Verification Audit</h3>
              <p className="text-xs text-slate-400">{kyc.client_name} ({kyc.client_id})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#152340] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Client summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#111c34] border border-[#1b2c4e] rounded-xl">
            <div>
              <div className="text-slate-400 text-[11px]">Tenant Platform</div>
              <div className="text-slate-200 font-semibold mt-0.5">{kyc.tenant_name}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Submitted Date</div>
              <div className="text-slate-200 font-mono mt-0.5">{kyc.submitted_date}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Document Type</div>
              <div className="text-slate-200 font-medium mt-0.5 flex items-center gap-1">
                <FileText size={13} className="text-blue-400" />
                {kyc.document_type}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-[11px]">Assigned Reviewer</div>
              <div className="text-slate-200 font-medium mt-0.5 flex items-center gap-1">
                <User size={13} className="text-purple-400" />
                {kyc.assigned_reviewer}
              </div>
            </div>
          </div>

          {/* Document mock preview container */}
          <div className="border border-[#1e2f52] rounded-xl p-4 bg-[#121c33] flex flex-col items-center justify-center text-center py-6">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2">
              <FileText size={24} />
            </div>
            <div className="text-slate-200 font-semibold">Government ID & Signature Uploads</div>
            <div className="text-slate-500 text-[11px] mt-1 max-w-xs">
              Encrypted binary attachments ready for automated optical character recognition or compliance officer review.
            </div>
            <div className="mt-3 px-2.5 py-1 rounded bg-slate-800 text-[11px] font-mono text-slate-300">
              ID: {kyc.id_number || 'PAN-VALIDATED-SECURE'}
            </div>
          </div>

          {/* Review notes */}
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Compliance Notes & Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add audit notes, verification checklist comments, or reason for correction..."
              className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#18243e] grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              disabled={loading}
              onClick={() => handleAction('CORRECTION_REQUIRED')}
              className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <AlertCircle size={14} /> Request Fix
            </button>
            <button
              disabled={loading}
              onClick={() => handleAction('REJECTED')}
              className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <XCircle size={14} /> Reject
            </button>
            <button
              disabled={loading}
              onClick={() => handleAction('APPROVED')}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Approve KYC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
