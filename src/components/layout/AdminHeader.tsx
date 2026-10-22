import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  Building,
  Shield,
  User,
  Lock,
  Key,
  Settings,
  LogOut,
  Check,
  X,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { Tenant, AuthUser } from '../../types';
import { UserProfileModals } from '../modals/UserProfileModals';
import { useTheme } from '../../context/ThemeContext';

interface AdminHeaderProps {
  breadcrumbs: string[];
  tenants: Tenant[];
  selectedTenantId: string | null;
  onSelectTenantScope: (tenantId: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLogout: () => void;
  currentUser?: AuthUser | null;
  activeUsersCount?: number;
  onOpenNotifications?: () => void;
  onNavigateFunds?: (tab: 'deposits' | 'withdrawals', status?: string) => void;
  onOpenMobileMenu?: () => void;
  onOpenTradingPlatform?: () => void;
  clients?: any[];
  orders?: any[];
  onNavigateTab?: (tab: string) => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  breadcrumbs,
  tenants,
  selectedTenantId,
  onSelectTenantScope,
  searchQuery,
  onSearchChange,
  onLogout,
  currentUser,
  activeUsersCount = 1,
  onOpenNotifications,
  onNavigateFunds,
  onOpenMobileMenu,
  onOpenTradingPlatform,
  clients = [],
  orders = [],
  onNavigateTab
}) => {
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Active modal triggered from profile dropdown
  const [activeModal, setActiveModal] = useState<'profile' | 'security' | 'password' | 'settings' | null>(null);

  // Refs for outside click closing
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const tenantMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(target)) {
        setShowTenantMenu(false);
      }
      if (notificationsMenuRef.current && !notificationsMenuRef.current.contains(target)) {
        setShowNotificationsMenu(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { clients: [], orders: [], total: 0 };

    const matchedClients = (clients || []).filter((c: any) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q) ||
      (c.client_code || '').toLowerCase().includes(q) ||
      (c.clientCode || '').toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedOrders = (orders || []).filter((o: any) =>
      (o.id || '').toLowerCase().includes(q) ||
      (o.symbol || '').toLowerCase().includes(q) ||
      (o.client_name || '').toLowerCase().includes(q) ||
      (o.clientName || '').toLowerCase().includes(q) ||
      (o.side || '').toLowerCase().includes(q)
    ).slice(0, 4);

    return {
      clients: matchedClients,
      orders: matchedOrders,
      total: matchedClients.length + matchedOrders.length
    };
  }, [searchQuery, clients, orders]);

  const activeTenant = tenants.find(t => t.id === selectedTenantId);

  return (
    <header className="h-16 bg-[#090f1e] border-b border-[#152038] px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none shrink-0 safe-top">
      {/* Left side: Mobile Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Button */}
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#111b33] transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Breadcrumbs: compact on mobile, full trail on sm+ */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs truncate">
          {/* Mobile view: show current section only */}
          <span className="sm:hidden text-slate-200 font-bold truncate max-w-[140px]">
            {breadcrumbs[breadcrumbs.length - 1] || 'Dashboard'}
          </span>

          {/* Tablet & Desktop: show breadcrumb trail */}
          <div className="hidden sm:flex items-center gap-2 truncate">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                {idx > 0 && <span className="text-slate-500 font-medium text-[11px] select-none">&gt;</span>}
                <span
                  className={
                    idx === breadcrumbs.length - 1
                      ? 'text-slate-200 font-semibold truncate'
                      : 'text-slate-400 hover:text-slate-300 truncate'
                  }
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Global Search (Desktop & Tablet) */}
        <div className="relative w-48 md:w-64 hidden sm:block" ref={searchContainerRef}>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setSearchFocused(true)}
            onChange={e => {
              onSearchChange(e.target.value);
              setSearchFocused(true);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') setSearchFocused(true);
              if (e.key === 'Escape') setSearchFocused(false);
            }}
            placeholder="Search clients, orders, transactions.."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0e1629] border border-[#18243e] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 transition-colors"
          />

          {/* Interactive Search Results Dropdown (QA-008) */}
          {searchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-[#0c1527] border border-[#1a2948] rounded-xl shadow-2xl shadow-black/80 py-2 z-50 text-xs overflow-hidden max-h-80 overflow-y-auto">
              {searchResults.total === 0 ? (
                <div className="px-4 py-4 text-center text-slate-400">
                  No matching records found for '{searchQuery}'
                </div>
              ) : (
                <div className="divide-y divide-[#15223c]">
                  {searchResults.clients.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Clients ({searchResults.clients.length})
                      </div>
                      {searchResults.clients.map((c: any) => (
                        <button
                          key={c.id || c.client_code}
                          onClick={() => {
                            setSearchFocused(false);
                            onNavigateTab?.('clients');
                          }}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#13203c] transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-white block truncate">{c.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.id || c.client_code} • {c.email}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Client</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.orders.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Orders ({searchResults.orders.length})
                      </div>
                      {searchResults.orders.map((o: any) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setSearchFocused(false);
                            onNavigateTab?.('orders');
                          }}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#13203c] transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-white block truncate">{o.symbol} • {o.id}</span>
                            <span className="text-[10px] text-slate-400">{o.client_name || o.clientName || 'Trader'}</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${o.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {o.side || 'ORDER'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Search Toggle Button */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="sm:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#111b33] transition-colors cursor-pointer"
          title="Search"
        >
          <Search size={17} />
        </button>

        {/* Multi-Tenant Scope Switcher */}
        <div className="relative" ref={tenantMenuRef}>
          <button
            onClick={() => {
              setShowTenantMenu(!showTenantMenu);
              setShowNotificationsMenu(false);
              setShowProfileMenu(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg bg-[#0e1629] border border-[#18243e] hover:border-blue-500/50 text-xs font-medium text-slate-300 transition-colors"
            title="Switch Tenant Scope"
          >
            <Building size={14} className="text-blue-400 shrink-0" />
            <span className="max-w-[70px] sm:max-w-[120px] truncate">
              {activeTenant ? activeTenant.name : 'All Tenants'}
            </span>
            <ChevronDown size={13} className="text-slate-500 shrink-0" />
          </button>

          {showTenantMenu && (
            <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#0d162b] border border-[#1c2c4d] rounded-xl shadow-xl shadow-black/60 py-1.5 z-50 text-xs">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#18243e]">
                Tenant Filter Scope
              </div>
              <button
                onClick={() => {
                  onSelectTenantScope(null);
                  setShowTenantMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#131f3b] ${
                  selectedTenantId === null ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Global (All Tenants)</span>
                </div>
                {selectedTenantId === null && <Check size={14} />}
              </button>
              {tenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectTenantScope(t.id);
                    setShowTenantMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#131f3b] ${
                    selectedTenantId === t.id ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                      {t.code}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </div>
                  {selectedTenantId === t.id && <Check size={14} className="shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Active Traders Telemetry Indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0e1629] border border-[#18243e] text-[11px] text-slate-300 select-none"
          title={`${activeUsersCount} Active User${activeUsersCount === 1 ? '' : 's'} connected across trading infrastructure`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-400 font-mono">{activeUsersCount}</span>
          <span className="text-slate-400 text-[10px]">Active</span>
        </div>

        {/* Launch Tenant Trading Platform */}
        {onOpenTradingPlatform && (
          <button
            id="trading-platform-btn"
            onClick={onOpenTradingPlatform}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition-colors cursor-pointer"
            title="Open B2C Trading Platform Terminal"
          >
            <Globe size={14} className="animate-pulse text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Trading Platform</span>
            <span className="sm:hidden">Terminal</span>
          </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notificationsMenuRef}>
          <button
            onClick={() => {
              setShowNotificationsMenu(!showNotificationsMenu);
              setShowTenantMenu(false);
              setShowProfileMenu(false);
            }}
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#111b33] transition-colors"
            title="System Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              3
            </span>
          </button>

            {showNotificationsMenu && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-[#0d162b] border border-[#1c2c4d] rounded-xl shadow-xl shadow-black/70 p-3 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#18243e]">
                <span className="font-semibold text-slate-200">Alerts & Notifications</span>
                <button
                  onClick={() => {
                    onOpenNotifications?.();
                    setShowNotificationsMenu(false);
                  }}
                  className="text-[10px] text-blue-400 cursor-pointer hover:underline"
                >
                  View all in Notifications &rarr;
                </button>
              </div>
              <div className="space-y-2">
                <div
                  onClick={() => {
                    onOpenNotifications?.();
                    setShowNotificationsMenu(false);
                  }}
                  className="p-2 rounded bg-[#121c35] border border-blue-500/20 text-slate-300 hover:bg-[#162342] transition-colors cursor-pointer"
                >
                  <div className="font-medium text-white flex items-center justify-between">
                    <span>KYC Document Submitted</span>
                    <span className="text-[10px] text-slate-500">10m ago</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Nathan Brooks submitted KYC documents for review.
                  </p>
                </div>
                <div
                  onClick={() => {
                    if (onNavigateFunds) {
                      onNavigateFunds('withdrawals', 'PENDING');
                    } else {
                      onOpenNotifications?.();
                    }
                    setShowNotificationsMenu(false);
                  }}
                  className="p-2 rounded bg-[#121c35] border border-amber-500/20 text-slate-300 hover:bg-[#162342] transition-colors cursor-pointer"
                >
                  <div className="font-medium text-white flex items-center justify-between">
                    <span>Withdrawal Request</span>
                    <span className="text-[10px] text-slate-500">25m ago</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Maya Patel requested withdrawal of ₹12,000.
                  </p>
                </div>
                <div
                  onClick={() => {
                    onOpenNotifications?.();
                    setShowNotificationsMenu(false);
                  }}
                  className="p-2 rounded bg-[#121c35] border border-blue-500/20 text-slate-300 hover:bg-[#162342] transition-colors cursor-pointer"
                >
                  <div className="font-medium text-white flex items-center justify-between">
                    <span>Large Order Alert</span>
                    <span className="text-[10px] text-slate-500">1h ago</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Order ORD002 - BTC/INR ₹15,059 executed by Maya Patel.
                  </p>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#18243e] text-center">
                <button
                  onClick={() => {
                    onOpenNotifications?.();
                    setShowNotificationsMenu(false);
                  }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Open Notifications Center
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Help icon */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#111b33] transition-colors"
          title="Platform Architecture & Help"
        >
          <HelpCircle size={18} />
        </button>

        {/* Quick Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#111b33] transition-all flex items-center justify-center cursor-pointer group"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Dark and Light Mode"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
          ) : (
            <Moon size={18} className="text-blue-600 group-hover:-rotate-12 transition-transform duration-300" />
          )}
        </button>

        {/* User Profile Trigger & Dropdown Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowTenantMenu(false);
              setShowNotificationsMenu(false);
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#0b1325] border border-[#1d2b4a] hover:border-blue-500/50 hover:bg-[#0f1a33] transition-all text-left"
          >
            {/* Avatar Circle */}
            <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0 uppercase">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
            </div>

            {/* Name and Role */}
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-100 leading-tight">
                {currentUser?.name || 'Admin John'}
              </span>
              <span className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                {currentUser?.role
                  ? currentUser.role === 'SUPER_ADMIN'
                    ? 'Super Admin'
                    : currentUser.role.replace(/_/g, ' ')
                  : 'Super Admin'}
              </span>
            </div>

            {/* Downward Chevron */}
            <ChevronDown
              size={14}
              className={`text-slate-400 ml-0.5 transition-transform duration-200 ${
                showProfileMenu ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </button>

          {/* User Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-[#0b1325] border border-[#1b2b4d] rounded-2xl shadow-2xl shadow-black/80 py-2 px-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
              {/* 1. My Profile */}
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setActiveModal('profile');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-[#13203e] rounded-xl transition-colors font-medium group"
              >
                <User size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
                <span>My Profile</span>
              </button>

              {/* 2. Security */}
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setActiveModal('security');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-[#13203e] rounded-xl transition-colors font-medium group"
              >
                <Lock size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
                <span>Security</span>
              </button>

              {/* 3. Change Password */}
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setActiveModal('password');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-[#13203e] rounded-xl transition-colors font-medium group"
              >
                <Key size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
                <span>Change Password</span>
              </button>

              {/* 4. Settings */}
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setActiveModal('settings');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-slate-200 hover:text-white hover:bg-[#13203e] rounded-xl transition-colors font-medium group cursor-pointer"
              >
                <Settings size={16} className="text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
                <span>Settings</span>
              </button>

              {/* 5. Dark / Light Mode Switcher */}
              <div className="flex items-center justify-between px-3 py-2 text-slate-200 hover:bg-[#13203e] rounded-xl transition-colors font-medium">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon size={16} className="text-blue-400 shrink-0" />
                  ) : (
                    <Sun size={16} className="text-amber-500 shrink-0" />
                  )}
                  <span className="text-xs">Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                    theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle Theme"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                      theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Subtle Horizontal Divider */}
              <div className="border-t border-[#182647] my-1.5" />

              {/* 6. Logout */}
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-medium group"
              >
                <LogOut size={16} className="text-red-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Profile Modals (My Profile, Security, Change Password, Settings) */}
      <UserProfileModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        currentUser={currentUser}
      />

      {/* Platform Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#0b1325] border border-[#1b2b4d] rounded-2xl shadow-2xl p-6 space-y-4 text-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#182647] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">TradeMatrix Central Architecture</h3>
                  <p className="text-[11px] text-slate-400">Multi-tenant hierarchy & system roles</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-[#0e172e] border border-[#1a2948]">
                <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Shield size={13} className="text-blue-400" /> Multi-Tenant Architecture
                </div>
                Central Admin Panel acts as the supreme control plane commanding independent white-label tenant instances (Alpha Prime, Quantum Trading, etc.).
              </div>

              <div className="p-3 rounded-xl bg-[#0e172e] border border-[#1a2948]">
                <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <Building size={13} className="text-emerald-400" /> Organizational Hierarchy
                </div>
                <div className="font-mono text-[11px] text-slate-400 space-y-1 mt-1">
                  <div>👑 Super Admin (Full Platform)</div>
                  <div className="pl-3">↳ 🎖️ Master (Tenant Franchisee)</div>
                  <div className="pl-6">↳ 🏢 Broker (Desk Principal)</div>
                  <div className="pl-9">↳ 💼 Sub-Broker (Branch Affiliate)</div>
                  <div className="pl-12">↳ 👤 Client (Trading End-User)</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Search Overlay Bar */}
      {mobileSearchOpen && (
        <div className="sm:hidden absolute top-16 left-0 right-0 bg-[#090f1e] border-b border-[#152038] p-3 shadow-xl z-40">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search clients, orders, transactions.."
              className="w-full pl-9 pr-9 py-2 bg-[#0e1629] border border-[#18243e] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
          {searchQuery.trim().length > 0 && (
            <div className="mt-2 bg-[#0c1527] border border-[#1a2948] rounded-xl shadow-2xl py-2 text-xs overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.total === 0 ? (
                <div className="px-4 py-3 text-center text-slate-400">
                  No matching records found for '{searchQuery}'
                </div>
              ) : (
                <div className="divide-y divide-[#15223c]">
                  {searchResults.clients.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Clients ({searchResults.clients.length})
                      </div>
                      {searchResults.clients.map((c: any) => (
                        <button
                          key={c.id || c.client_code}
                          onClick={() => {
                            setMobileSearchOpen(false);
                            onNavigateTab?.('clients');
                          }}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#13203c]"
                        >
                          <div>
                            <span className="font-semibold text-white block truncate">{c.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.id || c.client_code} • {c.email}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">Client</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.orders.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Orders ({searchResults.orders.length})
                      </div>
                      {searchResults.orders.map((o: any) => (
                        <button
                          key={o.id}
                          onClick={() => {
                            setMobileSearchOpen(false);
                            onNavigateTab?.('orders');
                          }}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#13203c]"
                        >
                          <div>
                            <span className="font-semibold text-white block truncate">{o.symbol} • {o.id}</span>
                            <span className="text-[10px] text-slate-400">{o.client_name || o.clientName || 'Trader'}</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${o.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {o.side || 'ORDER'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};
