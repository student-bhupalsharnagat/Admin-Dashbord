import React from 'react';
import { Clock, CheckCircle2, ArrowDownLeft, ArrowUpRight, FileSpreadsheet } from 'lucide-react';
import { ClientOrder } from '../../types/trading';

interface TradingHistoryViewProps {
  orders?: ClientOrder[];
  onOpenWalletLedger?: () => void;
}

export const TradingHistoryView: React.FC<TradingHistoryViewProps> = ({
  orders,
  onOpenWalletLedger
}) => {
  // Default history logs matching Screenshot 6 if orders not passed
  const historyLogs = [
    {
      id: 'ORD-33768',
      time: '11:01:10 • 22/09/2026',
      symbol: 'GOLD FUT',
      category: 'COMMODITY',
      action: 'BUY',
      lots: 1,
      qty: 100,
      price: 156853.88,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-15602',
      time: '10:58:53 • 22/09/2026',
      symbol: 'GOLD FUT',
      category: 'COMMODITY',
      action: 'BUY',
      lots: 1,
      qty: 100,
      price: 156998.89,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-90582',
      time: '10:55:37 • 22/09/2026',
      symbol: 'BTC/USDT',
      category: 'CRYPTO',
      action: 'BUY',
      lots: 1,
      qty: 1,
      price: 67500.43,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-93909',
      time: '10:54:49 • 22/09/2026',
      symbol: 'BTC/USDT',
      category: 'CRYPTO',
      action: 'SELL',
      lots: 1,
      qty: 1,
      price: 67374.30,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-37361',
      time: '19:57:41 • 21/09/2026',
      symbol: 'BTC/USDT',
      category: 'CRYPTO',
      action: 'BUY',
      lots: 1,
      qty: 1,
      price: 68765.81,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-37608',
      time: '19:56:36 • 21/09/2026',
      symbol: 'ETH/USDT',
      category: 'CRYPTO',
      action: 'BUY',
      lots: 1,
      qty: 1,
      price: 3544.72,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-76838',
      time: '19:55:07 • 21/09/2026',
      symbol: 'BTC/USDT',
      category: 'CRYPTO',
      action: 'BUY',
      lots: 1,
      qty: 1,
      price: 68521.47,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-60618',
      time: '19:54:25 • 21/09/2026',
      symbol: 'BTC/USDT',
      category: 'CRYPTO',
      action: 'BUY',
      lots: 1,
      qty: 1,
      price: 68534.94,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-84882',
      time: '19:53:32 • 21/09/2026',
      symbol: 'ETH/USDT',
      category: 'CRYPTO',
      action: 'BUY',
      lots: 1,
      qty: 1,
      price: 3545.02,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-68194',
      time: '19:52:18 • 21/09/2026',
      symbol: 'COPPER FUT',
      category: 'COMMODITY',
      action: 'BUY',
      lots: 1,
      qty: 2500,
      price: 842.10,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-55102',
      time: '19:50:04 • 21/09/2026',
      symbol: 'SILVER FUT',
      category: 'COMMODITY',
      action: 'BUY',
      lots: 1,
      qty: 100,
      price: 2391.45,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-44910',
      time: '19:48:12 • 21/09/2026',
      symbol: 'RELIANCE FUT',
      category: 'EQUITY',
      action: 'BUY',
      lots: 1,
      qty: 250,
      price: 2949.76,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-33291',
      time: '19:45:30 • 21/09/2026',
      symbol: 'NIFTY 50',
      category: 'INDEX',
      action: 'BUY',
      lots: 1,
      qty: 25,
      price: 24697.35,
      status: 'EXECUTED'
    },
    {
      id: 'ORD-22108',
      time: '19:42:15 • 21/09/2026',
      symbol: 'CRUDE OIL',
      category: 'COMMODITY',
      action: 'BUY',
      lots: 1,
      qty: 100,
      price: 6450.00,
      status: 'EXECUTED'
    }
  ];

  return (
    <div id="trading-history-view" className="space-y-4 select-none">
      {/* 1. TOP HEADER (MATCHING SCREENSHOT 6) */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] shadow-xs">
        <div>
          <h1 className="text-base sm:text-lg font-black tracking-wide text-slate-900 dark:text-white">
            HISTORY & Trades
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete audit log of executed trades and settlement
          </p>
        </div>

        {onOpenWalletLedger && (
          <button
            type="button"
            onClick={onOpenWalletLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 font-bold text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Wallet Ledger</span>
          </button>
        )}
      </div>

      {/* 2. HISTORY TABLE */}
      <div className="bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#162234] bg-slate-50 dark:bg-[#070D18] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Trade ID & Time</th>
                <th className="py-3 px-3">Instrument</th>
                <th className="py-3 px-3">Side</th>
                <th className="py-3 px-3 text-right">Lots / Qty</th>
                <th className="py-3 px-3 text-right">Execution Rate</th>
                <th className="py-3 px-4 text-center">Execution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142032] font-mono">
              {historyLogs.map(log => {
                const isBuy = log.action === 'BUY';

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors"
                  >
                    {/* Trade ID & Time */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        #{log.id}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{log.time}</div>
                    </td>

                    {/* Instrument */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white font-sans text-xs">
                          {log.symbol}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {log.category}
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
                        {log.action}
                      </span>
                    </td>

                    {/* Lots / Qty */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {log.lots} ({log.qty})
                    </td>

                    {/* Execution Rate */}
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      ₹
                      {log.price.toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </td>

                    {/* Execution Status */}
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {log.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
