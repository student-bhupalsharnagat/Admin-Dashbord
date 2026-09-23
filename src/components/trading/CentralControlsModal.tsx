import React, { useState } from 'react';
import {
  X,
  Shield,
  Sliders,
  Power,
  Layers,
  Snowflake,
  ExternalLink,
  RotateCcw,
  Check,
  AlertTriangle,
  LayoutDashboard
} from 'lucide-react';

interface CentralControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  tenantCode: string;
  tagline: string;
  isTradingEnabled: boolean;
  isOptionsEnabled: boolean;
  marketStatus: 'LIVE' | 'OPEN' | 'CLOSED';
  onUpdateTenantConfig: (config: {
    tenantName?: string;
    tenantCode?: string;
    tagline?: string;
    isTradingEnabled?: boolean;
    isOptionsEnabled?: boolean;
    marketStatus?: 'LIVE' | 'OPEN' | 'CLOSED';
  }) => void;
  onResetDemoData: () => void;
  onReturnToAdmin?: () => void;
}

export const CentralControlsModal: React.FC<CentralControlsModalProps> = ({
  isOpen,
  onClose,
  tenantName,
  tenantCode,
  tagline,
  isTradingEnabled,
  isOptionsEnabled,
  marketStatus,
  onUpdateTenantConfig,
  onResetDemoData,
  onReturnToAdmin
}) => {
  if (!isOpen) return null;

  const [killSwitchActive, setKillSwitchActive] = useState(!isTradingEnabled);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [optionsTradingEnabled, setOptionsTradingEnabled] = useState(isOptionsEnabled);
  const [tenantFrozen, setTenantFrozen] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleToggleKillSwitch = () => {
    const nextState = !killSwitchActive;
    setKillSwitchActive(nextState);
    onUpdateTenantConfig({ isTradingEnabled: !nextState });
    showNotification(nextState ? 'Kill-Switch Activated: Trading Halted' : 'Kill-Switch Deactivated: Trading Resumed');
  };

  const handleToggleMaintenance = () => {
    const next = !maintenanceMode;
    setMaintenanceMode(next);
    showNotification(next ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled');
  };

  const handleToggleOptions = () => {
    const next = !optionsTradingEnabled;
    setOptionsTradingEnabled(next);
    onUpdateTenantConfig({ isOptionsEnabled: next });
    showNotification(next ? 'Options Trading Enabled' : 'Options Trading Disabled');
  };

  const handleToggleFreeze = () => {
    const next = !tenantFrozen;
    setTenantFrozen(next);
    showNotification(next ? 'Tenant Desk Frozen' : 'Tenant Desk Unfrozen');
  };

  const showNotification = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        id="tenant-controls-dropdown"
        className="w-full max-w-lg bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Central Policy Enforcement
                </h3>
                <span className="text-[9px] font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  {tenantCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Global tenant risk & operational governance</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status notification toast */}
        {savedMessage && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>{savedMessage}</span>
          </div>
        )}

        {/* Policy list matching the reference live site */}
        <div className="p-5 space-y-3 overflow-y-auto text-xs">
          {/* 1. Trading Kill-Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234]">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Power className="w-3.5 h-3.5 text-rose-500" />
                <span>Trading Kill-Switch</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Halt all trade orders centrally across the tenant
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleKillSwitch}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-black cursor-pointer transition-colors ${
                killSwitchActive
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white'
              }`}
            >
              {killSwitchActive ? 'ACTIVE (HALTED)' : 'OFF (NORMAL)'}
            </button>
          </div>

          {/* 2. Maintenance Mode */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234]">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span>Maintenance Mode</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Put tenant platform into maintenance mode
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleMaintenance}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-black cursor-pointer transition-colors ${
                maintenanceMode
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white'
              }`}
            >
              {maintenanceMode ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* 3. Options Trading */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234]">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                <span>Options Trading</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Tenant feature flag for option strike ladders
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleOptions}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-black cursor-pointer transition-colors ${
                optionsTradingEnabled
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white'
              }`}
            >
              {optionsTradingEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* 4. Tenant Freeze */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234]">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Snowflake className="w-3.5 h-3.5 text-cyan-500" />
                <span>Tenant Freeze</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Suspend all user actions on this tenant desk
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleFreeze}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-black cursor-pointer transition-colors ${
                tenantFrozen
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white'
              }`}
            >
              {tenantFrozen ? 'FROZEN' : 'ACTIVE'}
            </button>
          </div>

          {/* Reset Demo State Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onResetDemoData();
                showNotification('Demo balances and positions reset.');
              }}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Virtual Margin & Portfolio to Default (₹10,00,000)</span>
            </button>
          </div>
        </div>

        {/* Footer: Return to Admin Panel */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#0B111C] border-t border-slate-200 dark:border-[#1A2638] flex items-center justify-between gap-3">
          {onReturnToAdmin ? (
            <button
              type="button"
              id="return-to-admin-btn"
              onClick={() => {
                onClose();
                onReturnToAdmin();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-900/30 cursor-pointer transition-all active:scale-98"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Open Central Admin Panel</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
