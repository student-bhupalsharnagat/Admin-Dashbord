import React from 'react';
import { Trade } from '../../types';

export interface DisplayRecentTrade {
  trade_id: string;
  client_name: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string | number;
  price: string | number;
  fees: string;
  time: string;
}

const defaultRecentTrades: DisplayRecentTrade[] = [
  {
    trade_id: 'TRD001',
    client_name: 'Alexander Hunt',
    symbol: 'EUR/USD',
    side: 'BUY',
    quantity: '100,000',
    price: '1.0880',
    fees: '$10.00',
    time: '10:14:25'
  },
  {
    trade_id: 'TRD002',
    client_name: 'Maya Patel',
    symbol: 'BTC/USD',
    side: 'SELL',
    quantity: '0.50',
    price: '30,118.00',
    fees: '$15.06',
    time: '10:22:48'
  },
  {
    trade_id: 'TRD003',
    client_name: 'Alexander Hunt',
    symbol: 'TSLA',
    side: 'SELL',
    quantity: '20',
    price: '248.15',
    fees: '$4.96',
    time: '12:00:03'
  },
  {
    trade_id: 'TRD004',
    client_name: 'Isabella Torres',
    symbol: 'AMZN',
    side: 'BUY',
    quantity: '10',
    price: '131.20',
    fees: '$1.31',
    time: '15:30:00'
  },
  {
    trade_id: 'TRD005',
    client_name: 'Maya Patel',
    symbol: 'EUR/USD',
    side: 'BUY',
    quantity: '200,000',
    price: '1.0850',
    fees: '$20.00',
    time: '09:10:00'
  }
];

interface RecentTradesCardProps {
  trades?: Trade[];
  currencySymbol?: string;
  onViewAll: () => void;
  onSelectTrade?: (trade: any) => void;
}

export const RecentTradesCard: React.FC<RecentTradesCardProps> = ({
  trades,
  currencySymbol = '$',
  onViewAll,
  onSelectTrade
}) => {
  // Use provided trades mapped to display format, or the screenshot-matched default dataset
  const displayItems: DisplayRecentTrade[] = trades && trades.length > 0
    ? trades.slice(0, 5).map(t => ({
        trade_id: t.trade_id,
        client_name: t.client_name,
        symbol: t.symbol.replace('/INR', '/USD'),
        side: t.side,
        quantity: t.quantity.toLocaleString(),
        price: t.price.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        fees: `${currencySymbol}${(t.price * 0.0005).toFixed(2)}`,
        time: t.timestamp ? t.timestamp.split(' ')[1] || t.timestamp : '10:14:25'
      }))
    : defaultRecentTrades.map(t => ({
        ...t,
        fees: t.fees.replace('$', currencySymbol)
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
              <th className="pb-3 font-semibold text-right">FEES</th>
              <th className="pb-3 font-semibold text-right">TIME</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#16233d]/60">
            {displayItems.map((trade, idx) => (
              <tr
                key={trade.trade_id || idx}
                onClick={() => onSelectTrade?.(trade)}
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
                <td className="py-3 font-mono text-slate-400 text-right">
                  {trade.fees}
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
