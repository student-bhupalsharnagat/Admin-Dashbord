import React, { useState } from 'react';
import { X, Shield, Sliders, RefreshCw, Check, Power, Settings, Globe } from 'lucide-react';

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
  onResetDemoData
}) => {
  if (!isOpen) return null;

  const [localName, setLocalName] = useState(tenantName);
  const [localCode, setLocalCode] = useState(tenantCode);
  const [localTagline, setLocalTagline] = useState(tagline);
  const [localTrading, setLocalTrading] = useState(isTradingEnabled);
  const [localOptions, setLocalOptions] = useState(isOptionsEnabled);
  const [localMarket, setLocalMarket] = useState(marketStatus);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    onUpdateTenantConfig({
      tenantName: localName,
      tenantCode: localCode,
      tagline: localTagline,
      isTradingEnabled: localTrading,
      isOptionsEnabled: localOptions,
      marketStatus: localMarket
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
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
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Central Platform & Tenant Controls
              </h3>
              <p className="text-[11px] text-slate-500">Live configuration & simulator engine</p>
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

        {/* Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Market Status Mode */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
              Market Mode & Simulator
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-[#070D18] p-1 rounded-xl border border-slate-200 dark:border-[#162234]">
              {(['LIVE', 'OPEN', 'CLOSED'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLocalMarket(mode)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    localMarket === mode
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400'
                  }`}
                >
                  {mode === 'LIVE' ? 'LIVE (IST)' : mode === 'OPEN' ? 'Sim OPEN' : 'FORCE CLOSED'}
                </button>
              ))}
            </div>
          </div>

          {/* Tenant White-Label Customization */}
          <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-[#142032]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Tenant White-Label Branding
            </span>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-slate-400 block mb-1">Platform Name</label>
                <input
                  type="text"
                  value={localName}
                  onChange={e => setLocalName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Code</label>
                <input
                  type="text"
                  value={localCode}
                  onChange={e => setLocalCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Tagline</label>
              <input
                type="text"
                value={localTagline}
                onChange={e => setLocalTagline(e.target.value)}
                className="w-full bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          {/* Permission Flags */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-[#142032]">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#162234] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Trading Status</span>
                <span className="text-[10px] text-slate-400">Order execution</span>
              </div>
              <button
                type="button"
                onClick={() => setLocalTrading(!localTrading)}
                className={`px-2 py-1 rounded text-xs font-mono font-bold cursor-pointer transition-colors ${
                  localTrading ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {localTrading ? 'ENABLED' : 'PAUSED'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#162234] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Options F&O</span>
                <span className="text-[10px] text-slate-400">Strike contracts</span>
              </div>
              <button
                type="button"
                onClick={() => setLocalOptions(!localOptions)}
                className={`px-2 py-1 rounded text-xs font-mono font-bold cursor-pointer transition-colors ${
                  localOptions ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {localOptions ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Reset Demo Data button */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#142032]">
            <button
              type="button"
              onClick={() => {
                if (confirm('Reset portfolio, orders, and wallet balance to original defaults?')) {
                  onResetDemoData();
                  onClose();
                }
              }}
              className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Portfolio & Balance to Demo Defaults</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-[#1E2E44] bg-slate-50 dark:bg-[#09101C] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-950" />
                <span>SAVED!</span>
              </>
            ) : (
              <span>APPLY SETTINGS</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
