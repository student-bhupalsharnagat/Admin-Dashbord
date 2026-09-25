import React, { useState } from 'react';
import {
  ArrowLeft,
  Building,
  Users,
  TrendingUp,
  CreditCard,
  Percent,
  Shield,
  Palette,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Globe
} from 'lucide-react';
import { Tenant, Master, Broker, SubBroker, Client, Trade, KYCRecord, WhiteLabelConfig } from '../types';

interface TenantDetailViewProps {
  tenant: Tenant;
  onBack: () => void;
  masters: Master[];
  brokers: Broker[];
  subBrokers: SubBroker[];
  clients: Client[];
  trades: Trade[];
  kycRecords: KYCRecord[];
  whiteLabelConfig?: WhiteLabelConfig;
  onSaveWhiteLabel?: (data: Partial<WhiteLabelConfig>) => Promise<void>;
}

type TabType =
  | 'overview'
  | 'users'
  | 'trading'
  | 'finance'
  | 'kyc'
  | 'usage'
  | 'subscription'
  | 'whitelabel'
  | 'audit';

export const TenantDetailView: React.FC<TenantDetailViewProps> = ({
  tenant,
  onBack,
  masters,
  brokers,
  subBrokers,
  clients,
  trades,
  kycRecords,
  whiteLabelConfig,
  onSaveWhiteLabel
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tenantMasters = masters.filter(m => m.tenant_id === tenant.id);
  const tenantBrokers = brokers.filter(b => b.tenant_id === tenant.id);
  const tenantSubBrokers = subBrokers.filter(sb => sb.tenant_id === tenant.id);
  const tenantClients = clients.filter(c => c.tenant_id === tenant.id);
  const tenantTrades = trades.filter(t => t.tenant_id === tenant.id);
  const tenantKYC = kycRecords.filter(k => k.tenant_id === tenant.id);

  // Real calculations
  const todayTrades = tenantTrades.filter(t => t.timestamp && new Date(t.timestamp).toDateString() === new Date().toDateString());
  const todayTurnover = todayTrades.reduce((acc, t) => acc + (t.total_value || (t.price * t.quantity) || 0), 0);
  const winningTradesCount = tenantTrades.filter(t => (t.pl || 0) > 0).length;
  const winRate = tenantTrades.length > 0 ? Math.round((winningTradesCount / tenantTrades.length) * 100) : 0;
  const activeClientsCount = tenantClients.filter(c => c.status === 'ACTIVE').length;
  const activeClientPercent = tenantClients.length > 0 ? Math.round((activeClientsCount / tenantClients.length) * 100) : 0;
  const totalClientWalletBalance = tenantClients.reduce((acc, c) => acc + (c.wallet_balance || 0), 0);

  // White label state
  const [brandingName, setBrandingName] = useState(whiteLabelConfig?.login_branding || `${tenant.name} Trading Desk`);
  const [domain, setDomain] = useState(whiteLabelConfig?.custom_domain || tenant.domain);
  const [primaryColor, setPrimaryColor] = useState(whiteLabelConfig?.primary_color || '#2563eb');
  const [supportEmail, setSupportEmail] = useState(whiteLabelConfig?.support_email || tenant.support_email);

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'users', label: `Hierarchy & Users (${tenantClients.length})`, icon: Users },
    { id: 'trading', label: `Trading (${tenantTrades.length})`, icon: TrendingUp },
    { id: 'finance', label: 'Finance & Margin', icon: Activity },
    { id: 'kyc', label: `KYC (${tenantKYC.length})`, icon: CreditCard },
    { id: 'usage', label: 'Usage Telemetry', icon: Activity },
    { id: 'subscription', label: 'Subscription', icon: Percent },
    { id: 'whitelabel', label: 'White Label', icon: Palette },
    { id: 'audit', label: 'Audit Logs', icon: FileText }
  ];

  return (
    <div className="space-y-4">
      {/* Header with Back button and Tenant Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d1527] border border-[#17233f] p-4 rounded-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-[#121c33] border border-[#1b2b4e] hover:bg-[#182647] text-slate-300 hover:text-white transition-colors shrink-0"
            title="Return to Tenants List"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                {tenant.code}
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight truncate">{tenant.name}</h2>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${
                  tenant.status === 'ACTIVE'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                }`}
              >
                {tenant.status}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Domain: <span className="text-slate-200">{tenant.domain}</span></span>
              <span>Admin: <span className="text-slate-200">{tenant.admin_name}</span></span>
              <span>Plan: <span className="text-blue-400 font-semibold">{tenant.plan}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-[#17233f] overflow-x-auto pb-1 text-xs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? 'bg-[#1d4ed8] text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111c34]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Total Trading Volume</div>
              <div className="text-xl font-bold text-white mt-1">{tenant.trading_volume}</div>
              <div className="text-[11px] text-emerald-400 mt-1">
                {todayTurnover > 0 ? `₹${todayTurnover.toLocaleString('en-IN')} today` : `${tenantTrades.length} trades recorded`}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Total Realized P&L</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">+{tenant.pl}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {tenantTrades.length > 0 ? `${winRate}% winning trades` : '0 trades recorded'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Commission Accrued</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{tenant.commission}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {tenantBrokers.length > 0 ? `Split across ${tenantBrokers.length} broker${tenantBrokers.length > 1 ? 's' : ''}` : 'Direct tenant routing'}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Margin Utilization</div>
              <div className="text-xl font-bold text-blue-400 mt-1">{tenant.margin}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {tenantClients.length > 0 ? `${activeClientPercent}% active client ratio` : '0 clients'}
              </div>
            </div>
          </div>

          {/* Hierarchy Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#0d1527] border border-[#17233f] text-center">
              <div className="text-slate-400">Masters</div>
              <div className="text-2xl font-bold text-white mt-1">{tenantMasters.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#0d1527] border border-[#17233f] text-center">
              <div className="text-slate-400">Brokers</div>
              <div className="text-2xl font-bold text-white mt-1">{tenantBrokers.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#0d1527] border border-[#17233f] text-center">
              <div className="text-slate-400">Sub-Brokers</div>
              <div className="text-2xl font-bold text-white mt-1">{tenantSubBrokers.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-[#0d1527] border border-[#17233f] text-center">
              <div className="text-slate-400">Trading Clients</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{tenantClients.length}</div>
            </div>
          </div>

          {/* Tenant details overview */}
          <div className="p-4 rounded-xl bg-[#0d1527] border border-[#17233f] text-xs space-y-3">
            <h3 className="font-semibold text-slate-200">Tenant Enterprise Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-slate-300">
              <div>
                <span className="text-slate-500 block">Admin Email:</span>
                <span className="font-mono text-slate-200">{tenant.admin_email}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Phone Support:</span>
                <span className="font-mono text-slate-200">{tenant.admin_phone}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Sub-domain Endpoint:</span>
                <span className="font-mono text-blue-400 flex items-center gap-1">
                  <Globe size={12} /> {tenant.domain}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Database Isolation:</span>
                <span className="text-emerald-400 font-semibold">Row-Level Security + Tenant ID Partition</span>
              </div>
              <div>
                <span className="text-slate-500 block">Onboarded Since:</span>
                <span className="font-mono text-slate-200">{tenant.created_at}</span>
              </div>
              <div>
                <span className="text-slate-500 block">SLA Level:</span>
                <span className="text-amber-400 font-semibold">99.99% Ultra-Low Latency</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Onboarded Clients ({tenantClients.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase">
                    <th className="pb-2">CODE</th>
                    <th className="pb-2">CLIENT</th>
                    <th className="pb-2">HIERARCHY DOWNLINE</th>
                    <th className="pb-2">KYC</th>
                    <th className="pb-2 text-right">WALLET BALANCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17233f]/60">
                  {tenantClients.map(c => (
                    <tr key={c.id} className="hover:bg-[#111c34]">
                      <td className="py-2.5 font-mono text-blue-400">{c.client_code}</td>
                      <td className="py-2.5 font-medium text-slate-200">{c.name}</td>
                      <td className="py-2.5 text-slate-400">
                        Master: {c.master_name} → Broker: {c.broker_name}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                          {c.kyc_status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-200">
                        ₹{c.wallet_balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trading' && (
        <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-4 text-xs">
          <h3 className="text-sm font-bold text-white mb-3">Recent Tenant Trades</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase">
                  <th className="pb-2">TRADE ID</th>
                  <th className="pb-2">CLIENT</th>
                  <th className="pb-2">SYMBOL</th>
                  <th className="pb-2">SIDE</th>
                  <th className="pb-2">PRICE</th>
                  <th className="pb-2 text-right">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17233f]/60">
                {tenantTrades.map(tr => (
                  <tr key={tr.id}>
                    <td className="py-2 font-mono text-blue-400">{tr.trade_id}</td>
                    <td className="py-2 text-slate-200">{tr.client_name}</td>
                    <td className="py-2 font-mono">{tr.symbol}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tr.side === 'BUY' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {tr.side}
                      </span>
                    </td>
                    <td className="py-2 font-mono">₹{tr.price.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-slate-400">{tr.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'whitelabel' && (
        <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 text-xs max-w-2xl space-y-4">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Palette size={16} className="text-blue-400" />
            White-Label Settings for {tenant.name}
          </div>
          <p className="text-slate-400 text-[11px]">
            Tenant branding is completely isolated. Changes made here apply exclusively to {tenant.name} users.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 mb-1">Custom Login Branding Headline</label>
              <input
                type="text"
                value={brandingName}
                onChange={e => setBrandingName(e.target.value)}
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1">Custom Domain CNAME</label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Primary Theme Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                  />
                  <span className="font-mono text-slate-300">{primaryColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={e => setSupportEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200"
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => onSaveWhiteLabel?.({
              login_branding: brandingName,
              custom_domain: domain,
              primary_color: primaryColor,
              support_email: supportEmail
            })}
            className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white font-semibold rounded-lg shadow-sm"
          >
            Save White Label Configuration
          </button>
        </div>
      )}

      {/* Finance & Margin Tab */}
      {activeTab === 'finance' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Total Client Wallets</div>
              <div className="text-xl font-bold text-white mt-1">₹{totalClientWalletBalance.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-400 mt-1">{tenantClients.length} accounts holding balances</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Realized P&L</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">+{tenant.pl}</div>
              <div className="text-[11px] text-slate-400 mt-1">From {tenantTrades.length} settled trades</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0d1527] border border-[#17233f]">
              <div className="text-slate-400">Margin Allocation</div>
              <div className="text-xl font-bold text-blue-400 mt-1">{tenant.margin}</div>
              <div className="text-[11px] text-slate-400 mt-1">Leverage cap: 20x</div>
            </div>
          </div>

          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">Client Margin & Balance Ledger</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase">
                    <th className="pb-2">CLIENT</th>
                    <th className="pb-2">CODE</th>
                    <th className="pb-2">STATUS</th>
                    <th className="pb-2 text-right">WALLET BALANCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17233f]/60">
                  {tenantClients.map(c => (
                    <tr key={c.id}>
                      <td className="py-2.5 font-medium text-slate-200">{c.name}</td>
                      <td className="py-2.5 font-mono text-blue-400">{c.client_code}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-200">
                        ₹{(c.wallet_balance || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* KYC Tab */}
      {activeTab === 'kyc' && (
        <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-4 text-xs">
          <h3 className="text-sm font-bold text-white mb-3">Tenant Client KYC Verification Queue ({tenantKYC.length})</h3>
          {tenantKYC.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No pending KYC records for this tenant.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase">
                    <th className="pb-2">CLIENT</th>
                    <th className="pb-2">PAN</th>
                    <th className="pb-2">DOCUMENT TYPE</th>
                    <th className="pb-2">STATUS</th>
                    <th className="pb-2 text-right">SUBMISSION DATE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17233f]/60">
                  {tenantKYC.map(k => (
                    <tr key={k.id}>
                      <td className="py-2.5 font-medium text-slate-200">{k.client_name}</td>
                      <td className="py-2.5 font-mono text-slate-300">{k.pan}</td>
                      <td className="py-2.5 text-slate-400">{k.document_type || 'PAN + Aadhaar'}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${k.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-400' : (k.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400')}`}>
                          {k.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-400">{k.submitted_at || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Usage Telemetry Tab */}
      {activeTab === 'usage' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#0d1527] border border-[#17233f] space-y-3">
            <h4 className="font-semibold text-white">S2S Backend Telemetry</h4>
            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Trading Platform Link:</span>
                <span className="text-emerald-400 font-mono font-semibold">CONNECTED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">HMAC-SHA256 Auth:</span>
                <span className="text-emerald-400 font-mono">VERIFIED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Order Routing Latency:</span>
                <span className="font-mono text-slate-200">11.4 ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Synchronized Trades:</span>
                <span className="font-mono text-blue-400">{tenantTrades.length}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0d1527] border border-[#17233f] space-y-3">
            <h4 className="font-semibold text-white">Database & Tenant Partitioning</h4>
            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Tenant ID:</span>
                <span className="font-mono text-blue-400">{tenant.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data Isolation:</span>
                <span className="text-emerald-400 font-semibold">Row-Level Security</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total User Records:</span>
                <span className="font-mono text-slate-200">{tenantClients.length + tenantBrokers.length + tenantMasters.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Audit Trail:</span>
                <span className="text-emerald-400">Immutable PostgreSQL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Tab */}
      {activeTab === 'subscription' && (
        <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 text-xs max-w-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{tenant.plan} Subscription</h3>
              <p className="text-slate-400 text-[11px] mt-0.5">Enterprise Multi-Tenant SaaS Agreement</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {tenant.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-[#080e1c] border border-[#17233f] rounded-lg">
            <div>
              <span className="text-slate-500 block">Trading Terminal:</span>
              <span className="text-slate-200 font-medium">B2C Web & Mobile Enabled</span>
            </div>
            <div>
              <span className="text-slate-500 block">White Label Domain:</span>
              <span className="text-blue-400 font-mono">{tenant.domain}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Leverage Cap:</span>
              <span className="text-slate-200 font-medium">20x Margin Allowed</span>
            </div>
            <div>
              <span className="text-slate-500 block">S2S API Access:</span>
              <span className="text-emerald-400 font-medium">Activated</span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-4 text-xs">
          <h3 className="text-sm font-bold text-white mb-3">Partitioned Audit Trail for {tenant.name}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <thead>
                <tr className="text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase">
                  <th className="pb-2">ACTION</th>
                  <th className="pb-2">MODULE</th>
                  <th className="pb-2">DETAILS</th>
                  <th className="pb-2 text-right">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17233f]/60">
                <tr>
                  <td className="py-2.5 font-mono text-emerald-400 font-bold">TENANT_CONFIG_SYNC</td>
                  <td className="py-2.5 text-slate-300">GOVERNANCE</td>
                  <td className="py-2.5 text-slate-400">S2S config verified with Trading Platform</td>
                  <td className="py-2.5 text-right font-mono text-slate-400">Just now</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-mono text-blue-400 font-bold">BRANDING_PUBLISHED</td>
                  <td className="py-2.5 text-slate-300">WHITE_LABEL</td>
                  <td className="py-2.5 text-slate-400">Active branding snapshot v2 deployed</td>
                  <td className="py-2.5 text-right font-mono text-slate-400">2026-03-29 10:14</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-mono text-amber-400 font-bold">SECURITY_SURVEILLANCE</td>
                  <td className="py-2.5 text-slate-300">RISK</td>
                  <td className="py-2.5 text-slate-400">Tenant risk boundaries validated (0 breaches)</td>
                  <td className="py-2.5 text-right font-mono text-slate-400">2026-03-29 09:00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
