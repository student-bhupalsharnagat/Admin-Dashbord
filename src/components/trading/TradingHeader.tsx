import React, { useState } from 'react';
import {
  Star,
  FileText,
  TrendingUp,
  Clock,
  User,
  Moon,
  Sun,
  Globe,
  Wallet,
  Bell,
  HelpCircle,
  ChevronDown
} from 'lucide-react';

export type TradingTabKey = 'watchlist' | 'orders' | 'portfolio' | 'history' | 'profile';

interface TradingHeaderProps {
  activeTab: TradingTabKey;
  onSelectTab: (tab: TradingTabKey) => void;
  brandName?: string;
  brandShortName?: string;
  brandTagline?: string;
  ordersCount?: number;
  positionsCount?: number;
  unreadNotificationsCount?: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
  onOpenTour: () => void;
  clientInitials?: string;
  clientFullName?: string;
}

export const TradingHeader: React.FC<TradingHeaderProps> = ({
  activeTab,
  onSelectTab,
  brandName = 'VERTEX Trading',
  brandShortName = 'VTX',
  brandTagline = 'Institutional Multi-Asset Platform',
  ordersCount = 3,
  positionsCount = 2,
  unreadNotificationsCount = 2,
  isDark,
  onToggleTheme,
  onOpenWallet,
  onOpenNotifications,
  onOpenTour,
  clientInitials = 'DT',
  clientFullName = 'Demo Trader'
}) => {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const languages = ['English', 'हिंदी (Hindi)', 'ગુજરાતી (Gujarati)', 'मराठी (Marathi)'];

  return (
    <header id="trading-main-header" className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B111C]/95 border-b border-slate-200 dark:border-[#1A2638] px-3 sm:px-6 py-2.5 backdrop-blur-md shadow-xs transition-colors duration-150">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand Identity Logo & Name */}
        <div
          onClick={() => onSelectTab('watchlist')}
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          title={`${brandName} - Click for Watchlist`}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center font-black text-slate-950 text-sm shadow-md group-hover:scale-105 transition-transform">
            {brandShortName}
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-black tracking-tight leading-none text-amber-500 group-hover:text-amber-400 transition-colors">
              {brandName}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[150px]">
              {brandTagline}
            </span>
          </div>
        </div>

        {/* Center: Navigation Tabs matching exact layout */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-[#080E18] p-1 rounded-xl border border-slate-200 dark:border-[#162234]">
          {/* WATCHLIST */}
          <button
            type="button"
            id="nav-tab-watchlist"
            onClick={() => onSelectTab('watchlist')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'watchlist'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${activeTab === 'watchlist' ? 'fill-slate-950 text-slate-950' : ''}`} />
            <span>WATCHLIST</span>
          </button>

          {/* ORDERS */}
          <button
            type="button"
            id="nav-tab-orders"
            onClick={() => onSelectTab('orders')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ORDERS</span>
            {ordersCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'orders' ? 'bg-slate-900 text-amber-400' : 'bg-slate-200 dark:bg-[#142032] text-slate-700 dark:text-slate-300'
              }`}>
                {ordersCount}
              </span>
            )}
          </button>

          {/* PORTFOLIO */}
          <button
            type="button"
            id="nav-tab-portfolio"
            onClick={() => onSelectTab('portfolio')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'portfolio'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>PORTFOLIO</span>
            {positionsCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'portfolio' ? 'bg-slate-900 text-amber-400' : 'bg-slate-200 dark:bg-[#142032] text-slate-700 dark:text-slate-300'
              }`}>
                {positionsCount}
              </span>
            )}
          </button>

          {/* HISTORY */}
          <button
            type="button"
            id="nav-tab-history"
            onClick={() => onSelectTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>HISTORY</span>
          </button>

          {/* PROFILE */}
          <button
            type="button"
            id="nav-tab-profile"
            onClick={() => onSelectTab('profile')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>PROFILE</span>
          </button>
        </nav>

        {/* Right side utility icons & buttons matching screenshot */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme toggle */}
          <button
            type="button"
            id="header-theme-toggle"
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-300 transition-colors cursor-pointer active:scale-95"
            title="Toggle Light / Dark Mode"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Language Selector */}
          <div className="relative">
            <button
              type="button"
              id="header-lang-btn"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
            >
              <Globe className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">{selectedLanguage}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-[#1E2E44] rounded-xl shadow-xl py-1 z-50 animate-in fade-in">
                {languages.map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => {
                      setSelectedLanguage(lang.split(' ')[0]);
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-[#152338] transition-colors ${
                      selectedLanguage === lang.split(' ')[0] ? 'text-amber-500 font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Wallet Button */}
          <button
            type="button"
            id="header-wallet-btn"
            onClick={onOpenWallet}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Open Wallet & Manage Funds"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Wallet</span>
          </button>

          {/* Notifications Bell */}
          <button
            type="button"
            id="header-notifications-btn"
            onClick={onOpenNotifications}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer relative active:scale-95"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 min-w-[16px] h-4 text-[9px] font-mono font-bold rounded-full bg-amber-500 text-slate-950 flex items-center justify-center ring-2 ring-white dark:ring-[#0B111C]">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Tour / Help Button */}
          <button
            type="button"
            id="header-tour-btn"
            onClick={onOpenTour}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Platform Tour & User Guide"
            aria-label="Platform Tour"
          >
            <HelpCircle className="w-4 h-4 text-amber-500" />
          </button>

          {/* User Avatar */}
          <button
            type="button"
            id="header-avatar-btn"
            onClick={() => onSelectTab('profile')}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xs font-black text-slate-950 shadow-md cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-all font-mono active:scale-95"
            title={`Account: ${clientFullName}`}
          >
            {clientInitials}
          </button>
        </div>
      </div>
    </header>
  );
};
