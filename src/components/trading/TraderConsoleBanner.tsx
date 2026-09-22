import React from 'react';
import { Shield, Clock, CheckCircle } from 'lucide-react';

interface TraderConsoleBannerProps {
  clientName: string;
  userId: string;
  kycStatus?: string;
  marketStatus: 'LIVE' | 'OPEN' | 'CLOSED';
  onToggleMarketStatus: () => void;
}

export const TraderConsoleBanner: React.FC<TraderConsoleBannerProps> = ({
  clientName = 'Demo Trader',
  userId = 'vtx123',
  kycStatus = 'Verified (MCX & NSE Active)',
  marketStatus = 'LIVE',
  onToggleMarketStatus
}) => {
  return (
    <div
      id="trader-console-banner"
      className="mb-4 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-[#0E1726] to-[#0A1220] border border-[#1E2E44] flex flex-wrap items-center justify-between gap-3 shadow-lg select-none"
    >
      {/* Left info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-white tracking-wide">
            Trading Console • {clientName}
          </h2>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
            <span>User ID:</span>
            <span className="text-amber-400 font-mono font-bold">{userId}</span>
            <span>•</span>
            <span>KYC:</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400 inline" />
              {kycStatus}
            </span>
          </p>
        </div>
      </div>

      {/* Right: Market status simulator toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          id="market-status-toggle-btn"
          onClick={onToggleMarketStatus}
          className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
            marketStatus === 'CLOSED'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
          title="Click to toggle Market Status Simulation (LIVE IST / Simulated OPEN / Closed)"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>
            {marketStatus === 'CLOSED'
              ? 'Market: CLOSED (Demo)'
              : marketStatus === 'OPEN'
              ? 'Market: OPEN (Demo)'
              : 'Market: LIVE (IST)'}
          </span>
        </button>
      </div>
    </div>
  );
};
