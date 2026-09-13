import React, { useState } from 'react';
import {
  ArrowLeft,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Clock,
  Wallet,
  FileText,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Download,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  Calendar,
  CreditCard
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

export interface ClientDetailViewProps {
  client: any;
  onBack: () => void;
  onNavigateDashboard?: () => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
  sourceView?: string;
}

// Portfolio Performance monthly data matching Screenshot 1
const defaultPortfolioData = [
  { month: 'Jan', value: 88500 },
  { month: 'Feb', value: 90200 },
  { month: 'Mar', value: 89800 },
  { month: 'Apr', value: 92400 },
  { month: 'May', value: 96800 },
  { month: 'Jun', value: 105200 }
];

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
  client,
  onBack,
  onNavigateDashboard,
  onNotify,
  sourceView = 'Clients'
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'Overview'
    | 'Profile'
    | 'KYC'
    | 'Wallet'
    | 'Ledger'
    | 'Orders'
    | 'Trades'
    | 'Positions'
    | 'P&L'
    | 'Activity'
  >('Overview');

  const [isSuspended, setIsSuspended] = useState(
    (client.account || client.status || '').toUpperCase() === 'SUSPENDED'
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [clientData, setClientData] = useState({
    name: client.name || 'Alexander Hunt',
    email: client.email || 'a.hunt@mail.com',
    phone: client.phone || '+1-555-3001',
    master: client.master || 'Apex Capital',
    broker: client.broker || 'Ryan Chen',
    subBroker: client.subBroker || 'Tom Anderson',
    id: client.id || 'CLT001',
    balance: client.balance || '₹25,400',
    netPl: client.netPl || (client.pl ? `+₹${client.pl.replace(/^[+-]/, '')}` : '+₹3,820'),
    totalOrders: client.totalOrders || 2,
    totalTrades: client.totalTrades || 2,
    joined: client.joined || client.created || '2023-04-01',
    kyc: client.kyc || 'APPROVED'
  });

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) {
      onNotify(msg, type);
    }
  };

  const handleToggleSuspend = () => {
    const nextState = !isSuspended;
    setIsSuspended(nextState);
    notify(
      nextState
        ? `Account for ${clientData.name} has been SUSPENDED.`
        : `Account for ${clientData.name} has been ACTIVATED.`,
      nextState ? 'warning' : 'success'
    );
  };

  // Mock sub-tab datasets for the client
  const clientOrders = [
    { id: 'ORD-8821', symbol: 'RELIANCE.EQ', side: 'BUY', qty: 50, price: '₹2,540.00', status: 'EXECUTED', time: '2023-06-22 10:14:02' },
    { id: 'ORD-8819', symbol: 'HDFCBANK.EQ', side: 'BUY', qty: 100, price: '₹1,620.50', status: 'EXECUTED', time: '2023-06-20 14:30:15' }
  ];

  const clientTrades = [
    { id: 'TRD-4412', symbol: 'RELIANCE.EQ', side: 'BUY', qty: 50, price: '₹2,540.00', pnl: '+₹1,450.00', time: '2023-06-22 10:14:03' },
    { id: 'TRD-4408', symbol: 'HDFCBANK.EQ', side: 'BUY', qty: 100, price: '₹1,620.50', pnl: '+₹2,370.00', time: '2023-06-20 14:30:16' }
  ];

  const clientPositions = [
    { symbol: 'RELIANCE.EQ', side: 'LONG', qty: 50, avgPrice: '₹2,540.00', ltp: '₹2,569.00', pnl: '+₹1,450.00', positive: true },
    { symbol: 'HDFCBANK.EQ', side: 'LONG', qty: 100, avgPrice: '₹1,620.50', ltp: '₹1,644.20', pnl: '+₹2,370.00', positive: true }
  ];

  const clientLedger = [
    { date: '2023-06-10', txnId: 'WDR-001', type: 'WITHDRAWAL', credit: '—', debit: '-₹5,000', balance: '₹25,400', ref: 'Bank Transfer', status: 'COMPLETED' },
    { date: '2023-06-01', txnId: 'TXN-8821-A', type: 'DEPOSIT', credit: '+₹10,000', debit: '—', balance: '₹30,400', ref: 'Bank Transfer', status: 'COMPLETED' },
    { date: '2023-05-28', txnId: 'COM-0528', type: 'COMMISSION', credit: '+₹120', debit: '—', balance: '₹20,400', ref: 'Monthly Commission', status: 'COMPLETED' }
  ];

  // Custom Tooltip for Portfolio Chart
  const CustomPortfolioTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#091122] border border-[#162238] rounded-lg p-2.5 shadow-xl text-xs font-mono">
          <p className="text-slate-400 font-sans font-medium">{label} 2023</p>
          <p className="text-emerald-400 font-bold mt-0.5">
            ₹{payload[0].value.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Portfolio Valuation</p>
        </div>
      );
    }
    return null;
  };

  const tabs: Array<typeof activeTab> = [
    'Overview',
    'Profile',
    'KYC',
    'Wallet',
    'Ledger',
    'Orders',
    'Trades',
    'Positions',
    'P&L',
    'Activity'
  ];

  const avatarInitial = (clientData.name || 'A').charAt(0).toUpperCase();

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. BREADCRUMB (Matches Screenshot 1) */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <button
          onClick={onNavigateDashboard || onBack}
          className="hover:text-white transition-colors cursor-pointer"
        >
          Dashboard
        </button>
        <span className="text-slate-600">&gt;</span>
        <button
          onClick={onBack}
          className="hover:text-white transition-colors cursor-pointer"
        >
          {sourceView}
        </button>
        <span className="text-slate-600">&gt;</span>
        <span className="text-slate-200 font-semibold">{clientData.name}</span>
      </div>

      {/* 2. HERO CARD (Matches Screenshot 1 exactly) */}
      <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            {/* Back Arrow Button */}
            <button
              onClick={onBack}
              title="Back to Clients"
              className="mt-1 sm:mt-0 p-2 rounded-lg border border-[#14223d] bg-[#091122] hover:bg-[#121c35] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>

            {/* Avatar block with initial letter */}
            <div className="w-11 h-11 rounded-lg bg-[#06261f] border border-[#065f46] flex items-center justify-center text-[#34d399] font-bold text-lg shrink-0">
              {avatarInitial}
            </div>

            {/* Name, Badges, Contact and Hierarchy lineage */}
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {clientData.name}
                </h1>
                {isSuspended ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
                    SUSPENDED
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
                    ACTIVE
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
                  KYC: {clientData.kyc}
                </span>
              </div>

              {/* Subtitle Line: Email • Phone */}
              <p className="text-xs text-slate-400 font-medium">
                {clientData.email} • {clientData.phone}
              </p>

              {/* Lineage path: CLT001 • Apex Capital → Ryan Chen → Tom Anderson */}
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-slate-400">{clientData.id}</span>
                <span>•</span>
                <span className="text-slate-400">{clientData.master}</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-400">{clientData.broker}</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-400">{clientData.subBroker}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons Top Right: Edit and Suspend */}
          <div className="flex items-center gap-2.5 self-end md:self-center">
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <Pencil size={13} />
              Edit
            </button>

            <button
              onClick={handleToggleSuspend}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer ${
                isSuspended
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-[#dc2626] hover:bg-[#b91c1c]'
              }`}
            >
              {isSuspended ? (
                <>
                  <ShieldCheck size={14} />
                  Activate
                </>
              ) : (
                <>
                  <ShieldAlert size={14} />
                  Suspend
                </>
              )}
            </button>
          </div>
        </div>

        {/* Four Prominent Key Metrics (Screenshot 1: Wallet Balance, Net P&L, Total Orders, Total Trades) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#121d33]/80">
          <div>
            <span className="text-xs text-slate-400 font-medium">Wallet Balance</span>
            <p className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 tracking-tight">
              {clientData.balance}
            </p>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-medium">Net P&amp;L</span>
            <p className="text-xl sm:text-2xl font-bold text-[#34d399] font-mono mt-1 tracking-tight">
              {clientData.netPl}
            </p>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-medium">Total Orders</span>
            <p className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 tracking-tight">
              {clientData.totalOrders}
            </p>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-medium">Total Trades</span>
            <p className="text-xl sm:text-2xl font-bold text-white font-mono mt-1 tracking-tight">
              {clientData.totalTrades}
            </p>
          </div>
        </div>
      </div>

      {/* 3. HORIZONTAL TAB STRIP (Screenshot 1: Overview, Profile, KYC, Wallet, Ledger, Orders, Trades, Positions, P&L, Activity) */}
      <div className="border-b border-[#121d33] overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max text-xs">
          {tabs.map(tab => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 font-semibold transition-colors relative cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. TAB CONTENTS */}
      {/* ======================================================== */}
      {/* OVERVIEW TAB (Exact layout matching Screenshot 1) */}
      {/* ======================================================== */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Portfolio Performance (Area Line Chart) */}
          <div className="lg:col-span-7 bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Portfolio Performance
              </h2>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                +18.8% YTD
              </span>
            </div>

            {/* Area Chart matching screenshot axes & green line */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={defaultPortfolioData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    domain={[0, 120000]}
                    ticks={[0, 30000, 60000, 90000, 120000]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickFormatter={val => `${val}`}
                    dx={-4}
                  />
                  <Tooltip content={<CustomPortfolioTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#portfolioGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Panel: Client Information (Exact rows from Screenshot 1) */}
          <div className="lg:col-span-5 bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm flex flex-col">
            <h2 className="text-sm font-bold text-white tracking-tight mb-4">
              Client Information
            </h2>

            <div className="divide-y divide-[#121d33]/80 text-xs flex-1 flex flex-col justify-between">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Client ID</span>
                <span className="font-mono font-bold text-white">{clientData.id}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Email</span>
                <span className="text-slate-200 font-medium">{clientData.email}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Phone</span>
                <span className="text-slate-200 font-medium">{clientData.phone}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Master</span>
                <span className="text-slate-200 font-medium">{clientData.master}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Broker</span>
                <span className="text-slate-200 font-medium">{clientData.broker}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Sub-Broker</span>
                <span className="text-slate-200 font-medium">{clientData.subBroker}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-400">Joined</span>
                <span className="font-mono text-slate-200 font-medium">{clientData.joined}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PROFILE TAB */}
      {/* ======================================================== */}
      {activeTab === 'Profile' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-5 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Full Client Profile & Compliance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#091122] border border-[#131e36] rounded-lg space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Personal Information</span>
              <div className="flex justify-between py-1 border-b border-[#131e36]/60">
                <span className="text-slate-400">Legal Name</span>
                <span className="text-white font-medium">{clientData.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#131e36]/60">
                <span className="text-slate-400">Date of Birth</span>
                <span className="text-slate-200 font-mono">1988-11-14</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#131e36]/60">
                <span className="text-slate-400">Citizenship</span>
                <span className="text-slate-200">United States / Resident</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Residential Address</span>
                <span className="text-slate-200 text-right">452 Market St, Suite 12, San Francisco, CA</span>
              </div>
            </div>

            <div className="p-4 bg-[#091122] border border-[#131e36] rounded-lg space-y-2.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Banking & Trading Tiers</span>
              <div className="flex justify-between py-1 border-b border-[#131e36]/60">
                <span className="text-slate-400">Primary Bank</span>
                <span className="text-slate-200 font-medium">JPMorgan Chase N.A.</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#131e36]/60">
                <span className="text-slate-400">Account Number</span>
                <span className="text-slate-200 font-mono">••••••••4819</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#131e36]/60">
                <span className="text-slate-400">Risk Profile Tier</span>
                <span className="text-emerald-400 font-semibold">Tier 1 (Aggressive Equity & F&amp;O)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Allowed Segments</span>
                <span className="text-slate-200 font-medium">NSE/BSE Equities, Futures, Options</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* KYC TAB */}
      {/* ======================================================== */}
      {activeTab === 'KYC' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">KYC Verification Documents</h2>
            <span className="px-2.5 py-1 rounded bg-[#06261f] border border-[#065f46] text-[#34d399] font-bold text-[11px]">
              VERIFIED & APPROVED
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Identity Document</span>
                <p className="font-bold text-white mt-0.5">Passport (International)</p>
                <span className="text-[10px] text-emerald-400 font-mono mt-1 block">Verified on 2023-04-02</span>
              </div>
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            </div>

            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Proof of Address</span>
                <p className="font-bold text-white mt-0.5">Utility Statement (Electric)</p>
                <span className="text-[10px] text-emerald-400 font-mono mt-1 block">Verified on 2023-04-02</span>
              </div>
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            </div>

            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Tax Registration</span>
                <p className="font-bold text-white mt-0.5">PAN / TIN Document</p>
                <span className="text-[10px] text-emerald-400 font-mono mt-1 block">Verified on 2023-04-03</span>
              </div>
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* WALLET TAB */}
      {/* ======================================================== */}
      {activeTab === 'Wallet' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Client Trading Wallet & Margins</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-slate-400 text-[11px]">Available Cash Balance</span>
              <p className="text-2xl font-bold font-mono text-white mt-1">{clientData.balance}</p>
            </div>
            <div className="p-4 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-slate-400 text-[11px]">Utilized Margin</span>
              <p className="text-2xl font-bold font-mono text-blue-400 mt-1">₹14,200</p>
            </div>
            <div className="p-4 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-slate-400 text-[11px]">Unsettled Trading P&amp;L</span>
              <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{clientData.netPl}</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* LEDGER TAB */}
      {/* ======================================================== */}
      {activeTab === 'Ledger' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Financial Ledger History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">DATE</th>
                  <th className="py-2.5 px-3">TXN ID</th>
                  <th className="py-2.5 px-3">TYPE</th>
                  <th className="py-2.5 px-3">CREDIT</th>
                  <th className="py-2.5 px-3">DEBIT</th>
                  <th className="py-2.5 px-3">BALANCE</th>
                  <th className="py-2.5 px-3">REFERENCE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121d33]">
                {clientLedger.map(item => (
                  <tr key={item.txnId} className="hover:bg-[#0c1527] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{item.date}</td>
                    <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">{item.txnId}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-200">{item.type}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 font-semibold">{item.credit}</td>
                    <td className="py-2.5 px-3 font-mono text-rose-400 font-semibold">{item.debit}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-200">{item.balance}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.ref}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ORDERS TAB */}
      {/* ======================================================== */}
      {activeTab === 'Orders' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Client Order Book</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">ORDER ID</th>
                  <th className="py-2.5 px-3">SYMBOL</th>
                  <th className="py-2.5 px-3">SIDE</th>
                  <th className="py-2.5 px-3">QTY</th>
                  <th className="py-2.5 px-3">PRICE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121d33]">
                {clientOrders.map(ord => (
                  <tr key={ord.id} className="hover:bg-[#0c1527] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">{ord.id}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{ord.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                        {ord.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{ord.qty}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{ord.price}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{ord.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TRADES TAB */}
      {/* ======================================================== */}
      {activeTab === 'Trades' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Executed Trades History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">TRADE ID</th>
                  <th className="py-2.5 px-3">SYMBOL</th>
                  <th className="py-2.5 px-3">SIDE</th>
                  <th className="py-2.5 px-3">QUANTITY</th>
                  <th className="py-2.5 px-3">EXECUTION PRICE</th>
                  <th className="py-2.5 px-3">REALIZED P&amp;L</th>
                  <th className="py-2.5 px-3">TIME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121d33]">
                {clientTrades.map(trd => (
                  <tr key={trd.id} className="hover:bg-[#0c1527] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">{trd.id}</td>
                    <td className="py-2.5 px-3 font-bold text-white">{trd.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                        {trd.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{trd.qty}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{trd.price}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{trd.pnl}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{trd.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* POSITIONS TAB */}
      {/* ======================================================== */}
      {activeTab === 'Positions' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Active Open Trading Positions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">SYMBOL</th>
                  <th className="py-2.5 px-3">SIDE</th>
                  <th className="py-2.5 px-3">QTY</th>
                  <th className="py-2.5 px-3">AVG PRICE</th>
                  <th className="py-2.5 px-3">LTP</th>
                  <th className="py-2.5 px-3">UNREALIZED P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121d33]">
                {clientPositions.map(pos => (
                  <tr key={pos.symbol} className="hover:bg-[#0c1527] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{pos.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                        {pos.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">{pos.qty}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{pos.avgPrice}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">{pos.ltp}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{pos.pnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* P&L TAB */}
      {/* ======================================================== */}
      {activeTab === 'P&L' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Trading Profit &amp; Loss Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-[11px] text-slate-400 block">Total Realized P&amp;L</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">+₹3,820</p>
            </div>
            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-[11px] text-slate-400 block">Win Ratio</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">100% (2/2)</p>
            </div>
            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-[11px] text-slate-400 block">Brokerage Paid</span>
              <p className="text-xl font-bold font-mono text-slate-300 mt-1">₹80.00</p>
            </div>
            <div className="p-3.5 bg-[#091122] border border-[#131e36] rounded-lg">
              <span className="text-[11px] text-slate-400 block">STT &amp; Govt Charges</span>
              <p className="text-xl font-bold font-mono text-slate-300 mt-1">₹34.50</p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACTIVITY TAB */}
      {/* ======================================================== */}
      {activeTab === 'Activity' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold text-white tracking-tight">Security &amp; Login Audit Trail</h2>
          <div className="space-y-2.5">
            <div className="p-3 bg-[#091122] border border-[#131e36] rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">Successful Mobile App Login</p>
                <span className="text-[11px] text-slate-400 font-mono">IP: 104.28.211.9 • iOS App v4.2</span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">Today at 09:12 AM</span>
            </div>
            <div className="p-3 bg-[#091122] border border-[#131e36] rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">Order Placed: RELIANCE.EQ (50 Qty)</p>
                <span className="text-[11px] text-slate-400 font-mono">Web Trading Terminal • Auth via 2FA</span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">2023-06-22 10:14 AM</span>
            </div>
            <div className="p-3 bg-[#091122] border border-[#131e36] rounded-lg flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200">KYC Verification Completed</p>
                <span className="text-[11px] text-slate-400 font-mono">Approved by Compliance Officer</span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">2023-04-03 04:30 PM</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Edit Client Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={clientData.name}
                  onChange={e => setClientData({ ...clientData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={clientData.email}
                  onChange={e => setClientData({ ...clientData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">Phone</label>
                <input
                  type="text"
                  value={clientData.phone}
                  onChange={e => setClientData({ ...clientData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200"
                />
              </div>
            </div>
            <div className="p-3.5 bg-[#080e1c] border-t border-[#162238] flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  notify(`Client ${clientData.name} updated successfully.`, 'success');
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
