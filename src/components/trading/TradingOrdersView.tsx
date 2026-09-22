import React, { useState } from 'react';
import { ClientOrder, TradingInstrument } from '../../types/trading';
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  BarChart2,
  RotateCw,
  FileText,
  Check,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

interface TradingOrdersViewProps {
  orders: ClientOrder[];
  onCancelOrder: (orderId: string) => void;
  onOpenPlaceOrder?: () => void;
  onOpenChart?: (symbol: string) => void;
  onRepeatOrder?: (order: ClientOrder) => void;
}

export const TradingOrdersView: React.FC<TradingOrdersViewProps> = ({
  orders,
  onCancelOrder,
  onOpenPlaceOrder,
  onOpenChart,
  onRepeatOrder
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXECUTED' | 'OPEN' | 'CANCELLED'>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Stats calculation
  const totalCount = orders.length;
  const executedCount = orders.filter(o => o.status === 'EXECUTED').length;
  const openCount = orders.filter(o => o.status === 'OPEN').length;
  const cancelledCount = orders.filter(o => o.status === 'CANCELLED').length;

  const filteredOrders = orders.filter(order => {
    // Status filter
    if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
    // Side filter
    if (sideFilter !== 'ALL' && order.type !== sideFilter) return false;
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        order.symbol.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopy = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div id="trading-orders-view" className="space-y-4 select-none">
      {/* 1. TOP HEADER (Title + Live Feed Badge + Subtitle + Place New Order Button) */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black tracking-wide text-slate-900 dark:text-white">
              Order Book
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE FEED
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time status of submitted orders, executions and cancellations
          </p>
        </div>

        {onOpenPlaceOrder && (
          <button
            type="button"
            id="orders-place-new-order-btn"
            onClick={onOpenPlaceOrder}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Place New Order</span>
          </button>
        )}
      </div>

      {/* 2. FOUR METRIC STAT CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            TOTAL ORDERS
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
              Active
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            EXECUTED / FILLED
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-black text-emerald-500">
              {executedCount}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              100%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            OPEN / PENDING
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-black text-amber-500">
              {openCount}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
              0%
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            CANCELLED
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-mono font-black text-rose-500">
              {cancelledCount}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">
              0%
            </span>
          </div>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#070D18] p-1 rounded-xl overflow-x-auto">
          {(
            [
              { key: 'ALL', label: `All (${totalCount})` },
              { key: 'EXECUTED', label: `Executed (${executedCount})` },
              { key: 'OPEN', label: `Open (${openCount})` },
              { key: 'CANCELLED', label: `Cancelled (${cancelledCount})` }
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Search + Side Tabs */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by symbol, order ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-amber-500"
            />
          </div>

          {/* Side Pills (ALL, BUY, SELL) */}
          <div className="flex items-center bg-slate-100 dark:bg-[#070D18] p-0.5 rounded-xl border border-slate-200 dark:border-[#162234]">
            {(['ALL', 'BUY', 'SELL'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSideFilter(s)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  sideFilter === s
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. ORDERS TABLE (EXACTLY MATCHING SCREENSHOT 3) */}
      <div className="bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#162234] bg-slate-50 dark:bg-[#070D18] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Order ID & Time</th>
                <th className="py-3 px-3">Instrument</th>
                <th className="py-3 px-3">Side</th>
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3 text-right">Lots / Qty</th>
                <th className="py-3 px-3 text-right">Order / Exec Price</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142032] font-mono">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isBuy = order.type === 'BUY';
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#0E1626] transition-colors"
                    >
                      {/* Order ID & Time */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(order.id)}
                            className="text-slate-400 hover:text-amber-400 transition-colors"
                            title="Copy ID"
                          >
                            {copiedId === order.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            #{order.id}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {order.timestamp || order.placedAt || '11:01:10 • 22/09/2026'}
                        </div>
                      </td>

                      {/* Instrument */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white font-sans text-xs">
                            {order.symbol}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            {order.category}
                          </span>
                        </div>
                      </td>

                      {/* Side */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-black ${
                            isBuy
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                          }`}
                        >
                          {isBuy ? (
                            <ArrowUpRight className="w-3 h-3 stroke-[3]" />
                          ) : (
                            <ArrowDownLeft className="w-3 h-3 stroke-[3]" />
                          )}
                          {order.type}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-sans text-xs font-semibold">
                        {order.product}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {order.orderType}
                        </span>
                      </td>

                      {/* Lots / Qty */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {order.lots} ({order.quantity})
                      </td>

                      {/* Order / Exec Price */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹
                        {(order.executionPrice || order.price).toLocaleString('en-IN', {
                          minimumFractionDigits: 2
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            order.status === 'EXECUTED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : order.status === 'OPEN'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {order.status === 'EXECUTED' && <CheckCircle2 className="w-3 h-3" />}
                          {order.status === 'OPEN' && <Clock className="w-3 h-3" />}
                          {order.status === 'CANCELLED' && <XCircle className="w-3 h-3" />}
                          {order.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onOpenChart && (
                            <button
                              type="button"
                              onClick={() => onOpenChart(order.symbol)}
                              className="p-1 rounded-lg bg-slate-100 dark:bg-[#121E30] hover:bg-amber-500/20 hover:text-amber-400 text-slate-400 transition-colors cursor-pointer"
                              title="View Chart"
                            >
                              <BarChart2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onRepeatOrder && (
                            <button
                              type="button"
                              onClick={() => onRepeatOrder(order)}
                              className="p-1 rounded-lg bg-slate-100 dark:bg-[#121E30] hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 transition-colors cursor-pointer"
                              title="Repeat Order"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {order.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => onCancelOrder(order.id)}
                              className="px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] border border-rose-500/30 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
