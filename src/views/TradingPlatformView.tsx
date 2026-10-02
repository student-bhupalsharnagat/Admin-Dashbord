import React, { useState, useEffect, useRef } from 'react';
import {
  TradingTopBar
} from '../components/trading/TradingTopBar';
import {
  TradingHeader,
  TradingTabKey
} from '../components/trading/TradingHeader';
import {
  TraderConsoleBanner
} from '../components/trading/TraderConsoleBanner';
import {
  TradingMetricsRow
} from '../components/trading/TradingMetricsRow';
import {
  TradingWatchlist
} from '../components/trading/TradingWatchlist';
import {
  LiveSpotlightTerminal
} from '../components/trading/LiveSpotlightTerminal';
import {
  OrderModal
} from '../components/trading/OrderModal';
import {
  TechnicalChartModal
} from '../components/trading/TechnicalChartModal';
import {
  OptionChainModal
} from '../components/trading/OptionChainModal';
import {
  WalletModal
} from '../components/trading/WalletModal';
import {
  CentralControlsModal
} from '../components/trading/CentralControlsModal';
import {
  SupportTicketsModal
} from '../components/trading/SupportTicketsModal';
import {
  MarketClosedModal
} from '../components/trading/MarketClosedModal';
import {
  TourModal
} from '../components/trading/TourModal';
import {
  TradingOrdersView
} from '../components/trading/TradingOrdersView';
import {
  TradingPortfolioView
} from '../components/trading/TradingPortfolioView';
import {
  TradingHistoryView
} from '../components/trading/TradingHistoryView';
import {
  TradingProfileView
} from '../components/trading/TradingProfileView';
import {
  TradingInstrument,
  ClientOrder,
  ClientPosition,
  ClientWallet,
  ClientAccount,
  BenchmarkQuote,
  TenantBrandingConfig
} from '../types/trading';
import {
  INITIAL_INSTRUMENTS,
  INITIAL_ORDERS,
  INITIAL_POSITIONS,
  INITIAL_WALLET,
  INITIAL_CLIENT,
  INITIAL_BENCHMARKS,
  INITIAL_TENANT_BRANDING
} from '../data/tradingData';
import { X, HelpCircle, Bell, CheckCircle2 } from 'lucide-react';

interface TradingPlatformViewProps {
  initialTenantDomain?: string;
  initialTenantId?: string;
  initialClient?: any;
  isAdmin?: boolean;
  onReturnToAdmin?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TradingPlatformView: React.FC<TradingPlatformViewProps> = ({
  initialTenantDomain = 'trade.vertextrading.com',
  initialTenantId = '',
  initialClient = null,
  isAdmin = false,
  onReturnToAdmin,
  onNotify
}) => {
  // Theme state with localStorage persistence and proper light/dark initialization
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trading_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<TradingTabKey>('watchlist');

  // Tenant Branding & Controls state
  const [branding, setBranding] = useState<TenantBrandingConfig>(() => {
    if (initialClient?.tenantName) {
      return {
        ...INITIAL_TENANT_BRANDING,
        tenantName: initialClient.tenantName,
        tenantCode: initialClient.tenantCode || 'VTX',
        brandName: initialClient.tenantName,
        shortName: initialClient.tenantCode || 'VTX'
      };
    }
    return INITIAL_TENANT_BRANDING;
  });

  // Active tenant scope for multi-tenant isolation
  const [activeTenantDomain, setActiveTenantDomain] = useState<string>(initialTenantDomain || 'trade.alphaprime.com');
  const [activeTenantId, setActiveTenantId] = useState<string>(initialTenantId || initialClient?.tenantId || '');
  const [availableTenantsList, setAvailableTenantsList] = useState<Array<{ id: string; name: string; code: string; domain: string }>>([
    { id: 'TNT-001', name: 'Alpha Prime Capital', code: 'APC', domain: 'trade.alphaprime.com' },
    { id: 'TNT-002', name: 'Apex Securities Ltd', code: 'APEX', domain: 'trade.apexsecurities.in' },
    { id: 'TNT-003', name: 'Zenith Markets', code: 'ZMK', domain: 'trade.zenithmarkets.in' },
    { id: 'TNT-004', name: 'Quantum Alpha Capital', code: 'QAC', domain: 'trade.quantumfx.io' }
  ]);

  // Load real tenants list from backend
  useEffect(() => {
    let isMounted = true;
    async function loadTenants() {
      try {
        const res = await fetch('/api/admin/tenants');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0 && isMounted) {
            setAvailableTenantsList(list.map((t: any) => ({
              id: t.id,
              name: t.name || t.tenant_name,
              code: t.code || t.tenant_code || t.id.slice(0, 3).toUpperCase(),
              domain: t.domain || `${t.code?.toLowerCase() || 'trade'}.tradepro.com`
            })));
          }
        }
      } catch (e) {
        console.warn('Could not load tenants list for TradingPlatformView:', e);
      }
    }
    loadTenants();
    return () => { isMounted = false; };
  }, []);

  // Tenant Branding fetcher function
  const loadTenantBranding = async (domain?: string, tenantId?: string) => {
    try {
      const targetDomain = domain || activeTenantDomain;
      const targetId = tenantId || activeTenantId;
      const url = `/api/tenant/branding?domain=${encodeURIComponent(targetDomain)}&tenantId=${encodeURIComponent(targetId)}`;
      const res = await fetch(url, {
        headers: {
          'x-tenant-domain': targetDomain,
          'x-tenant-id': targetId
        }
      });

      if (res.ok) {
        const data = await res.json();
        setBranding(prev => ({
          ...prev,
          tenantName: data.brandName || data.tenantName || prev.tenantName,
          tenantCode: data.shortName || data.tenantCode || prev.tenantCode,
          brandName: data.brandName || data.tenantName || prev.tenantName,
          shortName: data.shortName || data.tenantCode || prev.tenantCode,
          tagline: data.tagline !== undefined ? data.tagline : prev.tagline,
          logoText: data.shortName || data.brandName || prev.logoText,
          logoUrl: data.logoUrl || prev.logoUrl,
          faviconUrl: data.faviconUrl || prev.faviconUrl,
          primaryColor: data.colors?.primary || prev.primaryColor,
          secondaryColor: data.colors?.secondary || prev.secondaryColor,
          accentColor: data.colors?.accent || prev.accentColor,
          backgroundColor: data.colors?.background || prev.backgroundColor,
          surfaceColor: data.colors?.surface || prev.surfaceColor,
          footerCopyright: data.footerCopyright || data.legalLinks?.footerText || prev.footerCopyright,
          colors: data.colors || prev.colors,
          supportEmail: data.contactInfo?.supportEmail || prev.supportEmail,
          supportPhone: data.contactInfo?.supportPhone || prev.supportPhone
        }));

        // Inject CSS Variables for Theme
        if (data.colors) {
          const root = document.documentElement;
          if (data.colors.primary) {
            root.style.setProperty('--primary', data.colors.primary);
            root.style.setProperty('--brand-primary', data.colors.primary);
          }
          if (data.colors.secondary) {
            root.style.setProperty('--secondary', data.colors.secondary);
            root.style.setProperty('--brand-secondary', data.colors.secondary);
          }
          if (data.colors.accent) {
            root.style.setProperty('--accent', data.colors.accent);
            root.style.setProperty('--brand-accent', data.colors.accent);
          }
          if (data.colors.background) {
            root.style.setProperty('--background', data.colors.background);
            root.style.setProperty('--brand-background', data.colors.background);
          }
          if (data.colors.surface) {
            root.style.setProperty('--surface', data.colors.surface);
            root.style.setProperty('--brand-surface', data.colors.surface);
          }
        }

        // Update document title
        if (data.brandName) {
          document.title = `${data.brandName} - Trading Terminal`;
        }

        // Update favicon if provided
        if (data.faviconUrl) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = data.faviconUrl;
        }
      }
    } catch (err) {
      console.warn('Failed to load published tenant branding:', err);
    }
  };

  // Fetch tenant branding on mount and when domain/tenantId changes
  useEffect(() => {
    loadTenantBranding(activeTenantDomain, activeTenantId);
  }, [activeTenantDomain, activeTenantId]);

  // Helper to compute initials from client name
  const getInitials = (name?: string) => {
    if (!name) return 'TR';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Client Profile state
  const [client, setClient] = useState<ClientAccount>(() => {
    if (initialClient) {
      const name = initialClient.fullName || initialClient.name || 'Demo Trader';
      return {
        id: initialClient.id || 'CLI-9021',
        userId: initialClient.userId || initialClient.client_code || initialClient.id || 'vtx123',
        fullName: name,
        email: initialClient.email || 'trader@vertextrading.com',
        phone: initialClient.phone || '+91 98765 43210',
        initials: initialClient.initials || getInitials(name),
        kycStatus: initialClient.kyc || initialClient.kycStatus || 'Verified (MCX & NSE Active)',
        role: 'CLIENT',
        tenantId: initialClient.tenantId || initialClient.tenant_id || 'TNT-001',
        tenantName: initialClient.tenantName || initialClient.tenant_name || 'VERTEX Trading',
        segments: ['NSE Cash', 'NSE F&O', 'MCX Commodity', 'Crypto Derivatives'],
        bankDetails: {
          bankName: 'HDFC Bank Ltd',
          accountNumber: '•••• •••• 8912',
          ifsc: 'HDFC0001204',
          verified: true
        }
      };
    }
    return INITIAL_CLIENT;
  });

  // Market Simulator State
  const [marketStatus, setMarketStatus] = useState<'LIVE' | 'OPEN' | 'CLOSED'>('LIVE');
  const [instruments, setInstruments] = useState<TradingInstrument[]>(INITIAL_INSTRUMENTS);
  const [selectedInstrument, setSelectedInstrument] = useState<TradingInstrument>(
    INITIAL_INSTRUMENTS[0] // GOLD FUT matching screenshot default spotlight
  );
  const [benchmarks, setBenchmarks] = useState<BenchmarkQuote[]>(INITIAL_BENCHMARKS);
  const [orders, setOrders] = useState<ClientOrder[]>(INITIAL_ORDERS);
  const [positions, setPositions] = useState<ClientPosition[]>(INITIAL_POSITIONS);
  const [wallet, setWallet] = useState<ClientWallet>(() => {
    if (initialClient) {
      const rawBal = typeof initialClient.balance === 'number'
        ? initialClient.balance
        : parseFloat(String(initialClient.balance || '').replace(/[^0-9.-]/g, ''));
      const rawPl = typeof initialClient.pl === 'number'
        ? initialClient.pl
        : parseFloat(String(initialClient.pl || initialClient.netPl || '').replace(/[^0-9.-]/g, ''));
      return {
        ...INITIAL_WALLET,
        availableBalance: !isNaN(rawBal) && rawBal > 0 ? rawBal : INITIAL_WALLET.availableBalance,
        todayPnL: !isNaN(rawPl) ? rawPl : INITIAL_WALLET.todayPnL,
        totalPnL: !isNaN(rawPl) && rawPl !== 0 ? rawPl : INITIAL_WALLET.totalPnL
      };
    }
    return INITIAL_WALLET;
  });

  // Re-sync client and wallet when initialClient prop updates
  useEffect(() => {
    if (initialClient) {
      const name = initialClient.fullName || initialClient.name || 'Demo Trader';
      const initials = initialClient.initials || getInitials(name);
      setClient(prev => ({
        ...prev,
        id: initialClient.id || prev.id,
        userId: initialClient.userId || initialClient.client_code || initialClient.id || prev.userId,
        fullName: name,
        email: initialClient.email || prev.email,
        phone: initialClient.phone || prev.phone,
        initials,
        kycStatus: initialClient.kyc || initialClient.kycStatus || prev.kycStatus,
        tenantId: initialClient.tenantId || initialClient.tenant_id || prev.tenantId,
        tenantName: initialClient.tenantName || initialClient.tenant_name || prev.tenantName
      }));

      const rawBal = typeof initialClient.balance === 'number'
        ? initialClient.balance
        : parseFloat(String(initialClient.balance || '').replace(/[^0-9.-]/g, ''));
      const rawPl = typeof initialClient.pl === 'number'
        ? initialClient.pl
        : parseFloat(String(initialClient.pl || initialClient.netPl || '').replace(/[^0-9.-]/g, ''));

      if (!isNaN(rawBal) && rawBal > 0) {
        setWallet(w => ({
          ...w,
          availableBalance: rawBal,
          todayPnL: !isNaN(rawPl) ? rawPl : w.todayPnL
        }));
      }

      // Fetch live orders and positions for this client if ID is present
      const clientId = initialClient.id;
      if (clientId) {
        Promise.allSettled([
          fetch(`/api/admin/clients/${clientId}/orders`),
          fetch(`/api/admin/clients/${clientId}/positions`)
        ]).then(([ordRes, posRes]) => {
          if (ordRes.status === 'fulfilled' && ordRes.value.ok) {
            ordRes.value.json().then(data => {
              if (Array.isArray(data) && data.length > 0) {
                setOrders(data.map((o: any) => ({
                  id: o.id || o.order_id || `ORD-${Math.random().toString().slice(2, 6)}`,
                  symbol: o.symbol || 'RELIANCE.EQ',
                  category: o.category || 'EQUITY',
                  type: (o.side || o.type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
                  orderType: (o.orderType || o.order_type || 'MARKET').toUpperCase() as any,
                  product: (o.product || 'INTRADAY').toUpperCase() as any,
                  lots: o.lots || 1,
                  quantity: o.quantity || o.qty || 25,
                  price: typeof o.price === 'number' ? o.price : parseFloat(String(o.price || '0').replace(/[^0-9.-]/g, '')) || 0,
                  status: (o.status || 'EXECUTED').toUpperCase() as any,
                  placedAt: o.placedAt || o.time || o.created_at || 'Just now',
                  timestamp: o.timestamp || o.time || 'Just now'
                })));
              }
            }).catch(() => {});
          }
          if (posRes.status === 'fulfilled' && posRes.value.ok) {
            posRes.value.json().then(data => {
              if (Array.isArray(data) && data.length > 0) {
                setPositions(data.map((p: any) => {
                  const numPnl = typeof p.pnl === 'number' ? p.pnl : parseFloat(String(p.pnl || '0').replace(/[^0-9.-]/g, '')) || 0;
                  const numEntry = typeof p.avgPrice === 'number' ? p.avgPrice : parseFloat(String(p.avgPrice || p.entry_price || '0').replace(/[^0-9.-]/g, '')) || 0;
                  const numLtp = typeof p.ltp === 'number' ? p.ltp : parseFloat(String(p.ltp || p.lastPrice || '0').replace(/[^0-9.-]/g, '')) || numEntry;
                  return {
                    id: p.id || `POS-${Math.random().toString().slice(2, 6)}`,
                    symbol: p.symbol || 'RELIANCE.EQ',
                    category: p.category || 'EQUITY',
                    type: (p.side || p.type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
                    side: (p.side || p.type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
                    product: (p.product || 'INTRADAY').toUpperCase() as any,
                    quantity: p.quantity || p.qty || 25,
                    qty: p.quantity || p.qty || 25,
                    lots: p.lots || 1,
                    avgPrice: numEntry,
                    lastPrice: numLtp,
                    ltp: numLtp,
                    pnl: numPnl,
                    pnlPercent: numEntry > 0 ? (numPnl / (numEntry * (p.qty || 25))) * 100 : 0
                  };
                }));
              }
            }).catch(() => {});
          }
        });
      }
    }
  }, [initialClient]);

  // Modals state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderModalSide, setOrderModalSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderModalInstrument, setOrderModalInstrument] = useState<TradingInstrument | null>(null);

  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartModalInstrument, setChartModalInstrument] = useState<TradingInstrument | null>(null);

  const [optionChainModalOpen, setOptionChainModalOpen] = useState(false);
  const [optionChainInstrument, setOptionChainInstrument] = useState<TradingInstrument | null>(null);

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [centralControlsOpen, setCentralControlsOpen] = useState(false);
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [ticketsModalOpen, setTicketsModalOpen] = useState(false);
  const [marketClosedModalOpen, setMarketClosedModalOpen] = useState(false);

  // Sync dark and light classes and data-theme attribute on document root
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
      try {
        localStorage.setItem('trading_theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
      try {
        localStorage.setItem('trading_theme', 'light');
      } catch {}
    }
  }, [isDark]);

  // Live Market Price Tick Simulator (every 2 seconds if marketStatus !== 'CLOSED')
  useEffect(() => {
    if (marketStatus === 'CLOSED') return;

    const interval = setInterval(() => {
      setInstruments(prevList =>
        prevList.map(inst => {
          // Subtle price walk
          const volatility = inst.lastPrice * (inst.category === 'CRYPTO' ? 0.0015 : 0.0006);
          const delta = (Math.random() - 0.49) * volatility;
          const newPrice = Math.max(1, inst.lastPrice + delta);
          const newChange = inst.change + delta;
          const newChangePercent = ((newPrice - (inst.lastPrice - inst.change)) / (inst.lastPrice - inst.change)) * 100;
          const newHigh = Math.max(inst.high, newPrice);
          const newLow = Math.min(inst.low, newPrice);
          const spread = inst.lastPrice < 100 ? 0.05 : 0.5;

          return {
            ...inst,
            lastPrice: Number(newPrice.toFixed(inst.lastPrice < 10 ? 4 : 2)),
            change: Number(newChange.toFixed(inst.lastPrice < 10 ? 4 : 2)),
            changePercent: Number(newChangePercent.toFixed(2)),
            high: Number(newHigh.toFixed(2)),
            low: Number(newLow.toFixed(2)),
            bid: Number((newPrice - spread).toFixed(2)),
            ask: Number((newPrice + spread).toFixed(2))
          };
        })
      );

      // Also gently update Benchmarks
      setBenchmarks(prevBms =>
        prevBms.map(bm => {
          const delta = (Math.random() - 0.49) * (bm.price * 0.0004);
          const newPrice = bm.price + delta;
          const newChange = bm.change + delta;
          return {
            ...bm,
            price: Number(newPrice.toFixed(2)),
            change: Number(newChange.toFixed(2)),
            changePercent: Number(((newChange / (bm.price - bm.change)) * 100).toFixed(2))
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [marketStatus]);

  // Keep selectedInstrument in sync with price updates
  useEffect(() => {
    const updated = instruments.find(i => i.id === selectedInstrument.id);
    if (updated) {
      setSelectedInstrument(updated);
    }
  }, [instruments, selectedInstrument.id]);

  // Recalculate positions P&L dynamically based on latest instrument prices
  useEffect(() => {
    setPositions(prevPositions =>
      prevPositions.map(pos => {
        const inst = instruments.find(i => i.symbol === pos.symbol || pos.symbol.startsWith(i.symbol));
        const currentLTP = inst ? inst.lastPrice : pos.lastPrice;
        const priceDiff = pos.side === 'BUY' ? currentLTP - pos.avgPrice : pos.avgPrice - currentLTP;
        const newPnl = priceDiff * pos.quantity;
        const newPnlPercent = (priceDiff / pos.avgPrice) * 100;

        return {
          ...pos,
          lastPrice: currentLTP,
          pnl: Number(newPnl.toFixed(2)),
          pnlPercent: Number(newPnlPercent.toFixed(2))
        };
      })
    );
  }, [instruments]);

  // Handlers for Orders
  const handleOpenOrder = (inst: TradingInstrument, side: 'BUY' | 'SELL') => {
    if (marketStatus === 'CLOSED') {
      setMarketClosedModalOpen(true);
      return;
    }
    if (!branding.isTradingEnabled) {
      onNotify?.('Trading is currently disabled on this tenant platform.', 'warning');
      return;
    }
    setOrderModalInstrument(inst);
    setOrderModalSide(side);
    setOrderModalOpen(true);
  };

  // Telemetry Heartbeat: send active trader heartbeat to Central Admin
  useEffect(() => {
    try {
      fetch('/api/events/trading-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId || 'TNT-001' },
        body: JSON.stringify({
          eventType: 'user.login',
          tenantId: activeTenantId || 'TNT-001',
          payload: {
            userId: client.userId || 'CLI-001',
            clientId: client.userId || 'CLI-001',
            clientCode: client.userId || 'CLI-001',
            name: client.fullName || 'Active Trader'
          }
        })
      }).catch(() => {});
    } catch {}
  }, [activeTenantId, client.userId, client.fullName]);

  const handlePlaceOrder = (orderData: Partial<ClientOrder>) => {
    const newOrder: ClientOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      symbol: orderData.symbol || selectedInstrument.symbol,
      category: orderData.category || selectedInstrument.category,
      type: orderData.type || 'BUY',
      orderType: orderData.orderType || 'MARKET',
      product: orderData.product || 'INTRADAY',
      lots: orderData.lots || 1,
      quantity: orderData.quantity || 10,
      price: orderData.price || selectedInstrument.lastPrice,
      executionPrice: orderData.executionPrice,
      status: orderData.status || 'EXECUTED',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      stopLoss: orderData.stopLoss,
      target: orderData.target
    };

    setOrders(prev => [newOrder, ...prev]);

    // Dispatch S2S event to Central Admin in real-time
    try {
      const orderPayload = {
        orderId: newOrder.id,
        clientId: client.userId || 'CLI-001',
        clientName: client.fullName || 'Trading Client',
        tenantId: activeTenantId || 'TNT-001',
        symbol: newOrder.symbol,
        side: newOrder.type,
        quantity: newOrder.quantity,
        price: newOrder.executionPrice || newOrder.price,
        productType: newOrder.product,
        status: newOrder.status,
        timestamp: new Date().toISOString()
      };

      fetch('/api/events/trading-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId || 'TNT-001' },
        body: JSON.stringify({
          eventType: newOrder.status === 'EXECUTED' ? 'trade.executed' : 'order.created',
          tenantId: activeTenantId || 'TNT-001',
          payload: {
            ...orderPayload,
            tradeId: `TRD-${newOrder.id.replace('ORD-', '')}`,
            totalValue: (newOrder.executionPrice || newOrder.price) * (newOrder.quantity || 1)
          }
        })
      }).catch(err => console.warn('[TradingPlatformView] Order sync notice:', err));
    } catch {}

    // If order executed, add or update position and adjust margin
    if (newOrder.status === 'EXECUTED') {
      const marginDeduction = (orderData.product === 'INTRADAY' ? selectedInstrument.intraday : selectedInstrument.holding) * newOrder.lots;

      setWallet(prev => ({
        ...prev,
        availableBalance: Math.max(0, prev.availableBalance - marginDeduction),
        usedMargin: prev.usedMargin + marginDeduction
      }));

      // Add to positions
      const newPos: ClientPosition = {
        id: `POS-${Date.now().toString().slice(-5)}`,
        symbol: newOrder.symbol,
        category: newOrder.category,
        product: newOrder.product,
        side: newOrder.type,
        lots: newOrder.lots,
        quantity: newOrder.quantity,
        avgPrice: newOrder.executionPrice || newOrder.price,
        lastPrice: newOrder.executionPrice || newOrder.price,
        pnl: 0,
        pnlPercent: 0
      };
      setPositions(prev => [newPos, ...prev]);

      onNotify?.(`Order ${newOrder.id} executed successfully for ${newOrder.symbol}!`, 'success');
    } else {
      onNotify?.(`Limit order placed for ${newOrder.symbol} at ₹${newOrder.price}.`, 'info');
    }
  };

  const handleCancelOrder = (orderId: string) => {
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
    );
    try {
      fetch('/api/events/trading-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId || 'TNT-001' },
        body: JSON.stringify({
          eventType: 'order.cancelled',
          tenantId: activeTenantId || 'TNT-001',
          payload: {
            orderId,
            clientId: client.userId || 'CLI-001',
            status: 'CANCELLED'
          }
        })
      }).catch(() => {});
    } catch {}
    onNotify?.(`Order ${orderId} cancelled.`, 'info');
  };

  // Handlers for Positions
  const handleSquareOff = (positionId: string) => {
    const pos = positions.find(p => p.id === positionId);
    if (!pos) return;

    // Realize P&L and release margin
    setWallet(prev => ({
      ...prev,
      availableBalance: prev.availableBalance + pos.pnl + 15000,
      usedMargin: Math.max(0, prev.usedMargin - 15000),
      todayPnL: prev.todayPnL + pos.pnl,
      totalPnL: prev.totalPnL + pos.pnl
    }));

    setPositions(prev => prev.filter(p => p.id !== positionId));

    try {
      fetch('/api/events/trading-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId || 'TNT-001' },
        body: JSON.stringify({
          eventType: 'position.closed',
          tenantId: activeTenantId || 'TNT-001',
          payload: {
            positionId,
            clientId: client.userId || 'CLI-001',
            symbol: pos.symbol,
            pnl: pos.pnl,
            status: 'CLOSED'
          }
        })
      }).catch(() => {});
    } catch {}

    onNotify?.(`Squared off ${pos.symbol}. Realized P&L: ₹${pos.pnl.toFixed(2)}.`, 'success');
  };

  const handleSquareOffAll = () => {
    const totalPnl = positions.reduce((acc, p) => acc + p.pnl, 0);
    setWallet(prev => ({
      ...prev,
      availableBalance: prev.availableBalance + totalPnl + prev.usedMargin,
      usedMargin: 0,
      todayPnL: prev.todayPnL + totalPnl,
      totalPnL: prev.totalPnL + totalPnl
    }));
    setPositions([]);
    onNotify?.(`All positions squared off! Total Realized P&L: ₹${totalPnl.toFixed(2)}.`, 'success');
  };

  // Handlers for Wallet
  const handleDeposit = (amount: number, method: string) => {
    setWallet(prev => ({
      ...prev,
      availableBalance: prev.availableBalance + amount
    }));

    try {
      fetch('/api/events/trading-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId || 'TNT-001' },
        body: JSON.stringify({
          eventType: 'deposit.approved',
          tenantId: activeTenantId || 'TNT-001',
          payload: {
            depositId: `DEP-${Date.now().toString().slice(-6)}`,
            clientId: client.userId || 'CLI-001',
            clientName: client.fullName || 'Trading Client',
            amount,
            currency: 'INR',
            method,
            status: 'COMPLETED'
          }
        })
      }).catch(() => {});
    } catch {}

    onNotify?.(`₹${amount.toLocaleString()} deposited instantly via ${method}!`, 'success');
  };

  const handleWithdraw = (amount: number, bank: string) => {
    setWallet(prev => ({
      ...prev,
      availableBalance: Math.max(0, prev.availableBalance - amount)
    }));

    try {
      fetch('/api/events/trading-platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId || 'TNT-001' },
        body: JSON.stringify({
          eventType: 'withdrawal.approved',
          tenantId: activeTenantId || 'TNT-001',
          payload: {
            withdrawalId: `WTH-${Date.now().toString().slice(-6)}`,
            clientId: client.userId || 'CLI-001',
            clientName: client.fullName || 'Trading Client',
            amount,
            currency: 'INR',
            bank,
            status: 'COMPLETED'
          }
        })
      }).catch(() => {});
    } catch {}

    onNotify?.(`₹${amount.toLocaleString()} withdrawal initiated to ${bank}.`, 'success');
  };

  // Central controls & reset
  const handleResetDemoData = () => {
    setInstruments(INITIAL_INSTRUMENTS);
    setOrders(INITIAL_ORDERS);
    setPositions(INITIAL_POSITIONS);
    setWallet(INITIAL_WALLET);
    setSelectedInstrument(INITIAL_INSTRUMENTS[1]);
    onNotify?.('Platform restored to default demo portfolio state.', 'info');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-[#060B14] text-slate-100' : 'light bg-slate-100 text-slate-900'} font-sans transition-colors duration-150 flex flex-col`}>
      {/* 1. TOP BAR (Tenant Name, Code, Trade/Options Pills, Switch Tenant & Central Controls) */}
      <TradingTopBar
        tenantName={branding.brandName || branding.tenantName}
        tenantCode={branding.shortName || branding.tenantCode}
        tagline={branding.tagline}
        isTradingEnabled={branding.isTradingEnabled}
        isOptionsEnabled={branding.isOptionsEnabled}
        availableTenants={availableTenantsList}
        onSelectTenant={t => {
          setActiveTenantDomain(t.domain);
          setActiveTenantId(t.id);
          setBranding(prev => ({
            ...prev,
            tenantName: t.name,
            tenantCode: t.code,
            brandName: t.name,
            shortName: t.code
          }));
          loadTenantBranding(t.domain, t.id);
          onNotify?.(`Switched to tenant ${t.name}`, 'info');
        }}
        onOpenCentralControls={() => setCentralControlsOpen(true)}
        onReturnToAdmin={onReturnToAdmin}
        isAdmin={isAdmin}
      />

      {/* 2. MAIN HEADER (Logo, Watchlist, Orders, Portfolio, History, Profile Tabs + Theme, Lang, Wallet, Avatar) */}
      <TradingHeader
        activeTab={activeTab}
        onSelectTab={tab => setActiveTab(tab)}
        brandName={branding.brandName || branding.tenantName}
        brandShortName={branding.shortName || branding.tenantCode}
        brandTagline={branding.tagline}
        logoUrl={branding.logoUrl}
        primaryColor={branding.primaryColor || branding.colors?.primary}
        ordersCount={orders.filter(o => o.status === 'OPEN').length || orders.length}
        positionsCount={positions.length}
        unreadNotificationsCount={2}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onOpenWallet={() => setWalletModalOpen(true)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenTour={() => setTourModalOpen(true)}
        onOpenCentralControls={() => setCentralControlsOpen(true)}
        onReturnToAdmin={onReturnToAdmin}
        clientInitials={client.initials}
        clientFullName={client.fullName}
      />

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-6">
        {/* Trader Console Banner (User ID, KYC Verified, Market: LIVE IST toggle) */}
        <TraderConsoleBanner
          clientName={client.fullName}
          userId={client.userId}
          kycStatus={client.kycStatus}
          marketStatus={marketStatus}
          onToggleMarketStatus={() => {
            const nextMode = marketStatus === 'LIVE' ? 'OPEN' : marketStatus === 'OPEN' ? 'CLOSED' : 'LIVE';
            setMarketStatus(nextMode);
            if (nextMode === 'CLOSED') {
              setMarketClosedModalOpen(true);
            }
            onNotify?.(`Market Mode switched to: ${nextMode}`, 'info');
          }}
          onOpenMarketHoursInfo={() => setMarketClosedModalOpen(true)}
        />

        {/* Top 3 Metric Cards: AVAILABLE MARGIN, TODAY'S P&L, OVERALL P&L */}
        <TradingMetricsRow
          availableMargin={wallet.availableBalance}
          todayPnL={wallet.todayPnL}
          overallPnL={wallet.totalPnL}
          onOpenWallet={() => setWalletModalOpen(true)}
        />

        {/* TAB 1: WATCHLIST & SPOTLIGHT (Matching the exact provided screenshot) */}
        {activeTab === 'watchlist' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Watchlist with Search, Category filters, Instrument rows */}
            <div className="lg:col-span-8">
              <TradingWatchlist
                instruments={instruments}
                selectedInstrumentId={selectedInstrument.id}
                onSelectInstrument={inst => setSelectedInstrument(inst)}
                onOpenOrder={handleOpenOrder}
                onOpenChart={inst => {
                  setChartModalInstrument(inst);
                  setChartModalOpen(true);
                }}
                onOpenOptionChain={inst => {
                  setOptionChainInstrument(inst);
                  setOptionChainModalOpen(true);
                }}
              />
            </div>

            {/* Right Column: Live Spotlight Terminal (SILVER FUT), Range, Bid/Ask, Buy/Sell, Benchmarks, Margin */}
            <div className="lg:col-span-4 sticky top-16">
              <LiveSpotlightTerminal
                instrument={selectedInstrument}
                benchmarks={benchmarks}
                wallet={wallet}
                onOpenOrder={handleOpenOrder}
                onOpenChart={inst => {
                  setChartModalInstrument(inst);
                  setChartModalOpen(true);
                }}
                onOpenOptionChain={inst => {
                  setOptionChainInstrument(inst);
                  setOptionChainModalOpen(true);
                }}
                onOpenWallet={() => setWalletModalOpen(true)}
              />
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS VIEW */}
        {activeTab === 'orders' && (
          <TradingOrdersView
            orders={orders}
            onCancelOrder={handleCancelOrder}
            onOpenPlaceOrder={() => handleOpenOrder(selectedInstrument, 'BUY')}
            onOpenChart={(sym) => {
              const inst = instruments.find(i => i.symbol === sym) || selectedInstrument;
              setChartModalInstrument(inst);
              setChartModalOpen(true);
            }}
            onRepeatOrder={(ord) => {
              const inst = instruments.find(i => i.symbol === ord.symbol) || selectedInstrument;
              handleOpenOrder(inst, ord.type);
            }}
          />
        )}

        {/* TAB 3: PORTFOLIO VIEW */}
        {activeTab === 'portfolio' && (
          <TradingPortfolioView
            positions={positions}
            wallet={wallet}
            onSquareOff={handleSquareOff}
            onSquareOffAll={handleSquareOffAll}
            onOpenOrder={(sym, side) => {
              const inst = instruments.find(i => i.symbol === sym) || selectedInstrument;
              handleOpenOrder(inst, side);
            }}
            onOpenChart={(sym) => {
              const inst = instruments.find(i => i.symbol === sym) || selectedInstrument;
              setChartModalInstrument(inst);
              setChartModalOpen(true);
            }}
            onOpenWallet={() => setWalletModalOpen(true)}
          />
        )}

        {/* TAB 4: HISTORY VIEW */}
        {activeTab === 'history' && (
          <TradingHistoryView
            orders={orders}
            onOpenWalletLedger={() => setWalletModalOpen(true)}
          />
        )}

        {/* TAB 5: PROFILE VIEW */}
        {activeTab === 'profile' && (
          <TradingProfileView
            client={client}
            wallet={wallet}
            supportEmail={branding.supportEmail}
            supportPhone={branding.supportPhone}
            brandName={branding.brandName || branding.tenantName}
            footerCopyright={branding.footerCopyright}
            onLogout={() => {
              if (onReturnToAdmin) {
                onReturnToAdmin();
              } else {
                location.reload();
              }
            }}
            onOpenWallet={() => setWalletModalOpen(true)}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenTour={() => setTourModalOpen(true)}
            onOpenTickets={() => setTicketsModalOpen(true)}
          />
        )}
      </main>

      {/* 4. TENANT BRANDED FOOTER (LEGAL COMPLIANCE & SUPPORT) */}
      <footer className="mt-auto border-t border-slate-200 dark:border-[#162234] bg-white/50 dark:bg-[#070D18]/80 py-6 px-4 text-xs text-slate-500 select-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.brandName || branding.tenantName}
                className="h-6 max-w-[110px] object-contain rounded bg-black/20 p-0.5 border border-white/5"
              />
            ) : (
              <div
                className="w-6 h-6 rounded flex items-center justify-center font-black text-white text-[10px]"
                style={{ backgroundColor: branding.primaryColor || branding.colors?.primary || '#3b82f6' }}
              >
                {branding.shortName || branding.tenantCode}
              </div>
            )}
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {branding.footerCopyright || `© 2026 ${branding.brandName || branding.tenantName}. All rights reserved.`}
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {branding.supportEmail && (
              <a
                href={`mailto:${branding.supportEmail}`}
                className="text-slate-400 hover:text-blue-400 transition-colors"
              >
                Support: {branding.supportEmail}
              </a>
            )}
            {branding.supportPhone && (
              <span className="text-slate-400">
                Phone: {branding.supportPhone}
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              SEBI Compliant Terminal
            </span>
          </div>
        </div>
      </footer>

      {/* 4. MODALS & SLIDEOVERS */}
      {/* Order Placement Modal */}
      <OrderModal
        isOpen={orderModalOpen}
        instrument={orderModalInstrument}
        initialSide={orderModalSide}
        wallet={wallet}
        onClose={() => setOrderModalOpen(false)}
        onPlaceOrder={handlePlaceOrder}
        onOpenChart={inst => {
          setChartModalInstrument(inst);
          setChartModalOpen(true);
        }}
        onOpenOptionChain={inst => {
          setOptionChainInstrument(inst);
          setOptionChainModalOpen(true);
        }}
      />

      {/* Technical Candlestick Chart Modal */}
      <TechnicalChartModal
        isOpen={chartModalOpen}
        instrument={chartModalInstrument}
        onClose={() => setChartModalOpen(false)}
        onOpenOrder={handleOpenOrder}
        onOpenOptionChain={inst => {
          setOptionChainInstrument(inst);
          setOptionChainModalOpen(true);
        }}
      />

      {/* Option Chain Modal */}
      <OptionChainModal
        isOpen={optionChainModalOpen}
        instrument={optionChainInstrument}
        onClose={() => setOptionChainModalOpen(false)}
        onSelectStrike={(strikeSymbol, side, price) => {
          handleOpenOrder(
            {
              ...selectedInstrument,
              symbol: strikeSymbol,
              lastPrice: price,
              intraday: price * selectedInstrument.lotSize,
              holding: price * selectedInstrument.lotSize
            },
            side
          );
        }}
      />

      {/* Wallet & Funds Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        wallet={wallet}
        onClose={() => setWalletModalOpen(false)}
        onDeposit={handleDeposit}
        onWithdraw={handleWithdraw}
      />

      {/* Central Controls & White-Label Modal */}
      <CentralControlsModal
        isOpen={centralControlsOpen}
        onClose={() => setCentralControlsOpen(false)}
        tenantName={branding.tenantName}
        tenantCode={branding.tenantCode}
        tagline={branding.tagline}
        isTradingEnabled={branding.isTradingEnabled}
        isOptionsEnabled={branding.isOptionsEnabled}
        marketStatus={marketStatus}
        onUpdateTenantConfig={cfg => {
          setBranding(prev => ({
            ...prev,
            tenantName: cfg.tenantName || prev.tenantName,
            tenantCode: cfg.tenantCode || prev.tenantCode,
            tagline: cfg.tagline || prev.tagline,
            isTradingEnabled: cfg.isTradingEnabled !== undefined ? cfg.isTradingEnabled : prev.isTradingEnabled,
            isOptionsEnabled: cfg.isOptionsEnabled !== undefined ? cfg.isOptionsEnabled : prev.isOptionsEnabled
          }));
          if (cfg.marketStatus) setMarketStatus(cfg.marketStatus);
          onNotify?.('Tenant platform configuration updated.', 'success');
        }}
        onResetDemoData={handleResetDemoData}
        onReturnToAdmin={onReturnToAdmin}
      />

      {/* Quick Tour Modal */}
      <TourModal
        isOpen={tourModalOpen}
        onClose={() => setTourModalOpen(false)}
      />

      {/* Support & Compliance Tickets Modal */}
      <SupportTicketsModal
        isOpen={ticketsModalOpen}
        onClose={() => setTicketsModalOpen(false)}
      />

      {/* Official Market Closed Information & Override Modal */}
      <MarketClosedModal
        isOpen={marketClosedModalOpen}
        onClose={() => setMarketClosedModalOpen(false)}
        onSimulateOpen={() => {
          setMarketStatus('LIVE');
          onNotify?.('Market Mode switched to LIVE (IST)!', 'success');
        }}
        info={{
          exchange: selectedInstrument.category === 'COMMODITY' ? 'MCX Commodity Exchange' : 'NSE & BSE',
          tradingHours: selectedInstrument.category === 'COMMODITY' ? '09:00 - 23:30' : '09:15 - 15:30',
          days: 'Mon - Fri',
          timeZone: 'IST'
        }}
      />

      {/* Notifications Drawer */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs select-none animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0C1422] border-l border-slate-200 dark:border-[#1E2E44] h-full shadow-2xl p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#162234] pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">Notifications</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#162234] text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-500 font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Order Executed</span>
                  </div>
                  <p className="text-slate-400">Order ORD-90124 for 2 Lots GOLD FUT filled at ₹1,57,366.34.</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">10 minutes ago</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#162234] text-xs">
                  <div className="flex items-center gap-1.5 text-amber-500 font-bold mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Margin Credit Added</span>
                  </div>
                  <p className="text-slate-400">₹50,000 UPI Instant deposit credited to Available Margin.</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">1 hour ago</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-[#152338] text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
