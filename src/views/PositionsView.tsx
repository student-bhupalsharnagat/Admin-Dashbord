import React, { useState, useEffect } from 'react';
import {
  Search,
  TrendingUp,
  X,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  PieChart,
  Shield
} from 'lucide-react';
import { parseCleanNumber, liveLtpLookup } from '../utils/cleanNumber';

export interface PositionItem {
  id: string;
  client: string;
  symbol: string;
  qty: string;
  avgPrice: string;
  currentPrice: string;
  unrealizedPL: string;
  realizedPL: string;
  margin: string;
  unrealizedPLPositive: boolean;
  realizedPLPositive: boolean;
}

const initialPositionsData: PositionItem[] = [];

interface PositionsViewProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const PositionsView: React.FC<PositionsViewProps> = ({ onNotify }) => {
  const [positions, setPositions] = useState<PositionItem[]>(initialPositionsData);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [selectedPosition, setSelectedPosition] = useState<PositionItem | null>(null);

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const fetchPositions = async () => {
    try {
      const res = await fetch('/api/admin/positions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: PositionItem[] = data
            .filter((p: any) => {
              const qty = parseCleanNumber(p.rawQty ?? p.qty ?? p.quantity ?? 0);
              return qty !== 0 && (p.status || '').toUpperCase() !== 'CLOSED';
            })
            .map((p: any, idx: number) => {
              const qtyNum = parseCleanNumber(p.rawQty ?? p.qty ?? p.quantity ?? 1) || 1;
              let rawCurrent = parseCleanNumber(p.rawCurrentPrice ?? p.currentPrice ?? p.last_price ?? p.ltp ?? 0);
              const isForex = ['USD/INR', 'EUR/INR', 'GBP/INR', 'JPY/INR'].includes(String(p.symbol).toUpperCase());
              if (rawCurrent <= 0 || (!isForex && rawCurrent < 25)) {
                const ltp = liveLtpLookup(p.symbol);
                if (ltp > 0) rawCurrent = ltp;
              }

              let rawAvg = parseCleanNumber(p.rawAvgPrice ?? p.avgPrice ?? p.averagePrice ?? p.entryPrice ?? p.buyPrice ?? p.buy_price ?? 0);
              let pnlNum = parseCleanNumber(p.rawUnrealizedPL ?? p.unrealizedPL ?? p.pnl ?? p.unrealized_pnl ?? 0);

              if (rawAvg <= 0) {
                if (rawCurrent > 0 && pnlNum !== 0 && qtyNum !== 0) {
                  rawAvg = rawCurrent - (pnlNum / qtyNum);
                } else if (rawCurrent > 0) {
                  rawAvg = rawCurrent;
                }
              }

              const isLong = String(p.side || 'BUY').toUpperCase() !== 'SELL';
              if (pnlNum === 0 && rawCurrent > 0 && rawAvg > 0 && qtyNum > 0) {
                pnlNum = isLong ? (rawCurrent - rawAvg) * qtyNum : (rawAvg - rawCurrent) * qtyNum;
                pnlNum = Math.round(pnlNum * 100) / 100;
              }

              let marginVal = parseCleanNumber(p.rawMargin ?? p.margin ?? p.margin_used ?? p.used_margin ?? 0);
              if (marginVal <= 0 && rawAvg > 0 && qtyNum > 0) {
                marginVal = Math.round(rawAvg * qtyNum * 0.2 * 100) / 100;
              }

              const realizedNum = parseCleanNumber(p.rawRealizedPL ?? p.realizedPL ?? p.realized_pnl ?? 0);

              return {
                id: p.id || `POS-${idx + 1}`,
                client: p.client || p.client_name || 'Retail Client',
                symbol: p.symbol || 'NIFTY50',
                qty: qtyNum.toLocaleString('en-IN'),
                avgPrice: `₹${rawAvg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                currentPrice: `₹${rawCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                unrealizedPL: `${pnlNum >= 0 ? '+' : ''}₹${pnlNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                realizedPL: `${realizedNum >= 0 ? '+' : ''}₹${realizedNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                margin: `₹${marginVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                unrealizedPLPositive: pnlNum >= 0,
                realizedPLPositive: realizedNum >= 0
              };
            });
          setPositions(mapped);
        }
      }
    } catch (e) {
      console.error('Failed to fetch positions:', e);
    }
  };

  useEffect(() => {
    fetchPositions();

    // Listen to shared window admin:live-event to avoid socket starvation
    const handleLiveEvent = (e: any) => {
      const evt = e.detail;
      if (!evt) return;

      if (
        evt.eventType === 'position.updated' ||
        evt.eventType === 'position.created' ||
        evt.eventType === 'position.closed' ||
        evt.eventType === 'trade.executed'
      ) {
        fetchPositions();
      } else if (evt.eventType === 'market.ticks' || evt.eventType === 'market.tick') {
        const payload = evt.payload;
        if (!payload) return;

        const tickMap: Record<string, number> = {};
        if (Array.isArray(payload)) {
          for (const item of payload) {
            const sym = (item.symbol || '').toUpperCase();
            const price = parseCleanNumber(item.ltp || item.price || item.currentPrice);
            if (sym && price > 0) tickMap[sym] = price;
          }
        } else if (payload.symbol && (payload.price || payload.ltp)) {
          const sym = String(payload.symbol).toUpperCase();
          const price = parseCleanNumber(payload.price || payload.ltp);
          if (price > 0) tickMap[sym] = price;
        } else if (typeof payload === 'object') {
          for (const [key, val] of Object.entries(payload)) {
            const price = parseCleanNumber(val);
            if (price > 0) tickMap[key.toUpperCase()] = price;
          }
        }

        if (Object.keys(tickMap).length > 0) {
          setPositions(prev =>
            prev.map(pos => {
              const symUpper = pos.symbol.toUpperCase();
              const newPrice = tickMap[symUpper] || tickMap[symUpper.replace(/\s+/g, '')];
              if (!newPrice) return pos;

              const avg = parseCleanNumber(pos.avgPrice);
              const qty = parseCleanNumber(pos.qty);
              const pnl = avg > 0 && qty > 0 ? (newPrice - avg) * qty : parseCleanNumber(pos.unrealizedPL);

              return {
                ...pos,
                currentPrice: `₹${newPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                unrealizedPL: `${pnl >= 0 ? '+' : ''}₹${pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                unrealizedPLPositive: pnl >= 0
              };
            })
          );
        }
      } else if (evt.eventType === 'portfolio.mtm') {
        fetchPositions();
      }
    };

    window.addEventListener('admin:live-event', handleLiveEvent);

    // Optional direct WebSocket connection to live tick stream if available
    let ws: WebSocket | null = null;
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:4000/ws`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'tick' || msg.eventType === 'market.ticks' || msg.type === 'market.ticks') {
            window.dispatchEvent(new CustomEvent('admin:live-event', { detail: { eventType: 'market.ticks', payload: msg.data || msg.payload || msg } }));
          } else if (msg.type === 'position.updated' || msg.eventType === 'position.updated') {
            window.dispatchEvent(new CustomEvent('admin:live-event', { detail: { eventType: 'position.updated', payload: msg.data || msg.payload } }));
          }
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}

    return () => {
      window.removeEventListener('admin:live-event', handleLiveEvent);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, []);

  const handleSquareOff = async (pos: PositionItem) => {
    try {
      const res = await fetch(`/api/admin/positions/${pos.id}/square-off`, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        fetchPositions();
        notify(`Position in ${pos.symbol} for ${pos.client} successfully squared off at market.`, 'success');
      } else {
        notify(`Failed to square off position in database.`, 'warning');
      }
    } catch (e) {
      notify(`Network error squaring off position.`, 'warning');
    }
    setSelectedPosition(null);
  };

  const filteredPositions = positions.filter(p => {
    return (
      p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalPages = Math.ceil(filteredPositions.length / pageSize) || 1;
  const paginatedPositions = filteredPositions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Breadcrumb matching Screenshot 6 */}
      <div className="text-xs text-slate-400">
        <span className="text-slate-500">Dashboard</span>
        <span className="mx-2 text-slate-600">&gt;</span>
        <span className="text-slate-300 font-medium">Positions</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">Open Positions</h1>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Client or symbol..."
            className="w-full pl-9 pr-3 py-2 bg-[#091122] border border-[#162238] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Table matching Screenshot 6 */}
      <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[840px]">
            <thead>
              <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">CLIENT</th>
                <th className="py-3.5 px-4">SYMBOL</th>
                <th className="py-3.5 px-4">QTY</th>
                <th className="py-3.5 px-4">AVG PRICE</th>
                <th className="py-3.5 px-4">CURRENT PRICE</th>
                <th className="py-3.5 px-4">UNREALIZED P&amp;L</th>
                <th className="py-3.5 px-4">REALIZED P&amp;L</th>
                <th className="py-3.5 px-4">MARGIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131e36]/60">
              {paginatedPositions.map(item => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedPosition(item)}
                  className="hover:bg-[#0c152a] cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-white">{item.client}</td>
                  <td className="py-3.5 px-4 font-bold text-white font-mono">{item.symbol}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200 font-semibold">{item.qty}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200">{item.avgPrice}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200">{item.currentPrice}</td>
                  <td className="py-3.5 px-4 font-mono font-bold">
                    <span className={item.unrealizedPLPositive ? 'text-[#34d399]' : 'text-[#f87171]'}>
                      {item.unrealizedPL}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold">
                    <span className={item.realizedPLPositive ? 'text-[#34d399]' : 'text-[#f87171]'}>
                      {item.realizedPL}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-200">{item.margin}</td>
                </tr>
              ))}
              {filteredPositions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No open positions match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredPositions.length > pageSize && (
          <div className="px-4 py-3 border-t border-[#131e36] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 text-center sm:text-left">
            <div>
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredPositions.length)} of {filteredPositions.length} positions
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed border border-[#1e293b] text-slate-200 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-slate-300 font-medium">Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed border border-[#1e293b] text-slate-200 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Position Detail & Square-off Modal */}
      {selectedPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Live Position Details</h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedPosition.client} • {selectedPosition.symbol}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPosition(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Client</span>
                  <span className="font-bold text-white text-sm">{selectedPosition.client}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Instrument Symbol</span>
                  <span className="font-bold font-mono text-cyan-400 text-sm">{selectedPosition.symbol}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Holding Quantity</span>
                  <span className="font-mono text-white text-sm font-bold">{selectedPosition.qty}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Margin Blocked</span>
                  <span className="font-mono text-slate-300 font-medium">{selectedPosition.margin}</span>
                </div>
              </div>

              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Average Buy Price</span>
                  <span className="text-white font-bold">{selectedPosition.avgPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Market Current Price</span>
                  <span className="text-cyan-400 font-bold">{selectedPosition.currentPrice}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#162238] pt-2">
                  <span className="text-slate-400">Unrealized P&amp;L</span>
                  <span className={`font-bold ${selectedPosition.unrealizedPLPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {selectedPosition.unrealizedPL}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Realized P&amp;L</span>
                  <span className={`font-bold ${selectedPosition.realizedPLPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {selectedPosition.realizedPL}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-between">
              {selectedPosition.qty !== '0' ? (
                <button
                  onClick={() => handleSquareOff(selectedPosition)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs"
                >
                  Square Off Position
                </button>
              ) : (
                <span className="text-slate-500 text-[11px] font-mono">Position Closed</span>
              )}
              <button
                onClick={() => setSelectedPosition(null)}
                className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
