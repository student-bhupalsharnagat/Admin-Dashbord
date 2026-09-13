import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart2,
  DollarSign,
  BookOpen,
  Activity,
  ShoppingCart,
  Clock,
  FileText,
  Wallet,
  Users,
  Building2,
  BarChart3,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Lock
} from 'lucide-react';
import { hasPermission } from '../utils/rbac';

interface ReportCardConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  category: 'FINANCIAL' | 'TRADING' | 'AUDIT' | 'USERS';
  defaultFields: string[];
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    id: 'pl-report',
    title: 'P&L Report',
    description: 'Profit & loss summary by client, broker, or period',
    icon: TrendingUp,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    category: 'FINANCIAL',
    defaultFields: ['Client ID', 'Client Name', 'Realized P&L', 'Unrealized P&L', 'Gross P&L', 'Net P&L', 'Brokerage']
  },
  {
    id: 'turnover-report',
    title: 'Turnover Report',
    description: 'Trading volume and turnover analysis',
    icon: BarChart2,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    category: 'TRADING',
    defaultFields: ['Date', 'Symbol', 'Volume (Units)', 'Total Turnover (₹)', 'Exchange Fees', 'Broker Turnover']
  },
  {
    id: 'commission-report',
    title: 'Commission Report',
    description: 'Commission earned across hierarchy levels',
    icon: DollarSign,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    category: 'FINANCIAL',
    defaultFields: ['Master Name', 'Broker Name', 'Sub-Broker Name', 'Gross Commission', 'Sharing %', 'Net Pay-out']
  },
  {
    id: 'ledger-report',
    title: 'Ledger Report',
    description: 'Complete transaction and balance ledger',
    icon: BookOpen,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    category: 'AUDIT',
    defaultFields: ['Transaction ID', 'Date & Time', 'Account Code', 'Description', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)']
  },
  {
    id: 'trade-report',
    title: 'Trade Report',
    description: 'Executed trades with full details',
    icon: Activity,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
    category: 'TRADING',
    defaultFields: ['Trade ID', 'Order ID', 'Client', 'Symbol', 'Side', 'Qty', 'Price', 'Execution Time']
  },
  {
    id: 'order-report',
    title: 'Order Report',
    description: 'All orders including filled, pending, cancelled',
    icon: ShoppingCart,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    category: 'TRADING',
    defaultFields: ['Order ID', 'Time', 'Client', 'Symbol', 'Side', 'Order Type', 'Placed Qty', 'Status', 'Validity']
  },
  {
    id: 'position-report',
    title: 'Position Report',
    description: 'Open and closed position summary',
    icon: Clock,
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    category: 'TRADING',
    defaultFields: ['Client ID', 'Symbol', 'Net Qty', 'Avg Buy Price', 'Avg Sell Price', 'LTP', 'Current P&L']
  },
  {
    id: 'deposit-report',
    title: 'Deposit Report',
    description: 'All deposit transactions and methods',
    icon: FileText,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    category: 'FINANCIAL',
    defaultFields: ['Deposit ID', 'Client Name', 'Amount (₹)', 'Payment Gateway', 'Bank Ref #', 'Status', 'Timestamp']
  },
  {
    id: 'withdrawal-report',
    title: 'Withdrawal Report',
    description: 'All withdrawal requests and statuses',
    icon: Wallet,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    category: 'FINANCIAL',
    defaultFields: ['Req ID', 'Client Name', 'Account #', 'Requested Amount', 'Approved Amount', 'Status', 'Processed Date']
  },
  {
    id: 'client-report',
    title: 'Client Report',
    description: 'Client onboarding, KYC, and activity report',
    icon: Users,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    category: 'USERS',
    defaultFields: ['Client Code', 'Full Name', 'Email', 'Phone', 'Broker', 'KYC Status', 'Account Status', 'Joined Date']
  },
  {
    id: 'broker-report',
    title: 'Broker Report',
    description: 'Broker performance and hierarchy data',
    icon: Building2,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    category: 'USERS',
    defaultFields: ['Broker Code', 'Broker Name', 'Assigned Master', 'Sub-Brokers', 'Active Clients', 'Total Volume', 'Status']
  },
  {
    id: 'margin-report',
    title: 'Margin Report',
    description: 'Margin utilization and risk levels',
    icon: BarChart3,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    category: 'AUDIT',
    defaultFields: ['Client ID', 'Available Margin (₹)', 'Used Margin (₹)', 'Margin Utilization %', 'Peak Margin', 'Risk Status']
  }
];

interface ReportsViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  currentUser?: { role?: string; name?: string } | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onNotify, currentUser }) => {
  const canExport = hasPermission(currentUser?.role, 'REPORTS', 'EXPORT');
  const canCreate = hasPermission(currentUser?.role, 'REPORTS', 'CREATE');
  const [selectedReport, setSelectedReport] = useState<ReportCardConfig | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedMaster, setSelectedMaster] = useState<string>('All Masters');
  const [selectedBroker, setSelectedBroker] = useState<string>('All Brokers');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mastersList, setMastersList] = useState<string[]>([
    'Apex Capital Group (MST-001)',
    'Zenith Prime (MST-002)',
    'Global Equity Partners (MST-003)'
  ]);
  const [brokersList, setBrokersList] = useState<string[]>([
    'Ryan Chen (BRK-102)',
    'David Miller (BRK-103)',
    'Sarah Jenkins (BRK-104)',
    'Michael Chang (BRK-105)'
  ]);

  useEffect(() => {
    fetch('/api/admin/masters')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((m: any) => `${m.name} (${m.code || m.id})`);
          setMastersList(Array.from(new Set([...names, 'Apex Capital Group (MST-001)'])));
        }
      })
      .catch(() => {});

    fetch('/api/admin/brokers')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((b: any) => `${b.name} (${b.code || b.id})`);
          setBrokersList(Array.from(new Set([...names, 'Ryan Chen (BRK-102)'])));
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenModal = (report: ReportCardConfig) => {
    setSelectedReport(report);
    // Default to current month or empty
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    setDateFrom(firstDay);
    setDateTo(today);
  };

  const handleCloseModal = () => {
    if (!isGenerating) {
      setSelectedReport(null);
    }
  };

  const generateReportCSVData = (report: ReportCardConfig) => {
    const headers = report.defaultFields.join(',');
    let sampleRows = '';
    if (report.id === 'pl-report') {
      sampleRows = [
        'CLT001,Alexander Hunt,"₹12,450.00","₹3,200.00","₹15,650.00","₹14,850.00","₹800.00"',
        'CLT002,Sophia Lee,"-₹4,120.00","₹1,150.00","-₹2,970.00","-₹3,420.00","₹450.00"',
        'CLT003,Nathan Brooks,"₹8,900.00","₹0.00","₹8,900.00","₹8,450.00","₹450.00"',
        'CLT004,Maya Patel,"₹22,100.00","₹5,400.00","₹27,500.00","₹25,950.00","₹1,550.00"',
        'CLT005,Isabella Torres,"₹6,300.00","-₹850.00","₹5,450.00","₹5,100.00","₹350.00"'
      ].join('\n');
    } else if (report.id === 'turnover-report') {
      sampleRows = [
        '2024-04-15,NIFTY24APR22500CE,14500,"₹3,26,25,000.00","₹2,450.00","₹1,85,00,000.00"',
        '2024-04-15,BANKNIFTY24APR48000PE,8200,"₹3,93,60,000.00","₹3,150.00","₹2,10,00,000.00"',
        '2024-04-15,RELIANCE-EQ,4500,"₹1,32,75,000.00","₹1,120.00","₹85,00,000.00"',
        '2024-04-15,TCS-EQ,2100,"₹81,90,000.00","₹720.00","₹55,00,000.00"'
      ].join('\n');
    } else if (report.id === 'commission-report') {
      sampleRows = [
        'Apex Capital Group,Ryan Chen,Tom Anderson,"₹45,000.00","40% / 40% / 20%","₹18,000.00"',
        'Apex Capital Group,David Miller,Sarah Jenkins,"₹28,500.00","50% / 50%","₹14,250.00"',
        'Zenith Prime,Michael Chang,Alex Rivera,"₹62,100.00","35% / 45% / 20%","₹21,735.00"'
      ].join('\n');
    } else {
      sampleRows = [
        `REC-101,Sample Entity 1,Category A,100,Active,₹45,200.00,${dateFrom || '2024-04-15'}`,
        `REC-102,Sample Entity 2,Category B,250,Active,₹82,400.00,${dateTo || '2024-04-15'}`,
        `REC-103,Sample Entity 3,Category A,75,Pending,₹18,900.00,${dateFrom || '2024-04-14'}`
      ].join('\n');
    }
    return `${headers}\n${sampleRows}`;
  };

  const handleExportCSV = () => {
    if (!selectedReport) return;
    setIsGenerating(true);

    setTimeout(() => {
      const csvContent = `data:text/csv;charset=utf-8,${generateReportCSVData(selectedReport)}`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${selectedReport.id}_${dateFrom || 'from'}_${dateTo || 'to'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsGenerating(false);
      setSelectedReport(null);
      onNotify?.(`${selectedReport.title} CSV exported successfully.`, 'success');
    }, 500);
  };

  const handleExportPDF = () => {
    if (!selectedReport) return;
    setIsGenerating(true);

    setTimeout(() => {
      // Trigger browser print/pdf generation for report summary
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${selectedReport.title} - TradeMatrix</title>
              <style>
                body { font-family: sans-serif; padding: 24px; color: #1e293b; }
                h1 { margin-bottom: 4px; color: #0f172a; }
                .subtitle { color: #64748b; margin-bottom: 16px; font-size: 13px; }
                .meta { margin-bottom: 20px; font-size: 12px; background: #f1f5f9; padding: 12px; border-radius: 6px; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                th { background: #e2e8f0; font-weight: bold; }
              </style>
            </head>
            <body>
              <h1>${selectedReport.title}</h1>
              <div class="subtitle">${selectedReport.description}</div>
              <div class="meta">
                <strong>Date Range:</strong> ${dateFrom || 'All'} to ${dateTo || 'All'} |
                <strong>Master:</strong> ${selectedMaster} |
                <strong>Broker:</strong> ${selectedBroker} |
                <strong>Generated At:</strong> ${new Date().toLocaleString()}
              </div>
              <table>
                <thead>
                  <tr>${selectedReport.defaultFields.map(f => `<th>${f}</th>`).join('')}</tr>
                </thead>
                <tbody>
                  ${generateReportCSVData(selectedReport).split('\n').slice(1).map(row => `
                    <tr>${row.split(',').map(c => `<td>${c.replace(/"/g, '')}</td>`).join('')}</tr>
                  `).join('')}
                </tbody>
              </table>
              <script>window.print();</script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
      setIsGenerating(false);
      setSelectedReport(null);
      onNotify?.(`${selectedReport.title} PDF ready for export.`, 'success');
    }, 500);
  };

  const handleGenerateReport = () => {
    if (!selectedReport) return;
    setIsGenerating(true);

    setTimeout(() => {
      // Automatic download as standard CSV
      const csvContent = `data:text/csv;charset=utf-8,${generateReportCSVData(selectedReport)}`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${selectedReport.id}_${dateFrom || 'all'}_${dateTo || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsGenerating(false);
      setSelectedReport(null);
      onNotify?.(`${selectedReport.title} generated successfully for ${selectedMaster} / ${selectedBroker}!`, 'success');
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Reports Center</h1>
      </div>

      {/* 12-Card Grid matching Screenshot 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_CARDS.map(report => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="bg-[#0b1328] border border-[#142038] hover:border-[#22355c] rounded-xl p-5 flex flex-col justify-between transition-all duration-200 group"
            >
              <div>
                {/* Icon Box */}
                <div
                  className={`w-9 h-9 rounded-lg ${report.iconBg} ${report.iconColor} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}
                >
                  <Icon size={18} />
                </div>

                {/* Title & Description */}
                <h3 className="text-sm font-bold text-white mb-1.5 tracking-tight">
                  {report.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {report.description}
                </p>
              </div>

              {/* Action Link */}
              <div className="mt-5 pt-3">
                <button
                  onClick={() => handleOpenModal(report)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Generate &rarr;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Generation Modal (Exact match to Screenshot 2026-09-11 004437.png) */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#0b1328] border border-[#162340] rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-6">
            {/* Header: Title and Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-[#142038]">
              <h3 className="text-base font-bold text-white tracking-tight">
                {selectedReport.title}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-slate-400 -mt-2">
              {selectedReport.description}
            </p>

            {/* Form Fields: 2x2 Grid */}
            <div className="space-y-4 text-xs">
              {/* Row 1: Date From and Date To */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Date From
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      placeholder="mm/dd/yyyy"
                      className="w-full bg-[#081022] border border-[#162442] rounded-lg px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Date To
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      placeholder="mm/dd/yyyy"
                      className="w-full bg-[#081022] border border-[#162442] rounded-lg px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Filter by Master and Filter by Broker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Filter by Master
                  </label>
                  <select
                    value={selectedMaster}
                    onChange={e => setSelectedMaster(e.target.value)}
                    className="w-full bg-[#081022] border border-[#162442] text-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="All Masters">All Masters</option>
                    {mastersList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">
                    Filter by Broker
                  </label>
                  <select
                    value={selectedBroker}
                    onChange={e => setSelectedBroker(e.target.value)}
                    className="w-full bg-[#081022] border border-[#162442] text-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="All Brokers">All Brokers</option>
                    {brokersList.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Footer Buttons: Cancel, Export CSV, Export PDF on left; Generate Report on right */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#142038]">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-lg bg-[#0c162b] hover:bg-[#13203c] border border-[#1a2b4c] text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={isGenerating || !canExport}
                  title={!canExport ? 'Export restricted by RBAC policy' : undefined}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    canExport
                      ? 'bg-[#0c162b] hover:bg-[#13203c] border-[#1a2b4c] text-slate-200 cursor-pointer'
                      : 'bg-[#0a0f1d] border-[#141d30] text-slate-500 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {!canExport ? <Lock size={12} className="text-amber-400" /> : <Download size={13} />}
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isGenerating || !canExport}
                  title={!canExport ? 'Export restricted by RBAC policy' : undefined}
                  className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    canExport
                      ? 'bg-[#0c162b] hover:bg-[#13203c] border-[#1a2b4c] text-slate-200 cursor-pointer'
                      : 'bg-[#0a0f1d] border-[#141d30] text-slate-500 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {!canExport ? <Lock size={12} className="text-amber-400" /> : <Download size={13} />}
                  <span>Export PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={isGenerating || !canCreate}
                title={!canCreate ? 'Report generation restricted by RBAC policy' : undefined}
                className={`px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                  canCreate
                    ? 'bg-[#2563eb] hover:bg-blue-600 text-white shadow-blue-500/20 cursor-pointer'
                    : 'bg-[#152342] text-slate-400 border border-[#1e315b] cursor-not-allowed'
                } disabled:opacity-50`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : !canCreate ? (
                  <>
                    <Lock size={13} className="text-amber-400" />
                    <span>Generate Restricted</span>
                  </>
                ) : (
                  <span>Generate Report</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
