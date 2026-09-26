import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Shield,
  LayoutDashboard,
  Check
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  getLanguageOption,
  t
} from '../../utils/tradingTranslations';

export type TradingTabKey = 'watchlist' | 'orders' | 'portfolio' | 'history' | 'profile';

interface TradingHeaderProps {
  activeTab: TradingTabKey;
  onSelectTab: (tab: TradingTabKey) => void;
  brandName?: string;
  brandShortName?: string;
  brandTagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  ordersCount?: number;
  positionsCount?: number;
  unreadNotificationsCount?: number;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenWallet: () => void;
  onOpenNotifications: () => void;
  onOpenTour: () => void;
  onOpenCentralControls?: () => void;
  onReturnToAdmin?: () => void;
  clientInitials?: string;
  clientFullName?: string;
  currentLanguage?: string;
  onSelectLanguage?: (langCode: string) => void;
}

export const TradingHeader: React.FC<TradingHeaderProps> = ({
  activeTab,
  onSelectTab,
  brandName = 'VERTEX Trading',
  brandShortName = 'VTX',
  brandTagline = 'Institutional Multi-Asset Platform',
  logoUrl,
  primaryColor,
  ordersCount = 3,
  positionsCount = 2,
  unreadNotificationsCount = 2,
  isDark,
  onToggleTheme,
  onOpenWallet,
  onOpenNotifications,
  onOpenTour,
  onOpenCentralControls,
  onReturnToAdmin,
  clientInitials = 'DT',
  clientFullName = 'Demo Trader',
  currentLanguage = 'en',
  onSelectLanguage
}) => {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const activeLang = getLanguageOption(currentLanguage);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false);
      }
    };
    if (langDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [langDropdownOpen]);

  return (
    <header
      id="trading-main-header"
      className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B111C]/95 border-b border-slate-200 dark:border-[#1A2638] px-3 sm:px-6 py-2.5 backdrop-blur-md shadow-xs transition-colors duration-150"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Brand Identity Logo & Name */}
        <div
          onClick={() => onSelectTab('watchlist')}
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          title={`${brandName} - Click for Watchlist`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={brandName}
              className="h-9 max-w-[130px] object-contain rounded-xl bg-slate-100 dark:bg-black/20 p-1 border border-slate-200 dark:border-white/10 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-md group-hover:scale-105 transition-transform"
              style={{ backgroundColor: primaryColor || '#3b82f6' }}
            >
              {brandShortName}
            </div>
          )}
          <div className="flex flex-col">
            <span
              className="text-base sm:text-lg font-black tracking-tight leading-none group-hover:opacity-90 transition-colors"
              style={{ color: primaryColor || '#f59e0b' }}
            >
              {brandName}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
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
            <span>{t(currentLanguage, 'nav_watchlist')}</span>
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
            <span>{t(currentLanguage, 'nav_orders')}</span>
            {ordersCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'orders'
                    ? 'bg-slate-900 text-amber-400'
                    : 'bg-slate-200 dark:bg-[#142032] text-slate-700 dark:text-slate-300'
                }`}
              >
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
            <span>{t(currentLanguage, 'nav_portfolio')}</span>
            {positionsCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'portfolio'
                    ? 'bg-slate-900 text-amber-400'
                    : 'bg-slate-200 dark:bg-[#142032] text-slate-700 dark:text-slate-300'
                }`}
              >
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
            <span>{t(currentLanguage, 'nav_history')}</span>
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
            <span>{t(currentLanguage, 'nav_profile')}</span>
          </button>
        </nav>

        {/* Right side utility icons & buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Central Admin Switcher (If accessible) */}
          {onReturnToAdmin && (
            <button
              type="button"
              id="header-admin-panel-btn"
              onClick={onReturnToAdmin}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors cursor-pointer"
              title="Return to Central Admin Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>{t(currentLanguage, 'btn_admin_panel')}</span>
            </button>
          )}

          {/* Central Controls */}
          {onOpenCentralControls && (
            <button
              type="button"
              id="header-central-controls-btn"
              onClick={onOpenCentralControls}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-500 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Central Policy & Risk Controls"
            >
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden md:inline">{t(currentLanguage, 'btn_central_controls')}</span>
            </button>
          )}

          {/* Theme toggle (Light / Dark mode) */}
          <button
            type="button"
            id="header-theme-toggle"
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-300 transition-colors cursor-pointer active:scale-95 shadow-2xs"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Language Selector Dropdown (Matching Screenshot 2 exactly) */}
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              id="header-lang-btn"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                langDropdownOpen
                  ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 border'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0E1626] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200'
              }`}
              title="Select Platform Language"
            >
              <Globe className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="font-semibold">{activeLang.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langDropdownOpen && (
              <div
                id="header-lang-dropdown-menu"
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-[#1E2E44]/60 mb-1">
                  Select Language / भाषा चुनें
                </div>
                {SUPPORTED_LANGUAGES.map(lang => {
                  const isSelected = (currentLanguage || 'en').toLowerCase() === lang.code.toLowerCase();
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        onSelectLanguage?.(lang.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#142236]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium tracking-wide">{lang.nativeName}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-500 stroke-[3]" />}
                      </div>
                      <span className={`text-xs ${isSelected ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                        {lang.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wallet Button */}
          <button
            type="button"
            id="header-wallet-btn"
            onClick={onOpenWallet}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Open Wallet & Manage Funds"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(currentLanguage, 'btn_wallet')}</span>
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
