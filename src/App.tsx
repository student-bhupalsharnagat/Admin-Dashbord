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
import { ErrorBoundary } from './components/ErrorBoundary';

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
  const [activeTradingClient, setActiveTradingClient] = useState<any | null>(null);

  // Navigation & View state
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<Tenant | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global Multi-Tenant Scope filter for Super Admin (null = All Tenants)
  const [selectedTenantScope, setSelectedTenantScope] = useState<string | null>(null);

  // Global search input in header
  const [searchQuery, setSearchQuery] = useState('');

  // Live active users telemetry
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);

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
  const DEFAULT_INITIAL_DASHBOARD: DashboardData = {
    kpis: {
      total_masters: { value: 5, badge: '+2 new', subtitle: 'Across all regions' },
      total_brokers: { value: 43, badge: '+5 new', subtitle: '38 active' },
      total_clients: { value: 3073, badge: '↑ 12.3%', subtitle: '1,360 KYC approved' },
      commission_earned: { value: '₹862K', badge: '↑ 11.4%', subtitle: 'Today' },
      todays_turnover: { value: '₹48.2M', badge: '↑ 9.8%', subtitle: 'Today' },
      total_pl: { value: '₹8.44M', badge: '↑ 22.1%', subtitle: 'Unrealized + Realized' },
      pending_kyc: { value: 2, subtitle: 'Requires review' },
      open_tickets: { value: 4, subtitle: '2 high priority' }
    },
    volumeCommission: [
      { date: '2026-01-01', displayDate: 'Jan', volume: 25, commission: 135 },
      { date: '2026-02-01', displayDate: 'Feb', volume: 25, commission: 142 },
      { date: '2026-03-01', displayDate: 'Mar', volume: 28, commission: 155 },
      { date: '2026-04-01', displayDate: 'Apr', volume: 26, commission: 145 },
      { date: '2026-05-01', displayDate: 'May', volume: 45, commission: 200 },
      { date: '2026-06-01', displayDate: 'Jun', volume: 55, commission: 215 }
    ],
    clientGrowth: [
      { month: 'Apr', clients: 2400 },
      { month: 'May', clients: 2600 },
      { month: 'Jun', clients: 2750 },
      { month: 'Jul', clients: 2900 },
      { month: 'Aug', clients: 2980 },
      { month: 'Sep', clients: 3073 }
    ],
    dailyPL: [
      { day: 'Sep 13', displayDay: '13 Sep', pl: 12.4, isProfit: true },
      { day: 'Sep 14', displayDay: '14 Sep', pl: -4.2, isProfit: false },
      { day: 'Sep 15', displayDay: '15 Sep', pl: 18.6, isProfit: true },
      { day: 'Sep 16', displayDay: '16 Sep', pl: 8.2, isProfit: true },
      { day: 'Sep 17', displayDay: '17 Sep', pl: -2.1, isProfit: false },
      { day: 'Sep 18', displayDay: '18 Sep', pl: 15.3, isProfit: true },
      { day: 'Sep 19', displayDay: '19 Sep', pl: 21.8, isProfit: true }
    ],
    recentTrades: [],
    pendingKYC: [],
    tenants: []
  };

  const [dashboardData, setDashboardData] = useState<DashboardData>(DEFAULT_INITIAL_DASHBOARD);
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

  // Authentication State (managed via secure HTTP-only cookie session)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Check active session on initial load
  useEffect(() => {
    let isMounted = true;
    async function checkAuthSession() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user && isMounted) {
            setCurrentUser(data.user);
            if (data.user.tenant_id && data.user.tenant_id !== 'GLOBAL') {
              setSelectedTenantScope(data.user.tenant_id);
            }
            if (data.user.role === 'CLIENT') {
              const clientInfo = {
                id: data.user.id,
                userId: data.user.client_code || data.user.id || 'vtx123',
                fullName: data.user.name || 'Demo Trader',
                email: data.user.email,
                tenantId: data.user.tenant_id,
                tenantName: data.user.tenant_name || 'VERTEX Trading',
                tenantCode: 'VTX',
                initials: data.user.name
                  ? data.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'DT'
              };
              setActiveTradingClient(clientInfo);
              setAppMode('trading-platform');
            }
            loadDashboardData();
            loadHierarchyData();
          }
        } else if (isMounted) {
          setCurrentUser(null);
        }
      } catch (err) {
        console.warn('Authentication session check error:', err);
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setAuthChecking(false);
      }
    }

    checkAuthSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    if (user.tenant_id && user.tenant_id !== 'GLOBAL') {
      setSelectedTenantScope(user.tenant_id);
    } else {
      setSelectedTenantScope(null);
    }
    loadDashboardData();
    loadHierarchyData();

    // If client account registers or signs in, open Trading Platform with client account details
    if (user.role === 'CLIENT') {
      const clientInfo = {
        id: user.id,
        userId: (user as any).client_code || user.id || 'vtx123',
        fullName: user.name || 'Demo Trader',
        email: user.email,
        tenantId: user.tenant_id,
        tenantName: (user as any).tenant_name || 'VERTEX Trading',
        tenantCode: 'VTX',
        initials: user.name
          ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
          : 'DT'
      };
      setActiveTradingClient(clientInfo);
      const matchedTenant = tenants.find(t => t.id === user.tenant_id);
      if (matchedTenant?.domain) {
        setActiveTradingDomain(matchedTenant.domain);
      }
      setAppMode('trading-platform');
      showToast(`Welcome to ${clientInfo.tenantName}, ${user.name}! Trading console initialized.`, 'success');
      return;
    }

    showToast(`Welcome back, ${user.name}! Signed in as ${user.role}.`, 'success');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setCurrentUser(null);
    setActiveTradingClient(null);
    setAppMode('admin');
    showToast('Signed out of TradeMatrix. Session ended.', 'info');
  };

  const handleSelectTenantScope = async (tenantId: string | null) => {
    setSelectedTenantScope(tenantId);
    if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'PLATFORM_OWNER') {
      try {
        await fetch('/api/auth/switch-tenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
          credentials: 'include'
        });
      } catch (e) {
        console.warn('Switch tenant error:', e);
      }
    }
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
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data: any = await res.json();
        setDashboardData(prev => ({
          kpis: data.kpis || prev.kpis,
          volumeCommission: data.volumeCommission || data.charts?.volumeCommission || prev.volumeCommission,
          clientGrowth: data.clientGrowth || data.charts?.clientGrowth || prev.clientGrowth,
          dailyPL: Array.isArray(data.dailyPL)
            ? data.dailyPL
            : (data.charts?.dailyPL?.data || prev.dailyPL),
          recentTrades: data.recentTrades || prev.recentTrades,
          pendingKYC: data.pendingKYC || prev.pendingKYC,
          tenants: data.tenants || prev.tenants
        }));
        if (data.tenants && data.tenants.length) setTenants(data.tenants);
        if (data.recentTrades && data.recentTrades.length) setRecentTrades(data.recentTrades);
        if (data.pendingKYC && data.pendingKYC.length) setPendingKYC(data.pendingKYC);
        if (data.activeUsersCount !== undefined) setActiveUsersCount(Number(data.activeUsersCount));
      }
    } catch (err) {
      console.warn('Backend API fetch error, using resilient state:', err);
    }
  }, [selectedTenantScope]);

  // Fetch Full Hierarchy Entities
  const [isHierarchyLoading, setIsHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  const loadHierarchyData = useCallback(async () => {
    setIsHierarchyLoading(true);
    setHierarchyError(null);
    try {
      const scopeParam = selectedTenantScope ? `?tenantId=${selectedTenantScope}` : '';
      const [mRes, bRes, sbRes, cRes, kRes, tRes, tnRes] = await Promise.all([
        fetch(`/api/admin/masters${scopeParam}`, { credentials: 'include' }),
        fetch(`/api/admin/brokers${scopeParam}`, { credentials: 'include' }),
        fetch(`/api/admin/sub-brokers${scopeParam}`, { credentials: 'include' }),
        fetch(`/api/admin/clients${scopeParam}`, { credentials: 'include' }),
        fetch(`/api/admin/kyc${scopeParam}`, { credentials: 'include' }),
        fetch(`/api/admin/trades${scopeParam}`, { credentials: 'include' }),
        fetch('/api/admin/tenants', { credentials: 'include' })
      ]);

      if (mRes.ok) setMasters(await mRes.json());
      if (bRes.ok) setBrokers(await bRes.json());
      if (sbRes.ok) setSubBrokers(await sbRes.json());
      if (cRes.ok) setClients(await cRes.json());
      if (kRes.ok) setKycRecords(await kRes.json());
      if (tRes.ok) setTrades(await tRes.json());
      if (tnRes.ok) {
        const tnList = await tnRes.json();
        if (Array.isArray(tnList) && tnList.length > 0) setTenants(tnList);
      }
    } catch (err: any) {
      console.warn('Hierarchy API sync warning:', err);
      setHierarchyError('Failed to load hierarchy entities from central API');
    } finally {
      setIsHierarchyLoading(false);
    }
  }, [selectedTenantScope]);

  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [pendingKYC, setPendingKYC] = useState<KYCRecord[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
      loadHierarchyData();
    }
  }, [currentUser?.id, selectedTenantScope, loadDashboardData, loadHierarchyData]);

  // Real-time EventSource listener for S2S events from Trading Platform
  useEffect(() => {
    if (!currentUser) return;
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/admin/events/stream');
      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (!event || !event.eventType) return;

          switch (event.eventType) {
            case 'client.registered':
            case 'client.activated': {
              const p = event.payload || {};
              const clientId = p.clientId || p.userId || p.tradingUserId || `CLI-${Date.now()}`;
              const clientCode = (p.clientCode || p.userId || clientId).toUpperCase();
              const newClient: Client = {
                id: clientId,
                client_code: clientCode,
                sub_broker_id: p.subBrokerId || p.sub_broker_id || 'SB-001',
                name: p.name || p.fullName || 'Registered Client',
                email: p.email || `${clientCode.toLowerCase()}@client.tradematrix.io`,
                phone: p.phone || p.mobile || '+91 98000 00000',
                status: (p.status || p.accountStatus || 'ACTIVE').toUpperCase() as any,
                kyc_status: (p.kycStatus === 'VERIFIED' ? 'APPROVED' : (p.kycStatus || 'APPROVED')) as any,
                wallet_balance: Number(p.balance || p.walletBalance || 500000),
                available_margin: Number(p.equity || p.balance || 500000),
                todays_pl: 0,
                open_positions_count: 0,
                tenant_id: event.tenantId,
                tenant_name: p.tenantName || 'Alpha Prime Capital',
                sub_broker_name: 'Apex Direct',
                broker_name: 'Apex Broking',
                master_name: 'Alpha Prime Master',
                created_at: new Date().toISOString().split('T')[0]
              };
              setClients(prev => [newClient, ...prev.filter(c => c.id !== clientId && c.client_code !== clientCode)]);
              showToast(`New client registered: ${newClient.name} (${newClient.client_code})`, 'success');
              loadDashboardData();
              loadHierarchyData();
              break;
            }

            case 'login.succeeded':
            case 'user.login':
            case 'user.active': {
              const count = Number(event.payload?.activeUsers || event.payload?.count);
              if (!isNaN(count) && count > 0) {
                setActiveUsersCount(count);
              } else {
                setActiveUsersCount(prev => prev + 1);
              }
              break;
            }

            case 'trade.executed':
              if (event.payload) {
                const newTrade: Trade = {
                  id: event.payload.id || `trd_${Date.now()}`,
                  trade_id: event.payload.tradeId || `TRD-${Date.now()}`,
                  tenant_id: event.tenantId,
                  tenant_name: event.payload.tenantName || 'Alpha Prime Capital',
                  client_id: event.payload.clientId || event.payload.tradingUserId || 'CLI-001',
                  client_name: event.payload.clientName || 'Live Client',
                  symbol: event.payload.symbol || 'NIFTY50',
                  exchange: event.payload.exchange || 'NSE',
                  side: event.payload.side || 'BUY',
                  quantity: event.payload.quantity || event.payload.lots || 1,
                  price: event.payload.price || event.payload.executionPrice || 100,
                  total_value: Number(event.payload.totalValue || event.payload.executionValue || (event.payload.price * event.payload.quantity) || 0),
                  pl: Number(event.payload.pl || 0),
                  status: 'EXECUTED',
                  timestamp: event.timestamp || new Date().toISOString()
                };
                setTrades(prev => [newTrade, ...prev.slice(0, 99)]);
                setRecentTrades(prev => [newTrade, ...prev.slice(0, 9)]);
                showToast(`Trade Executed: ${newTrade.side} ${newTrade.quantity} ${newTrade.symbol} @ ₹${newTrade.price}`, 'success');
              }
              loadDashboardData();
              break;

            case 'order.created':
            case 'order.updated':
            case 'order.cancelled':
              loadDashboardData();
              showToast(`Order ${event.payload?.orderId || 'ORD'}: ${event.payload?.status || 'UPDATED'}`, 'info');
              break;

            case 'position.updated':
            case 'position.closed':
              loadDashboardData();
              break;

            case 'deposit.created':
            case 'deposit.approved':
            case 'deposit.rejected':
              loadDashboardData();
              loadHierarchyData();
              showToast(`Deposit Event (${event.payload?.status || 'UPDATED'}): ₹${event.payload?.amount || 0}`, 'info');
              break;

            case 'withdrawal.created':
            case 'withdrawal.approved':
            case 'withdrawal.rejected':
              loadDashboardData();
              loadHierarchyData();
              showToast(`Withdrawal Event (${event.payload?.status || 'UPDATED'}): ₹${event.payload?.amount || 0}`, 'info');
              break;

            case 'kyc.submitted':
            case 'kyc.updated':
              if (event.payload?.id && event.payload?.status) {
                setKycRecords(prev => prev.map(k => k.id === event.payload.id ? { ...k, status: event.payload.status } : k));
              }
              loadDashboardData();
              break;

            case 'wallet.updated':
            case 'client.account_updated':
              if (event.payload?.clientId || event.payload?.userId) {
                const targetId = event.payload?.clientId || event.payload?.userId;
                setClients(prev => prev.map(c => (c.id === targetId || c.client_code === targetId) ? { ...c, wallet_balance: event.payload.balance ?? c.wallet_balance } : c));
              }
              loadDashboardData();
              break;

            case 'risk.margin_breach':
              showToast(`Critical Risk Alert: Margin breach on position for ${event.payload?.clientName || 'Client'}`, 'warning');
              loadDashboardData();
              break;

            case 'execution.failure':
              showToast(`Execution Warning: Order execution failed for ${event.payload?.symbol || 'Order'}`, 'warning');
              break;

            case 'notification.created':
              if (event.payload?.title) {
                showToast(`New Notification: ${event.payload.title}`, 'info');
              }
              break;

            case 'support.created':
            case 'support.updated':
              showToast(`Support Ticket: ${event.payload?.subject || 'Ticket updated'}`, 'info');
              break;

            case 'tenant.config.updated':
            case 'tenant.branding.updated':
            case 'tenant.status.updated':
              loadHierarchyData();
              break;
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch (err) {
      console.warn('Real-time EventSource connection error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [currentUser?.id, loadDashboardData, loadHierarchyData]);

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
    try {
      const res = await fetch('/api/admin/masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Master created successfully', 'success');
        await loadHierarchyData();
        await loadDashboardData();
      } else {
        showToast('Failed to create Master', 'warning');
      }
    } catch {
      showToast('Error creating Master', 'warning');
    }
  };

  const handleCreateBroker = async (data: any) => {
    try {
      const res = await fetch('/api/admin/brokers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Broker registered successfully', 'success');
        await loadHierarchyData();
        await loadDashboardData();
      } else {
        showToast('Failed to create Broker', 'warning');
      }
    } catch {
      showToast('Error creating Broker', 'warning');
    }
  };

  const handleAddClient = async (data: any) => {
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        showToast('Client onboarded successfully', 'success');
        await loadHierarchyData();
        await loadDashboardData();
      } else {
        showToast('Failed to onboard Client', 'warning');
      }
    } catch {
      showToast('Error onboarding Client', 'warning');
    }
  };

  const handleCreateTenant = async (data: any) => {
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const newTenant = await res.json();
        setTenants(prev => [newTenant, ...prev]);
        showToast('Tenant created successfully', 'success');
        await loadDashboardData();
      } else {
        showToast('Failed to create Tenant', 'warning');
      }
    } catch {
      showToast('Error creating Tenant', 'warning');
    }
  };

  const handleUpdateKYCStatus = async (
    id: string,
    status: KYCRecord['kyc_status'],
    notes?: string
  ) => {
    try {
      const res = await fetch(`/api/admin/kyc/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes })
      });
      if (res.ok) {
        showToast(`KYC status updated to ${status}`, 'success');
        await loadHierarchyData();
        await loadDashboardData();
      } else {
        showToast('Failed to update KYC status', 'warning');
      }
    } catch {
      showToast('Error updating KYC status', 'warning');
    }
  };

  const handleToggleEntityStatus = async (
    type: string,
    id: string,
    currentStatus: string
  ) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/${type}/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`${type} status updated to ${newStatus}`, 'success');
        await loadHierarchyData();
        await loadDashboardData();
      } else {
        showToast(`Failed to update ${type} status`, 'warning');
      }
    } catch {
      showToast(`Error updating ${type} status`, 'warning');
    }
  };

  const handleToggleTenantStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/tenants/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setTenants(prev =>
          prev.map(t => (t.id === id ? { ...t, status: newStatus as any } : t))
        );
        showToast(`Tenant status changed to ${newStatus}`, 'success');
        await loadDashboardData();
      } else {
        showToast('Failed to update Tenant status', 'warning');
      }
    } catch {
      showToast('Error updating Tenant status', 'warning');
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

  // If authentication check is in progress, show clean loader
  if (authChecking) {
    return (
      <div className="min-h-screen w-full bg-[#050811] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono">Authenticating session...</span>
        </div>
      </div>
    );
  }

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

  // Helper to open Trading Platform with optional client context
  const handleOpenTradingPlatform = (clientData?: any) => {
    if (clientData) {
      setActiveTradingClient(clientData);
      // If client belongs to a tenant or has tenantId
      const clientTenantId = clientData.tenantId;
      const matchedTenant = tenants.find(t => t.id === clientTenantId || t.name === clientData.tenantName);
      if (matchedTenant?.domain) {
        setActiveTradingDomain(matchedTenant.domain);
      }
    } else {
      setActiveTradingClient(null);
      const currentTenant = tenants.find(t => t.id === selectedTenantScope);
      const domain = currentTenant?.domain || (selectedTenantScope === 'ten-02' ? 'trade.zenithmarkets.in' : selectedTenantScope === 'ten-03' ? 'trade.quantumfx.io' : 'trade.alphaprime.com');
      setActiveTradingDomain(domain);
    }
    setAppMode('trading-platform');
  };

  // If in Trading Platform Mode: render the dedicated Branded Tenant Trading Platform
  if (appMode === 'trading-platform') {
    return (
      <TradingPlatformView
        initialTenantDomain={activeTradingDomain}
        initialTenantId={selectedTenantScope}
        initialClient={activeTradingClient}
        isAdmin={currentUser?.role !== 'CLIENT'}
        onReturnToAdmin={currentUser?.role === 'CLIENT' ? handleLogout : () => setAppMode('admin')}
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
          onSelectTenantScope={handleSelectTenantScope}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLogout={handleLogout}
          currentUser={currentUser}
          activeUsersCount={activeUsersCount}
          onOpenNotifications={() => {
            setActiveTab('notifications');
          }}
          onNavigateFunds={handleNavigateFunds}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          onOpenTradingPlatform={() => handleOpenTradingPlatform()}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1920px] mx-auto w-full">
          <ErrorBoundary onReset={loadHierarchyData}>
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
                  clients={clients}
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
                  onRefresh={loadDashboardData}
                />
              )}

              {/* Trades View - matching user screenshot */}
              {(activeTab === 'trades' || activeTab === 'orders-trades') && (
                <TradesView
                  initialSelectedTrade={selectedTradeForDetail}
                  initialTrades={trades}
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
                  onOpenTradingPlatform={handleOpenTradingPlatform}
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
                  onNavigateTab={tab => setActiveTab(tab as NavigationTab)}
                  onCreateMaster={() => setShowCreateMasterModal(true)}
                  onCreateBroker={() => setShowCreateBrokerModal(true)}
                  onAddClient={() => setShowAddClientModal(true)}
                  onToggleStatus={handleToggleEntityStatus}
                  onNotify={showToast}
                  onOpenTradingPlatform={handleOpenTradingPlatform}
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
                  onLaunchTradingPlatform={(domain, tenantId) => {
                    if (tenantId) setSelectedTenantScope(tenantId);
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
          </ErrorBoundary>
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
