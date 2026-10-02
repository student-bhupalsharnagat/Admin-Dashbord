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
  const [mastersList, setMastersList] = useState<string[]>([]);
  const [brokersList, setBrokersList] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/admin/masters')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((m: any) => `${m.name || m.trading_name || m.username || 'Master'} (${m.code || m.id})`);
          setMastersList(Array.from(new Set(names)));
        }
      })
      .catch(() => {});

    fetch('/api/admin/brokers')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((b: any) => `${b.name || b.trading_name || b.username || 'Broker'} (${b.code || b.id})`);
          setBrokersList(Array.from(new Set(names)));
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenModal = (report: ReportCardConfig) => {
    setSelectedReport(report);
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

  const fetchLiveReportRows = async (report: ReportCardConfig): Promise<string[]> => {
    try {
      if (report.id === 'pl-report') {
        const res = await fetch('/api/admin/clients');
        if (!res.ok) return [];
        const clients = await res.json();
        if (!Array.isArray(clients) || clients.length === 0) return [];
        return clients.map((c: any) => {
          const code = c.code || c.id || '';
          const name = (c.name || 'Client').replace(/"/g, '""');
          const realized = `₹${Number(c.realized_pl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const unrealized = `₹${Number(c.unrealized_pl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const total = `₹${(Number(c.realized_pl || 0) + Number(c.unrealized_pl || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const avail = `₹${Number(c.available_margin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const used = `₹${Number(c.used_margin || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          return `${code},"${name}","${realized}","${unrealized}","${total}","${avail}","${used}"`;
        });
      }

      if (report.id === 'turnover-report' || report.id === 'trade-book-report') {
        const res = await fetch('/api/admin/trades');
        if (!res.ok) return [];
        const trades = await res.json();
        if (!Array.isArray(trades) || trades.length === 0) return [];
        return trades.map((t: any) => {
          const time = t.executed_at || t.timestamp || new Date().toISOString();
          const symbol = t.symbol || '';
          const qty = t.quantity || t.qty || 0;
          const price = Number(t.price || 0);
          const turnover = `₹${(qty * price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const side = t.side || '';
          const client = t.client_id || t.clientId || '';
          if (report.id === 'turnover-report') {
            return `${time.split('T')[0]},${symbol},${qty},"${turnover}","₹${(price).toFixed(2)}",${client}`;
          }
          return `${t.id || ''},${t.order_id || ''},${client},${symbol},${side},${qty},"₹${price.toFixed(2)}",${time}`;
        });
      }

      if (report.id === 'order-book-report') {
        const res = await fetch('/api/admin/orders');
        if (!res.ok) return [];
        const orders = await res.json();
        if (!Array.isArray(orders) || orders.length === 0) return [];
        return orders.map((o: any) => {
          const id = o.id || o.order_id || '';
          const client = o.client_id || o.clientId || '';
          const symbol = o.symbol || '';
          const side = o.side || '';
          const qty = o.quantity || o.qty || 0;
          const price = `₹${Number(o.price || 0).toFixed(2)}`;
          const status = o.status || '';
          const time = o.created_at || new Date().toISOString();
          return `${id},${client},${symbol},${o.type || 'LIMIT'},${side},${qty},"${price}",${status},${time}`;
        });
      }

      if (report.id === 'position-book-report') {
        const res = await fetch('/api/admin/positions');
        if (!res.ok) return [];
        const pos = await res.json();
        if (!Array.isArray(pos) || pos.length === 0) return [];
        return pos.map((p: any) => {
          const client = p.client_id || p.clientId || '';
          const symbol = p.symbol || '';
          const netQty = p.net_quantity || p.quantity || 0;
          const buyAvg = `₹${Number(p.buy_average || p.buy_price || 0).toFixed(2)}`;
          const sellAvg = `₹${Number(p.sell_average || p.sell_price || 0).toFixed(2)}`;
          const ltp = `₹${Number(p.ltp || p.current_price || 0).toFixed(2)}`;
          const pl = `₹${Number(p.unrealized_pl || p.pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          return `${client},${symbol},${netQty},"${buyAvg}","${sellAvg}","${ltp}","${pl}"`;
        });
      }

      if (report.id === 'deposit-report') {
        const res = await fetch('/api/admin/funds/deposits');
        if (!res.ok) return [];
        const deps = await res.json();
        if (!Array.isArray(deps) || deps.length === 0) return [];
        return deps.map((d: any) => {
          const id = d.id || '';
          const name = (d.client_name || d.client_id || '').replace(/"/g, '""');
          const amt = `₹${Number(d.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const gateway = d.payment_gateway || d.method || 'UPI/IMPS';
          const ref = d.bank_reference || d.reference_no || '';
          const status = d.status || '';
          const date = d.created_at || '';
          return `${id},"${name}","${amt}",${gateway},${ref},${status},${date}`;
        });
      }

      if (report.id === 'withdrawal-report') {
        const res = await fetch('/api/admin/funds/withdrawals');
        if (!res.ok) return [];
        const wds = await res.json();
        if (!Array.isArray(wds) || wds.length === 0) return [];
        return wds.map((w: any) => {
          const id = w.id || '';
          const name = (w.client_name || w.client_id || '').replace(/"/g, '""');
          const acc = w.account_number || w.bank_account || '';
          const reqAmt = `₹${Number(w.requested_amount || w.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const appAmt = `₹${Number(w.approved_amount || w.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const status = w.status || '';
          const date = w.processed_at || w.created_at || '';
          return `${id},"${name}",${acc},"${reqAmt}","${appAmt}",${status},${date}`;
        });
      }

      if (report.id === 'client-report') {
        const res = await fetch('/api/admin/clients');
        if (!res.ok) return [];
        const clients = await res.json();
        if (!Array.isArray(clients) || clients.length === 0) return [];
        return clients.map((c: any) => {
          const code = c.code || c.id || '';
          const name = (c.name || '').replace(/"/g, '""');
          const email = c.email || '';
          const phone = c.phone || '';
          const broker = c.broker_id || c.broker_name || '';
          const kyc = c.kyc_status || 'VERIFIED';
          const status = c.status || 'ACTIVE';
          const joined = c.created_at || '';
          return `${code},"${name}",${email},${phone},${broker},${kyc},${status},${joined}`;
        });
      }

      if (report.id === 'broker-report') {
        const res = await fetch('/api/admin/brokers');
        if (!res.ok) return [];
        const brokers = await res.json();
        if (!Array.isArray(brokers) || brokers.length === 0) return [];
        return brokers.map((b: any) => {
          const code = b.code || b.id || '';
          const name = (b.name || b.username || '').replace(/"/g, '""');
          const master = b.master_id || b.master_name || '';
          const subBrokers = b.sub_brokers_count || 0;
          const activeClients = b.active_clients_count || 0;
          const vol = `₹${Number(b.total_volume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const status = b.status || 'ACTIVE';
          return `${code},"${name}",${master},${subBrokers},${activeClients},"${vol}",${status}`;
        });
      }

      if (report.id === 'commission-report') {
        const res = await fetch('/api/admin/commissions');
        if (!res.ok) return [];
        const coms = await res.json();
        if (!Array.isArray(coms) || coms.length === 0) return [];
        return coms.map((cm: any) => {
          const master = (cm.master_name || cm.master_id || '').replace(/"/g, '""');
          const broker = (cm.broker_name || cm.broker_id || '').replace(/"/g, '""');
          const client = (cm.client_name || cm.client_id || '').replace(/"/g, '""');
          const gross = `₹${Number(cm.gross_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          const split = cm.split_ratio || '100%';
          const net = `₹${Number(cm.net_payout || cm.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          return `"${master}","${broker}","${client}","${gross}","${split}","${net}"`;
        });
      }

      // Default fallback
      const res = await fetch('/api/admin/clients');
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return [];
      return data.map((item: any, i: number) => {
        return `REC-${101 + i},"${(item.name || item.id || '').replace(/"/g, '""')}",Category A,1,Active,"₹${Number(item.available_margin || 0).toLocaleString('en-IN')}",${item.created_at || dateFrom || ''}`;
      });
    } catch {
      return [];
    }
  };

  const handleExportCSV = async () => {
    if (!selectedReport) return;
    setIsGenerating(true);

    try {
      const rows = await fetchLiveReportRows(selectedReport);
      const headers = selectedReport.defaultFields.join(',');
      const csvData = `${headers}\n${rows.join('\n')}`;
      const csvContent = `data:text/csv;charset=utf-8,${encodeURIComponent(csvData)}`;
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', `${selectedReport.id}_${dateFrom || 'from'}_${dateTo || 'to'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsGenerating(false);
      setSelectedReport(null);
      onNotify?.(`${selectedReport.title} CSV exported successfully.`, 'success');
    } catch {
      setIsGenerating(false);
      onNotify?.(`Failed to export ${selectedReport.title}.`, 'warning');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedReport) return;
    setIsGenerating(true);

    try {
      const rows = await fetchLiveReportRows(selectedReport);
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
                  ${rows.length > 0 ? rows.map(row => `
                    <tr>${row.split(',').map(c => `<td>${c.replace(/"/g, '')}</td>`).join('')}</tr>
                  `).join('') : `<tr><td colspan="${selectedReport.defaultFields.length}" style="text-align: center; color: #94a3b8; padding: 24px;">No records found for the selected criteria</td></tr>`}
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
    } catch {
      setIsGenerating(false);
      onNotify?.(`Failed to generate ${selectedReport.title} PDF.`, 'warning');
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedReport) return;
    await handleExportCSV();
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
