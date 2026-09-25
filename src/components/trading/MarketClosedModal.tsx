import React from 'react';
import { X, Clock, AlertTriangle, ShieldCheck, Check } from 'lucide-react';

export interface MarketHoursInfo {
  exchange?: string;
  tradingHours?: string;
  days?: string;
  timeZone?: string;
}

interface MarketClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateOpen?: () => void;
  info?: MarketHoursInfo;
}

export const MarketClosedModal: React.FC<MarketClosedModalProps> = ({
  isOpen,
  onClose,
  onSimulateOpen,
  info
}) => {
  if (!isOpen) return null;

  const exchangeName = info?.exchange || 'MCX & NSE';
  const tradingHours = info?.tradingHours || '09:00 - 23:30';
  const days = info?.days || 'Mon - Fri';
  const timeZone = info?.timeZone || 'IST';

  return (
    <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in select-none">
      <div
        className="bg-white dark:bg-[#0D1524] border border-slate-200 dark:border-[#1E2B40] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 sm:p-7 flex flex-col items-center text-center animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Glowing Clock Icon Badge matching Reference Screenshot */}
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-[#34141B] border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-950/20">
          <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-700 relative flex items-center justify-center shadow-inner">
            {/* Clock center pin */}
            <div className="w-1.5 h-1.5 rounded-full bg-rose-600 z-10" />
            {/* Hour hand */}
            <div className="absolute top-1.5 w-0.5 h-2.5 bg-slate-900 rounded-full transform origin-bottom rotate-45" />
            {/* Minute hand */}
            <div className="absolute top-1 w-0.5 h-3 bg-slate-900 rounded-full transform origin-bottom -rotate-45" />
            {/* Second hand accent */}
            <div className="absolute top-0.5 w-0.5 h-3.5 bg-rose-500 rounded-full transform origin-bottom rotate-12" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-4">
          Market Closed
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-normal leading-relaxed mt-2.5 px-1">
          The stock market is currently closed. Trading is available only during official market hours. Please try again when the market opens.
        </p>

        {/* Info Box matching Reference Screenshot */}
        <div className="w-full bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#162234] rounded-xl p-3 sm:p-3.5 text-center mt-5">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono">
            {exchangeName} trading hours:{' '}
            <span className="text-amber-600 dark:text-amber-400 font-bold">{tradingHours}</span>
          </div>
          <div className="text-xs font-semibold mt-1">
            <span className="text-amber-600 dark:text-amber-400 font-bold">{timeZone}</span>
            <span className="text-slate-400 dark:text-slate-500"> • </span>
            <span className="text-slate-600 dark:text-slate-400">{days}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2 mt-5">
          {onSimulateOpen && (
            <button
              type="button"
              id="market-simulate-open-btn"
              onClick={() => {
                onSimulateOpen();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Switch Market to LIVE (Simulate Open)</span>
            </button>
          )}

          <button
            type="button"
            id="market-closed-dismiss-btn"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#16243A] dark:hover:bg-[#1D2E49] text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            I Understand, Close
          </button>
        </div>
      </div>
    </div>
  );
};
