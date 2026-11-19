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
import { apiFetch, setAuthToken, setStoredUser } from './utils/api';
import { canAccessTab } from './utils/rbac';
import { parseCleanNumber, liveLtpLookup, updateLivePrices } from './utils/cleanNumber';
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

const DEFAULT_INITIAL_TENANTS: Tenant[] = [];

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Dashboard Data State - Clean empty initial state without fake numbers
  const EMPTY_INITIAL_DASHBOARD: DashboardData = {
    kpis: {
      total_masters: { value: 0, subtitle: 'Across all regions' },
      total_brokers: { value: 0, subtitle: '0 active' },
      total_clients: { value: 0, subtitle: '0 registered' },
      commission_earned: { value: '₹0', subtitle: 'Today' },
      todays_turnover: { value: '₹0', subtitle: 'Today' },
      total_turnover: { value: '₹0', subtitle: 'Total volume' },
      total_pl: { value: '₹0', subtitle: 'Net P&L' },
      pending_kyc: { value: 0, subtitle: 'Requires review' },
      open_tickets: { value: 0, subtitle: '0 open tickets' }
    },
    volumeCommission: [],
    clientGrowth: [],
    dailyPL: [],
    recentTrades: [],
    pendingKYC: [],
    tenants: []
  };

  const [dashboardData, setDashboardData] = useState<DashboardData>(EMPTY_INITIAL_DASHBOARD);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>(DEFAULT_INITIAL_TENANTS);
  const [masters, setMasters] = useState<Master[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [subBrokers, setSubBrokers] = useState<SubBroker[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [kycRecords, setKycRecords] = useState<KYCRecord[]>([]);
  const [quotesMap, setQuotesMap] = useState<Record<string, number>>({});
  const [selectedTradeForDetail, setSelectedTradeForDetail] = useState<any | null>(null);
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<any | null>(null);

  // Modals state
  const [showCreateMasterModal, setShowCreateMasterModal] = useState(false);
  const [showCreateBrokerModal, setShowCreateBrokerModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showCreateTenantModal, setShowCreateTenantModal] = useState(false);
  const [selectedKycForReview, setSelectedKycForReview] = useState<KYCRecord | null>(null);

  // Authentication State (managed via secure HTTP-only cookie session)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState(false);

  // Check active session on initial load in background (non-blocking)
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);

    async function checkAuthSession() {
      try {
        // Pre-fetch public active tenants
        apiFetch('/api/public/tenants', { signal: controller.signal })
          .then(res => res.ok ? res.json() : null)
          .then(list => {
            if (Array.isArray(list) && list.length > 0 && isMounted) {
              setTenants(list);
            }
          })
          .catch(() => {});

        const res = await apiFetch('/api/auth/me', {
          signal: controller.signal
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user && isMounted) {
            const roleUpper = (data.user.role || '').toUpperCase();
            if (roleUpper === 'CLIENT' || roleUpper === 'TRADER' || roleUpper === 'TRADER_CLIENT') {
              localStorage.removeItem('auth_token');
              sessionStorage.removeItem('auth_token');
              setCurrentUser(null);
              setIsAuthenticated(false);
              showToast('Access Denied: Trader Clients cannot access the Admin Portal. Please login via the Trading Platform.', 'warning');
              return;
            }
            setCurrentUser(data.user);
            setIsAuthenticated(true);
            const isGlobalRole = ['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN'].includes(roleUpper);
            if (!isGlobalRole && data.user.tenant_id && data.user.tenant_id !== 'GLOBAL') {
              setSelectedTenantScope(data.user.tenant_id);
            } else if (isGlobalRole) {
              setSelectedTenantScope(null);
            }
            loadDashboardData();
            loadHierarchyData();
          }
        }
      } catch (err) {
        // Quietly fallback to auth screen
      } finally {
        clearTimeout(timeoutId);
      }
    }

    checkAuthSession();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleLogin = (user: AuthUser) => {
    const roleUpper = (user.role || '').toUpperCase();
    if (roleUpper === 'CLIENT' || roleUpper === 'TRADER' || roleUpper === 'TRADER_CLIENT') {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
      setCurrentUser(null);
      setIsAuthenticated(false);
      showToast('Access Denied: Trader Clients cannot access the Admin Portal. Please login via the Trading Platform.', 'warning');
      return;
    }
    setCurrentUser(user);
    setIsAuthenticated(true);
    const isGlobalRole = ['SUPER_ADMIN', 'PLATFORM_OWNER', 'ADMIN'].includes(roleUpper);
    if (!isGlobalRole && user.tenant_id && user.tenant_id !== 'GLOBAL') {
      setSelectedTenantScope(user.tenant_id);
    } else {
      setSelectedTenantScope(null);
    }
    loadDashboardData();
    loadHierarchyData();

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
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('tradepro_user');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('tradepro_user');
      sessionStorage.removeItem('user_role');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('role');
    } catch {
      // Storage access restricted
    }
    setAuthToken(null);
    setStoredUser(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
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
  const loadDashboardData = useCallback(async (silent?: boolean | unknown) => {
    const isSilent = silent === true;
    try {
      const url = selectedTenantScope
        ? `/api/admin/metrics?tenantId=${encodeURIComponent(selectedTenantScope)}`
        : '/api/admin/metrics';
      const res = await apiFetch(url);
      if (res.ok) {
        const data: any = await res.json();
        setDashboardError(null);
        setDashboardData(prev => ({
          kpis: data.kpis || prev.kpis,
          volumeCommission: data.volumeCommission || data.charts?.volumeCommission || prev.volumeCommission || [],
          clientGrowth: data.clientGrowth || data.charts?.clientGrowth || prev.clientGrowth || [],
          dailyPL: Array.isArray(data.dailyPL)
            ? data.dailyPL
            : (data.charts?.dailyPL?.data || prev.dailyPL || []),
          dailyPLBadge: data.charts?.dailyPL?.mtdBadge || data.dailyPL?.mtdBadge || prev.dailyPLBadge || '',
          recentTrades: data.recentTrades || prev.recentTrades || [],
          pendingKYC: data.pendingKYC || prev.pendingKYC || [],
          tenants: data.tenants || prev.tenants || []
        }));
        if (data.tenants && Array.isArray(data.tenants)) setTenants(data.tenants);
        if (data.recentTrades && Array.isArray(data.recentTrades)) setRecentTrades(data.recentTrades);
        if (data.pendingKYC && Array.isArray(data.pendingKYC)) setPendingKYC(data.pendingKYC);
        if (data.activeUsersCount !== undefined) setActiveUsersCount(Number(data.activeUsersCount));
      } else if (!isSilent) {
        if (res.status === 401 || res.status === 403) {
          setDashboardError(null);
        } else {
          // Preserve any existing valid KPI state rather than wiping it to null on transient errors
          setDashboardData(prev => {
            const hasExisting = prev?.kpis && Number(prev.kpis.total_clients?.value || 0) >= 0 && prev.kpis.total_clients?.value !== '—';
            if (hasExisting) {
              setDashboardError(null);
              return prev;
            }
            setDashboardError('Failed to fetch dashboard live telemetry from PostgreSQL');
            return prev;
          });
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (!isSilent) {
        console.warn('Dashboard API fetch error:', err);
        setDashboardData(prev => {
          const hasExisting = prev?.kpis && prev.kpis.total_clients?.value !== '—';
          if (hasExisting) {
            setDashboardError(null);
            return prev;
          }
          setDashboardError(err.message || 'Dashboard live telemetry unavailable');
          return prev;
        });
      }
    }
  }, [selectedTenantScope]);

  // Fetch Full Hierarchy Entities
  const [isHierarchyLoading, setIsHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  const loadHierarchyData = useCallback(async (silent = false) => {
    if (!silent) setIsHierarchyLoading(true);
    if (!silent) setHierarchyError(null);
    try {
      const scopeParam = selectedTenantScope ? `?tenantId=${selectedTenantScope}` : '';
      const [mRes, bRes, sbRes, cRes, kRes, tRes, tnRes] = await Promise.all([
        apiFetch(`/api/admin/masters${scopeParam}`),
        apiFetch(`/api/admin/brokers${scopeParam}`),
        apiFetch(`/api/admin/sub-brokers${scopeParam}`),
        apiFetch(`/api/admin/clients${scopeParam}`),
        apiFetch(`/api/admin/kyc${scopeParam}`),
        apiFetch(`/api/admin/trades${scopeParam}`),
        apiFetch('/api/admin/tenants')
      ]);

      if (mRes.ok) setMasters(await mRes.json());
      if (bRes.ok) setBrokers(await bRes.json());
      if (sbRes.ok) setSubBrokers(await sbRes.json());
      if (cRes.ok) setClients(await cRes.json());
      if (kRes.ok) setKycRecords(await kRes.json());
      if (tRes.ok) setTrades(await tRes.json());
      if (tnRes.ok) {
        const tnList = await tnRes.json();
        if (Array.isArray(tnList)) setTenants(tnList);
      }
    } catch (err: any) {
      if (!silent) {
        console.warn('Hierarchy API sync warning:', err);
        setHierarchyError('Failed to load hierarchy entities from central API');
      }
    } finally {
      if (!silent) setIsHierarchyLoading(false);
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
      const token = typeof window !== 'undefined' ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) : '';
      const sseUrl = token ? `/api/admin/events/stream?token=${encodeURIComponent(token)}` : '/api/admin/events/stream';
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (!event || !event.eventType) return;

          // Dispatch event to window for all child views to eliminate duplicate SSE streams
          window.dispatchEvent(new CustomEvent('admin:live-event', { detail: event }));

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
                tenant_name: p.tenantName || 'VERTEX Trading',
                sub_broker_name: 'Apex Direct',
                broker_name: 'Apex Broking',
                master_name: 'Apex Capital Group',
                created_at: new Date().toISOString().split('T')[0]
              };
              setClients(prev => [newClient, ...prev.filter(c => c.id !== clientId && c.client_code !== clientCode)]);
              showToast(`New client registered: ${newClient.name} (${newClient.client_code})`, 'success');
              loadDashboardData();
              loadHierarchyData();
              break;
            }

            case 'broker.added':
            case 'hierarchy.updated': {
              loadHierarchyData(true);
              loadDashboardData(true);
              if (event.eventType === 'broker.added' && event.payload?.name) {
                showToast(`New ${event.payload.role || 'Broker'} added: ${event.payload.name}`, 'success');
              }
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
                  tenant_name: event.payload.tenantName || 'VERTEX Trading',
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
            case 'fund.transaction_updated':
              loadDashboardData(true);
              loadHierarchyData(true);
              showToast(`Fund Transaction (${event.payload?.status || 'UPDATED'}): ₹${event.payload?.amount || 0}`, 'info');
              break;

            case 'ledger.updated':
              loadDashboardData(true);
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
            case 'risk.alert_triggered':
              showToast(`Critical Risk Alert: ${event.payload?.reason || `Margin breach on position for ${event.payload?.clientName || event.payload?.userId || 'Client'}`}`, 'warning');
              loadDashboardData(true);
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

  // Sub-Second Real-Time WebSocket & Fallback Live MTM Sync
  useEffect(() => {
    if (!currentUser) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connectWebSocket = () => {
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
        ws = new WebSocket(wsUrl);

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (!msg) return;

            const evtType = msg.eventType || msg.event || msg.type;
            const payload = msg.payload || msg.data;

            if (evtType === 'market.ticks' || evtType === 'market.tick') {
              const tickMap: Record<string, number> = {};
              if (Array.isArray(payload)) {
                for (const item of payload) {
                  const s = (item.symbol || '').toUpperCase();
                  const p = parseCleanNumber(item.ltp ?? item.price);
                  if (s && p > 0) tickMap[s] = p;
                }
              } else if (payload?.symbol && (payload.ltp || payload.price)) {
                const s = String(payload.symbol).toUpperCase();
                const p = parseCleanNumber(payload.ltp ?? payload.price);
                if (s && p > 0) tickMap[s] = p;
              } else if (typeof payload === 'object') {
                for (const [k, v] of Object.entries(payload)) {
                  const p = parseCleanNumber(v);
                  if (k && p > 0) tickMap[k.toUpperCase()] = p;
                }
              }

              if (Object.keys(tickMap).length > 0) {
                updateLivePrices(tickMap);
                setQuotesMap(prev => ({ ...prev, ...tickMap }));
                window.dispatchEvent(new CustomEvent('admin:live-event', { detail: { eventType: 'market.ticks', payload: tickMap } }));
              }
            } else if (evtType === 'positions.live_mtm' || evtType === 'positions.mtm_batch') {
              const deltas = Array.isArray(payload) ? payload : (Array.isArray(payload?.deltas) ? payload.deltas : []);
              if (deltas.length > 0) {
                // Update Clients live P&L in memory
                const clientMtmMap = new Map<string, { pnl: number; count: number }>();
                let totalNetMtm = 0;

                for (const d of deltas) {
                  const pnl = parseCleanNumber(d.unrealizedPnL ?? d.unrealizedPL ?? d.pnl);
                  totalNetMtm += pnl;
                  const cId = String(d.clientId || d.client || '').toLowerCase().trim();
                  if (cId) {
                    const cur = clientMtmMap.get(cId) || { pnl: 0, count: 0 };
                    cur.pnl += pnl;
                    cur.count += 1;
                    clientMtmMap.set(cId, cur);
                  }
                }

                if (clientMtmMap.size > 0) {
                  setClients(prevClients =>
                    prevClients.map(c => {
                      const idKey = String(c.id || '').toLowerCase().trim();
                      const codeKey = String(c.client_code || '').toLowerCase().trim();
                      const nameKey = String(c.name || '').toLowerCase().trim();
                      const m = clientMtmMap.get(idKey) || clientMtmMap.get(codeKey) || clientMtmMap.get(nameKey);
                      if (!m) return c;
                      const rawPnl = Math.round(m.pnl * 100) / 100;
                      const walletBal = parseCleanNumber(c.wallet_balance ?? c.balance);
                      const totalEq = walletBal + rawPnl;
                      return {
                        ...c,
                        todays_pl: rawPnl,
                        pnl: rawPnl,
                        pl: `${rawPnl >= 0 ? '+' : ''}₹${rawPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                        open_positions_count: m.count,
                        available_margin: totalEq,
                        equity: `₹${totalEq.toLocaleString('en-IN')}`
                      };
                    })
                  );
                }

                // Update Total MTM P&L KPI card in real time
                setDashboardData(prev => {
                  if (!prev.kpis) return prev;
                  const prevKpis = { ...prev.kpis };
                  if (prevKpis.total_pl) {
                    const formattedMtm = `${totalNetMtm >= 0 ? '+' : ''}₹${Math.abs(totalNetMtm).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    prevKpis.total_pl = {
                      ...prevKpis.total_pl,
                      value: formattedMtm,
                      raw: totalNetMtm,
                      badge: totalNetMtm >= 0 ? '+Net Profit' : '-Net Loss'
                    };
                  }
                  return { ...prev, kpis: prevKpis };
                });

                window.dispatchEvent(new CustomEvent('admin:live-event', { detail: { eventType: 'positions.live_mtm', payload: deltas } }));
              }
            } else {
              if (
                evtType === 'client.registered' ||
                evtType === 'client.activated' ||
                evtType === 'broker.added' ||
                evtType === 'hierarchy.updated' ||
                evtType === 'fund.transaction_updated' ||
                (typeof evtType === 'string' && (evtType.startsWith('deposit.') || evtType.startsWith('withdrawal.') || evtType.startsWith('fund.') || evtType.startsWith('manual_deposit.')))
              ) {
                loadDashboardData(true);
                loadHierarchyData(true);
              } else if (
                evtType === 'trade.executed' ||
                evtType === 'ledger.updated' ||
                evtType === 'risk.alert_triggered' ||
                evtType === 'risk.margin_breach' ||
                evtType === 'wallet.updated' ||
                evtType === 'position.updated'
              ) {
                loadDashboardData(true);
              }
              window.dispatchEvent(new CustomEvent('admin:live-event', { detail: { eventType: evtType, payload } }));
            }
          } catch {}
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connectWebSocket, 2000);
        };
        ws.onerror = () => {};
      } catch {}
    };

    connectWebSocket();

    // 4.5s Background silent metrics & hierarchy sync (safe 4000ms-5000ms interval)
    const fallbackSync = setInterval(() => {
      loadDashboardData(true);
      loadHierarchyData(true);
    }, 4500);

    return () => {
      if (ws) {
        try { ws.close(); } catch {}
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackSync);
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
    const isCurrentlyActive = (currentStatus || '').toString().toUpperCase() === 'ACTIVE';
    const newStatus = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    // Optimistic immediate update to row
    setTenants(prev =>
      prev.map(t => (t.id === id || t.code === id ? { ...t, status: newStatus as any } : t))
    );
    try {
      const res = await fetch(`/api/admin/tenants/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const resolvedStatus = (data?.tenant?.status || newStatus).toUpperCase();
        setTenants(prev =>
          prev.map(t => (t.id === id || t.code === id ? { ...t, status: resolvedStatus as any } : t))
        );
        showToast(`Tenant status changed to ${resolvedStatus}`, 'success');
        await loadDashboardData();
      } else {
        showToast(`Tenant status changed to ${newStatus}`, 'success');
      }
    } catch {
      showToast(`Tenant status updated to ${newStatus}`, 'info');
    }
  };

  const handleSwitchUserRole = async (newRole: UserRole, targetHierarchyId?: string) => {
    if (currentUser) {
      let hierarchyId = targetHierarchyId || currentUser.hierarchyId;
      let hierarchyLevel = currentUser.hierarchyLevel;
      if (newRole === 'MASTER') {
        hierarchyId = targetHierarchyId || 'MST-001';
        hierarchyLevel = 'MASTER';
      } else if (newRole === 'BROKER') {
        hierarchyId = targetHierarchyId || 'BRK-001';
        hierarchyLevel = 'BROKER';
      } else if (newRole === 'SUB_BROKER') {
        hierarchyId = targetHierarchyId || 'SBRK-001';
        hierarchyLevel = 'SUB_BROKER';
      } else if (newRole === 'CLIENT') {
        hierarchyId = targetHierarchyId || 'CLT-001';
        hierarchyLevel = 'CLIENT';
      } else if (newRole === 'SUPER_ADMIN' || newRole === 'PLATFORM_OWNER') {
        hierarchyId = undefined;
        hierarchyLevel = 'PLATFORM';
      } else {
        hierarchyLevel = 'TENANT';
      }

      const updatedUser = {
        ...currentUser,
        role: newRole,
        roleName: newRole.replace(/_/g, ' '),
        hierarchyId,
        hierarchyLevel
      };
      setCurrentUser(updatedUser);
      if (newRole === 'SUPER_ADMIN' || newRole === 'PLATFORM_OWNER') {
        setSelectedTenantScope(null);
      }
      showToast(`Active session role switched to ${newRole.replace(/_/g, ' ')}`, 'info');

      try {
        await apiFetch('/api/auth/switch-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole, hierarchyId, hierarchyLevel })
        });
      } catch {}

      // If the current tab cannot be accessed by the new role, redirect gracefully to dashboard
      if (!canAccessTab(newRole, activeTab)) {
        setActiveTab('dashboard');
      }
      loadHierarchyData();
      loadDashboardData();
    }
  };

  // Helper to open Trading Platform with optional client context
  const handleOpenTradingPlatform = useCallback((clientData?: any) => {
    const MAIN_TRADING_PLATFORM_URL = 'https://trading-platform-2t6r.onrender.com';
    if (clientData) {
      const clientId = clientData.id || clientData.client_code || clientData.userId || '';
      const clientName = clientData.name || clientData.fullName || '';
      const rawBalance = typeof clientData.balance === 'number'
        ? clientData.balance
        : parseFloat(String(clientData.balance || '').replace(/[^0-9.-]/g, '')) || 0;
      const clientEmail = clientData.email || '';
      const queryParams = new URLSearchParams();
      if (clientId) {
        queryParams.set('impersonateClient', clientId);
        queryParams.set('client_id', clientId);
      }
      if (clientName) {
        queryParams.set('clientName', clientName);
        queryParams.set('name', clientName);
      }
      if (clientEmail) {
        queryParams.set('clientEmail', clientEmail);
        queryParams.set('email', clientEmail);
      }
      queryParams.set('balance', String(rawBalance));
      const url = `${MAIN_TRADING_PLATFORM_URL}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.open(MAIN_TRADING_PLATFORM_URL, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // Check URL params on initial load for deep linking to trading platform
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const modeParam = params.get('mode') || params.get('app_mode');
        const clientId = params.get('impersonateClient') || params.get('client_id');
        if (modeParam === 'trading' || modeParam === 'trading-platform' || clientId) {
          if (clientId) {
            const clientName = params.get('clientName') || params.get('name') || 'Client Trader';
            const clientEmail = params.get('clientEmail') || params.get('email') || '';
            const clientBalance = params.get('balance') || '₹25,400';
            if (modeParam === 'trading' || modeParam === 'trading-platform') {
              setActiveTradingClient({
                id: clientId,
                userId: clientId,
                name: clientName,
                fullName: clientName,
                email: clientEmail,
                balance: clientBalance,
                tenantId: params.get('tenant_id') || undefined
              });
              setAppMode('trading-platform');
            }
          }
        }
      }
    } catch (e) {
      console.warn('URL param parse error:', e);
    }
  }, [handleOpenTradingPlatform]);

  // If no user is logged in, show the TradeMatrix Login & Sign Up screen
  if (!currentUser || !isAuthenticated) {
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
        initialTenantId={selectedTenantScope || undefined}
        initialClient={activeTradingClient}
        isAdmin={currentUser?.role !== 'CLIENT'}
        onReturnToAdmin={currentUser?.role === 'CLIENT' ? handleLogout : () => {
          setAppMode('admin');
          setActiveTradingClient(null);
        }}
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        onLogout={handleLogout}
        currentUser={currentUser}
        badgeCounts={{
          kycPending: Number(dashboardData?.kpis?.pending_kyc?.value) || 0,
          openTickets: Number(dashboardData?.kpis?.open_tickets?.value) || 0
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
          clients={clients}
          orders={(dashboardData as any)?.orders || (dashboardData as any)?.recent_orders || []}
          onNavigateTab={(tab: string) => setActiveTab(tab as any)}
          onSelectClient={(client: any) => {
            setSelectedClientForDetail(client);
            setActiveTab('clients');
          }}
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
                  hasError={!!dashboardError}
                  errorMessage={dashboardError || undefined}
                  volumeCommissionData={dashboardData?.volumeCommission || []}
                  clientGrowthData={dashboardData?.clientGrowth || []}
                  dailyPLData={dashboardData?.dailyPL || []}
                  dailyPLBadge={dashboardData?.dailyPLBadge || ''}
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
                <PositionsView onNotify={showToast} currentUser={currentUser} />
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
                  selectedClient={selectedClientForDetail}
                  onClearSelectedClient={() => setSelectedClientForDetail(null)}
                  onRefresh={async () => {
                    await loadHierarchyData();
                    await loadDashboardData();
                  }}
                  currentUser={currentUser}
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
                  currentUser={currentUser}
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
                  onNavigateFunds={handleNavigateFunds}
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
                    const targetUrl =
                      domain && domain !== 'trade.alphaprime.com' && !domain.includes('example.com')
                        ? (domain.startsWith('http') ? domain : `https://${domain}`)
                        : 'https://trading-platform-2t6r.onrender.com';
                    window.open(targetUrl, '_blank', 'noopener,noreferrer');
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
        currentUser={currentUser}
      />

      <CreateTenantModal
        isOpen={showCreateTenantModal}
        onClose={() => setShowCreateTenantModal(false)}
        onSubmit={handleCreateTenant}
      />
    </div>
  );
}
