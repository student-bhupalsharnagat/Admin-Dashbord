import React from 'react';
import {
  TrendingUp,
  LayoutDashboard,
  Crown,
  Building2,
  Users2,
  Users,
  CreditCard,
  Wallet,
  BookOpen,
  ShoppingCart,
  Activity,
  CandlestickChart,
  DollarSign,
  AlertTriangle,
  FileText,
  Bell,
  Headphones,
  Building,
  Globe,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { canAccessTab } from '../../utils/rbac';

export type NavigationTab =
  | 'dashboard'
  | 'masters'
  | 'brokers'
  | 'sub-brokers'
  | 'clients'
  | 'tree'
  | 'kyc'
  | 'funds'
  | 'ledger'
  | 'orders'
  | 'trades'
  | 'positions'
  | 'orders-trades'
  | 'commission'
  | 'risk'
  | 'reports'
  | 'notifications'
  | 'support'
  | 'tenants'
  | 'subscriptions'
  | 'whitelabel'
  | 'white-label'
  | 'audit-logs'
  | 'settings'
  | 'rbac';

interface AdminSidebarProps {
  activeTab?: NavigationTab;
  currentTab?: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onLogout?: () => void;
  currentUser?: { role?: string; name?: string } | null;
  badgeCounts?: {
    kycPending?: number;
    openTickets?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  currentTab,
  onSelectTab,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
  onLogout,
  currentUser,
  badgeCounts
}) => {
  const selectedTab = activeTab || currentTab || 'dashboard';

  // Navigation matching screenshot order: Orders and Trades divided into separate entries
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tenants', label: 'Tenants', icon: Building },
    { id: 'masters', label: 'Masters', icon: Crown },
    { id: 'brokers', label: 'Brokers', icon: Building2 },
    { id: 'sub-brokers', label: 'Sub-Brokers', icon: Users2 },
    { id: 'clients', label: 'Clients', icon: Users },
    {
      id: 'kyc',
      label: 'KYC',
      icon: CreditCard,
      badge: badgeCounts?.kycPending ? String(badgeCounts.kycPending) : undefined
    },
    { id: 'funds', label: 'Funds', icon: Wallet },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'trades', label: 'Trades', icon: Activity },
    { id: 'positions', label: 'Positions', icon: CandlestickChart },
    { id: 'commission', label: 'Commission', icon: DollarSign },
    { id: 'risk', label: 'Risk & Limits', icon: AlertTriangle },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    {
      id: 'support',
      label: 'Support',
      icon: Headphones,
      badge: badgeCounts?.openTickets ? String(badgeCounts.openTickets) : undefined
    },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'whitelabel', label: 'White Label', icon: Globe },
    { id: 'audit-logs', label: 'Audit & Logs', icon: BookOpen },
    { id: 'settings', label: 'Settings & Controls', icon: Settings },
    { id: 'rbac', label: 'Roles & Permissions', icon: ShieldCheck }
  ];

  // Dynamically filter menu items according to user role permissions
  const menuItems = allMenuItems.filter(item => {
    return canAccessTab(currentUser?.role, item.id as NavigationTab);
  });

  const { theme, toggleTheme } = useTheme();

  const handleItemClick = (id: string) => {
    onSelectTab(id as NavigationTab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static top-0 bottom-0 left-0 z-50 md:z-auto bg-[#070d19] border-r border-[#131d33] flex flex-col transition-all duration-300 select-none shrink-0 safe-top safe-bottom ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-20 w-64' : 'w-64'}`}
      >
        {/* Brand Header - TradeMatrix Logo and Toggle */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#131d33] shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-md bg-[#2563eb] text-white flex items-center justify-center shadow-sm shrink-0">
              <TrendingUp size={16} className="stroke-[2.5]" />
            </div>
            {(!collapsed || mobileOpen) && (
              <span className="font-bold text-white text-[15px] tracking-tight truncate">
                TradeMatrix
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Toggle */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden md:flex p-1.5 rounded text-slate-500 hover:text-white hover:bg-[#111c34] transition-colors cursor-pointer"
              >
                {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              </button>
            )}

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              title="Close navigation"
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#111c34] transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Role section label matching current user role */}
        {(!collapsed || mobileOpen) && (
          <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
            <span className="font-extrabold text-[#38bdf8] text-[11px] tracking-wider uppercase font-sans select-none">
              {(currentUser?.role || 'SUPER_ADMIN').replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 px-1.5 py-0.5 rounded font-mono">
              RBAC
            </span>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            // Match both 'trades' and legacy 'orders-trades' for trades if tab selected
            const isActive =
              selectedTab === item.id ||
              (item.id === 'trades' && selectedTab === 'orders-trades');

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={collapsed && !mobileOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group relative cursor-pointer min-h-[40px] ${
                  isActive
                    ? 'bg-[#0d2246] border border-[#1d4ed8] text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0d172c] border border-transparent'
                }`}
              >
                <Icon
                  size={16}
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-[#38bdf8]' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {(!collapsed || mobileOpen) && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {(!collapsed || mobileOpen) && item.badge && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#15274d] text-blue-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer / Theme Switch & Logout */}
        <div className="p-3 border-t border-[#131d33] shrink-0 space-y-1.5">
          {/* Theme Switch Pill */}
          {(!collapsed || mobileOpen) ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0d172c] border border-[#131d33] text-xs min-h-[40px]">
              <div className="flex items-center gap-2 text-slate-300">
                {theme === 'dark' ? (
                  <Moon size={13} className="text-blue-400" />
                ) : (
                  <Sun size={13} className="text-amber-500" />
                )}
                <span className="text-[11px] font-medium">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={`w-8 h-4 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                  theme === 'dark' ? 'bg-blue-600' : 'bg-slate-400'
                }`}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle Theme"
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                    theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Theme"
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#111c34] transition-colors cursor-pointer min-h-[40px]"
            >
              {theme === 'dark' ? (
                <Sun size={16} className="text-amber-400" />
              ) : (
                <Moon size={16} className="text-blue-500" />
              )}
            </button>
          )}

          <button
            onClick={() => {
              if (onLogout) onLogout();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer min-h-[40px] ${
              collapsed && !mobileOpen ? 'justify-center' : ''
            }`}
            title="Logout"
          >
            <LogOut size={16} className="shrink-0" />
            {(!collapsed || mobileOpen) && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
