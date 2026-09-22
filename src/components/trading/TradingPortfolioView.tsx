import React, { useState } from 'react';
import { ClientPosition, ClientWallet } from '../../types/trading';
import {
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  BarChart2,
  X,
  Zap,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';

interface TradingPortfolioViewProps {
  positions: ClientPosition[];
  wallet?: ClientWallet;
  onSquareOff: (positionId: string) => void;
  onSquareOffAll: () => void;
  onOpenOrder?: (symbol: string, side: 'BUY' | 'SELL') => void;
  onOpenChart?: (symbol: string) => void;
  onOpenWallet?: () => void;
}

export const TradingPortfolioView: React.FC<TradingPortfolioViewProps> = ({
  positions,
  wallet,
  onSquareOff,
  onSquareOffAll,
  onOpenOrder,
  onOpenChart,
  onOpenWallet
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'POSITIONS' | 'HOLDINGS'>('POSITIONS');
  const [productFilter, setProductFilter] = useState<'ALL' | 'INTRADAY' | 'HOLDING'>('ALL');

  // Calculate live MTM stats
  const totalUnrealizedPnL = positions.reduce((acc, p) => acc + p.pnl, 0);
  const realizedPnL = wallet?.realizedPnL ?? 365541.38;
  const netTotalPnL = totalUnrealizedPnL + realizedPnL;
  const usedMargin = wallet?.usedMargin ?? 100308.0;
  const availableBalance = wallet?.availableBalance ?? 897804.97;

  const isTotalPos = totalUnrealizedPnL >= 0;
  const totalExposure = positions.reduce((acc, p) => acc + (p.exposure || p.avgPrice * (p.quantity || 1)), 0);
  const returnPercent = totalExposure > 0 ? (totalUnrealizedPnL / totalExposure) * 100 : 0;

  const filteredPositions = positions.filter(pos => {
    if (productFilter === 'ALL') return true;
    return pos.product === productFilter;
  });

  const intradayCount = positions.filter(p => p.product === 'INTRADAY').length;
  const holdingCount = positions.filter(p => p.product === 'HOLDING').length;

  return (
    <div id="trading-portfolio-view" className="space-y-4 select-none">
      {/* 1. TOP BAR: SUB TABS (POSITIONS 3 / HOLDINGS 0) + ACTIONS (EXIT ALL / TRADE MORE) */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] shadow-xs">
        {/* Sub Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#070D18] p-1 rounded-xl border border-slate-200 dark:border-[#162234]">
          <button
            type="button"
            onClick={() => setActiveSubTab('POSITIONS')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'POSITIONS'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('HOLDINGS')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'HOLDINGS'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            Holdings (0)
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {positions.length > 0 && (
            <button
              type="button"
              id="portfolio-exit-all-btn"
              onClick={() => {
                if (window.confirm('⚠️ Confirm Square Off: Are you sure you want to Exit ALL open positions at market price?')) {
                  onSquareOffAll();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 hover:text-rose-400 font-bold text-xs tracking-wider transition-all cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Exit All Positions</span>
            </button>
          )}

          {onOpenOrder && (
            <button
              type="button"
              id="portfolio-trade-more-btn"
              onClick={() => onOpenOrder('GOLD FUT', 'BUY')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
              <span>Trade More</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. BIG MTM REAL-TIME DASHBOARD BANNER (MATCHING SCREENSHOT 4 & 5) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#09111D] border border-[#1A2638] shadow-lg relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black tracking-wider text-amber-500 uppercase">
              TOTAL UNREALIZED P&L (MTM)
            </span>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            • PROFIT ({isTotalPos ? '+' : ''}{returnPercent.toFixed(2)}%)
          </span>
        </div>

        {/* Big PnL Display */}
        <div className="flex items-baseline gap-3 mt-2 flex-wrap">
          <span
            className={`text-3xl sm:text-4xl lg:text-5xl font-mono font-black tracking-tight ${
              isTotalPos ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isTotalPos ? '+' : ''}₹
            {totalUnrealizedPnL.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              LIVE 1s FEED
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              ▲ TICK UP
            </span>
          </div>
        </div>

        {/* 4 Sub-Stat Boxes at the bottom of MTM card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#142032]">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              REALIZED P&L
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-0.5 block">
              +₹{realizedPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              NET TOTAL P&L
            </span>
            <span className="text-sm sm:text-base font-mono font-black text-emerald-400 mt-0.5 block">
              +₹{netTotalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              USED MARGIN
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-slate-200 mt-0.5 block">
              ₹{usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                AVAILABLE BALANCE
              </span>
              {onOpenWallet && (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="text-[10px] text-amber-400 hover:underline font-bold"
                >
                  + Funds
                </button>
              )}
            </div>
            <span className="text-sm sm:text-base font-mono font-bold text-white mt-0.5 block">
              ₹{availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. PRODUCT FILTER PILLS */}
      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
        {(
          [
            { key: 'ALL', label: `All (${positions.length})` },
            { key: 'INTRADAY', label: `Intraday MIS (${intradayCount})` },
            { key: 'HOLDING', label: `Holding CNC (${holdingCount})` }
          ] as const
        ).map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setProductFilter(tab.key)}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              productFilter === tab.key
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. POSITION CARDS (MATCHING SCREENSHOTS 4 & 5) */}
      <div className="space-y-4">
        {filteredPositions.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
            <p className="text-sm text-slate-400">No active positions in this view.</p>
          </div>
        ) : (
          filteredPositions.map(pos => {
            const isBuy = pos.side === 'BUY';
            const isPos = pos.pnl >= 0;
            const exposure = pos.exposure || (pos.avgPrice * (pos.quantity || 1));

            return (
              <div
                key={pos.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] shadow-xs space-y-3.5 transition-all hover:border-slate-400 dark:hover:border-slate-700"
              >
                {/* Position Card Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black ${
                        isBuy
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                      {pos.side}
                    </span>

                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-wide">
                      {pos.symbol}
                    </h3>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {pos.product}
                    </span>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                      {pos.lots} Lots ({pos.quantity})
                    </span>
                  </div>

                  {/* Actions for this position */}
                  <div className="flex items-center gap-2">
                    {onOpenOrder && (
                      <button
                        type="button"
                        onClick={() => onOpenOrder(pos.symbol, pos.side || 'BUY')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 hover:text-amber-400 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add More</span>
                      </button>
                    )}

                    {onOpenChart && (
                      <button
                        type="button"
                        onClick={() => onOpenChart(pos.symbol)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#121E30] hover:bg-[#1A2A42] text-slate-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>Chart</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSquareOff(pos.id)}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Exit Position</span>
                    </button>
                  </div>
                </div>

                {/* MTM P&L Highlight Banner for this Position */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
                    isPos
                      ? 'bg-emerald-500/5 dark:bg-[#071612] border-emerald-500/20'
                      : 'bg-rose-500/5 dark:bg-[#180A10] border-rose-500/20'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      LIVE MTM P&L (UNREALIZED)
                    </span>
                    <span
                      className={`text-xl sm:text-2xl font-mono font-black block mt-0.5 ${
                        isPos ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                      }`}
                    >
                      {isPos ? '+' : ''}₹{pos.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      RETURN
                    </span>
                    <span
                      className={`text-sm sm:text-base font-mono font-black block mt-0.5 ${
                        isPos ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                      }`}
                    >
                      {isPos ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Key Position Metrics Row: Avg Price, Current LTP, Total Exposure, Position ID */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      AVG BUY / SELL PRICE
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold mt-0.5 block">
                      ₹{pos.avgPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      CURRENT LTP
                    </span>
                    <span className="text-slate-900 dark:text-white font-black mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      ₹{pos.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      TOTAL EXPOSURE
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold mt-0.5 block">
                      ₹{exposure.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      POSITION ID
                    </span>
                    <span className="text-slate-500 font-bold mt-0.5 block">
                      #{pos.id}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
