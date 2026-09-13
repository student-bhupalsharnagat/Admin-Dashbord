import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Globe,
  Shield,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  ChevronDown,
  Search,
  Sliders,
  RefreshCw,
  Lock,
  UserPlus,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Phone,
  Mail,
  FileText
} from 'lucide-react';
import { TenantBranding, TenantPlatformConfig } from '../types';

interface MarketQuote {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: string;
}

interface TenantOrder {
  id: string;
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  type: string;
  status: string;
  created_at: string;
}

interface TradingPlatformViewProps {
  initialTenantDomain?: string;
  onReturnToAdmin?: () => void;
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TradingPlatformView: React.FC<TradingPlatformViewProps> = ({
  initialTenantDomain = 'trade.alphaprime.com',
  onReturnToAdmin,
  onNotify
}) => {
  // Domain / Tenant Switcher
  const [currentDomain, setCurrentDomain] = useState(initialTenantDomain);
  const [availableDomains, setAvailableDomains] = useState<Array<{ domain: string; name: string; tenantId: string }>>([
    { domain: 'trade.alphaprime.com', name: 'AlphaPrime Capital', tenantId: 'ten-01' },
    { domain: 'trade.zenithmarkets.in', name: 'Zenith Markets', tenantId: 'ten-02' },
    { domain: 'trade.quantumfx.io', name: 'Quantum Alpha', tenantId: 'ten-03' },
    { domain: 'trade.apexalgo.co', name: 'Apex Securities', tenantId: 'ten-04' }
  ]);

  // Tenant Branding & Config State
  const [branding, setBranding] = useState<any | null>(null);
  const [platformConfig, setPlatformConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<'terminal' | 'orders' | 'market' | 'register'>('terminal');

  // Market & Order State
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderQuantity, setOrderQuantity] = useState<number>(50);
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [orderPrice, setOrderPrice] = useState<string>('');
  const [recentOrders, setRecentOrders] = useState<TenantOrder[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regFeedback, setRegFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch Tenant Branding & Platform Config
  const fetchTenantData = async (domain: string) => {
    setLoading(true);
    try {
      // 1. Fetch Branding
      const brandingRes = await fetch(`/api/tenant/branding?domain=${encodeURIComponent(domain)}`);
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        setBranding(brandingData);

        // Apply Dynamic CSS Variables to Root/Terminal
        if (brandingData.colors) {
          const root = document.documentElement;
          root.style.setProperty('--brand-primary', brandingData.colors.primary);
          root.style.setProperty('--brand-secondary', brandingData.colors.secondary);
          root.style.setProperty('--brand-accent', brandingData.colors.accent);
          root.style.setProperty('--brand-bg', brandingData.colors.background);
          root.style.setProperty('--brand-surface', brandingData.colors.surface);
          root.style.setProperty('--brand-text', brandingData.colors.text);
        }

        // Dynamically update document title
        if (brandingData.brandName) {
          document.title = `${brandingData.brandName} - Trading Terminal`;
        }
      }

      // 2. Fetch Platform Feature Flags & Emergency Controls
      const configRes = await fetch(`/api/tenant/config?domain=${encodeURIComponent(domain)}`);
      if (configRes.ok) {
        const configData = await configRes.json();
        setPlatformConfig(configData);
      }

      // 3. Fetch Market Quotes
      const quotesRes = await fetch('/api/tenant/market-quotes');
      if (quotesRes.ok) {
        const quotesData = await quotesRes.json();
        setMarketQuotes(quotesData);
        if (quotesData.length > 0 && !selectedSymbol) {
          setSelectedSymbol(quotesData[0].symbol);
          setOrderPrice(String(quotesData[0].lastPrice));
        }
      }

      // 4. Fetch Tenant Orders
      const ordersRes = await fetch(`/api/tenant/orders?domain=${encodeURIComponent(domain)}`);
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData);
      }
    } catch (err) {
      console.error('Error fetching tenant platform data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTenantData(currentDomain);
  }, [currentDomain]);

  // Set default price when symbol changes
  useEffect(() => {
    const quote = marketQuotes.find(q => q.symbol === selectedSymbol);
    if (quote) {
      setOrderPrice(String(quote.lastPrice));
    }
  }, [selectedSymbol, marketQuotes]);

  // Handle Order Placement
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacingOrder(true);
    setOrderFeedback(null);

    try {
      const payload = {
        symbol: selectedSymbol,
        side: orderSide,
        quantity: orderQuantity,
        price: orderType === 'LIMIT' ? Number(orderPrice) : undefined,
        type: orderType,
        clientName: 'Demo Retail Trader'
      };

      const res = await fetch(`/api/tenant/orders?domain=${encodeURIComponent(currentDomain)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setOrderFeedback({
          success: false,
          message: data.message || data.error || 'Order rejected by risk/feature control.'
        });
        onNotify?.(data.message || 'Order rejected', 'warning');
      } else {
        setOrderFeedback({
          success: true,
          message: `Order #${data.order?.order_id || 'SUCCESS'} placed successfully for ${orderQuantity}x ${selectedSymbol}!`
        });
        onNotify?.(`Order placed successfully on ${branding?.brandName}!`, 'success');
        
        // Refresh orders list
        if (data.order) {
          setRecentOrders(prev => [data.order, ...prev]);
        }
      }
    } catch (err: any) {
      setOrderFeedback({
        success: false,
        message: err.message || 'Network error while executing order'
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  // Handle Client Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    setRegFeedback(null);

    try {
      const res = await fetch(`/api/tenant/register?domain=${encodeURIComponent(currentDomain)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          password: regPassword
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRegFeedback({
          success: false,
          message: data.message || 'Registration rejected by broker configuration.'
        });
      } else {
        setRegFeedback({
          success: true,
          message: data.message || 'Registration successful! Your client account is active.'
        });
        setRegName('');
        setRegEmail('');
        setRegPhone('');
        setRegPassword('');
      }
    } catch (err: any) {
      setRegFeedback({ success: false, message: err.message });
    } finally {
      setRegistering(false);
    }
  };

  const currentQuote = marketQuotes.find(q => q.symbol === selectedSymbol) || marketQuotes[0];
  const primaryColor = branding?.colors?.primary || '#2563eb';
  const surfaceColor = branding?.colors?.surface || '#0f172a';
  const backgroundColor = branding?.colors?.background || '#080d1a';
  const textColor = branding?.colors?.text || '#f8fafc';
  const accentColor = branding?.colors?.accent || '#38bdf8';

  return (
    <div
      className="min-h-screen flex flex-col font-sans transition-colors duration-300"
      style={{
        backgroundColor: backgroundColor,
        color: textColor
      }}
    >
      {/* Top Architecture Bar: Demonstrates Central Admin <-> Multi-Tenant Trading Platform link */}
      <div className="bg-[#050914] border-b border-[#141f38] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
            <Globe size={13} />
            <span>TENANT TRADING PLATFORM</span>
          </div>

          {/* Domain Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 hidden sm:inline">Active Host/Domain:</span>
            <div className="relative">
              <select
                value={currentDomain}
                onChange={e => setCurrentDomain(e.target.value)}
                className="bg-[#0d162d] border border-[#1f2f54] text-slate-200 rounded-lg px-2.5 py-1 pr-8 font-mono text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {availableDomains.map(d => (
                  <option key={d.domain} value={d.domain}>
                    {d.domain} ({d.name})
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchTenantData(currentDomain);
            }}
            disabled={refreshing}
            className="px-2.5 py-1 rounded bg-[#0f1b36] hover:bg-[#16274e] border border-[#213560] text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Tenant Branding & Config"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin text-blue-400' : ''} />
            <span className="hidden sm:inline">Sync Branding</span>
          </button>

          {onReturnToAdmin && (
            <button
              onClick={onReturnToAdmin}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Layers size={13} />
              <span>Back to Central Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Maintenance Mode Banner */}
      {platformConfig?.maintenanceMode && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2.5 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="font-semibold">MAINTENANCE MODE ACTIVE:</span>
          <span>{platformConfig.maintenanceMessage || 'Platform undergoing scheduled maintenance. Trading is temporarily halted.'}</span>
        </div>
      )}

      {/* Global Halting or Tenant Frozen Banner */}
      {(platformConfig?.systemHalted || platformConfig?.tenantFrozen || !platformConfig?.tradingEnabled) && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-2 text-center text-xs text-rose-300 flex items-center justify-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span className="font-bold">TRADING SUSPENDED:</span>
          <span>
            {platformConfig?.systemHalted
              ? 'Global Trading Emergency Circuit is active.'
              : platformConfig?.tenantFrozen
              ? 'This brokerage account is currently frozen by compliance.'
              : 'Trading is disabled by platform feature flag.'}
          </span>
        </div>
      )}

      {/* Tenant Custom Branded Navigation Header */}
      <header
        className="px-4 lg:px-8 py-3.5 border-b border-white/10 flex items-center justify-between transition-colors shrink-0"
        style={{ backgroundColor: surfaceColor }}
      >
        <div className="flex items-center gap-6">
          {/* Tenant Brand Logo & Name */}
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.brandName}
                className="h-8 max-w-[150px] object-contain"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                <TrendingUp size={18} />
              </div>
            )}
            <div>
              <div className="font-bold tracking-tight text-sm flex items-center gap-2">
                <span>{branding?.brandName || 'Trading Desk'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold bg-white/10 text-slate-300">
                  {branding?.shortName || 'PRO'}
                </span>
              </div>
              {branding?.tagline && (
                <div className="text-[11px] opacity-70 truncate max-w-[200px] sm:max-w-xs">
                  {branding.tagline}
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActivePlatformTab('terminal')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePlatformTab === 'terminal' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Terminal
            </button>
            <button
              onClick={() => setActivePlatformTab('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePlatformTab === 'orders' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Orders ({recentOrders.length})
            </button>
            <button
              onClick={() => setActivePlatformTab('register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activePlatformTab === 'register' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Open Account
            </button>
          </nav>
        </div>

        {/* Right side: Contact & Account Status */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col text-right text-[11px]">
            <span className="text-slate-400">Support Desk</span>
            <span className="font-medium text-slate-200">{branding?.contactInfo?.supportEmail || 'support@tradingdesk.com'}</span>
          </div>

          <div className="h-4 w-px bg-white/15 hidden sm:block" />

          {/* Platform Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Market Open</span>
          </div>
        </div>
      </header>

      {/* Main Trading Platform Container */}
      <div className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
            <p className="text-xs text-slate-400">Resolving tenant configuration and live branding...</p>
          </div>
        ) : activePlatformTab === 'register' ? (
          /* REGISTRATION / CLIENT ONBOARDING VIEW */
          <div className="max-w-md mx-auto py-8">
            <div
              className="rounded-2xl border border-white/10 p-6 shadow-2xl space-y-5"
              style={{ backgroundColor: surfaceColor }}
            >
              <div className="text-center space-y-1">
                <div
                  className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-white mb-2"
                  style={{ backgroundColor: primaryColor }}
                >
                  <UserPlus size={20} />
                </div>
                <h2 className="text-lg font-bold text-white">Create Trading Account</h2>
                <p className="text-xs text-slate-400">
                  Open an account with {branding?.brandName || 'our brokerage'}
                </p>
              </div>

              {!platformConfig?.registrationEnabled ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center space-y-2">
                  <AlertTriangle size={24} className="text-amber-400 mx-auto" />
                  <div className="text-xs font-bold text-amber-300">Registration Currently Disabled</div>
                  <p className="text-[11px] text-slate-400">
                    New client registrations are temporarily disabled for {branding?.brandName} according to administrator platform configuration.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  {regFeedback && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                        regFeedback.success
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {regFeedback.success ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
                      <span>{regFeedback.message}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="trader@domain.com"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Mobile Phone</label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Create Password</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={registering}
                    className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {registering ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Registration</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* TRADING TERMINAL & ORDERS VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Market Watchlist (4 cols) */}
            <div
              className="lg:col-span-4 rounded-2xl border border-white/10 p-4 space-y-4"
              style={{ backgroundColor: surfaceColor }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Market Watch</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 font-mono text-slate-300">
                    NSE / BSE
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Live Quotes</div>
              </div>

              {/* Symbol List */}
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {marketQuotes.map(quote => {
                  const isSelected = quote.symbol === selectedSymbol;
                  const isPositive = quote.change >= 0;

                  return (
                    <button
                      key={quote.symbol}
                      onClick={() => setSelectedSymbol(quote.symbol)}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer border ${
                        isSelected
                          ? 'border-white/30 shadow-md'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent'
                      }}
                    >
                      <div>
                        <div className="text-xs font-bold text-white tracking-tight">{quote.symbol}</div>
                        <div className="text-[10px] text-slate-400">Vol: {quote.volume}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-white">
                          ₹{quote.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          <span>
                            {isPositive ? '+' : ''}
                            {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Middle/Right Column: Active Ticker Chart & Order Execution Form (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Ticker Header & Dynamic Mini-Chart */}
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-4"
                style={{ backgroundColor: surfaceColor }}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/10">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-black tracking-tight text-white">{currentQuote.symbol}</h2>
                      <span className="text-xs px-2 py-0.5 rounded font-mono uppercase bg-white/10 text-slate-300">
                        EQUITY / DERIVATIVES
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      High: ₹{currentQuote.high} | Low: ₹{currentQuote.low}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-black font-mono text-white">
                      ₹{currentQuote.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`text-xs font-bold font-mono ${
                        currentQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {currentQuote.change >= 0 ? '+' : ''}
                      {currentQuote.change.toFixed(2)} ({currentQuote.changePercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>

                {/* Simulated Chart Container Styled with Tenant Accent Color */}
                <div className="h-32 bg-black/20 rounded-xl p-3 flex flex-col justify-between border border-white/5 relative overflow-hidden">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 z-10">
                    <span>1D Candle Trend</span>
                    <span className="font-mono">Branded Feed: {branding?.brandName}</span>
                  </div>

                  {/* SVG Trend Wave Colored by Tenant Primary/Accent */}
                  <div className="absolute inset-0 flex items-center opacity-30 pointer-events-none">
                    <svg viewBox="0 0 500 100" className="w-full h-full preserve-3d">
                      <path
                        d="M 0,60 Q 70,20 140,55 T 280,30 T 420,70 T 500,20 L 500,100 L 0,100 Z"
                        fill={primaryColor}
                      />
                      <path
                        d="M 0,60 Q 70,20 140,55 T 280,30 T 420,70 T 500,20"
                        fill="none"
                        stroke={accentColor}
                        strokeWidth="3"
                      />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 z-10">
                    <span>09:15 AM</span>
                    <span>11:30 AM</span>
                    <span>01:45 PM</span>
                    <span>03:30 PM</span>
                  </div>
                </div>
              </div>

              {/* Order Placement Box */}
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-4 shadow-xl"
                style={{ backgroundColor: surfaceColor }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-slate-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Order Execution</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Routing: {branding?.brandName} Core Engine
                  </div>
                </div>

                {/* Feedback Banner if order rejected/accepted */}
                {orderFeedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
                      orderFeedback.success
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {orderFeedback.success ? (
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                    )}
                    <div className="space-y-0.5">
                      <div className="font-bold">
                        {orderFeedback.success ? 'Order Executed' : 'Execution Denied by Platform Controls'}
                      </div>
                      <div className="text-[11px] opacity-90">{orderFeedback.message}</div>
                    </div>
                  </div>
                )}

                {/* Disabled Warning if feature flag trading_enabled is false */}
                {!platformConfig?.tradingEnabled && (
                  <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>
                      Trading orders are currently halted for this tenant platform. All placement requests will be rejected by the backend validation layer.
                    </span>
                  </div>
                )}

                <form onSubmit={handlePlaceOrder} className="space-y-4">
                  {/* BUY / SELL Switcher */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderSide('BUY')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        orderSide === 'BUY'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      BUY / LONG
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderSide('SELL')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        orderSide === 'SELL'
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      SELL / SHORT
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Order Type */}
                    <div>
                      <label className="block text-[11px] text-slate-400 font-medium mb-1">Order Type</label>
                      <select
                        value={orderType}
                        onChange={e => setOrderType(e.target.value as any)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-[11px] text-slate-400 font-medium mb-1">Quantity (Lots)</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={orderQuantity}
                        onChange={e => setOrderQuantity(Number(e.target.value))}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Price */}
                    <div>
                      <label className="block text-[11px] text-slate-400 font-medium mb-1">Price (₹)</label>
                      <input
                        type="text"
                        disabled={orderType === 'MARKET'}
                        value={orderType === 'MARKET' ? currentQuote.lastPrice : orderPrice}
                        onChange={e => setOrderPrice(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Summary & Submit */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                    <div className="text-xs text-slate-400">
                      Total Value:{' '}
                      <span className="font-mono font-bold text-white">
                        ₹{(orderQuantity * (Number(orderPrice) || currentQuote.lastPrice)).toLocaleString('en-IN', {
                          minimumFractionDigits: 2
                        })}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={placingOrder}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: orderSide === 'BUY' ? '#10b981' : '#ef4444'
                      }}
                    >
                      {placingOrder ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Routing Order...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit {orderSide} Order</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Recent Orders on this Platform */}
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-3"
                style={{ backgroundColor: surfaceColor }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Orders Executed on {branding?.brandName} ({recentOrders.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Isolated to Tenant: {branding?.tenantName}</span>
                </div>

                {recentOrders.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No orders placed on this platform yet. Place an order above to test execution.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 text-[11px]">
                          <th className="py-2">Order ID</th>
                          <th className="py-2">Symbol</th>
                          <th className="py-2">Side</th>
                          <th className="py-2">Qty</th>
                          <th className="py-2">Price</th>
                          <th className="py-2">Status</th>
                          <th className="py-2">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {recentOrders.slice(0, 6).map(order => (
                          <tr key={order.id || order.order_id} className="hover:bg-white/5">
                            <td className="py-2 font-bold text-white">{order.order_id}</td>
                            <td className="py-2 text-slate-200">{order.symbol}</td>
                            <td className="py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  order.side === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {order.side}
                              </span>
                            </td>
                            <td className="py-2 text-slate-200">{order.quantity}</td>
                            <td className="py-2 text-white">₹{order.price?.toFixed(2)}</td>
                            <td className="py-2">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 font-semibold">
                                {order.status}
                              </span>
                            </td>
                            <td className="py-2 text-slate-400 text-[11px]">{order.created_at}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tenant Branded Footer */}
      <footer
        className="mt-auto px-4 lg:px-8 py-6 border-t border-white/10 text-xs transition-colors shrink-0"
        style={{ backgroundColor: surfaceColor }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-slate-400 text-center sm:text-left">
            <div>{branding?.legalLinks?.footerText || `© 2024 ${branding?.brandName || 'Trading Desk'}. All Rights Reserved.`}</div>
            <div className="text-[11px] opacity-75 mt-0.5">
              Powered by TradePro Multi-Tenant Engine - Domain: <span className="font-mono text-slate-300">{currentDomain}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
            <a href={branding?.legalLinks?.termsUrl || '#'} className="hover:text-white transition-colors">Terms of Service</a>
            <a href={branding?.legalLinks?.privacyUrl || '#'} className="hover:text-white transition-colors">Privacy Policy</a>
            <a href={branding?.legalLinks?.riskDisclosureUrl || '#'} className="hover:text-white transition-colors">Risk Disclosure</a>
            <a href={branding?.contactInfo?.helpSupportUrl || '#'} className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
