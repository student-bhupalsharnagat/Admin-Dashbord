import React, { useState } from 'react';
import {
  TrendingUp,
  Coins,
  ShieldAlert,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  Zap
} from 'lucide-react';
import { Trade, Tenant } from '../types';

interface TradingMonitorViewProps {
  section: 'orders-trades' | 'commission' | 'risk';
  trades: Trade[];
  tenants: Tenant[];
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TradingMonitorView: React.FC<TradingMonitorViewProps> = ({
  section,
  trades,
  tenants,
  onNotify
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [tenantFilter, setTenantFilter] = useState('ALL');
  const [emergencyActive, setEmergencyActive] = useState(false);

  const filteredTrades = trades.filter(t => {
    const matchSearch =
      t.trade_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSide = sideFilter === 'ALL' || t.side === sideFilter;
    const matchTenant = tenantFilter === 'ALL' || t.tenant_id === tenantFilter;
    return matchSearch && matchSide && matchTenant;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d1527] border border-[#17233f] p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            {section === 'orders-trades' && <TrendingUp size={20} />}
            {section === 'commission' && <Coins size={20} className="text-amber-400" />}
            {section === 'risk' && <ShieldAlert size={20} className="text-rose-400" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {section === 'orders-trades' && 'Real-Time Orders & Trade Monitor'}
              {section === 'commission' && 'Central Commission Engine & Revenue Splits'}
              {section === 'risk' && 'Central Risk Management & Exposure Controls'}
            </h2>
            <p className="text-xs text-slate-400">
              {section === 'orders-trades' && 'Live trade stream across all active tenant exchanges'}
              {section === 'commission' && 'Master, Broker, Sub-Broker markup calculations and payouts'}
              {section === 'risk' && 'Real-time leverage monitoring, margin thresholds and emergency circuit controls'}
            </p>
          </div>
        </div>

        {section === 'risk' && (
          <button
            onClick={() => {
              setEmergencyActive(true);
              if (onNotify) {
                onNotify('Emergency Square-Off safeguards engaged for high-risk accounts', 'warning');
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold text-xs border border-rose-500/40 rounded-lg shadow-sm transition-colors"
          >
            <AlertTriangle size={14} className="text-rose-400" />
            {emergencyActive ? 'Safeguards Active' : 'Emergency Margin Square-off'}
          </button>
        )}
      </div>

      {/* Orders and Trades Tab */}
      {section === 'orders-trades' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search Trade ID, Client, Symbol..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#0d1527] border border-[#17233f] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
              <div className="flex items-center bg-[#0d1527] border border-[#17233f] p-0.5 rounded-lg">
                {(['ALL', 'BUY', 'SELL'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSideFilter(s)}
                    className={`px-3 py-1 rounded font-medium ${
                      sideFilter === s ? 'bg-[#2563eb] text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <select
                value={tenantFilter}
                onChange={e => setTenantFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#0d1527] border border-[#17233f] rounded-lg text-slate-200 focus:outline-none w-full sm:w-auto"
              >
                <option value="ALL">All Tenants</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Trade Table */}
          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[760px]">
                <thead>
                  <tr className="bg-[#0b1120] text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">TRADE ID</th>
                    <th className="py-3 px-4">CLIENT</th>
                    <th className="py-3 px-4">TENANT</th>
                    <th className="py-3 px-4">SYMBOL</th>
                    <th className="py-3 px-4">SIDE</th>
                    <th className="py-3 px-4">QUANTITY</th>
                    <th className="py-3 px-4">EXECUTION PRICE</th>
                    <th className="py-3 px-4 text-right">TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17233f]/60">
                  {filteredTrades.map(trade => (
                    <tr key={trade.id} className="hover:bg-[#111c34]">
                      <td className="py-3 px-4 font-mono font-bold text-blue-400">{trade.trade_id}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">{trade.client_name}</td>
                      <td className="py-3 px-4 text-slate-300">{trade.tenant_name}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">{trade.symbol}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            trade.side === 'BUY'
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${trade.side === 'BUY' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {trade.side}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{trade.quantity || 150}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">₹{trade.price.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">{trade.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Commission Management Tab */}
      {section === 'commission' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="lg:col-span-2 bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm">Tenant Commission Distribution Slabs</h3>
            <div className="space-y-3">
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Equities Intraday Turnover</div>
                  <div className="text-[11px] text-slate-400">Master: 40% • Broker: 30% • Sub-Broker: 20% • Platform: 10%</div>
                </div>
                <div className="font-mono text-emerald-400 font-bold text-sm">0.03% Volume</div>
              </div>
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Index Futures & Options</div>
                  <div className="text-[11px] text-slate-400">Flat ₹20 per executed order distributed up the downline</div>
                </div>
                <div className="font-mono text-blue-400 font-bold text-sm">₹20 / Lot</div>
              </div>
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Commodity Multi-Asset</div>
                  <div className="text-[11px] text-slate-400">Master: 50% • Broker: 25% • Sub-Broker: 15% • Platform: 10%</div>
                </div>
                <div className="font-mono text-amber-400 font-bold text-sm">0.025% Vol</div>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm">MTD Commission Accrual</h3>
            <div className="p-3 rounded-lg bg-[#111c34] border border-[#1c2c4d]">
              <div className="text-slate-400 text-[11px]">Total Platform Net Share</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">₹50,54,200</div>
              <div className="text-[11px] text-slate-400 mt-1">↑ 8.4% compared to last cycle</div>
            </div>
            <div className="space-y-2 pt-2 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Alpha Prime Capital:</span>
                <span className="font-mono font-bold">₹18.4L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Zenith Broking House:</span>
                <span className="font-mono font-bold">₹15.2L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Horizon Securities:</span>
                <span className="font-mono font-bold">₹11.8L</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Management Tab */}
      {section === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          <div className="lg:col-span-2 bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-white text-sm">Global Risk & Leverage Matrix</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl">
                <div className="text-slate-400 text-[11px]">Global Leverage Ceiling</div>
                <div className="text-lg font-bold text-white mt-1">5x Intraday (Cap)</div>
                <div className="text-slate-500 text-[10px] mt-1">Tenants cannot exceed without Super Admin authorization</div>
              </div>
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl">
                <div className="text-slate-400 text-[11px]">Margin Call Threshold</div>
                <div className="text-lg font-bold text-amber-400 mt-1">80% Margin Utilized</div>
                <div className="text-slate-500 text-[10px] mt-1">Sends immediate automated notification & SMS alert</div>
              </div>
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl">
                <div className="text-slate-400 text-[11px]">Auto Square-Off Trigger</div>
                <div className="text-lg font-bold text-rose-400 mt-1">90% Utilization</div>
                <div className="text-slate-500 text-[10px] mt-1">Risk engine automatically unwinds highest volatility legs</div>
              </div>
              <div className="p-3.5 bg-[#111c34] border border-[#1c2c4d] rounded-xl">
                <div className="text-slate-400 text-[11px]">Daily Max Loss Circuit</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">₹50,00,000 / Tenant</div>
                <div className="text-slate-500 text-[10px] mt-1">Freezes fresh long/short position executions</div>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm">High-Margin Alerts</h3>
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200">
              <div className="font-bold flex items-center justify-between">
                <span>BRK-101 (Vikas Shah)</span>
                <span className="font-mono text-xs">82%</span>
              </div>
              <div className="text-[11px] text-rose-300/80 mt-1">
                Approaching margin call. 12 clients in NIFTY index options.
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
              <div className="font-bold flex items-center justify-between">
                <span>CLT-004 (Deepa Menon)</span>
                <span className="font-mono text-xs">79%</span>
              </div>
              <div className="text-[11px] text-amber-300/80 mt-1">
                Single security exposure in BANKNIFTY exceeds 35% portfolio ratio.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
