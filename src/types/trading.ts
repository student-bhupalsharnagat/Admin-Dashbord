export type InstrumentCategory = 'ALL' | 'COMMODITY' | 'INDEX' | 'CRYPTO' | 'EQUITY' | 'FOREX';

export interface TradingInstrument {
  id: string;
  symbol: string;
  name: string;
  category: 'COMMODITY' | 'INDEX' | 'CRYPTO' | 'EQUITY' | 'FOREX';
  expiry: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volume: string;
  intraday: number;
  holding: number;
  lotSize: number;
  maxLots: number;
  bid: number;
  ask: number;
  bidLots: number;
  askLots: number;
  sparkline: number[];
}

export interface ClientOrder {
  id: string;
  symbol: string;
  category: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL';
  product: 'INTRADAY' | 'HOLDING';
  lots: number;
  quantity: number;
  price: number;
  triggerPrice?: number;
  stopLoss?: number;
  target?: number;
  status: 'PENDING' | 'OPEN' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  executionPrice?: number;
  placedAt?: string;
  timestamp?: string;
  executedAt?: string;
  clientOrderId?: string;
}

export interface ClientPosition {
  id: string;
  symbol: string;
  category: string;
  expiry?: string;
  type?: 'BUY' | 'SELL';
  side?: 'BUY' | 'SELL';
  product: 'INTRADAY' | 'HOLDING';
  qty?: number;
  quantity?: number;
  lots: number;
  lotSize?: number;
  avgPrice: number;
  ltp?: number;
  lastPrice: number;
  pnl: number;
  pnlPercent: number;
  marginUsed?: number;
  exposure?: number;
}

export interface ClientTrade {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  product: 'INTRADAY' | 'HOLDING';
  qty: number;
  lots: number;
  price: number;
  totalValue: number;
  pnl?: number;
  timestamp: string;
  orderId: string;
}

export interface ClientWallet {
  availableBalance: number;
  usedMargin: number;
  totalPnL: number;
  todayPnL: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  deposited: number;
  withdrawn: number;
}

export interface BenchmarkQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface ClientAccount {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  initials: string;
  kycStatus: string;
  role: string;
  tenantId: string;
  tenantName: string;
  segments: string[];
  bankDetails: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    verified: boolean;
  };
}

export interface TenantBrandingConfig {
  tenantName: string;
  tenantCode: string;
  brandName?: string;
  shortName?: string;
  tagline: string;
  logoText: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  footerCopyright?: string;
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text?: string;
  };
  isTradingEnabled: boolean;
  isOptionsEnabled: boolean;
  theme: 'dark' | 'light';
  supportEmail: string;
  supportPhone: string;
}
