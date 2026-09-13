import React, { useState } from 'react';
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

const initialPositionsData: PositionItem[] = [
  {
    id: 'pos_1',
    client: 'Alexander Hunt',
    symbol: 'EUR/INR',
    qty: '100,000',
    avgPrice: '1.088',
    currentPrice: '1.089',
    unrealizedPL: '+₹160',
    realizedPL: '+₹3,660',
    margin: '₹1,087.6',
    unrealizedPLPositive: true,
    realizedPLPositive: true
  },
  {
    id: 'pos_2',
    client: 'Maya Patel',
    symbol: 'ETH/INR',
    qty: '2',
    avgPrice: '1,980',
    currentPrice: '2,010',
    unrealizedPL: '+₹60',
    realizedPL: '+₹9,450',
    margin: '₹396',
    unrealizedPLPositive: true,
    realizedPLPositive: true
  },
  {
    id: 'pos_3',
    client: 'Isabella Torres',
    symbol: 'AMZN',
    qty: '10',
    avgPrice: '131.2',
    currentPrice: '133.5',
    unrealizedPL: '+₹23',
    realizedPL: '+₹5,657',
    margin: '₹131.2',
    unrealizedPLPositive: true,
    realizedPLPositive: true
  },
  {
    id: 'pos_4',
    client: 'Maya Patel',
    symbol: 'AAPL',
    qty: '100',
    avgPrice: '178.4',
    currentPrice: '182.5',
    unrealizedPL: '+₹410',
    realizedPL: '+₹1,790',
    margin: '₹1,784',
    unrealizedPLPositive: true,
    realizedPLPositive: true
  },
  {
    id: 'pos_5',
    client: 'Alexander Hunt',
    symbol: 'TSLA',
    qty: '0',
    avgPrice: '248.2',
    currentPrice: '248.15',
    unrealizedPL: '+₹0',
    realizedPL: '₹-1',
    margin: '₹0',
    unrealizedPLPositive: true,
    realizedPLPositive: false
  }
];

interface PositionsViewProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const PositionsView: React.FC<PositionsViewProps> = ({ onNotify }) => {
  const [positions, setPositions] = useState<PositionItem[]>(initialPositionsData);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<PositionItem | null>(null);

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const handleSquareOff = (pos: PositionItem) => {
    setPositions(prev =>
      prev.map(p =>
        p.id === pos.id
          ? {
              ...p,
              qty: '0',
              unrealizedPL: '+₹0',
              margin: '₹0'
            }
          : p
      )
    );
    notify(`Position in ${pos.symbol} for ${pos.client} successfully squared off at market.`, 'success');
    setSelectedPosition(null);
  };

  const filteredPositions = positions.filter(p => {
    return (
      p.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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
        <div className="relative w-64 sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
              {filteredPositions.map(item => (
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
