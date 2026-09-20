import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  Eye,
  Check,
  X,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Pause,
  Filter,
  FileDown,
  User,
  ShieldCheck,
  Calendar,
  CreditCard,
  Building,
  DollarSign
} from 'lucide-react';
import { KYCRecord } from '../types';

interface ComplianceViewProps {
  section: 'kyc' | 'funds' | 'ledger';
  initialFundsTab?: 'deposits' | 'withdrawals';
  initialFundsStatus?: string;
  fundsNavigationNonce?: number;
  kycRecords?: KYCRecord[];
  onReviewKYC?: (kyc: any) => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

// ----------------------------------------------------------------------
// SCREENSHOT 1: KYC MANAGEMENT DATASET
// ----------------------------------------------------------------------
interface KycItem {
  kycId: string;
  clientId: string;
  client: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  submitted: string;
  reviewer: string;
  reviewDate: string;
  documentType?: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  notes?: string;
}

const initialKycData: KycItem[] = [];

// ----------------------------------------------------------------------
// SCREENSHOT 2: FUNDS MANAGEMENT DATASET
// ----------------------------------------------------------------------
interface FundDepositItem {
  txnId: string;
  client: string;
  amount: string;
  method: string;
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED';
  date: string;
  rawAmount: number;
}

const initialDepositsData: FundDepositItem[] = [];

interface FundWithdrawalItem {
  txnId: string;
  client: string;
  amount: string;
  method: string;
  reference: string;
  status: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'FAILED';
  date: string;
  rawAmount: number;
}

const initialWithdrawalsData: FundWithdrawalItem[] = [];

// ----------------------------------------------------------------------
// SCREENSHOT 3: LEDGER DATASET
// ----------------------------------------------------------------------
interface LedgerRowItem {
  date: string;
  txnId: string;
  account: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'COMMISSION' | 'P&L';
  credit: string;
  debit: string;
  balance: string;
  reference: string;
  status: 'COMPLETED' | 'PROCESSING' | 'PENDING';
}

const initialLedgerData: LedgerRowItem[] = [];

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  section,
  initialFundsTab,
  initialFundsStatus,
  fundsNavigationNonce,
  onReviewKYC,
  onNotify
}) => {
  // Shared notification helper
  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  // State for KYC
  const [kycList, setKycList] = useState<KycItem[]>(initialKycData);
  const [kycSearch, setKycSearch] = useState('');
  const [kycStatusFilter, setKycStatusFilter] = useState('All Status');
  const [selectedKycDetail, setSelectedKycDetail] = useState<KycItem | null>(null);

  // State for Funds
  const [fundsTab, setFundsTab] = useState<'deposits' | 'withdrawals'>(initialFundsTab || 'deposits');
  const [depositsList, setDepositsList] = useState<FundDepositItem[]>(initialDepositsData);
  const [withdrawalsList, setWithdrawalsList] = useState<FundWithdrawalItem[]>(initialWithdrawalsData);
  const [fundsSearch, setFundsSearch] = useState('');
  const [fundsStatusFilter, setFundsStatusFilter] = useState(initialFundsStatus || 'All Status');
  const [selectedTxnDetail, setSelectedTxnDetail] = useState<any | null>(null);

  // Synchronize when initialFundsTab or fundsNavigationNonce changes
  useEffect(() => {
    if (initialFundsTab) {
      setFundsTab(initialFundsTab);
    }
  }, [initialFundsTab, fundsNavigationNonce]);

  useEffect(() => {
    if (initialFundsStatus !== undefined) {
      setFundsStatusFilter(initialFundsStatus);
    }
  }, [initialFundsStatus, fundsNavigationNonce]);

  // State for Ledger
  const [ledgerList, setLedgerList] = useState<LedgerRowItem[]>(initialLedgerData);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState('All Types');
  const [selectedLedgerItem, setSelectedLedgerItem] = useState<LedgerRowItem | null>(null);
  const [selectedDrawerTxn, setSelectedDrawerTxn] = useState<LedgerRowItem | null>(null);

  // ----------------------------------------------------------------------
  // DATA FETCHING HOOKS (PostgreSQL-backed)
  // ----------------------------------------------------------------------
  const fetchKycData = async () => {
    try {
      const url = kycStatusFilter && kycStatusFilter !== 'All Status'
        ? `/api/admin/kyc?status=${kycStatusFilter}`
        : '/api/admin/kyc';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const mapped: KycItem[] = data.map((d: any) => ({
          kycId: d.id,
          clientId: d.client_id,
          client: d.client_name,
          status: d.kyc_status,
          submitted: d.submitted_date ? d.submitted_date.slice(0, 10) : '2026-03-29',
          reviewer: d.assigned_reviewer || 'Admin Officer',
          reviewDate: d.reviewed_at ? d.reviewed_at.slice(0, 10) : '—',
          documentType: d.document_type || 'ID Document',
          email: `${d.client_name?.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          idNumber: d.id_number || 'IND-XXXXX1234',
          notes: d.notes || 'Submitted for compliance verification'
        }));
        setKycList(mapped);
      }
    } catch (e) {
      console.error('Error fetching KYC:', e);
    }
  };

  const fetchFundsData = async () => {
    try {
      const statusParam = fundsStatusFilter && fundsStatusFilter !== 'All Status' ? `?status=${fundsStatusFilter}` : '';
      const [depRes, wdrRes] = await Promise.all([
        fetch(`/api/admin/compliance/deposits${statusParam}`),
        fetch(`/api/admin/compliance/withdrawals${statusParam}`)
      ]);
      if (depRes.ok) {
        const depData = await depRes.json();
        setDepositsList(depData);
      }
      if (wdrRes.ok) {
        const wdrData = await wdrRes.json();
        setWithdrawalsList(wdrData);
      }
    } catch (e) {
      console.error('Error fetching funds:', e);
    }
  };

  const fetchLedgerData = async () => {
    try {
      const typeParam = ledgerTypeFilter && ledgerTypeFilter !== 'All Types' ? `?type=${ledgerTypeFilter}` : '';
      const res = await fetch(`/api/admin/compliance/ledger${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerList(data);
      }
    } catch (e) {
      console.error('Error fetching ledger:', e);
    }
  };

  useEffect(() => {
    fetchKycData();
  }, [kycStatusFilter]);

  useEffect(() => {
    fetchFundsData();
  }, [fundsTab, fundsStatusFilter]);

  useEffect(() => {
    fetchLedgerData();
  }, [ledgerTypeFilter]);

  // ----------------------------------------------------------------------
  // KYC ACTIONS
  // ----------------------------------------------------------------------
  const handleApproveKyc = async (item: KycItem) => {
    try {
      const res = await fetch(`/api/admin/kyc/${item.kycId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED' })
      });
      if (res.ok) {
        fetchKycData();
        notify(`KYC for ${item.client} approved successfully.`, 'success');
      } else {
        notify('Failed to approve KYC in database', 'warning');
      }
    } catch (e) {
      notify('Network error approving KYC', 'warning');
    }
    if (selectedKycDetail?.kycId === item.kycId) {
      setSelectedKycDetail(null);
    }
  };

  const handleRejectKyc = async (item: KycItem) => {
    try {
      const res = await fetch(`/api/admin/kyc/${item.kycId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED' })
      });
      if (res.ok) {
        fetchKycData();
        notify(`KYC for ${item.client} marked as REJECTED.`, 'warning');
      } else {
        notify('Failed to reject KYC in database', 'warning');
      }
    } catch (e) {
      notify('Network error rejecting KYC', 'warning');
    }
    if (selectedKycDetail?.kycId === item.kycId) {
      setSelectedKycDetail(null);
    }
  };

  // ----------------------------------------------------------------------
  // FUNDS ACTIONS
  // ----------------------------------------------------------------------
  const handleApproveFunds = async (item: any, isDeposit: boolean) => {
    try {
      const endpoint = isDeposit
        ? `/api/admin/compliance/deposits/${item.txnId}/approve`
        : `/api/admin/compliance/withdrawals/${item.txnId}/approve`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        fetchFundsData();
        fetchLedgerData();
        notify(`${isDeposit ? 'Deposit' : 'Withdrawal'} ${item.txnId} (${item.amount}) approved & credited.`, 'success');
      } else {
        notify(`Failed to approve ${isDeposit ? 'deposit' : 'withdrawal'}.`, 'warning');
      }
    } catch (e) {
      notify('Network error approving transaction', 'warning');
    }
    setSelectedTxnDetail(null);
  };

  const handleRejectFunds = async (item: any, isDeposit: boolean) => {
    try {
      const endpoint = isDeposit
        ? `/api/admin/compliance/deposits/${item.txnId}/reject`
        : `/api/admin/compliance/withdrawals/${item.txnId}/reject`;
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        fetchFundsData();
        notify(`${isDeposit ? 'Deposit' : 'Withdrawal'} ${item.txnId} rejected.`, 'warning');
      } else {
        notify(`Failed to reject ${isDeposit ? 'deposit' : 'withdrawal'}.`, 'warning');
      }
    } catch (e) {
      notify('Network error rejecting transaction', 'warning');
    }
    setSelectedTxnDetail(null);
  };

  // ----------------------------------------------------------------------
  // EXPORT HELPERS
  // ----------------------------------------------------------------------
  const handleExportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(e => e.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Exported ${filename}.csv successfully!`, 'success');
  };

  // Status Badge Rendering Helper
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'COMPLETED' || s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          {s}
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-[#291e0a] border border-[#78350f] text-[#fbbf24]">
          PENDING
        </span>
      );
    }
    if (s === 'PROCESSING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-[#0b2149] border border-[#0369a1] text-[#38bdf8]">
          PROCESSING
        </span>
      );
    }
    if (s === 'REJECTED' || s === 'FAILED' || s === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
          {s}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-[#131d33] border border-[#1e2e50] text-slate-400">
        {s}
      </span>
    );
  };

  // ======================================================================
  // 1. KYC MANAGEMENT VIEW (Matches Screenshot 1)
  // ======================================================================
  if (section === 'kyc') {
    const pendingCount = kycList.filter(k => k.status === 'PENDING').length;
    const approvedCount = kycList.filter(k => k.status === 'APPROVED').length;
    const rejectedCount = kycList.filter(k => k.status === 'REJECTED').length;
    const totalCount = kycList.length;

    const filteredKyc = kycList.filter(k => {
      const matchSearch =
        k.client.toLowerCase().includes(kycSearch.toLowerCase()) ||
        k.clientId.toLowerCase().includes(kycSearch.toLowerCase()) ||
        k.kycId.toLowerCase().includes(kycSearch.toLowerCase());
      const matchStatus = kycStatusFilter === 'All Status' || k.status === kycStatusFilter;
      return matchSearch && matchStatus;
    });

    return (
      <div className="space-y-6">
        {/* Breadcrumb matching screenshot */}
        <div className="text-xs text-slate-400">
          <span className="text-slate-500">Dashboard</span>
          <span className="mx-2 text-slate-600">&gt;</span>
          <span className="text-slate-300 font-medium">KYC Management</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">KYC Management</h1>
        </div>

        {/* 4 Stat Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: PENDING REVIEW */}
          <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PENDING REVIEW</p>
              <p className="text-2xl font-bold text-white mt-1">{pendingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#291e0a] border border-[#78350f] flex items-center justify-center text-[#fbbf24]">
              <FileText size={18} />
            </div>
          </div>

          {/* Card 2: APPROVED */}
          <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">APPROVED</p>
              <p className="text-2xl font-bold text-white mt-1">{approvedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#06261f] border border-[#065f46] flex items-center justify-center text-[#34d399]">
              <CheckCircle2 size={18} />
            </div>
          </div>

          {/* Card 3: REJECTED */}
          <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">REJECTED</p>
              <p className="text-2xl font-bold text-white mt-1">{rejectedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#310e18] border border-[#7f1d1d] flex items-center justify-center text-[#f87171]">
              <XCircle size={18} />
            </div>
          </div>

          {/* Card 4: TOTAL SUBMISSIONS */}
          <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL SUBMISSIONS</p>
              <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
              <FileText size={18} />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-64 sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={kycSearch}
                onChange={e => setKycSearch(e.target.value)}
                placeholder="Search by client name or ID.."
                className="w-full pl-9 pr-3 py-2 bg-[#091122] border border-[#162238] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={kycStatusFilter}
                onChange={e => setKycStatusFilter(e.target.value)}
                className="appearance-none bg-[#091122] border border-[#162238] text-xs text-slate-300 pl-3.5 pr-8 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={() =>
              handleExportCSV(
                'kyc_submissions',
                ['KYC ID', 'CLIENT ID', 'CLIENT', 'STATUS', 'SUBMITTED', 'REVIEWER', 'REVIEW DATE'],
                filteredKyc.map(k => [k.kycId, k.clientId, k.client, k.status, k.submitted, k.reviewer, k.reviewDate])
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
          >
            <Download size={13} className="text-slate-400" />
            Export
          </button>
        </div>

        {/* Table matching Screenshot 1 */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[840px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">KYC ID</th>
                  <th className="py-3.5 px-4">CLIENT ID</th>
                  <th className="py-3.5 px-4">CLIENT</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">SUBMITTED</th>
                  <th className="py-3.5 px-4">REVIEWER</th>
                  <th className="py-3.5 px-4">REVIEW DATE</th>
                  <th className="py-3.5 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {filteredKyc.map(item => (
                  <tr key={item.kycId} className="hover:bg-[#0c152a] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{item.kycId}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{item.clientId}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{item.client}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{item.submitted}</td>
                    <td className="py-3.5 px-4 text-slate-300">{item.reviewer}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{item.reviewDate}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        {/* Eye icon: View details */}
                        <button
                          onClick={() => setSelectedKycDetail(item)}
                          title="View KYC Dossier"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Interactive actions for PENDING */}
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveKyc(item)}
                              title="Approve KYC"
                              className="p-1 hover:text-emerald-400 transition-colors"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => handleRejectKyc(item)}
                              title="Reject KYC"
                              className="p-1 hover:text-rose-400 transition-colors"
                            >
                              <X size={15} />
                            </button>
                            <button
                              onClick={() => notify(`Flagged ${item.client} for secondary compliance audit.`, 'warning')}
                              title="Flag for review"
                              className="p-1 hover:text-amber-400 transition-colors"
                            >
                              <AlertTriangle size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredKyc.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No KYC submissions match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* KYC Dossier Modal */}
        {selectedKycDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#162238] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                    <ShieldCheck size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">KYC Verification Dossier</h3>
                    <p className="text-[11px] text-slate-400">
                      {selectedKycDetail.kycId} • {selectedKycDetail.clientId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedKycDetail(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Client Full Name</span>
                    <span className="font-bold text-white text-sm">{selectedKycDetail.client}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
                    <div className="mt-0.5">{renderStatusBadge(selectedKycDetail.status)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Email Address</span>
                    <span className="text-slate-300">{selectedKycDetail.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Contact Phone</span>
                    <span className="text-slate-300 font-mono">{selectedKycDetail.phone || 'N/A'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Submitted Documents & Identity
                  </span>
                  <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Document Classification</span>
                      <span className="font-semibold text-slate-200">{selectedKycDetail.documentType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ID Reference Number</span>
                      <span className="font-mono text-cyan-400">{selectedKycDetail.idNumber || 'DOC-REG-99120'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Submission Date</span>
                      <span className="font-mono text-slate-300">{selectedKycDetail.submitted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Audited By</span>
                      <span className="text-slate-300">{selectedKycDetail.reviewer}</span>
                    </div>
                  </div>
                </div>

                {selectedKycDetail.notes && (
                  <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-lg text-slate-300 text-[11px] leading-relaxed">
                    <span className="font-bold text-blue-400 block mb-1">Compliance Officer Notes:</span>
                    {selectedKycDetail.notes}
                  </div>
                )}
              </div>

              <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-end gap-2">
                {selectedKycDetail.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleRejectKyc(selectedKycDetail)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs"
                    >
                      Reject Submission
                    </button>
                    <button
                      onClick={() => handleApproveKyc(selectedKycDetail)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                    >
                      Approve KYC
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedKycDetail(null)}
                    className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs"
                  >
                    Close Dossier
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======================================================================
  // 2. FUNDS MANAGEMENT VIEW (Matches Screenshot 2)
  // ======================================================================
  if (section === 'funds') {
    const isDeposits = fundsTab === 'deposits';
    const pendingDepositsCount = depositsList.filter(d => d.status === 'PENDING').length;
    const pendingWithdrawalsCount = withdrawalsList.filter(w => w.status === 'PENDING').length;

    const filteredDeposits = depositsList.filter(d => {
      const matchSearch =
        d.client.toLowerCase().includes(fundsSearch.toLowerCase()) ||
        d.txnId.toLowerCase().includes(fundsSearch.toLowerCase()) ||
        d.reference.toLowerCase().includes(fundsSearch.toLowerCase());
      const matchStatus = fundsStatusFilter === 'All Status' || d.status === fundsStatusFilter;
      return matchSearch && matchStatus;
    });

    const filteredWithdrawals = withdrawalsList.filter(w => {
      const matchSearch =
        w.client.toLowerCase().includes(fundsSearch.toLowerCase()) ||
        w.txnId.toLowerCase().includes(fundsSearch.toLowerCase()) ||
        w.reference.toLowerCase().includes(fundsSearch.toLowerCase());
      const matchStatus = fundsStatusFilter === 'All Status' || w.status === fundsStatusFilter;
      return matchSearch && matchStatus;
    });

    return (
      <div className="space-y-6">
        {/* Breadcrumb matching screenshot */}
        <div className="text-xs text-slate-400">
          <span className="text-slate-500">Dashboard</span>
          <span className="mx-2 text-slate-600">&gt;</span>
          <span className="text-slate-300 font-medium">Funds Management</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">Funds Management</h1>
        </div>

        {/* 4 Stat Summary Cards matching Screenshot 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: TOTAL DEPOSITS */}
          <div
            onClick={() => {
              setFundsTab('deposits');
              setFundsStatusFilter('All Status');
            }}
            role="button"
            tabIndex={0}
            title="Click to view all deposits"
            className={`bg-[#091122] border rounded-xl p-5 flex items-center justify-between cursor-pointer transition-all duration-200 group ${
              fundsTab === 'deposits' && fundsStatusFilter === 'All Status'
                ? 'border-emerald-500/50 bg-[#091122]/90 ring-1 ring-emerald-500/30'
                : 'border-[#131e36] hover:border-emerald-500/30 hover:bg-[#0c152a]'
            }`}
          >
            <div>
              <p className="text-[11px] font-bold text-slate-400 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">TOTAL DEPOSITS</p>
              <p className="text-2xl font-bold text-white mt-1">₹50K</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#06261f] border border-[#065f46] flex items-center justify-center text-[#34d399]">
              <ArrowDownLeft size={18} />
            </div>
          </div>

          {/* Card 2: TOTAL WITHDRAWALS */}
          <div
            onClick={() => {
              setFundsTab('withdrawals');
              setFundsStatusFilter('All Status');
            }}
            role="button"
            tabIndex={0}
            title="Click to view all withdrawals"
            className={`bg-[#091122] border rounded-xl p-5 flex items-center justify-between cursor-pointer transition-all duration-200 group ${
              fundsTab === 'withdrawals' && fundsStatusFilter === 'All Status'
                ? 'border-red-500/50 bg-[#091122]/90 ring-1 ring-red-500/30'
                : 'border-[#131e36] hover:border-red-500/30 hover:bg-[#0c152a]'
            }`}
          >
            <div>
              <p className="text-[11px] font-bold text-slate-400 group-hover:text-red-400 transition-colors uppercase tracking-wider">TOTAL WITHDRAWALS</p>
              <p className="text-2xl font-bold text-white mt-1">₹5K</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#310e18] border border-[#7f1d1d] flex items-center justify-center text-[#f87171]">
              <ArrowUpRight size={18} />
            </div>
          </div>

          {/* Card 3: PENDING DEPOSITS */}
          <div
            onClick={() => {
              setFundsTab('deposits');
              setFundsStatusFilter('PENDING');
            }}
            role="button"
            tabIndex={0}
            title="Click to view pending deposits"
            className={`bg-[#091122] border rounded-xl p-5 flex items-center justify-between cursor-pointer transition-all duration-200 group ${
              fundsTab === 'deposits' && fundsStatusFilter === 'PENDING'
                ? 'border-amber-500/60 bg-[#161408] ring-1 ring-amber-500/40'
                : 'border-[#131e36] hover:border-amber-500/40 hover:bg-[#12120b]'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-slate-400 group-hover:text-amber-400 transition-colors uppercase tracking-wider">PENDING DEPOSITS</p>
                {fundsTab === 'deposits' && fundsStatusFilter === 'PENDING' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{pendingDepositsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#291e0a] border border-[#78350f] flex items-center justify-center text-[#fbbf24]">
              <CreditCard size={18} />
            </div>
          </div>

          {/* Card 4: PENDING WITHDRAWALS */}
          <div
            onClick={() => {
              setFundsTab('withdrawals');
              setFundsStatusFilter('PENDING');
            }}
            role="button"
            tabIndex={0}
            title="Click to view pending withdrawals"
            className={`bg-[#091122] border rounded-xl p-5 flex items-center justify-between cursor-pointer transition-all duration-200 group ${
              fundsTab === 'withdrawals' && fundsStatusFilter === 'PENDING'
                ? 'border-orange-500/60 bg-[#170e06] ring-1 ring-orange-500/40'
                : 'border-[#131e36] hover:border-orange-500/40 hover:bg-[#120d09]'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-slate-400 group-hover:text-orange-400 transition-colors uppercase tracking-wider">PENDING WITHDRAWALS</p>
                {fundsTab === 'withdrawals' && fundsStatusFilter === 'PENDING' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                )}
              </div>
              <p className="text-2xl font-bold text-white mt-1 font-mono">{pendingWithdrawalsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#291e0a] border border-[#78350f] flex items-center justify-center text-[#fbbf24]">
              <Clock size={18} />
            </div>
          </div>
        </div>

        {/* Tabs: Deposits | Withdrawals */}
        <div className="border-b border-[#131e36] flex items-center gap-6 text-sm">
          <button
            onClick={() => {
              setFundsTab('deposits');
              setFundsSearch('');
            }}
            className={`pb-3 font-semibold transition-colors relative flex items-center gap-2 cursor-pointer ${
              fundsTab === 'deposits' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Deposits
            {pendingDepositsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingDepositsCount} pending
              </span>
            )}
            {fundsTab === 'deposits' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
            )}
          </button>
          <button
            onClick={() => {
              setFundsTab('withdrawals');
              setFundsSearch('');
            }}
            className={`pb-3 font-semibold transition-colors relative flex items-center gap-2 cursor-pointer ${
              fundsTab === 'withdrawals' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Withdrawals
            {pendingWithdrawalsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingWithdrawalsCount} pending
              </span>
            )}
            {fundsTab === 'withdrawals' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
            )}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-64 sm:w-80">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={fundsSearch}
                onChange={e => setFundsSearch(e.target.value)}
                placeholder={isDeposits ? 'Search deposits...' : 'Search withdrawals...'}
                className="w-full pl-9 pr-3 py-2 bg-[#091122] border border-[#162238] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={fundsStatusFilter}
                onChange={e => setFundsStatusFilter(e.target.value)}
                className="appearance-none bg-[#091122] border border-[#162238] text-xs text-slate-300 pl-3.5 pr-8 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="PENDING">PENDING</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="FAILED">FAILED</option>
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {fundsStatusFilter === 'PENDING' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
                <span>Showing Pending {isDeposits ? 'Deposits' : 'Withdrawals'}</span>
                <button
                  onClick={() => setFundsStatusFilter('All Status')}
                  className="hover:text-white p-0.5 transition-colors cursor-pointer"
                  title="Clear filter and show all"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={() => {
              if (isDeposits) {
                handleExportCSV(
                  'deposits_ledger',
                  ['TXN ID', 'CLIENT', 'AMOUNT', 'METHOD', 'REFERENCE', 'STATUS', 'DATE'],
                  filteredDeposits.map(d => [d.txnId, d.client, d.amount, d.method, d.reference, d.status, d.date])
                );
              } else {
                handleExportCSV(
                  'withdrawals_ledger',
                  ['TXN ID', 'CLIENT', 'AMOUNT', 'METHOD', 'REFERENCE', 'STATUS', 'DATE'],
                  filteredWithdrawals.map(w => [w.txnId, w.client, w.amount, w.method, w.reference, w.status, w.date])
                );
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
          >
            <Download size={13} className="text-slate-400" />
            Export
          </button>
        </div>

        {/* Table for Deposits / Withdrawals */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[840px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">TXN ID</th>
                  <th className="py-3.5 px-4">CLIENT</th>
                  <th className="py-3.5 px-4">AMOUNT</th>
                  <th className="py-3.5 px-4">METHOD</th>
                  <th className="py-3.5 px-4">REFERENCE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">DATE</th>
                  <th className="py-3.5 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {(isDeposits ? filteredDeposits : filteredWithdrawals).map(item => (
                  <tr key={item.txnId} className="hover:bg-[#0c152a] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{item.txnId}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{item.client}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#34d399]">{item.amount}</td>
                    <td className="py-3.5 px-4 text-slate-300">{item.method}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{item.reference}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{item.date}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        {/* Eye icon: View transaction receipt */}
                        <button
                          onClick={() => setSelectedTxnDetail({ ...item, isDeposit: isDeposits })}
                          title="View Transaction Breakdown"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        {/* Interactive actions for PENDING */}
                        {item.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApproveFunds(item, isDeposits)}
                              title={isDeposits ? 'Approve Deposit' : 'Disburse Withdrawal'}
                              className="p-1 hover:text-emerald-400 transition-colors"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              onClick={() => handleRejectFunds(item, isDeposits)}
                              title="Reject Transaction"
                              className="p-1 hover:text-rose-400 transition-colors"
                            >
                              <X size={15} />
                            </button>
                            <button
                              onClick={() => notify(`Transaction ${item.txnId} held for bank validation.`, 'warning')}
                              title="Put on hold"
                              className="p-1 hover:text-amber-400 transition-colors"
                            >
                              <Pause size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(isDeposits ? filteredDeposits : filteredWithdrawals).length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No {isDeposits ? 'deposit' : 'withdrawal'} records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Modal */}
        {selectedTxnDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#162238] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                    <CreditCard size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Financial Transaction Receipt</h3>
                    <p className="text-[11px] text-slate-400">
                      {selectedTxnDetail.txnId} • {selectedTxnDetail.reference}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTxnDetail(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-4 bg-[#0c162b] border border-[#162238] rounded-lg text-center">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Transaction Amount</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400 mt-0.5 block">
                    {selectedTxnDetail.amount}
                  </span>
                  <span className="inline-block mt-1">{renderStatusBadge(selectedTxnDetail.status)}</span>
                </div>

                <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Client Name</span>
                    <span className="font-bold text-white">{selectedTxnDetail.client}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Payment Gateway / Method</span>
                    <span className="font-medium text-slate-300">{selectedTxnDetail.method}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">UTR / Reference No</span>
                    <span className="font-mono text-cyan-400">{selectedTxnDetail.reference}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Date Logged</span>
                    <span className="font-mono text-slate-300">{selectedTxnDetail.date}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-end gap-2">
                {selectedTxnDetail.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleRejectFunds(selectedTxnDetail, selectedTxnDetail.isDeposit)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApproveFunds(selectedTxnDetail, selectedTxnDetail.isDeposit)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                    >
                      Authorize & Disburse
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedTxnDetail(null)}
                    className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======================================================================
  // 3. LEDGER VIEW (Matches Screenshot 3)
  // ======================================================================
  if (section === 'ledger') {
    const filteredLedger = ledgerList.filter(row => {
      const matchSearch =
        row.account.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        row.txnId.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        row.reference.toLowerCase().includes(ledgerSearch.toLowerCase());
      const matchType = ledgerTypeFilter === 'All Types' || row.type === ledgerTypeFilter;
      return matchSearch && matchType;
    });

    const renderTypeBadge = (type: string) => {
      if (type === 'DEPOSIT') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
            DEPOSIT
          </span>
        );
      }
      if (type === 'WITHDRAWAL') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#291e0a] border border-[#78350f] text-[#fbbf24]">
            WITHDRAWAL
          </span>
        );
      }
      if (type === 'COMMISSION') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#0b2149] border border-[#0369a1] text-[#38bdf8]">
            COMMISSION
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#26123a] border border-[#6b21a8] text-[#c084fc]">
          P&amp;L
        </span>
      );
    };

    return (
      <div className="space-y-6">
        {/* Breadcrumb matching screenshot 3 */}
        <div className="text-xs text-slate-400">
          <span className="text-slate-500">Dashboard</span>
          <span className="mx-2 text-slate-600">&gt;</span>
          <span className="text-slate-300 font-medium">Ledger</span>
        </div>

        {/* Header with Export CSV & Export PDF on top right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-white tracking-tight">Ledger</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleExportCSV(
                  'general_ledger',
                  ['DATE', 'TXN ID', 'ACCOUNT', 'TYPE', 'CREDIT', 'DEBIT', 'BALANCE', 'REFERENCE', 'STATUS'],
                  filteredLedger.map(l => [l.date, l.txnId, l.account, l.type, l.credit, l.debit, l.balance, l.reference, l.status])
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
            >
              <Download size={13} className="text-slate-400" />
              Export CSV
            </button>

            <button
              onClick={() => notify('Ledger PDF audit report generated and downloaded.', 'info')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
            >
              <FileDown size={13} className="text-slate-400" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-64 sm:w-80">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={ledgerSearch}
              onChange={e => setLedgerSearch(e.target.value)}
              placeholder="Search by account or Txn ID"
              className="w-full pl-9 pr-3 py-2 bg-[#091122] border border-[#162238] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Type Dropdown */}
          <div className="relative">
            <select
              value={ledgerTypeFilter}
              onChange={e => setLedgerTypeFilter(e.target.value)}
              className="appearance-none bg-[#091122] border border-[#162238] text-xs text-slate-300 pl-3.5 pr-8 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All Types">All Types</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
              <option value="COMMISSION">COMMISSION</option>
              <option value="P&L">P&amp;L</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table matching Screenshot 3 */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">DATE</th>
                  <th className="py-3.5 px-4">TXN ID</th>
                  <th className="py-3.5 px-4">ACCOUNT</th>
                  <th className="py-3.5 px-4">TYPE</th>
                  <th className="py-3.5 px-4">CREDIT</th>
                  <th className="py-3.5 px-4">DEBIT</th>
                  <th className="py-3.5 px-4">BALANCE</th>
                  <th className="py-3.5 px-4">REFERENCE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {filteredLedger.map(item => (
                  <tr key={item.txnId} className="hover:bg-[#0c152a] transition-colors group">
                    <td className="py-3.5 px-4 font-mono text-slate-400">{item.date}</td>
                    <td 
                      onClick={() => setSelectedDrawerTxn(item)}
                      className="py-3.5 px-4 font-mono font-bold text-[#38bdf8] cursor-pointer hover:underline"
                    >
                      {item.txnId}
                    </td>
                    <td 
                      onClick={() => setSelectedDrawerTxn(item)}
                      className="py-3.5 px-4 font-bold text-white cursor-pointer hover:text-blue-400 hover:underline"
                    >
                      {item.account}
                    </td>
                    <td className="py-3.5 px-4">{renderTypeBadge(item.type)}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {item.credit !== '—' ? (
                        <span className="text-[#34d399]">{item.credit}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold">
                      {item.debit !== '—' ? (
                        <span className="text-[#f87171]">{item.debit}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-200">{item.balance}</td>
                    <td className="py-3.5 px-4 text-slate-300">{item.reference}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedDrawerTxn(item)}
                          title="View Transaction Details"
                          className="p-1 text-slate-400 hover:text-[#38bdf8] transition-colors cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setSelectedLedgerItem(item)}
                          title="View Double-Entry Voucher"
                          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <FileText size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLedger.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No ledger transactions match the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ledger Voucher Modal */}
        {selectedLedgerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b border-[#162238] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                    <FileText size={17} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Double-Entry Journal Voucher</h3>
                    <p className="text-[11px] text-slate-400">
                      Voucher #{selectedLedgerItem.txnId}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLedgerItem(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Account</span>
                    <span className="font-bold text-white text-sm">{selectedLedgerItem.account}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Transaction Type</span>
                    <div className="mt-0.5">{renderTypeBadge(selectedLedgerItem.type)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Effective Date</span>
                    <span className="text-slate-300 font-mono">{selectedLedgerItem.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
                    <div className="mt-0.5">{renderStatusBadge(selectedLedgerItem.status)}</div>
                  </div>
                </div>

                <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Credit Amount</span>
                    <span className="font-mono font-bold text-[#34d399]">{selectedLedgerItem.credit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Debit Amount</span>
                    <span className="font-mono font-bold text-[#f87171]">{selectedLedgerItem.debit}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#162238] pt-2">
                    <span className="text-slate-400 font-semibold">Running Balance After</span>
                    <span className="font-mono font-bold text-white text-sm">{selectedLedgerItem.balance}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Reference / Description</span>
                    <span className="text-slate-300 font-medium">{selectedLedgerItem.reference}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-end">
                <button
                  onClick={() => setSelectedLedgerItem(null)}
                  className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs"
                >
                  Close Voucher
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Details Side Drawer (Exact match to Screenshot 2) */}
        {selectedDrawerTxn && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            {/* Backdrop click to close */}
            <div 
              className="absolute inset-0"
              onClick={() => setSelectedDrawerTxn(null)}
            />

            {/* Right Drawer Panel */}
            <div className="relative w-full max-w-md bg-[#070e1b] border-l border-[#131e36] h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between z-10 animate-in slide-in-from-right duration-200">
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#131e36]">
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Transaction Details
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {selectedDrawerTxn.txnId} • {selectedDrawerTxn.account}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDrawerTxn(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 6 Key-Value Cards in 2 columns x 3 rows (Matching Screenshot 2) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 font-medium block">Txn ID</span>
                    <p className="text-xs sm:text-sm font-bold text-white font-mono mt-1">
                      {selectedDrawerTxn.txnId}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 font-medium block">Date</span>
                    <p className="text-xs sm:text-sm font-bold text-white font-mono mt-1">
                      {selectedDrawerTxn.date}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 font-medium block">Account</span>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1 truncate">
                      {selectedDrawerTxn.account}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 font-medium block">Type</span>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1 capitalize">
                      {selectedDrawerTxn.type.charAt(0).toUpperCase() + selectedDrawerTxn.type.slice(1).toLowerCase()}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 font-medium block">Reference</span>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1 truncate">
                      {selectedDrawerTxn.reference}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 font-medium block">Status</span>
                    <p className="text-xs sm:text-sm font-bold text-white mt-1 lowercase">
                      {selectedDrawerTxn.status.toLowerCase()}
                    </p>
                  </div>
                </div>

                {/* 3 Highlight Cards (Credit, Debit, Balance) (Matching Screenshot 2) */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5 text-center">
                    <span className="text-[11px] text-slate-400 font-medium block">Credit</span>
                    <p className="text-xs sm:text-sm font-bold font-mono text-[#34d399] mt-1">
                      {selectedDrawerTxn.credit !== '—' ? selectedDrawerTxn.credit : '—'}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5 text-center">
                    <span className="text-[11px] text-slate-400 font-medium block">Debit</span>
                    <p className="text-xs sm:text-sm font-bold font-mono text-[#f87171] mt-1">
                      {selectedDrawerTxn.debit !== '—' ? selectedDrawerTxn.debit : '—'}
                    </p>
                  </div>

                  <div className="bg-[#091122] border border-[#131e36] rounded-xl p-3.5 text-center">
                    <span className="text-[11px] text-slate-400 font-medium block">Balance</span>
                    <p className="text-xs sm:text-sm font-bold font-mono text-white mt-1">
                      {selectedDrawerTxn.balance}
                    </p>
                  </div>
                </div>

                {/* All transactions for this client */}
                {(() => {
                  const clientAllTxns = ledgerList.filter(
                    l => l.account.toLowerCase() === selectedDrawerTxn.account.toLowerCase()
                  );
                  return (
                    <div className="space-y-2 pt-4 border-t border-[#131e36]">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                          All Transactions for {selectedDrawerTxn.account} ({clientAllTxns.length})
                        </span>
                        <button
                          onClick={() => {
                            setLedgerSearch(selectedDrawerTxn.account);
                            setSelectedDrawerTxn(null);
                            notify(`Filtered ledger by ${selectedDrawerTxn.account}`, 'info');
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                        >
                          Filter in Table
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {clientAllTxns.map(t => {
                          const isCurrent = t.txnId === selectedDrawerTxn.txnId;
                          return (
                            <div
                              key={t.txnId}
                              onClick={() => setSelectedDrawerTxn(t)}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                isCurrent
                                  ? 'bg-[#0c1f44] border-[#0369a1] text-white shadow-sm'
                                  : 'bg-[#091122] border-[#131e36] hover:bg-[#0c152a] text-slate-300'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[#38bdf8] font-bold text-[11px]">
                                    {t.txnId}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold text-slate-300 px-1 py-0.2 rounded bg-slate-800">
                                    {t.type}
                                  </span>
                                </div>
                                <div className="text-slate-400 text-[10px] font-mono">
                                  {t.date} • {t.reference}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono font-bold text-xs">
                                  {t.credit !== '—' ? (
                                    <span className="text-[#34d399]">{t.credit}</span>
                                  ) : (
                                    <span className="text-[#f87171]">{t.debit}</span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Bal: {t.balance}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bottom Actions */}
              <div className="pt-5 border-t border-[#131e36] flex items-center gap-2 mt-4">
                <button
                  onClick={() => {
                    notify(`Receipt for ${selectedDrawerTxn.txnId} downloaded successfully.`, 'success');
                  }}
                  className="flex-1 py-2 px-3 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  Download Receipt
                </button>
                <button
                  onClick={() => setSelectedDrawerTxn(null)}
                  className="flex-1 py-2 px-3 bg-[#162238] hover:bg-[#202f4d] rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
