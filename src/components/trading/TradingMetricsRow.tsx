import React from 'react';
import { t } from '../../utils/tradingTranslations';

interface TradingMetricsRowProps {
  availableMargin: number;
  todayPnL: number;
  overallPnL: number;
  onOpenWallet: () => void;
  currentLanguage?: string;
}

export const TradingMetricsRow: React.FC<TradingMetricsRowProps> = ({
  availableMargin = 142840,
  todayPnL = 252227,
  overallPnL = 285727,
  onOpenWallet,
  currentLanguage = 'en'
}) => {
  const isTodayPositive = todayPnL >= 0;
  const isOverallPositive = overallPnL >= 0;

  return (
    <div
      id="trading-metrics-row"
      className="grid grid-cols-3 gap-2 py-3 px-3.5 sm:px-5 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] shadow-xs transition-colors mb-3.5 select-none"
    >
      {/* Available Margin */}
      <button
        type="button"
        id="metric-available-margin"
        onClick={onOpenWallet}
        className="text-left cursor-pointer hover:opacity-90 transition-opacity"
        title="Click to view Wallet and Manage Margin"
      >
        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {t(currentLanguage, 'available_margin')}
        </div>
        <div className="text-sm sm:text-base lg:text-lg font-mono font-black text-slate-900 dark:text-white tracking-tight mt-0.5 truncate">
          ₹{availableMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
      </button>

      {/* Today's P&L */}
      <div id="metric-today-pnl" className="text-center">
        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center justify-center gap-1">
          <span>{t(currentLanguage, 'today_pnl')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div
          className={`text-sm sm:text-base lg:text-lg font-mono font-black tracking-tight mt-0.5 truncate transition-colors duration-200 ${
            isTodayPositive ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {isTodayPositive ? '+' : ''}₹{todayPnL.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Overall P&L */}
      <div id="metric-overall-pnl" className="text-right">
        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
          {t(currentLanguage, 'overall_pnl')}
        </div>
        <div
          className={`text-sm sm:text-base lg:text-lg font-mono font-black tracking-tight mt-0.5 truncate transition-colors duration-200 ${
            isOverallPositive ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {isOverallPositive ? '+' : ''}₹{overallPnL.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
};
