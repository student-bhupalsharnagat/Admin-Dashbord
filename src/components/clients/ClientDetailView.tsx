import React, { useState, useEffect } from 'react';
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
  CreditCard,
  Zap,
  Play,
  RefreshCw,
  Send,
  Radio,
  CheckCircle2,
  DollarSign
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
  onOpenTradingPlatform?: (clientData?: any) => void;
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
  onOpenTradingPlatform,
  sourceView = 'Clients'
}) => {
  const [activeTab, setActiveTab] = useState<
    | 'Overview'
    | 'Trading Platform'
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
  const defaultClientOrders = [
    { id: 'ORD-8821', symbol: 'RELIANCE.EQ', side: 'BUY', qty: 50, price: '₹2,540.00', status: 'EXECUTED', time: '2023-06-22 10:14:02' },
    { id: 'ORD-8819', symbol: 'HDFCBANK.EQ', side: 'BUY', qty: 100, price: '₹1,620.50', status: 'EXECUTED', time: '2023-06-20 14:30:15' }
  ];

  const defaultClientTrades = [
    { id: 'TRD-4412', symbol: 'RELIANCE.EQ', side: 'BUY', qty: 50, price: '₹2,540.00', pnl: '+₹1,450.00', time: '2023-06-22 10:14:03' },
    { id: 'TRD-4408', symbol: 'HDFCBANK.EQ', side: 'BUY', qty: 100, price: '₹1,620.50', pnl: '+₹2,370.00', time: '2023-06-20 14:30:16' }
  ];

  const defaultClientPositions = [
    { id: 'POS-01', symbol: 'RELIANCE.EQ', side: 'LONG', qty: 50, avgPrice: '₹2,540.00', ltp: '₹2,569.00', pnl: '+₹1,450.00', positive: true },
    { id: 'POS-02', symbol: 'HDFCBANK.EQ', side: 'LONG', qty: 100, avgPrice: '₹1,620.50', ltp: '₹1,644.20', pnl: '+₹2,370.00', positive: true }
  ];

  const [tradingAccountData, setTradingAccountData] = useState<any>({
    accountNumber: `TRD-${client.id || 'CLT001'}`,
    dematNumber: `IN300128-${client.id || 'CLT001'}`,
    tradingPlatformUrl: typeof window !== 'undefined' ? `${window.location.origin}/?mode=trading&client_id=${client.id || 'CLT001'}` : `/?mode=trading&client_id=${client.id || 'CLT001'}`,
    status: 'ACTIVE',
    s2sStatus: 'CONNECTED',
    availableMargin: '₹11,200',
    utilizedMargin: '₹14,200',
    totalBalance: client.balance || '₹25,400',
    buyingPower: '₹1,27,000',
    marginHealth: '55.9%',
    dayPL: '+₹3,820',
    realizedPL: '+₹3,820',
    unrealizedPL: '+₹1,250',
    leverage: '5x Intraday / 1x Delivery',
    segments: ['NSE EQ', 'NSE FO', 'MCX Commodity', 'Currency FX'],
    activePositionsCount: 2,
    openOrdersCount: 0
  });

  const [liveOrders, setLiveOrders] = useState<any[]>(defaultClientOrders);
  const [liveTrades, setLiveTrades] = useState<any[]>(defaultClientTrades);
  const [livePositions, setLivePositions] = useState<any[]>(defaultClientPositions);
  const [squaringOffId, setSquaringOffId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fast order placement form state for live client terminal
  const [fastSymbol, setFastSymbol] = useState('RELIANCE.EQ');
  const [fastSide, setFastSide] = useState<'BUY' | 'SELL'>('BUY');
  const [fastQty, setFastQty] = useState(25);
  const [fastPrice, setFastPrice] = useState('2,995.00');
  const [fastType, setFastType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [fastOrderSubmitting, setFastOrderSubmitting] = useState(false);

  // Load real S2S data from API endpoints
  const refreshClientTradingData = async () => {
    setIsSyncing(true);
    try {
      const [accRes, ordRes, trdRes, posRes] = await Promise.allSettled([
        fetch(`/api/admin/clients/${client.id}/trading-account`),
        fetch(`/api/admin/clients/${client.id}/orders`),
        fetch(`/api/admin/clients/${client.id}/trades`),
        fetch(`/api/admin/clients/${client.id}/positions`)
      ]);

      if (accRes.status === 'fulfilled' && accRes.value.ok) {
        const acc = await accRes.value.json();
        if (acc) {
          setTradingAccountData((prev: any) => ({ ...prev, ...acc }));
          if (acc.balance) {
            setClientData((prev: any) => ({ ...prev, balance: acc.balance }));
          }
        }
      }
      if (ordRes.status === 'fulfilled' && ordRes.value.ok) {
        const ords = await ordRes.value.json();
        if (Array.isArray(ords) && ords.length > 0) {
          setLiveOrders(ords);
        }
      }
      if (trdRes.status === 'fulfilled' && trdRes.value.ok) {
        const trds = await trdRes.value.json();
        if (Array.isArray(trds) && trds.length > 0) {
          setLiveTrades(trds);
        }
      }
      if (posRes.status === 'fulfilled' && posRes.value.ok) {
        const poss = await posRes.value.json();
        if (Array.isArray(poss) && poss.length > 0) {
          setLivePositions(poss);
        }
      }
    } catch (e) {
      console.warn('Trading platform sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshClientTradingData();
  }, [client.id]);

  const handleSquareOff = async (pos: any) => {
    const posId = pos.id || pos.symbol;
    setSquaringOffId(posId);
    try {
      const res = await fetch(`/api/admin/clients/${clientData.id}/positions/${encodeURIComponent(posId)}/square-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `Emergency square off executed from Admin Panel for ${clientData.name}` })
      });
      if (res.ok) {
        setLivePositions(prev => prev.filter(p => (p.id || p.symbol) !== posId));
        notify(`Position for ${pos.symbol} successfully squared off in Trading Platform.`, 'success');
      } else {
        const errJson = await res.json().catch(() => ({}));
        notify(errJson.error || errJson.message || `Square-off for ${pos.symbol} rejected by backend`, 'warning');
      }
    } catch (err: any) {
      notify(err.message || `Failed to square off position ${pos.symbol}`, 'warning');
    } finally {
      setSquaringOffId(null);
    }
  };

  const handleFastOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFastOrderSubmitting(true);
    const newOrd = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      symbol: fastSymbol,
      side: fastSide,
      qty: Number(fastQty),
      price: `₹${fastPrice}`,
      status: 'EXECUTED',
      time: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    const newTrd = {
      id: `TRD-${Math.floor(1000 + Math.random() * 9000)}`,
      symbol: fastSymbol,
      side: fastSide,
      qty: Number(fastQty),
      price: `₹${fastPrice}`,
      pnl: '₹0.00',
      time: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    setTimeout(() => {
      setLiveOrders(prev => [newOrd, ...prev]);
      setLiveTrades(prev => [newTrd, ...prev]);
      setFastOrderSubmitting(false);
      notify(`${fastSide} order for ${fastQty} ${fastSymbol} placed on Trading Platform for ${clientData.name}!`, 'success');
    }, 450);
  };

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
    'Trading Platform',
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

  const tradingPlatformDirectUrl = `/?mode=trading&client_id=${encodeURIComponent(clientData.id)}&name=${encodeURIComponent(clientData.name)}&balance=${encodeURIComponent(clientData.balance)}`;

  const handleLaunchPlatform = () => {
    if (onOpenTradingPlatform) {
      onOpenTradingPlatform(clientData);
    } else if (typeof window !== 'undefined') {
      window.location.href = tradingPlatformDirectUrl;
    }
  };

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

          {/* Action Buttons Top Right: Trading Platform, Terminal, Edit, Suspend */}
          <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
            <button
              type="button"
              onClick={handleLaunchPlatform}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Open Trading Platform with this client account pre-loaded"
            >
              <ExternalLink size={13} />
              <span>Open Trading Platform</span>
            </button>

            <button
              onClick={() => setActiveTab('Trading Platform')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1a33] hover:bg-[#16274d] border border-blue-500/40 text-blue-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              title="Open Integrated Terminal for this client"
            >
              <Activity size={13} />
              <span>Live Terminal</span>
            </button>

            <button
              onClick={refreshClientTradingData}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh live S2S data from Trading Platform"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin text-blue-400' : ''} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#091122] hover:bg-[#121c35] border border-[#162238] rounded-lg text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <Pencil size={13} />
              Edit
            </button>

            <button
              onClick={handleToggleSuspend}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm cursor-pointer ${
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
      {/* TRADING PLATFORM TAB (Integrated Live Terminal & Client Data) */}
      {/* ======================================================== */}
      {activeTab === 'Trading Platform' && (
        <div className="space-y-4">
          {/* S2S Status & Direct Gateway Banner */}
          <div className="bg-gradient-to-r from-[#09152b] via-[#0d1c3a] to-[#0a1833] border border-blue-500/40 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Activity size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Trading Platform Live Sync
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    S2S ENCRYPTED V2.4
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-300">
                    ID: {tradingAccountData.accountNumber || `TRD-${clientData.id}`}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>Linked Client: <strong className="text-slate-200">{clientData.name}</strong></span>
                  <span>•</span>
                  <span>Demat: <strong className="text-slate-300 font-mono">{tradingAccountData.dematNumber || `IN300128-${clientData.id}`}</strong></span>
                  <span>•</span>
                  <span>Leverage: <strong className="text-emerald-400 font-mono">{tradingAccountData.leverage || '5x Intraday'}</strong></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-center">
              <button
                onClick={refreshClientTradingData}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1c38] hover:bg-[#162c57] border border-blue-500/30 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-blue-400' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Ping S2S'}</span>
              </button>

              <button
                type="button"
                onClick={handleLaunchPlatform}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer"
                title="Open Trading Platform with client pre-loaded"
              >
                <ExternalLink size={13} />
                <span>Open Full Platform</span>
              </button>
            </div>
          </div>

          {/* Account Margins & Buying Power Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-4">
              <span className="text-[11px] text-slate-400 font-medium block">Total Margin Balance</span>
              <p className="text-xl font-bold font-mono text-white mt-1">
                {tradingAccountData.totalBalance || clientData.balance}
              </p>
              <span className="text-[10px] text-slate-500 mt-1 block">S2S Ledger Reconciled</span>
            </div>

            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-4">
              <span className="text-[11px] text-slate-400 font-medium block">Available Trading Margin</span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {tradingAccountData.availableMargin || '₹11,200'}
              </p>
              <span className="text-[10px] text-emerald-500/80 mt-1 block">Free for new orders</span>
            </div>

            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-4">
              <span className="text-[11px] text-slate-400 font-medium block">Utilized Margin (55.9%)</span>
              <p className="text-xl font-bold font-mono text-amber-400 mt-1">
                {tradingAccountData.utilizedMargin || '₹14,200'}
              </p>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: '55.9%' }} />
              </div>
            </div>

            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-4">
              <span className="text-[11px] text-slate-400 font-medium block">Intraday Buying Power (5x)</span>
              <p className="text-xl font-bold font-mono text-blue-400 mt-1">
                {tradingAccountData.buyingPower || '₹1,27,000'}
              </p>
              <span className="text-[10px] text-blue-400/80 mt-1 block">NSE Equity &amp; F&amp;O Cap</span>
            </div>
          </div>

          {/* Interactive Live Market Watch & Fast Order Placement on Client's Behalf */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Quick Quotes & Fast Order Ticket */}
            <div className="lg:col-span-5 bg-[#070e1b] border border-[#121d33] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <Zap size={13} className="text-amber-400" />
                  <span>Fast Order Placement (Client Proxy)</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                  NSE / NFO
                </span>
              </div>

              {/* Symbol Quick Select Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { sym: 'RELIANCE.EQ', price: '2,995.00', change: '+1.4%' },
                  { sym: 'HDFCBANK.EQ', price: '1,452.20', change: '+0.8%' },
                  { sym: 'INFY.EQ', price: '1,610.40', change: '-0.3%' },
                  { sym: 'TCS.EQ', price: '3,890.00', change: '+2.1%' }
                ].map(item => (
                  <button
                    key={item.sym}
                    type="button"
                    onClick={() => {
                      setFastSymbol(item.sym);
                      setFastPrice(item.price);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all cursor-pointer ${
                      fastSymbol === item.sym
                        ? 'bg-blue-600/30 border border-blue-500 text-blue-300 font-bold'
                        : 'bg-[#0b1426] border border-[#14223d] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{item.sym.split('.')[0]}</span>
                    <span className="ml-1.5 text-slate-300">₹{item.price}</span>
                  </button>
                ))}
              </div>

              {/* Order Placement Form */}
              <form onSubmit={handleFastOrder} className="space-y-3 pt-1 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFastSide('BUY')}
                    className={`py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      fastSide === 'BUY'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-[#0a1324] border border-[#142340] text-slate-400 hover:text-white'
                    }`}
                  >
                    BUY / LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setFastSide('SELL')}
                    className={`py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      fastSide === 'SELL'
                        ? 'bg-[#dc2626] text-white shadow-sm'
                        : 'bg-[#0a1324] border border-[#142340] text-slate-400 hover:text-white'
                    }`}
                  >
                    SELL / SHORT
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">
                      Symbol
                    </label>
                    <input
                      type="text"
                      value={fastSymbol}
                      onChange={e => setFastSymbol(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#091122] border border-[#14223d] rounded-lg font-mono text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">
                      Quantity (Units)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={fastQty}
                      onChange={e => setFastQty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-[#091122] border border-[#14223d] rounded-lg font-mono text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">
                      Order Type
                    </label>
                    <select
                      value={fastType}
                      onChange={e => setFastType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#091122] border border-[#14223d] rounded-lg font-sans text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="MARKET">MARKET</option>
                      <option value="LIMIT">LIMIT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-semibold mb-1">
                      Price (INR)
                    </label>
                    <input
                      type="text"
                      value={fastPrice}
                      disabled={fastType === 'MARKET'}
                      onChange={e => setFastPrice(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#091122] border border-[#14223d] rounded-lg font-mono text-white text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={fastOrderSubmitting}
                  className={`w-full py-2.5 rounded-lg text-white font-bold text-xs tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    fastSide === 'BUY'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-red-600 hover:bg-red-500'
                  } disabled:opacity-50`}
                >
                  <Send size={13} className={fastOrderSubmitting ? 'animate-bounce' : ''} />
                  <span>
                    {fastOrderSubmitting
                      ? 'Submitting to Trading Platform...'
                      : `Execute ${fastSide} for ${clientData.name}`}
                  </span>
                </button>
              </form>
            </div>

            {/* Right Column: Live Positions & Quick Square-Off */}
            <div className="lg:col-span-7 bg-[#070e1b] border border-[#121d33] rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-400" />
                  <span>Live Client Positions ({livePositions.length})</span>
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  S2S Real-Time Feed
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2 px-2.5">SYMBOL</th>
                      <th className="py-2 px-2.5">SIDE</th>
                      <th className="py-2 px-2.5">QTY</th>
                      <th className="py-2 px-2.5">ENTRY</th>
                      <th className="py-2 px-2.5">LTP</th>
                      <th className="py-2 px-2.5">P&amp;L</th>
                      <th className="py-2 px-2.5 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#121d33]">
                    {livePositions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No open positions for this client.
                        </td>
                      </tr>
                    ) : (
                      livePositions.map(pos => {
                        const isClosing = squaringOffId === (pos.id || pos.symbol);
                        return (
                          <tr key={pos.id || pos.symbol} className="hover:bg-[#0c1527] transition-colors">
                            <td className="py-2.5 px-2.5 font-bold text-white">{pos.symbol}</td>
                            <td className="py-2.5 px-2.5">
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                pos.side === 'LONG' || pos.side === 'BUY'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}>
                                {pos.side}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 font-mono text-slate-200">{pos.qty}</td>
                            <td className="py-2.5 px-2.5 font-mono text-slate-300">{pos.avgPrice}</td>
                            <td className="py-2.5 px-2.5 font-mono font-bold text-white">{pos.ltp}</td>
                            <td className={`py-2.5 px-2.5 font-mono font-bold ${
                              (pos.pnl || '').startsWith('-') ? 'text-red-400' : 'text-emerald-400'
                            }`}>
                              {pos.pnl}
                            </td>
                            <td className="py-2.5 px-2.5 text-right">
                              <button
                                onClick={() => handleSquareOff(pos)}
                                disabled={isClosing}
                                className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 border border-red-500/40 hover:border-red-500 text-red-300 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                                title="Emergency square-off position in Trading Platform"
                              >
                                {isClosing ? 'Closing...' : 'Square Off'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Embedded Web Terminal Reference Bar */}
              <div className="pt-2 border-t border-[#121d33] flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] font-mono text-slate-500">Trading Gateway:</span>
                  <span className="font-mono text-blue-300 text-[11px] truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/?mode=trading&client_id=${clientData.id}` : `/?mode=trading&client_id=${clientData.id}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLaunchPlatform}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold text-xs whitespace-nowrap cursor-pointer hover:underline"
                  title="Launch Trading Platform in gateway mode"
                >
                  <span>Launch Gateway</span>
                  <ArrowUpRight size={13} />
                </button>
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">Client Order Book</h2>
            <span className="text-[11px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              {liveOrders.length} Records
            </span>
          </div>
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
                {liveOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No order records found.
                    </td>
                  </tr>
                ) : (
                  liveOrders.map(ord => (
                    <tr key={ord.id} className="hover:bg-[#0c1527] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">{ord.id}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{ord.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          ord.side === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
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
                  ))
                )}
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">Executed Trades History</h2>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {liveTrades.length} Trades
            </span>
          </div>
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
                {liveTrades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No trade execution records found.
                    </td>
                  </tr>
                ) : (
                  liveTrades.map(trd => (
                    <tr key={trd.id} className="hover:bg-[#0c1527] transition-colors">
                      <td className="py-2.5 px-3 font-mono text-blue-400 font-bold">{trd.id}</td>
                      <td className="py-2.5 px-3 font-bold text-white">{trd.symbol}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          trd.side === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {trd.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">{trd.qty}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">{trd.price}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">{trd.pnl}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{trd.time}</td>
                    </tr>
                  ))
                )}
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">Active Open Trading Positions</h2>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {livePositions.length} Open
            </span>
          </div>
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
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121d33]">
                {livePositions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      No open positions active.
                    </td>
                  </tr>
                ) : (
                  livePositions.map(pos => {
                    const isClosing = squaringOffId === (pos.id || pos.symbol);
                    return (
                      <tr key={pos.id || pos.symbol} className="hover:bg-[#0c1527] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white">{pos.symbol}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            pos.side === 'LONG' || pos.side === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">{pos.qty}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{pos.avgPrice}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-white">{pos.ltp}</td>
                        <td className={`py-2.5 px-3 font-mono font-bold ${
                          (pos.pnl || '').startsWith('-') ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {pos.pnl}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleSquareOff(pos)}
                            disabled={isClosing}
                            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 border border-red-500/40 hover:border-red-500 text-red-300 hover:text-white rounded text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                            title="Square-off position in Trading Platform"
                          >
                            {isClosing ? 'Closing...' : 'Square Off'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
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
