import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  CreditCard,
  Lock,
  LogOut,
  CheckCircle2,
  Wallet,
  Bell,
  HelpCircle,
  Settings,
  FileText,
  ChevronRight,
  Headphones,
  Check
} from 'lucide-react';
import { ClientAccount, ClientWallet } from '../../types/trading';

interface TradingProfileViewProps {
  client: ClientAccount;
  wallet?: ClientWallet;
  supportEmail?: string;
  supportPhone?: string;
  brandName?: string;
  footerCopyright?: string;
  onLogout: () => void;
  onOpenWallet?: () => void;
  onOpenNotifications?: () => void;
  onOpenTour?: () => void;
  onOpenTickets?: () => void;
}

export const TradingProfileView: React.FC<TradingProfileViewProps> = ({
  client,
  wallet,
  supportEmail = 'support@tradepro.com',
  supportPhone = '+91 98765 43210',
  brandName = 'Trading Desk',
  footerCopyright,
  onLogout,
  onOpenWallet,
  onOpenNotifications,
  onOpenTour,
  onOpenTickets
}) => {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const portfolioValue = wallet?.availableBalance ?? 897804.97;
  const openPnL = wallet?.unrealizedPnL ?? 381321.15;
  const marginUsed = wallet?.usedMargin ?? 100308.0;

  return (
    <div id="trading-profile-view" className="space-y-4 select-none max-w-4xl mx-auto">
      {/* 1. TOP HEADER PROFILE CARD (MATCHING SCREENSHOT 7 & 8) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar DT */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg font-mono">
            {client.initials || 'DT'}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {client.fullName || 'Demo Trader'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                KYC Verified
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                MCX - NSE
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-amber-500">{client.userId || 'vtx123'}</span>
              <span>•</span>
              <span>{client.email || 'demo@vertex.io'}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-400 font-bold text-xs flex items-center gap-1.5 border border-rose-500/30 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* 2. THREE METRIC CARDS: PORTFOLIO, OPEN PNL, MARGIN USED */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            PORTFOLIO
          </span>
          <span className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white mt-1 block">
            ₹{portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            OPEN PNL
          </span>
          <span className="text-xl sm:text-2xl font-mono font-black text-emerald-500 dark:text-emerald-400 mt-1 block">
            +₹{openPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            MARGIN USED
          </span>
          <span className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white mt-1 block">
            ₹{marginUsed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 3. MENU LIST WITH CHEVRONS (MATCHING SCREENSHOT 7 & 8) */}
      <div className="bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1A2638] rounded-2xl divide-y divide-slate-100 dark:divide-[#142032] overflow-hidden shadow-xs">
        {/* Profile Details */}
        <div
          onClick={() => setActiveSection(activeSection === 'profile' ? null : 'profile')}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Profile</h4>
              <p className="text-xs text-slate-400">Account information and personal details</p>
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${activeSection === 'profile' ? 'rotate-90' : ''}`} />
        </div>

        {activeSection === 'profile' && (
          <div className="p-4 bg-slate-50 dark:bg-[#070D18] space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-[#142032]">
              <span className="text-slate-400">Legal Name</span>
              <span className="font-bold text-slate-900 dark:text-white">{client.fullName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-[#142032]">
              <span className="text-slate-400">User ID</span>
              <span className="font-bold text-amber-500">{client.userId}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200 dark:border-[#142032]">
              <span className="text-slate-400">Email</span>
              <span className="text-slate-200">{client.email}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Phone</span>
              <span className="text-slate-200">{client.phone}</span>
            </div>
          </div>
        )}

        {/* Wallet & Funds */}
        <div
          onClick={() => {
            if (onOpenWallet) {
              onOpenWallet();
            } else {
              setActiveSection(activeSection === 'wallet' ? null : 'wallet');
            }
          }}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Wallet & Funds</h4>
              <p className="text-xs text-slate-400">Deposit, withdraw and ledger history</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Notifications */}
        <div
          onClick={() => onOpenNotifications?.()}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h4>
              <p className="text-xs text-slate-400">System and trade execution alerts</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Support Tickets */}
        <div
          onClick={() => {
            if (onOpenTickets) {
              onOpenTickets();
            } else {
              setActiveSection(activeSection === 'support' ? null : 'support');
            }
          }}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Support Tickets</h4>
              <p className="text-xs text-slate-400">Submit tickets to compliance desk</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Settings */}
        <div
          onClick={() => setActiveSection(activeSection === 'settings' ? null : 'settings')}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Settings</h4>
              <p className="text-xs text-slate-400">Security, 2FA, theme and preferences</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Terms & Privacy */}
        <div
          onClick={() => setActiveSection(activeSection === 'terms' ? null : 'terms')}
          className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Terms & Privacy</h4>
              <p className="text-xs text-slate-400">Trading agreements and regulatory disclosure</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* 4. TRADING DESK & COMPLIANCE BOX (MATCHING SCREENSHOT 8) */}
      <div className="p-4 rounded-2xl bg-[#09111D] border border-[#1A2638] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Headphones className="w-5 h-5 text-amber-500" />
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {brandName} • Trading Desk & Compliance
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Support: <strong className="text-slate-300">{supportEmail}</strong> • Hotline:{' '}
              <strong className="text-slate-300">{supportPhone}</strong>
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ONLINE 24/7
        </span>
      </div>

      {/* 5. FULL-WIDTH SIGN OUT BUTTON */}
      <button
        type="button"
        id="profile-sign-out-full-btn"
        onClick={onLogout}
        className="w-full py-3.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-xs tracking-wider border border-rose-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out from Trading Console</span>
      </button>
    </div>
  );
};
