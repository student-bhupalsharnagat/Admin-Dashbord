/**
 * TradePro Central Admin Panel
 * Architecture: Central Admin Panel -> Central API -> Multi-Tenant Trading Infrastructure
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminSidebar, NavigationTab } from './components/layout/AdminSidebar';
import { AdminHeader } from './components/layout/AdminHeader';
import { DashboardView } from './views/DashboardView';
import { TenantsView } from './views/TenantsView';
import { TenantDetailView } from './views/TenantDetailView';
import { HierarchyViews } from './views/HierarchyViews';
import { TradingMonitorView } from './views/TradingMonitorView';
import { TradesView } from './views/TradesView';
import { OrdersView } from './views/OrdersView';
import { PositionsView } from './views/PositionsView';
import { CommissionView } from './views/CommissionView';
import { RiskLimitsView } from './views/RiskLimitsView';
import { ComplianceView } from './views/ComplianceView';
import { ReportsView } from './views/ReportsView';
import { NotificationsView } from './views/NotificationsView';
import { SupportView } from './views/SupportView';
import { SubscriptionsView } from './views/SubscriptionsView';
import { WhiteLabelView } from './views/WhiteLabelView';
import { TradingPlatformView } from './views/TradingPlatformView';
import { SystemToolsView } from './views/SystemToolsView';
import { RbacView } from './components/views/RbacView';
import { useTheme } from './context/ThemeContext';
import { canAccessTab } from './utils/rbac';
import { ShieldAlert } from 'lucide-react';

// Modals
import { CreateMasterModal } from './components/modals/CreateMasterModal';
import { CreateBrokerModal } from './components/modals/CreateBrokerModal';
import { AddClientModal } from './components/modals/AddClientModal';
import { ReviewKYCModal } from './components/modals/ReviewKYCModal';
import { CreateTenantModal } from './components/modals/CreateTenantModal';
import { AuthScreen } from './components/auth/AuthScreen';

import {
  DashboardData,
  Tenant,
  Master,
  Broker,
  SubBroker,
  Client,
  Trade,
  KYCRecord,
  DashboardKPIs,
  VolumeCommissionChartPoint,
  ClientGrowthChartPoint,
  DailyPLPoint,
  AuthUser,
  UserRole
} from './types';

export default function App() {
  const { isDark } = useTheme();
  // Application Mode: Central Admin Panel vs Tenant Trading Platform
  const [appMode, setAppMode] = useState<'admin' | 'trading-platform'>('admin');
  const [activeTradingDomain, setActiveTradingDomain] = useState<string>('trade.alphaprime.com');

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<Tenant | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global Multi-Tenant Scope filter for Super Admin (null = All Tenants)
  const [selectedTenantScope, setSelectedTenantScope] = useState<string | null>(null);

  // Global search input in header
  const [searchQuery, setSearchQuery] = useState('');

  // Funds View navigation control (deep-linking to deposits or withdrawals)
  const [fundsInitialTab, setFundsInitialTab] = useState<'deposits' | 'withdrawals'>('deposits');
  const [fundsInitialStatus, setFundsInitialStatus] = useState<string>('All Status');
  const [fundsNavigationNonce, setFundsNavigationNonce] = useState<number>(0);

  const handleNavigateFunds = (tab: 'deposits' | 'withdrawals' = 'deposits', status: string = 'PENDING') => {
    setFundsInitialTab(tab);
    setFundsInitialStatus(status);
    setFundsNavigationNonce(prev => prev + 1);
    setActiveTab('funds');
  };

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [subBrokers, setSubBrokers] = useState<SubBroker[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [selectedTradeForDetail, setSelectedTradeForDetail] = useState<any | null>(null);

  // Modals state
  const [showCreateMasterModal, setShowCreateMasterModal] = useState(false);
  const [showCreateBrokerModal, setShowCreateBrokerModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [selectedKycForReview, setSelectedKycForReview] = useState<KYCRecord | null>(null);

  // Authentication State (default to Super Admin for immediate dashboard rendering)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('tradematrix_session');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // Ignore parse failure
    }
    return {
      id: 'usr_superadmin_01',
      name: 'Admin John',
      email: 'admin@platform.com',
      role: 'SUPER_ADMIN',
      tenantId: 'GLOBAL',
      tenantName: 'All Tenants (Global Scope)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    };
  });

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('tradematrix_session', JSON.stringify(user));
    } catch (e) {
      // Ignore storage failure
    }
    showToast(`Welcome back, ${user.name}! Signed in as ${user.role}.`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('tradematrix_session');
    } catch (e) {
      // Ignore storage failure
    }
    showToast('Signed out of TradeMatrix. Session ended.', 'info');
  };

  // Notification Toast state (clean alternative to browser alert)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Dashboard & System Data
  const loadDashboardData = useCallback(async () => {
    try {
      const url = selectedTenantScope
        ? `/api/admin/dashboard?tenantId=${selectedTenantScope}`
        : '/api/admin/dashboard';
      const res = await fetch(url);
      if (res.ok) {
        const data: DashboardData = await res.json();
        setDashboardData(data);
        setTenants(data.tenants || []);
        setRecentTrades(data.recentTrades || []);
        setPendingKYC(data.pendingKYC || []);
      }
    } catch (err) {
      console.warn('Backend API fetch error, using resilient state:', err);
    }
  }, [selectedTenantScope]);

  // Fetch Full Hierarchy Entities
  const loadHierarchyData = useCallback(async () => {
    try {
      const [mRes, bRes, sbRes, cRes, kRes, tRes] = await Promise.all([
        fetch('/api/admin/hierarchy/masters'),
        fetch('/api/admin/hierarchy/brokers'),
        fetch('/api/admin/hierarchy/sub-brokers'),
        fetch('/api/admin/hierarchy/clients'),
        fetch('/api/admin/kyc'),
        fetch('/api/admin/trading/trades')
      ]);

      if (mRes.ok) setMasters(await mRes.json());
      if (bRes.ok) setBrokers(await bRes.json());
      if (sbRes.ok) setSubBrokers(await sbRes.json());
      if (cRes.ok) setClients(await cRes.json());
      if (kRes.ok) setKycRecords(await kRes.json());
      if (tRes.ok) setTrades(await tRes.json());
    } catch (err) {
      console.warn('API sync warning:', err);
    }
  }, []);

  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [pendingKYC, setPendingKYC] = useState<KYCRecord[]>([]);

  useEffect(() => {
    loadDashboardData();
    loadHierarchyData();
  }, [loadDashboardData, loadHierarchyData]);

  // Dynamic breadcrumb generation matching screenshot (e.g. Dashboard > Trades)
  const getBreadcrumbs = () => {
    if (selectedTenantForDetail) {
      return ['Dashboard', 'Tenants', selectedTenantForDetail.name];
    }
    switch (activeTab) {
      case 'dashboard':
        return ['Dashboard'];
      case 'trades':
        return ['Dashboard', 'Trades'];
      case 'orders':
        return ['Dashboard', 'Orders'];
      case 'positions':
        return ['Dashboard', 'Positions'];
      case 'tenants':
        return ['Dashboard', 'Tenants'];
      case 'masters':
        return ['Dashboard', 'Masters'];
      case 'brokers':
        return ['Dashboard', 'Brokers'];
      case 'sub-brokers':
        return ['Dashboard', 'Sub-Brokers'];
      case 'clients':
        return ['Dashboard', 'Clients'];
      case 'tree':
        return ['Dashboard', 'Downline Tree'];
      case 'orders-trades':
        return ['Dashboard', 'Trades'];
      case 'commission':
        return ['Dashboard', 'Commission'];
      case 'risk':
        return ['Dashboard', 'Risk & Limits'];
      case 'kyc':
        return ['Dashboard', 'KYC'];
      case 'funds':
        return ['Dashboard', 'Funds'];
      case 'ledger':
        return ['Dashboard', 'Ledger'];
      case 'subscriptions':
        return ['Dashboard', 'Subscriptions'];
      case 'whitelabel':
      case 'white-label':
        return ['Dashboard', 'White Label'];
      case 'reports':
        return ['Dashboard', 'Reports'];
      case 'notifications':
        return ['Dashboard', 'Notifications'];
      case 'support':
        return ['Dashboard', 'Support'];
      case 'audit-logs':
        return ['Dashboard', 'Audit Logs'];
      case 'settings':
        return ['Dashboard', 'Settings'];
      case 'rbac':
        return ['Security', 'Roles & Permissions (RBAC)'];
      default:
        return ['Dashboard'];
    }
  };

  // Creation Handlers
  const handleCreateMaster = async (data: any) => {
    const res = await fetch('/api/admin/hierarchy/masters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      await loadHierarchyData();
      await loadDashboardData();
    }
  };

  const handleCreateBroker = async (data: any) => {
    const res = await fetch('/api/admin/hierarchy/brokers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      await loadHierarchyData();
      await loadDashboardData();
    }
  };

  const handleAddClient = async (data: any) => {
    const res = await fetch('/api/admin/hierarchy/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      await loadHierarchyData();
      await loadDashboardData();
    }
  };

  const handleCreateTenant = async (data: any) => {
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const newTenant = await res.json();
      setTenants(prev => [newTenant, ...prev]);
      await loadDashboardData();
    }
  };

  const handleUpdateKYCStatus = async (
    id: string,
    status: KYCRecord['kyc_status'],
    notes?: string
  ) => {
    const res = await fetch(`/api/admin/kyc/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    if (res.ok) {
      await loadHierarchyData();
      await loadDashboardData();
    }
  };

  const handleToggleEntityStatus = async (
    type: string,
    id: string,
    currentStatus: string
  ) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await fetch(`/api/admin/entities/${type}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      await loadHierarchyData();
      await loadDashboardData();
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await fetch(`/api/admin/tenants/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      setTenants(prev =>
        prev.map(t => (t.id === id ? { ...t, status: newStatus as any } : t))
      );
      await loadDashboardData();
    }
  };

  const handleSwitchUserRole = (newRole: UserRole) => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        role: newRole,
        roleName: newRole.replace(/_/g, ' ')
      });
      showToast(`Active session role switched to ${newRole.replace(/_/g, ' ')}`, 'info');
      // If the current tab cannot be accessed by the new role, redirect gracefully to dashboard
      if (!canAccessTab(newRole, activeTab)) {
        setActiveTab('dashboard');
      }
    }
  };

  // If no user is logged in, show the TradeMatrix Login & Sign Up screen
  if (!currentUser) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} tenants={tenants} />

        {/* Floating System Toast Notification */}
        {toast && (
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] bg-[#0e172a] border border-[#1e293b] rounded-xl shadow-2xl p-3 flex items-start gap-3 text-xs animate-in slide-in-from-bottom-2">
            <div
              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                toast.type === 'success'
                  ? 'bg-emerald-400'
                  : toast.type === 'warning'
                  ? 'bg-amber-400'
                  : 'bg-blue-400'
              }`}
            />
            <div className="flex-1 text-slate-200 font-medium leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
            >
              ×
            </button>
          </div>
        )}
      </>
    );
  }

  // If in Trading Platform Mode: render the dedicated Branded Tenant Trading Platform
  if (appMode === 'trading-platform') {
    return (
      <TradingPlatformView
        initialTenantDomain={activeTradingDomain}
        onReturnToAdmin={() => setAppMode('admin')}
        onNotify={showToast}
      />
    );
  }

  return (
    <div className={`flex h-screen ${isDark ? 'bg-[#070d19] text-slate-100' : 'bg-slate-100 text-slate-900'} overflow-hidden font-sans`}>
      {/* Central Admin Left Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={tab => {
          setSelectedTenantForDetail(null);
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        currentUser={currentUser}
        badgeCounts={{
          kycPending: dashboardData?.kpis.pending_kyc.value || 2,
          openTickets: dashboardData?.kpis.open_tickets.value || 4
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <AdminHeader
          breadcrumbs={getBreadcrumbs()}
          tenants={tenants}
          selectedTenantId={selectedTenantScope}
          onSelectTenantScope={tenantId => {
            setSelectedTenantScope(tenantId);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLogout={handleLogout}
          currentUser={currentUser}
          onOpenNotifications={() => {
            setActiveTab('notifications');
          }}
          onNavigateFunds={handleNavigateFunds}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onOpenTradingPlatform={() => {
            const currentTenant = tenants.find(t => t.id === selectedTenantScope);
            const domain = currentTenant?.domain || (selectedTenantScope === 'ten-02' ? 'trade.zenithmarkets.in' : selectedTenantScope === 'ten-03' ? 'trade.quantumfx.io' : 'trade.alphaprime.com');
            setActiveTradingDomain(domain);
            setAppMode('trading-platform');
          }}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1920px] mx-auto w-full">
          {/* Tenant Detail Drill-down */}
          {selectedTenantForDetail ? (
            <TenantDetailView
              tenant={selectedTenantForDetail}
              onBack={() => setSelectedTenantForDetail(null)}
              masters={masters}
              brokers={brokers}
              subBrokers={subBrokers}
              clients={clients}
              trades={trades}
              kycRecords={kycRecords}
            />
          ) : !canAccessTab(currentUser?.role, activeTab) ? (
            <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center bg-[#0b1327] border border-rose-500/30 rounded-2xl max-w-xl mx-auto shadow-2xl space-y-4 my-8">
              <div className="p-4 bg-rose-500/10 text-rose-400 rounded-full border border-rose-500/30">
                <ShieldAlert size={42} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Access Restricted by RBAC Policy</h2>
                <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  Your current role <span className="font-mono text-rose-400 font-bold">{currentUser?.role || 'ANONYMOUS'}</span> is not authorized to access the <strong className="text-slate-200">{activeTab.toUpperCase()}</strong> module.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md shadow-blue-600/20"
                >
                  Return to Dashboard
                </button>
                <button
                  onClick={() => handleSwitchUserRole('SUPER_ADMIN')}
                  className="px-4 py-2 bg-[#162342] hover:bg-[#1c2d54] text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-[#233868] transition-all cursor-pointer"
                >
                  Switch to Super Admin
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Dashboard View */}
              {activeTab === 'dashboard' && (
                <DashboardView
                  kpis={dashboardData?.kpis || null}
                  volumeCommissionData={dashboardData?.volumeCommission || []}
                  clientGrowthData={dashboardData?.clientGrowth || []}
                  dailyPLData={dashboardData?.dailyPL || []}
                  dailyPLBadge="+₹28.4L MTD"
                  recentTrades={recentTrades.length ? recentTrades : dashboardData?.recentTrades || []}
                  pendingKYC={pendingKYC.length ? pendingKYC : dashboardData?.pendingKYC || []}
                  onNavigateTab={tab => setActiveTab(tab)}
                  onNavigateFunds={handleNavigateFunds}
                  onCreateMaster={() => setShowCreateMasterModal(true)}
                  onCreateBroker={() => setShowCreateBrokerModal(true)}
                  onAddClient={() => setShowAddClientModal(true)}
                  onReviewKYC={kyc => {
                    if (kyc) {
                      setSelectedKycForReview(kyc);
                    } else if (pendingKYC.length > 0) {
                      setSelectedKycForReview(pendingKYC[0]);
                    }
                  }}
                  onSelectTrade={trade => {
                    setSelectedTradeForDetail(trade);
                    setActiveTab('trades');
                  }}
                />
              )}

              {/* Trades View - matching user screenshot */}
              {(activeTab === 'trades' || activeTab === 'orders-trades') && (
                <TradesView
                  initialSelectedTrade={selectedTradeForDetail}
                  onNavigateToClient={() => setActiveTab('clients')}
                  onNotify={showToast}
                />
              )}

              {/* Orders View - matching user screenshot */}
              {activeTab === 'orders' && (
                <OrdersView
                  onNotify={showToast}
                  onNavigateToClient={() => setActiveTab('clients')}
                  onNavigateToTrade={() => setActiveTab('trades')}
                />
              )}

              {/* Open Positions View - matching user screenshot */}
              {activeTab === 'positions' && (
                <PositionsView onNotify={showToast} />
              )}

              {/* Commission Management View - matching user screenshot */}
              {activeTab === 'commission' && (
                <CommissionView onNotify={showToast} />
              )}

              {/* Risk & Limits View - matching user screenshot */}
              {activeTab === 'risk' && (
                <RiskLimitsView onNotify={showToast} />
              )}

              {/* Tenants View */}
              {activeTab === 'tenants' && (
                <TenantsView
                  tenants={tenants}
                  onOpenCreateTenant={() => setShowCreateTenantModal(true)}
                  onSelectTenantDetails={t => setSelectedTenantForDetail(t)}
                  onToggleStatus={handleToggleTenantStatus}
                  currentUser={currentUser}
                />
              )}

              {/* Hierarchy Views: Masters, Brokers, Sub-Brokers, Clients, Tree */}
              {['masters', 'brokers', 'sub-brokers', 'clients', 'tree'].includes(
                activeTab
              ) && (
                <HierarchyViews
                  level={
                    activeTab as
                      | 'masters'
                      | 'brokers'
                      | 'sub-brokers'
                      | 'clients'
                      | 'tree'
                  }
                  masters={masters}
                  brokers={brokers}
                  subBrokers={subBrokers}
                  clients={clients}
                  tenants={tenants}
                  onNavigateTab={tab => setActiveTab(tab)}
                  onCreateMaster={() => setShowCreateMasterModal(true)}
                  onCreateBroker={() => setShowCreateBrokerModal(true)}
                  onAddClient={() => setShowAddClientModal(true)}
                  onToggleStatus={handleToggleEntityStatus}
                  onNotify={showToast}
                />
              )}

              {/* Compliance Views: KYC, Funds, Ledger */}
              {['kyc', 'funds', 'ledger'].includes(activeTab) && (
                <ComplianceView
                  section={activeTab as 'kyc' | 'funds' | 'ledger'}
                  initialFundsTab={fundsInitialTab}
                  initialFundsStatus={fundsInitialStatus}
                  fundsNavigationNonce={fundsNavigationNonce}
                  kycRecords={kycRecords}
                  onReviewKYC={kyc => setSelectedKycForReview(kyc)}
                  onNotify={showToast}
                />
              )}

              {/* Reports Center View - matching Screenshot 1 */}
              {activeTab === 'reports' && (
                <ReportsView onNotify={showToast} currentUser={currentUser} />
              )}

              {/* Notifications View - matching Screenshot 2 */}
              {activeTab === 'notifications' && (
                <NotificationsView
                  onNotify={showToast}
                  onNavigateTab={tab => {
                    if (tab === 'funds') {
                      handleNavigateFunds('withdrawals', 'PENDING');
                    } else {
                      setActiveTab(tab);
                    }
                  }}
                />
              )}

              {/* Support Tickets View - matching Screenshot 3 */}
              {activeTab === 'support' && (
                <SupportView onNotify={showToast} currentUser={currentUser} />
              )}

              {/* Subscriptions & Plans View - matching Screenshot 4 */}
              {activeTab === 'subscriptions' && (
                <SubscriptionsView onNotify={showToast} />
              )}

              {/* White Label & Branding View - matching Screenshot 5 */}
              {['whitelabel', 'white-label'].includes(activeTab) && (
                <WhiteLabelView
                  onNotify={showToast}
                  selectedTenantScope={selectedTenantScope}
                  onLaunchTradingPlatform={domain => {
                    if (domain) setActiveTradingDomain(domain);
                    setAppMode('trading-platform');
                  }}
                />
              )}

              {/* System Audit Logs & Architecture Settings */}
              {['audit-logs', 'settings'].includes(activeTab) && (
                <SystemToolsView
                  section={activeTab as 'audit-logs' | 'settings'}
                  tenants={tenants}
                  onNotify={showToast}
                />
              )}

              {/* Role-Based Access Control (RBAC) Management View */}
              {activeTab === 'rbac' && (
                <RbacView
                  currentUser={currentUser}
                  onSwitchUserRole={handleSwitchUserRole}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating System Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] bg-[#0e172a] border border-[#1e293b] rounded-xl shadow-2xl p-3 flex items-start gap-3 text-xs animate-in slide-in-from-bottom-2">
          <div
            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-400'
                : toast.type === 'warning'
                ? 'bg-amber-400'
                : 'bg-blue-400'
            }`}
          />
          <div className="flex-1 text-slate-200 font-medium leading-relaxed">
            {toast.message}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Interactive Action Modals */}
      <CreateMasterModal
        isOpen={showCreateMasterModal}
        onClose={() => setShowCreateMasterModal(false)}
        tenants={tenants}
        onSubmit={handleCreateMaster}
      />

      <CreateBrokerModal
        isOpen={showCreateBrokerModal}
        onClose={() => setShowCreateBrokerModal(false)}
        masters={masters}
        onSubmit={handleCreateBroker}
      />

      <AddClientModal
        isOpen={showAddClientModal}
        onClose={() => setShowAddClientModal(false)}
        subBrokers={subBrokers}
        onSubmit={handleAddClient}
      />

      <ReviewKYCModal
        isOpen={!!selectedKycForReview}
        onClose={() => setSelectedKycForReview(null)}
        kyc={selectedKycForReview}
        onUpdateStatus={handleUpdateKYCStatus}
      />

      <CreateTenantModal
        isOpen={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
        onSubmit={handleCreateTenant}
      />
    </div>
  );
}
