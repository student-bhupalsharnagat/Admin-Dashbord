import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  X,
  FileDown,
  TrendingUp,
  Clock,
  DollarSign,
  ShieldCheck,
  Building,
  User,
  Hash
} from 'lucide-react';
import { Trade } from '../types';

export interface DetailedTradeItem {
  tradeId: string;
  orderId: string;
  client: string;
  clientId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  execPrice: string;
  fees: string;
  timestamp: string;
  assetClass?: string;
  executionVenue?: string;
  clearingBroker?: string;
}

const defaultTradesData: DetailedTradeItem[] = [
  {
    tradeId: 'TRD001',
    orderId: 'ORD001',
    client: 'Alexander Hunt',
    clientId: 'CLT001',
    symbol: 'EUR/INR',
    side: 'BUY',
    quantity: '100,000',
    execPrice: '1.088',
    fees: '$10',
    timestamp: '2023-06-23 10:14:25',
    assetClass: 'Forex',
    executionVenue: 'NSE Currency Clearing',
    clearingBroker: 'Apex Capital Group'
  },
  {
    tradeId: 'TRD002',
    orderId: 'ORD002',
    client: 'Maya Patel',
    clientId: 'CLT004',
    symbol: 'BTC/INR',
    side: 'SELL',
    quantity: '0.5',
    execPrice: '30,118',
    fees: '$15.06',
    timestamp: '2023-06-23 10:22:48',
    assetClass: 'Crypto',
    executionVenue: 'Institutional Liquidity Hub',
    clearingBroker: 'Global Markets Ltd'
  },
  {
    tradeId: 'TRD003',
    orderId: 'ORD005',
    client: 'Alexander Hunt',
    clientId: 'CLT001',
    symbol: 'TSLA',
    side: 'SELL',
    quantity: '20',
    execPrice: '248.15',
    fees: '$4.96',
    timestamp: '2023-06-23 12:00:03',
    assetClass: 'Equities',
    executionVenue: 'US Direct DMA',
    clearingBroker: 'Apex Capital Group'
  },
  {
    tradeId: 'TRD004',
    orderId: 'ORD007',
    client: 'Isabella Torres',
    clientId: 'CLT006',
    symbol: 'AMZN',
    side: 'BUY',
    quantity: '10',
    execPrice: '131.2',
    fees: '$1.31',
    timestamp: '2023-06-22 15:30:00',
    assetClass: 'Equities',
    executionVenue: 'US Direct DMA',
    clearingBroker: 'Global Markets Ltd'
  },
  {
    tradeId: 'TRD005',
    orderId: 'ORD008',
    client: 'Maya Patel',
    clientId: 'CLT004',
    symbol: 'EUR/INR',
    side: 'BUY',
    quantity: '200,000',
    execPrice: '1.085',
    fees: '$20',
    timestamp: '2023-06-22 09:10:00',
    assetClass: 'Forex',
    executionVenue: 'NSE Currency Clearing',
    clearingBroker: 'Global Markets Ltd'
  }
];

interface TradesViewProps {
  initialSelectedTrade?: Trade | null;
  initialTrades?: Trade[] | DetailedTradeItem[];
  onNavigateToClient?: () => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const TradesView: React.FC<TradesViewProps> = ({
  initialTrades,
  onNavigateToClient,
  onNotify
}) => {
  const [trades, setTrades] = useState<DetailedTradeItem[]>(defaultTradesData);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'All Sides' | 'BUY' | 'SELL'>('All Sides');
  const [selectedTrade, setSelectedTrade] = useState<DetailedTradeItem | null>(null);

  // Synchronize when initialTrades prop updates from App.tsx SSE
  useEffect(() => {
    if (initialTrades && Array.isArray(initialTrades) && initialTrades.length > 0) {
      const mapped: DetailedTradeItem[] = initialTrades.map((t: any, idx: number) => ({
        tradeId: t.trade_id || t.tradeId || t.id || `TRD${String(idx + 1).padStart(3, '0')}`,
        orderId: t.order_id || t.orderId || `ORD${String(idx + 1).padStart(3, '0')}`,
        client: t.client_name || t.client || 'Client Trader',
        clientId: t.client_id || t.clientId,
        symbol: t.symbol || 'EUR/INR',
        side: (t.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
        quantity: typeof t.quantity === 'number' ? t.quantity.toLocaleString() : String(t.quantity || '100,000'),
        execPrice: String(t.price || t.execPrice || '1.088'),
        fees: t.fees ? (String(t.fees).startsWith('$') || String(t.fees).startsWith('₹') ? String(t.fees) : `₹${t.fees}`) : '₹10',
        timestamp: t.timestamp || t.created_at || '2023-06-23 10:14:25',
        assetClass: t.asset_class || t.assetClass || 'Forex',
        executionVenue: t.execution_venue || t.executionVenue || 'NSE Currency Clearing',
        clearingBroker: t.clearing_broker || t.clearingBroker || 'Apex Capital Group'
      }));
      setTrades(mapped);
    }
  }, [initialTrades]);

  // Synchronize with API /api/admin/trades
  useEffect(() => {
    let isMounted = true;
    const fetchTrades = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/trades', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped: DetailedTradeItem[] = data.map((t: any, idx: number) => ({
            tradeId: t.id || t.tradeId || `TRD${String(idx + 1).padStart(3, '0')}`,
            orderId: t.order_id || t.orderId || `ORD${String(idx + 1).padStart(3, '0')}`,
            client: t.client_name || t.client || 'Client Trader',
            clientId: t.client_id || t.clientId,
            symbol: t.symbol || 'EUR/INR',
            side: (t.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
            quantity: typeof t.quantity === 'number' ? t.quantity.toLocaleString() : String(t.quantity || '100,000'),
            execPrice: String(t.price || t.execPrice || '1.088'),
            fees: t.fees ? (String(t.fees).startsWith('$') || String(t.fees).startsWith('₹') ? String(t.fees) : `₹${t.fees}`) : '₹10',
            timestamp: t.timestamp || t.created_at || '2023-06-23 10:14:25',
            assetClass: t.asset_class || t.assetClass || 'Forex',
            executionVenue: t.execution_venue || t.executionVenue || 'NSE Currency Clearing',
            clearingBroker: t.clearing_broker || t.clearingBroker || 'Apex Capital Group'
          }));
          setTrades(mapped);
          setLoadError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Trades API sync:', err);
          setLoadError('Failed to synchronize trades with central API');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTrades();

    // Real-time EventSource listener
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/admin/events/stream');
      eventSource.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (evt?.eventType === 'trade.executed') {
            fetchTrades();
          }
        } catch {}
      };
    } catch {}

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
    };
  }, []);

  const filteredTrades = trades.filter(t => {
    const matchSearch =
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tradeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.orderId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSide = sideFilter === 'All Sides' || t.side === sideFilter;
    return matchSearch && matchSide;
  });

  const renderSideBadge = (side: 'BUY' | 'SELL') => {
    if (side === 'BUY') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          BUY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
        SELL
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb matching Screenshot 5 */}
      <div className="text-xs text-slate-400">
        <span className="text-slate-500">Dashboard</span>
        <span className="mx-2 text-slate-600">&gt;</span>
        <span className="text-slate-300 font-medium">Trades</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">Trades</h1>
        {isLoading && (
          <span className="text-xs text-blue-400 animate-pulse flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            Syncing trades...
          </span>
        )}
      </div>

      {loadError && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-3 py-2 rounded-lg">
          {loadError}
        </div>
      )}

      {/* Filter Bar matching Screenshot 5 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-64 sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Symbol, client, trade ID..."
            className="w-full pl-9 pr-3 py-2 bg-[#091122] border border-[#162238] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* All Sides Dropdown */}
        <div className="relative">
          <select
            value={sideFilter}
            onChange={e => setSideFilter(e.target.value as any)}
            className="appearance-none bg-[#091122] border border-[#162238] text-xs text-slate-300 pl-3.5 pr-8 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All Sides">All Sides</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table matching Screenshot 5 */}
      <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">TRADE ID</th>
                <th className="py-3.5 px-4">ORDER ID</th>
                <th className="py-3.5 px-4">CLIENT</th>
                <th className="py-3.5 px-4">SYMBOL</th>
                <th className="py-3.5 px-4">SIDE</th>
                <th className="py-3.5 px-4">QUANTITY</th>
                <th className="py-3.5 px-4">EXEC PRICE</th>
                <th className="py-3.5 px-4">FEES</th>
                <th className="py-3.5 px-4">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131e36]/60">
              {filteredTrades.map(item => (
                <tr
                  key={item.tradeId}
                  onClick={() => setSelectedTrade(item)}
                  className="hover:bg-[#0c152a] cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{item.tradeId}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{item.orderId}</td>
                  <td className="py-3.5 px-4 font-bold text-white">{item.client}</td>
                  <td className="py-3.5 px-4 font-bold text-white font-mono">{item.symbol}</td>
                  <td className="py-3.5 px-4">{renderSideBadge(item.side)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200 font-semibold">{item.quantity}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200">{item.execPrice}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200">{item.fees}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{item.timestamp}</td>
                </tr>
              ))}
              {filteredTrades.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No trades match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Execution Note Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Trade Confirmation Note</h3>
                  <p className="text-[11px] text-slate-400">Trade #{selectedTrade.tradeId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Client</span>
                  <span className="font-bold text-white text-sm">{selectedTrade.client}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Contract Symbol</span>
                  <span className="font-bold font-mono text-cyan-400 text-sm">{selectedTrade.symbol}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Order Reference</span>
                  <span className="font-mono text-slate-300">{selectedTrade.orderId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Execution Side</span>
                  <div className="mt-0.5">{renderSideBadge(selectedTrade.side)}</div>
                </div>
              </div>

              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Executed Quantity</span>
                  <span className="font-bold text-white">{selectedTrade.quantity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Execution Price</span>
                  <span className="font-bold text-white">{selectedTrade.execPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Exchange / Clearing Fees</span>
                  <span className="font-bold text-amber-400">{selectedTrade.fees}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Clearing Broker</span>
                  <span className="text-slate-300">{selectedTrade.clearingBroker || 'Prime Clearing'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Execution Timestamp</span>
                  <span className="text-slate-400">{selectedTrade.timestamp}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-between">
              <span className="text-slate-500 text-[11px]">Audit Hash: 0x8a92...b4</span>
              <button
                onClick={() => setSelectedTrade(null)}
                className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs"
              >
                Close Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
