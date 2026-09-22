import React, { useState } from 'react';
import { Search, Star } from 'lucide-react';
import { TradingInstrument, InstrumentCategory } from '../../types/trading';

interface TradingWatchlistProps {
  instruments: TradingInstrument[];
  selectedInstrumentId: string;
  onSelectInstrument: (instrument: TradingInstrument) => void;
  onOpenOrder: (instrument: TradingInstrument, side: 'BUY' | 'SELL') => void;
}

export const TradingWatchlist: React.FC<TradingWatchlistProps> = ({
  instruments,
  selectedInstrumentId,
  onSelectInstrument,
  onOpenOrder
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory>('ALL');
  const [favorites, setFavorites] = useState<Record<string, boolean>>({
    gold_fut: true,
    silver_fut: true,
    nifty_50: true,
    btc_usdt: true
  });

  const categories: InstrumentCategory[] = ['ALL', 'CRYPTO', 'EQUITY', 'FOREX', 'COMMODITY'];

  const filteredInstruments = instruments.filter(inst => {
    const matchCategory = selectedCategory === 'ALL' || inst.category === selectedCategory;
    const matchSearch =
      inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div id="trading-watchlist-container" className="space-y-3.5 select-none">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          id="watchlist-search-input"
          placeholder="Search instruments... e.g. NIFTY, GOLD, BTC"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-[#080E18] border border-slate-200 dark:border-[#1B273A] focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-sans shadow-xs"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              id={`cat-filter-${cat.toLowerCase()}`}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 sm:px-4 py-1.5 text-xs font-bold tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-white dark:bg-[#0B111C] border border-slate-200 dark:border-[#1E2E44] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Header with Title and Count */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          WATCHLIST
        </h2>
        <span className="text-xs text-slate-500 font-mono">
          {filteredInstruments.length} Instruments
        </span>
      </div>

      {/* Instruments List */}
      <div className="space-y-4">
        {filteredInstruments.map(inst => {
          const isPositive = inst.change >= 0;
          const isSelected = selectedInstrumentId === inst.id;
          const isFav = favorites[inst.id] || false;

          return (
            <div key={inst.id} className="space-y-1.5">
              {/* Category label */}
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase px-1">
                {inst.category}
              </div>

              {/* Card */}
              <div
                id={`instrument-row-${inst.id}`}
                onClick={() => onSelectInstrument(inst)}
                className={`p-4 sm:p-5 rounded-2xl transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer group border ${
                  isSelected
                    ? 'bg-amber-50/50 dark:bg-[#0E1626] border-amber-500/50 dark:border-amber-500/40 ring-1 ring-amber-500/30'
                    : 'bg-white dark:bg-[#0A101C] hover:bg-slate-50 dark:hover:bg-[#0E1626] border-slate-200 dark:border-[#162234] hover:border-amber-500/40 dark:hover:border-[#223550]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={e => toggleFavorite(inst.id, e)}
                        className="text-amber-500 hover:scale-110 transition-transform cursor-pointer"
                        title="Toggle Favorite"
                      >
                        <Star className={`w-4 h-4 ${isFav ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                      </button>
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-wide group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                        {inst.symbol}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 ml-1">
                        {inst.expiry}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs mt-2 text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>
                        Intraday:{' '}
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          ₹{inst.intraday.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </span>
                      <span>
                        Holding:{' '}
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          ₹{inst.holding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Sparkline Visual / Trend bar (Center, sm+ screens) */}
                  <div className="hidden sm:flex items-center justify-center px-4 flex-1 max-w-[180px]">
                    <div
                      className={`w-full h-4 rounded-xs opacity-75 ${
                        isPositive
                          ? 'bg-gradient-to-t from-transparent to-emerald-500/20 border-b border-emerald-500/50'
                          : 'bg-gradient-to-t from-transparent to-rose-500/20 border-b border-rose-500/50'
                      }`}
                    />
                  </div>

                  {/* Right: Last Price & Change */}
                  <div className="text-right flex flex-col items-end shrink-0">
                    <div className="font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                      ₹
                      {inst.lastPrice < 100
                        ? inst.lastPrice.toFixed(2)
                        : inst.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`font-mono text-xs sm:text-sm flex items-center gap-1 font-bold mt-0.5 ${
                        isPositive ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      <span>{isPositive ? '↗' : '↘'}</span>
                      <span>
                        {isPositive ? '+' : ''}
                        {inst.change.toFixed(inst.lastPrice < 10 ? 4 : 2)} ({isPositive ? '+' : ''}
                        {inst.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInstruments.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs bg-white dark:bg-[#0A101C] rounded-2xl border border-slate-200 dark:border-[#162234]">
            No instruments found matching "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  );
};
