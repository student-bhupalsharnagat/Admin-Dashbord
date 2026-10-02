import React, { useState } from 'react';
import {
  Crown,
  Building2,
  Users,
  Network,
  TrendingUp,
  BarChart3,
  DollarSign,
  Coins,
  Activity,
  Calendar,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import {
  DashboardKPIs,
  Trade,
  KYCRecord
} from '../types';
import { KPICard } from '../components/dashboard/KPICard';
import { PendingAlertsStrip } from '../components/dashboard/PendingAlertsStrip';
import { TradingVolumeRevenueChart } from '../components/dashboard/TradingVolumeRevenueChart';
import { AssetAllocationDonutChart } from '../components/dashboard/AssetAllocationDonutChart';
import { NewClientRegistrationsChart } from '../components/dashboard/NewClientRegistrationsChart';
import { DashboardQuickActions } from '../components/dashboard/DashboardQuickActions';
import { RecentTradesCard } from '../components/dashboard/RecentTradesCard';
import { RecentRegistrationsCard } from '../components/dashboard/RecentRegistrationsCard';
import { NavigationTab } from '../components/layout/AdminSidebar';

export interface DashboardViewProps {
  kpis?: DashboardKPIs | null;
<<<<<<< HEAD
  clients?: any[];
=======
  hasError?: boolean;
  errorMessage?: string;
>>>>>>> 3eb279a3a987a5596e31a324551957d91f2feb92
  volumeCommissionData?: any;
  clientGrowthData?: any;
  dailyPLData?: any;
  dailyPLBadge?: string;
  recentTrades: Trade[];
  pendingKYC: KYCRecord[];
  onNavigateTab: (tab: NavigationTab) => void;
  onNavigateFunds?: (tab: 'deposits' | 'withdrawals', status?: string) => void;
  onCreateMaster: () => void;
  onCreateBroker: () => void;
  onAddClient: () => void;
  onReviewKYC: (kyc?: KYCRecord) => void;
  onSelectTrade: (trade: Trade) => void;
  onRefresh?: () => Promise<void> | void;
}

const DEFAULT_UNAVAILABLE_KPIS: DashboardKPIs = {
  total_masters: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  total_brokers: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  total_sub_brokers: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  total_clients: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  commission_earned: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  todays_turnover: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  total_turnover: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  total_pl: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  net_pl: { value: '—', badge: 'Offline', subtitle: 'Telemetry unavailable' },
  pending_kyc: { value: 0, subtitle: 'Telemetry unavailable' },
  open_tickets: { value: 0, subtitle: 'Telemetry unavailable' }
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
<<<<<<< HEAD
  clients,
=======
  hasError,
  errorMessage,
>>>>>>> 3eb279a3a987a5596e31a324551957d91f2feb92
  volumeCommissionData,
  clientGrowthData,
  dailyPLData,
  dailyPLBadge,
  recentTrades,
  pendingKYC,
  onNavigateTab,
  onNavigateFunds,
  onCreateMaster,
  onCreateBroker,
  onAddClient,
  onReviewKYC,
  onSelectTrade,
  onRefresh
}) => {
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [timeRange, setTimeRange] = useState<'Today' | '7D' | '30D' | 'YTD' | 'All'>('30D');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currencySymbol = currency === 'USD' ? '$' : '₹';
  const activeKpis = kpis !== null && kpis !== undefined ? kpis : DEFAULT_UNAVAILABLE_KPIS;
  const isUnavailable = kpis === null || hasError;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.warn('Dashboard telemetry refresh error:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Error Alert State if Dashboard API failed */}
      {isUnavailable && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-3 flex items-center justify-between text-xs text-red-200 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <div>
              <span className="font-bold text-red-100">Live Telemetry Unavailable: </span>
              <span className="text-red-300">
                {errorMessage || 'Unable to connect to PostgreSQL live telemetry. Financial KPIs and projections are safely suppressed to prevent displaying inaccurate figures.'}
              </span>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded-lg font-medium transition-colors cursor-pointer shrink-0 ml-3"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Dashboard Subheader Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0b1325] border border-[#16233d] rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isUnavailable ? 'bg-red-400' : 'bg-emerald-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isUnavailable ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Admin Overview</h2>
              {!isUnavailable ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono">
                  LIVE 12ms
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-semibold font-mono flex items-center gap-1">
                  UNAVAILABLE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Multi-tenant liquidity pool & downline clearing
            </p>
          </div>
        </div>

        {/* Right Controls: Currency Switcher + Timeframe Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Currency Toggle */}
          <div className="flex items-center bg-[#090f1f] border border-[#16233d] rounded-lg p-0.5">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                currency === 'USD'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              $ USD
            </button>
            <button
              onClick={() => setCurrency('INR')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                currency === 'INR'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ₹ INR
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="hidden md:flex items-center bg-[#090f1f] border border-[#16233d] rounded-lg p-0.5 text-xs font-medium text-slate-400">
            {(['Today', '7D', '30D', 'YTD', 'All'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTimeRange(tab)}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  timeRange === tab
                    ? 'bg-[#15233f] text-white font-semibold'
                    : 'hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Refresh dashboard telemetry"
            className="p-1.5 rounded-lg bg-[#090f1f] border border-[#16233d] text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* Row 1: Primary Entity Metrics (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <KPICard
          title="TOTAL MASTERS"
          value={activeKpis.total_masters?.value ?? 0}
          subtitle={activeKpis.total_masters?.subtitle || 'Across all regions'}
          icon={Crown}
          iconColor="text-blue-400"
          iconBg="bg-blue-950/60"
          onClick={() => onNavigateTab('masters')}
        />

        <KPICard
          title="TOTAL BROKERS"
          value={activeKpis.total_brokers?.value ?? 0}
          subtitle={activeKpis.total_brokers?.subtitle || 'Active brokers'}
          icon={Building2}
          iconColor="text-purple-400"
          iconBg="bg-purple-950/60"
          onClick={() => onNavigateTab('brokers')}
        />

        <KPICard
          title="SUB-BROKERS"
          value={activeKpis.total_sub_brokers?.value ?? 0}
          subtitle={activeKpis.total_sub_brokers?.subtitle || 'Sub-Brokers'}
          icon={Network}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-950/60"
          onClick={() => onNavigateTab('sub-brokers')}
        />

        <KPICard
          title="TOTAL CLIENTS"
          value={typeof activeKpis.total_clients?.value === 'number' ? activeKpis.total_clients.value.toLocaleString() : (activeKpis.total_clients?.value ?? '0')}
          subtitle={activeKpis.total_clients?.subtitle || 'Registered accounts'}
          icon={Users}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-950/60"
          onClick={() => onNavigateTab('clients')}
        />
      </div>

      {/* Row 2: Financial Metrics (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <KPICard
          title="TODAY'S TURNOVER"
          value={activeKpis.todays_turnover?.value || '₹0'}
          subtitle={activeKpis.todays_turnover?.subtitle || 'Today'}
          icon={TrendingUp}
          iconColor="text-amber-400"
          iconBg="bg-amber-950/60"
          onClick={() => onNavigateTab('trades')}
        />

        <KPICard
          title="TOTAL TURNOVER"
          value={activeKpis.total_turnover?.value || activeKpis.todays_turnover?.value || '₹0'}
          subtitle={activeKpis.total_turnover?.subtitle || 'Total Executed'}
          icon={BarChart3}
          iconColor="text-blue-400"
          iconBg="bg-blue-950/60"
          onClick={() => onNavigateTab('trades')}
        />

        <KPICard
          title="NET P&L"
          value={activeKpis.net_pl?.value || activeKpis.total_pl?.value || '₹0'}
          subtitle={activeKpis.net_pl?.subtitle || activeKpis.total_pl?.subtitle || 'Unrealized + Realized'}
          icon={DollarSign}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-950/60"
          onClick={() => onNavigateTab('trades')}
        />

        <KPICard
          title="COMMISSION EARNED"
          value={activeKpis.commission_earned?.value ? `${activeKpis.commission_earned.value}` : '₹0'}
          subtitle={activeKpis.commission_earned?.subtitle || 'Actual rules'}
          icon={Coins}
          iconColor="text-purple-400"
          iconBg="bg-purple-950/60"
          onClick={() => onNavigateTab('commission')}
        />
      </div>

      {/* Row 3: Pending Status Strip */}
      <PendingAlertsStrip
        pendingKYC={Number(activeKpis.pending_kyc?.value) || 0}
        pendingDeposits={Number(activeKpis.pending_deposits?.value) || 0}
        pendingWithdrawals={Number(activeKpis.pending_withdrawals?.value) || 0}
        openTickets={Number(activeKpis.open_tickets?.value) || 0}
        onNavigateKYC={() => onNavigateTab('kyc')}
        onNavigateDeposits={() => {
          if (onNavigateFunds) {
            onNavigateFunds('deposits', 'PENDING');
          } else {
            onNavigateTab('funds');
          }
        }}
        onNavigateWithdrawals={() => {
          if (onNavigateFunds) {
            onNavigateFunds('withdrawals', 'PENDING');
          } else {
            onNavigateTab('funds');
          }
        }}
        onNavigateTickets={() => onNavigateTab('support')}
      />

      {/* Row 4: Trading Volume & Revenue + Asset Allocation Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TradingVolumeRevenueChart data={volumeCommissionData} />
        </div>
        <div className="lg:col-span-1">
          <AssetAllocationDonutChart />
        </div>
      </div>

      {/* Row 5: New Client Registrations + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <NewClientRegistrationsChart />
        </div>
        <div className="lg:col-span-1">
          <DashboardQuickActions
            onCreateMaster={onCreateMaster}
            onCreateBroker={onCreateBroker}
            onAddClient={onAddClient}
            onReviewKYC={() => onReviewKYC()}
            onViewReports={() => onNavigateTab('reports')}
          />
        </div>
      </div>

      {/* Row 6: Recent Trades Table */}
      <RecentTradesCard
        trades={recentTrades}
        currencySymbol={currencySymbol}
        onViewAll={() => onNavigateTab('trades')}
        onSelectTrade={trade => {
          if (onSelectTrade) {
            onSelectTrade(trade);
          } else {
            onNavigateTab('trades');
          }
        }}
      />

      {/* Row 7: Recent Registrations Table */}
      <RecentRegistrationsCard
        clients={clients}
        currencySymbol={currencySymbol}
        onViewAll={() => onNavigateTab('clients')}
        onSelectClient={() => onNavigateTab('clients')}
      />
    </div>
  );
};
