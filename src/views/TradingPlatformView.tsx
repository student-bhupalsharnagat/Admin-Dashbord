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
  initialClient?: any;
  onReturnToAdmin?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TradingPlatformView: React.FC<TradingPlatformViewProps> = ({
  initialTenantDomain = 'trade.vertextrading.com',
  initialClient = null,
  onReturnToAdmin,
  onNotify
}) => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || true;
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
        tenantCode: initialClient.tenantCode || 'VTX'
      };
    }
    return INITIAL_TENANT_BRANDING;
  });

  // Client Profile state
  const [client, setClient] = useState<ClientAccount>(() => {
    if (initialClient) {
      return {
        id: initialClient.id || 'CLI-9021',
        userId: initialClient.userId || initialClient.client_code || initialClient.id || 'vtx123',
        fullName: initialClient.fullName || initialClient.name || 'Demo Trader',
        email: initialClient.email || 'trader@vertextrading.com',
        phone: initialClient.phone || '+91 98765 43210',
        initials: initialClient.initials || 'DT',
        kycStatus: 'Verified (MCX & NSE Active)',
        role: 'CLIENT',
        tenantId: initialClient.tenantId || 'TNT-001',
        tenantName: initialClient.tenantName || 'VERTEX Trading',
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
  const [wallet, setWallet] = useState<ClientWallet>(INITIAL_WALLET);

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

  // Sync dark class on document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
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
    if (!branding.isTradingEnabled) {
      onNotify?.('Trading is currently disabled on this tenant platform.', 'warning');
      return;
    }
    setOrderModalInstrument(inst);
    setOrderModalSide(side);
    setOrderModalOpen(true);
  };

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
    onNotify?.(`₹${amount.toLocaleString()} deposited instantly via ${method}!`, 'success');
  };

  const handleWithdraw = (amount: number, bank: string) => {
    setWallet(prev => ({
      ...prev,
      availableBalance: Math.max(0, prev.availableBalance - amount)
    }));
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
    <div className={`min-h-screen ${isDark ? 'dark bg-[#060B14] text-slate-100' : 'bg-slate-100/70 text-slate-900'} font-sans transition-colors duration-150 flex flex-col`}>
      {/* 1. TOP BAR (Tenant Name, Code, Trade/Options Pills, Switch Tenant & Central Controls) */}
      <TradingTopBar
        tenantName={branding.tenantName}
        tenantCode={branding.tenantCode}
        tagline={branding.tagline}
        isTradingEnabled={branding.isTradingEnabled}
        isOptionsEnabled={branding.isOptionsEnabled}
        onSelectTenant={t => {
          setBranding(prev => ({
            ...prev,
            tenantName: t.name,
            tenantCode: t.code
          }));
          onNotify?.(`Switched to tenant ${t.name}`, 'info');
        }}
        onOpenCentralControls={() => setCentralControlsOpen(true)}
        onReturnToAdmin={onReturnToAdmin}
        isAdmin={!!onReturnToAdmin}
      />

      {/* 2. MAIN HEADER (Logo, Watchlist, Orders, Portfolio, History, Profile Tabs + Theme, Lang, Wallet, Avatar) */}
      <TradingHeader
        activeTab={activeTab}
        onSelectTab={tab => setActiveTab(tab)}
        brandName={branding.tenantName}
        brandShortName={branding.tenantCode}
        brandTagline={branding.tagline}
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
            onNotify?.(`Market Mode switched to: ${nextMode}`, 'info');
          }}
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
