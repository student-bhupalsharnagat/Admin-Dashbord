import React, { useState, useEffect } from 'react';
import { Shield, Clock, CheckCircle, Info } from 'lucide-react';
import { t } from '../../utils/tradingTranslations';

interface TraderConsoleBannerProps {
  clientName: string;
  userId: string;
  kycStatus?: string;
  marketStatus: 'LIVE' | 'OPEN' | 'CLOSED';
  onToggleMarketStatus: () => void;
  onOpenMarketHoursInfo?: () => void;
  currentLanguage?: string;
}

export const TraderConsoleBanner: React.FC<TraderConsoleBannerProps> = ({
  clientName = 'Demo Trader',
  userId = 'vtx123',
  kycStatus = 'Verified (MCX & NSE Active)',
  marketStatus = 'LIVE',
  onToggleMarketStatus,
  onOpenMarketHoursInfo,
  currentLanguage = 'en'
}) => {
  const [istTime, setIstTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format in IST (UTC+5:30)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setIstTime(new Intl.DateTimeFormat('en-GB', options).format(now) + ' IST');
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      id="trader-console-banner"
      className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1E2E44] flex flex-wrap items-center justify-between gap-3 shadow-xs select-none transition-colors"
    >
      {/* Left info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-wide">
            {t(currentLanguage, 'trading_console')} • {clientName}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
            <span>{t(currentLanguage, 'user_id')}:</span>
            <span className="text-amber-500 font-mono font-bold">{userId}</span>
            <span>•</span>
            <span>KYC:</span>
            <span className="text-emerald-500 font-medium flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 inline" />
              {kycStatus || t(currentLanguage, 'kyc_verified')}
            </span>
          </p>
        </div>
      </div>

      {/* Right: Live IST Clock & Market Status Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Live IST Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#121E30] border border-slate-200 dark:border-[#1E2E44] text-xs font-mono text-slate-600 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{istTime || '10:30:00 IST'}</span>
        </div>

        {/* Market Status Button */}
        <button
          type="button"
          id="market-status-toggle-btn"
          onClick={onToggleMarketStatus}
          className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
            marketStatus === 'CLOSED'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-500 dark:text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}
          title="Toggle market simulator mode (LIVE / OPEN / CLOSED)"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>
            {marketStatus === 'CLOSED'
              ? t(currentLanguage, 'market_closed')
              : t(currentLanguage, 'market_live')}
          </span>
        </button>

        {/* Market Hours Info button */}
        {onOpenMarketHoursInfo && (
          <button
            type="button"
            onClick={onOpenMarketHoursInfo}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#121E30] dark:hover:bg-[#1A2A42] border border-slate-200 dark:border-[#1E2E44] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            title="View Official Market Hours"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
