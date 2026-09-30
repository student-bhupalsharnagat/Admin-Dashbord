import React from 'react';
import { Trade } from '../../types';
import { DisplayCurrency, formatMoney } from '../../utils/currency';

export interface DisplayRecentTrade {
  trade_id: string;
  client_name: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string | number;
  price: string | number;
  notional: string;
  time: string;
  source?: Trade;
}

interface RecentTradesCardProps {
  trades?: Trade[];
  currency?: DisplayCurrency;
  currencySymbol?: string;
  onViewAll: () => void;
  onSelectTrade?: (trade: any) => void;
}

export const RecentTradesCard: React.FC<RecentTradesCardProps> = ({
  trades = [],
  currency = 'INR',
  onViewAll,
  onSelectTrade
}) => {
  const displayItems: DisplayRecentTrade[] = trades.slice(0, 6).map(t => ({
    trade_id: t.trade_id,
    client_name: t.client_name,
    symbol: t.symbol,
    side: t.side,
    quantity: Number(t.quantity).toLocaleString(),
    price: Number(t.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
    notional: formatMoney(Number(t.total_value || t.price * t.quantity || 0), currency),
    time: t.timestamp ? (t.timestamp.split(' ')[1] || t.timestamp).slice(0, 19) : '—',
    source: t
  }));

  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-4 sm:p-5 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 
          onClick={onViewAll}
          className="text-sm font-bold text-white tracking-tight cursor-pointer hover:text-blue-400 transition-colors"
        >
          Recent Trades
        </h3>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
        >
          View all →
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[580px]">
          <thead>
            <tr className="text-slate-400 border-b border-[#16233d] text-[10px] font-bold uppercase tracking-wider">
              <th className="pb-3 font-semibold">TRADE ID</th>
              <th className="pb-3 font-semibold">CLIENT</th>
              <th className="pb-3 font-semibold">SYMBOL</th>
              <th className="pb-3 font-semibold">SIDE</th>
              <th className="pb-3 font-semibold text-right">QTY</th>
              <th className="pb-3 font-semibold text-right">EXEC PRICE</th>
              <th className="pb-3 font-semibold text-right">NOTIONAL</th>
              <th className="pb-3 font-semibold text-right">TIME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#16233d]/60">
            {displayItems.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No executed trades yet
                </td>
              </tr>
            )}
            {displayItems.map((trade, idx) => (
              <tr
                key={trade.trade_id || idx}
                onClick={() => onSelectTrade?.(trade.source || trade)}
                className="hover:bg-[#101b33] transition-colors cursor-pointer group"
              >
                <td className="py-3 font-mono font-medium text-blue-400">
                  {trade.trade_id}
                </td>
                <td className="py-3 font-medium text-slate-200">
                  {trade.client_name}
                </td>
                <td className="py-3 font-mono font-medium text-slate-300">
                  {trade.symbol}
                </td>
                <td className="py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      trade.side === 'BUY'
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    }`}
                  >
                    {trade.side}
                  </span>
                </td>
                <td className="py-3 font-mono text-slate-300 text-right">
                  {trade.quantity}
                </td>
                <td className="py-3 font-mono font-medium text-white text-right">
                  {trade.price}
                </td>
                <td className="py-3 font-mono text-slate-300 text-right">
                  {trade.notional}
                </td>
                <td className="py-3 font-mono text-slate-400 text-right">
                  {trade.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
