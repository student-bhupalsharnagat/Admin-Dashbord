import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  Shield,
  Zap
} from 'lucide-react';
import { TradingInstrument, BenchmarkQuote, ClientWallet } from '../../types/trading';

interface LiveSpotlightTerminalProps {
  instrument: TradingInstrument;
  benchmarks: BenchmarkQuote[];
  wallet: ClientWallet;
  onOpenOrder: (instrument: TradingInstrument, side: 'BUY' | 'SELL') => void;
  onOpenChart: (instrument: TradingInstrument) => void;
  onOpenWallet: () => void;
}

export const LiveSpotlightTerminal: React.FC<LiveSpotlightTerminalProps> = ({
  instrument,
  benchmarks,
  wallet,
  onOpenOrder,
  onOpenChart,
  onOpenWallet
}) => {
  const isPositive = instrument.change >= 0;

  // Calculate 24h range percentage
  const rangeSpan = Math.max(0.01, instrument.high - instrument.low);
  const currentRangeOffset = Math.min(100, Math.max(0, ((instrument.lastPrice - instrument.low) / rangeSpan) * 100));

  // Margin health calculation
  const totalMargin = (wallet.availableBalance || 0) + (wallet.usedMargin || 0);
  const marginUsedPct = totalMargin > 0 ? Math.min(100, Math.round(((wallet.usedMargin || 0) / totalMargin) * 100)) : 26;

  return (
    <div id="live-spotlight-terminal" className="space-y-4 select-none">
      {/* Main Spotlight Card */}
      <div className="bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 transition-colors">
        {/* Terminal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400">
              LIVE SPOTLIGHT TERMINAL
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {instrument.category}
          </span>
        </div>

        {/* Symbol and Expiry */}
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-wide">
            {instrument.symbol}
          </h2>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
            {instrument.expiry}
          </span>
        </div>

        {/* Price & Change */}
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            ₹{instrument.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            className={`text-xs sm:text-sm font-mono font-bold flex items-center gap-1 ${
              isPositive ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            <span>{isPositive ? '↗' : '↘'}</span>
            <span>
              {isPositive ? '+' : ''}{instrument.change.toFixed(2)} ({isPositive ? '+' : ''}
              {instrument.changePercent.toFixed(2)}%)
            </span>
          </span>
        </div>

        {/* 24h Range */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span>L: ₹{instrument.low.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400">
              24h Range
            </span>
            <span>H: ₹{instrument.high.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-[#142032] rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-full transition-all duration-300"
              style={{ width: `${currentRangeOffset}%` }}
            />
          </div>
        </div>

        {/* Best Bid / Best Ask Market Depth Cards */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Best Bid */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070E1A] border border-slate-200 dark:border-[#162234]">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              BEST BID
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-emerald-500 block mt-0.5">
              ₹{instrument.bid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {instrument.bidLots} Lots
            </span>
          </div>

          {/* Best Ask */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070E1A] border border-slate-200 dark:border-[#162234] text-right">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              BEST ASK
            </span>
            <span className="text-sm sm:text-base font-mono font-bold text-rose-500 block mt-0.5">
              ₹{instrument.ask.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {instrument.askLots} Lots
            </span>
          </div>
        </div>

        {/* Fast Trade Buttons: ⚡ BUY and ⚡ SELL */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            id="spotlight-buy-btn"
            onClick={() => onOpenOrder(instrument, 'BUY')}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-black text-sm tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>BUY</span>
          </button>

          <button
            type="button"
            id="spotlight-sell-btn"
            onClick={() => onOpenOrder(instrument, 'SELL')}
            className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-98 text-white font-black text-sm tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>SELL</span>
          </button>
        </div>

        {/* Open Technical Chart Button */}
        <button
          type="button"
          id="spotlight-open-chart-btn"
          onClick={() => onOpenChart(instrument)}
          className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#101A29] dark:hover:bg-[#16243A] text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-[#1E2E44] transition-colors cursor-pointer active:scale-98"
        >
          <BarChart2 className="w-4 h-4 text-amber-500" />
          <span>Open Technical Chart</span>
        </button>
      </div>

      {/* Key Benchmarks Card */}
      <div className="bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] rounded-2xl p-4 shadow-sm space-y-2.5 transition-colors">
        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100 dark:border-[#162234]">
          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            Key Benchmarks
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-medium">
            NSE • MCX • Global
          </span>
        </div>

        <div className="space-y-2">
          {benchmarks.map(bm => {
            const isBmPos = bm.change >= 0;
            return (
              <div key={bm.symbol} className="flex items-center justify-between text-xs py-0.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {bm.symbol}
                </span>
                <div className="text-right font-mono">
                  <span className="font-bold text-slate-900 dark:text-white mr-2">
                    {bm.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[11px] font-bold ${isBmPos ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isBmPos ? '+' : ''}{bm.change.toFixed(2)} ({isBmPos ? '+' : ''}{bm.changePercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Margin Health Card */}
      <div className="bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] rounded-2xl p-4 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            Margin Health
          </span>
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
            {marginUsedPct}% Used
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-slate-100 dark:bg-[#142032] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              marginUsedPct > 80 ? 'bg-rose-500' : marginUsedPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${marginUsedPct}%` }}
          />
        </div>

        {/* Available vs Used */}
        <div className="flex justify-between text-xs font-mono pt-1">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Available</span>
            <span className="font-bold text-slate-900 dark:text-white">
              ₹{(wallet.availableBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Used Margin</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              ₹{(wallet.usedMargin || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Manage Wallet button */}
        <button
          type="button"
          id="manage-wallet-deposit-btn"
          onClick={onOpenWallet}
          className="w-full py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer text-center block active:scale-95"
        >
          Manage Wallet & Deposit
        </button>
      </div>
    </div>
  );
};
