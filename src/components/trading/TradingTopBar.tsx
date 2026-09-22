import React, { useState } from 'react';
import { Shield, ChevronDown, Building, RefreshCw, LayoutDashboard } from 'lucide-react';

interface TradingTopBarProps {
  tenantName: string;
  tenantCode: string;
  tagline: string;
  isTradingEnabled: boolean;
  isOptionsEnabled: boolean;
  availableTenants?: Array<{ id: string; name: string; code: string; domain: string }>;
  onSelectTenant?: (tenant: { id: string; name: string; code: string; domain: string }) => void;
  onOpenCentralControls: () => void;
  onReturnToAdmin?: () => void;
  isAdmin?: boolean;
}

export const TradingTopBar: React.FC<TradingTopBarProps> = ({
  tenantName = 'VERTEX Trading',
  tenantCode = 'VTX',
  tagline = 'Institutional Multi-Asset Platform',
  isTradingEnabled = true,
  isOptionsEnabled = true,
  availableTenants = [
    { id: 'TNT-001', name: 'VERTEX Trading', code: 'VTX', domain: 'trade.vertextrading.com' },
    { id: 'TNT-002', name: 'Alpha Prime Capital', code: 'APC', domain: 'trade.alphaprime.com' },
    { id: 'TNT-003', name: 'Zenith Markets', code: 'ZMK', domain: 'trade.zenithmarkets.in' },
    { id: 'TNT-004', name: 'Quantum Alpha', code: 'QAL', domain: 'trade.quantumfx.io' }
  ],
  onSelectTenant,
  onOpenCentralControls,
  onReturnToAdmin,
  isAdmin = false
}) => {
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);

  return (
    <div id="trading-top-bar" className="bg-[#070D18] text-slate-300 border-b border-[#152338] px-3 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-3 select-none relative z-40">
      {/* Left side: Tenant Name, Code & Tagline */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" />
        <span className="text-slate-400 font-medium">Tenant:</span>
        <span className="text-white font-black tracking-wide">{tenantName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 font-mono border border-slate-700 font-bold">
          {tenantCode}
        </span>
        <span className="hidden sm:inline text-slate-500">•</span>
        <span className="hidden sm:inline text-slate-400 font-medium">Tagline:</span>
        <span className="hidden sm:inline italic text-slate-400 font-normal">
          {tagline}
        </span>
      </div>

      {/* Right side: Trading Status Pills, Tenant Switcher & Central Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Trading Status */}
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold tracking-wide">
            Trade: {isTradingEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-500/30 text-blue-400 font-mono text-[10px] font-bold tracking-wide">
            Options: {isOptionsEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* Switch Tenant Dropdown */}
        <div className="relative">
          <button
            type="button"
            id="switch-tenant-btn"
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="px-2.5 py-1 rounded-lg bg-[#121D2F] hover:bg-[#18273E] text-slate-200 text-xs font-semibold border border-slate-700/60 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
          >
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <span>Switch Tenant</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {tenantDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-[#0E1726] border border-[#1E2E44] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1E2E44]">
                Available Tenant Platforms
              </div>
              {availableTenants.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTenant?.(t);
                    setTenantDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#152338] transition-colors ${
                    t.name === tenantName ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-slate-300'
                  }`}
                >
                  <div className="flex flex-col">
                    <span>{t.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{t.domain}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono text-slate-400">
                    {t.code}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Central Controls Button */}
        <button
          type="button"
          id="central-controls-btn"
          onClick={onOpenCentralControls}
          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
          title="Open Central Platform Controls"
        >
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Central Controls</span>
        </button>

        {/* Back to Admin Desk (if applicable) */}
        {onReturnToAdmin && (
          <button
            type="button"
            id="admin-desk-btn"
            onClick={onReturnToAdmin}
            className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Return to TradeMatrix Admin Desk"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-purple-400" />
            <span>Admin Desk</span>
          </button>
        )}
      </div>
    </div>
  );
};
