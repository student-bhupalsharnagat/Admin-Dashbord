import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  Zap,
  BarChart2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { TradingInstrument, InstrumentCategory } from '../../types/trading';

interface TradingWatchlistProps {
  instruments: TradingInstrument[];
  selectedInstrumentId: string;
  onSelectInstrument: (instrument: TradingInstrument) => void;
  onOpenOrder: (instrument: TradingInstrument, side: 'BUY' | 'SELL') => void;
  onOpenChart?: (instrument: TradingInstrument) => void;
  onOpenOptionChain?: (instrument: TradingInstrument) => void;
}

type EquitySector =
  | 'ALL'
  | 'NIFTY50'
  | 'BANKING'
  | 'IT'
  | 'AUTO'
  | 'ENERGY'
  | 'FMCG_RETAIL'
  | 'PHARMA'
  | 'PSU_DEFENCE'
  | 'FUTURES';

type SortOption = 'DEFAULT' | 'PRICE_DESC' | 'PRICE_ASC' | 'GAINERS' | 'LOSERS' | 'VOLUME';

export const TradingWatchlist: React.FC<TradingWatchlistProps> = ({
  instruments,
  selectedInstrumentId,
  onSelectInstrument,
  onOpenOrder,
  onOpenChart,
  onOpenOptionChain
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory>('ALL');
  const [selectedSector, setSelectedSector] = useState<EquitySector>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DEFAULT');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const [favorites, setFavorites] = useState<Record<string, boolean>>({
    gold_fut: true,
    silver_fut: true,
    nifty_50: true,
    btc_usdt: true
  });

  const categories: InstrumentCategory[] = ['ALL', 'EQUITY', 'COMMODITY', 'INDEX', 'CRYPTO', 'FOREX'];

  const sectors: Array<{ key: EquitySector; label: string }> = [
    { key: 'ALL', label: 'All Sectors' },
    { key: 'NIFTY50', label: 'Nifty 50' },
    { key: 'BANKING', label: 'Banking & Financials' },
    { key: 'IT', label: 'IT & Software' },
    { key: 'AUTO', label: 'Automobiles' },
    { key: 'ENERGY', label: 'Energy & Power' },
    { key: 'FMCG_RETAIL', label: 'FMCG & Retail' },
    { key: 'PHARMA', label: 'Pharma & Healthcare' },
    { key: 'PSU_DEFENCE', label: 'PSU & Defence' },
    { key: 'FUTURES', label: 'Futures & Derivatives' }
  ];

  // Map symbols to equity sectors for filtering
  const getInstrumentSector = (symbol: string): EquitySector => {
    const s = symbol.toUpperCase();
    if (s.includes('HDFC') || s.includes('ICICI') || s.includes('SBI') || s.includes('AXIS') || s.includes('KOTAK') || s.includes('BANKNIFTY')) {
      return 'BANKING';
    }
    if (s.includes('TCS') || s.includes('INFY') || s.includes('WIPRO') || s.includes('HCL')) {
      return 'IT';
    }
    if (s.includes('TATA') || s.includes('MARUTI') || s.includes('M&M') || s.includes('BAJAJ')) {
      return 'AUTO';
    }
    if (s.includes('RELIANCE') || s.includes('ONGC') || s.includes('NTPC') || s.includes('POWER') || s.includes('CRUDE')) {
      return 'ENERGY';
    }
    if (s.includes('ITC') || s.includes('HUL') || s.includes('NESTLE') || s.includes('DMART')) {
      return 'FMCG_RETAIL';
    }
    if (s.includes('SUN') || s.includes('CIPLA') || s.includes('DRREDDY') || s.includes('APOLLO')) {
      return 'PHARMA';
    }
    if (s.includes('HAL') || s.includes('BEL') || s.includes('BHEL') || s.includes('DEFENCE')) {
      return 'PSU_DEFENCE';
    }
    if (s.includes('FUT')) {
      return 'FUTURES';
    }
    return 'NIFTY50';
  };

  const filteredInstruments = useMemo(() => {
    return instruments
      .filter(inst => {
        // Category Filter
        if (selectedCategory !== 'ALL' && inst.category !== selectedCategory) {
          return false;
        }

        // Equity Sector Filter (when EQUITY or ALL is active)
        if (selectedSector !== 'ALL') {
          const instSector = getInstrumentSector(inst.symbol);
          if (instSector !== selectedSector && !(selectedSector === 'FUTURES' && inst.symbol.includes('FUT'))) {
            return false;
          }
        }

        // Search Query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSym = inst.symbol.toLowerCase().includes(q);
          const matchName = inst.name.toLowerCase().includes(q);
          const matchCat = inst.category.toLowerCase().includes(q);
          const matchExp = (inst.expiry || '').toLowerCase().includes(q);
          if (!matchSym && !matchName && !matchCat && !matchExp) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE_DESC') return b.lastPrice - a.lastPrice;
        if (sortBy === 'PRICE_ASC') return a.lastPrice - b.lastPrice;
        if (sortBy === 'GAINERS') return b.changePercent - a.changePercent;
        if (sortBy === 'LOSERS') return a.changePercent - b.changePercent;
        if (sortBy === 'VOLUME') return (parseFloat(b.volume || '0') || 0) - (parseFloat(a.volume || '0') || 0);
        return 0; // DEFAULT
      });
  }, [instruments, selectedCategory, selectedSector, searchQuery, sortBy]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div id="trading-watchlist-container" className="space-y-3.5 select-none">
      {/* 1. Search Bar + Sort Dropdown */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            id="watchlist-search-input"
            placeholder="Search instruments... e.g. NIFTY, GOLD, RELIANCE, BTC"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-[#080E18] border border-slate-200 dark:border-[#1B273A] focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all font-sans shadow-xs"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            type="button"
            id="watchlist-sort-btn"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            className="px-3 py-2.5 bg-white dark:bg-[#080E18] border border-slate-200 dark:border-[#1B273A] hover:border-slate-300 dark:hover:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">
              {sortBy === 'DEFAULT' ? 'Sort' : sortBy === 'GAINERS' ? 'Gainers' : sortBy === 'LOSERS' ? 'Losers' : 'Price'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {sortDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-[#1E2E44] rounded-xl shadow-2xl py-1.5 z-40 animate-in fade-in">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-[#1E2E44]">
                Sort Watchlist
              </div>
              {[
                { id: 'DEFAULT', label: 'Default Order' },
                { id: 'PRICE_DESC', label: 'Price: High to Low' },
                { id: 'PRICE_ASC', label: 'Price: Low to High' },
                { id: 'GAINERS', label: 'Top Gainers (% High)' },
                { id: 'LOSERS', label: 'Top Losers (% Low)' },
                { id: 'VOLUME', label: 'Trading Volume' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSortBy(opt.id as SortOption);
                    setSortDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    sortBy === opt.id
                      ? 'bg-amber-500/10 text-amber-500 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#152338]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              id={`cat-filter-${cat.toLowerCase()}`}
              onClick={() => {
                setSelectedCategory(cat);
                if (cat !== 'EQUITY' && cat !== 'ALL') {
                  setSelectedSector('ALL');
                }
              }}
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

      {/* 3. Equity Sectors Sub-Pills (Shown when ALL or EQUITY is selected) */}
      {(selectedCategory === 'ALL' || selectedCategory === 'EQUITY') && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          {sectors.map(sec => {
            const isSecActive = selectedSector === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setSelectedSector(sec.key)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap font-medium ${
                  isSecActive
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-[#0C1524] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-[#1A2840]'
                }`}
              >
                {sec.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Header with Count */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 tracking-wider uppercase">
          WATCHLIST
        </h2>
        <span className="text-xs text-slate-500 font-mono font-medium">
          {filteredInstruments.length} Instruments
        </span>
      </div>

      {/* 5. Instruments List Cards */}
      <div className="space-y-3">
        {filteredInstruments.map(inst => {
          const isPositive = inst.change >= 0;
          const isSelected = selectedInstrumentId === inst.id;
          const isFav = favorites[inst.id] || false;

          // Day range progress
          const range = Math.max(0.01, inst.high - inst.low);
          const rangePos = Math.min(100, Math.max(0, ((inst.lastPrice - inst.low) / range) * 100));

          // Option chain support
          const hasOptionChain =
            inst.category === 'INDEX' ||
            inst.category === 'COMMODITY' ||
            inst.symbol.includes('FUT') ||
            inst.category === 'EQUITY';

          return (
            <div
              key={inst.id}
              id={`instrument-row-${inst.id}`}
              onClick={() => onSelectInstrument(inst)}
              className={`p-3.5 sm:p-4 rounded-2xl transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer group border ${
                isSelected
                  ? 'bg-amber-50/50 dark:bg-[#0E1626] border-amber-500/50 dark:border-amber-500/40 ring-1 ring-amber-500/30'
                  : 'bg-white dark:bg-[#0A101C] hover:bg-slate-50 dark:hover:bg-[#0E1626] border-slate-200 dark:border-[#162234] hover:border-amber-500/40 dark:hover:border-[#223550]'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left Section: Favorite + Symbol + Expiry + Name + Margins */}
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={e => toggleFavorite(inst.id, e)}
                    className="mt-0.5 text-amber-500 hover:scale-110 transition-transform cursor-pointer shrink-0"
                    title="Toggle Favorite"
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-wide group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                        {inst.symbol}
                      </h3>
                      {inst.expiry && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {inst.expiry}
                        </span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider bg-slate-100 dark:bg-[#121E30] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1E2E44]">
                        {inst.category}
                      </span>
                    </div>

                    {inst.name && inst.name !== inst.symbol && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                        {inst.name}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] mt-1.5 text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>
                        Intraday:{' '}
                        <strong className="font-mono text-slate-700 dark:text-slate-300">
                          ₹{inst.intraday.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Lot Size:{' '}
                        <strong className="font-mono text-slate-700 dark:text-slate-300">
                          {inst.lotSize}
                        </strong>
                      </span>
                      {inst.volume && (
                        <>
                          <span>•</span>
                          <span>Vol: <strong className="font-mono text-slate-700 dark:text-slate-300">{inst.volume}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center / Right Section: Range bar + Price + Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#142032]">
                  {/* Price info */}
                  <div className="text-left sm:text-right">
                    <div className="font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                      ₹
                      {inst.lastPrice < 100
                        ? inst.lastPrice.toFixed(2)
                        : inst.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div
                      className={`font-mono text-xs flex items-center sm:justify-end gap-0.5 font-bold mt-0.5 ${
                        isPositive ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      <span>
                        {isPositive ? '+' : ''}
                        {inst.change.toFixed(inst.lastPrice < 10 ? 4 : 2)} ({isPositive ? '+' : ''}
                        {inst.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  {/* Direct One-Click Action Buttons on each Card */}
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {/* Fast BUY */}
                    <button
                      type="button"
                      onClick={() => onOpenOrder(inst, 'BUY')}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xs tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1"
                      title={`Buy ${inst.symbol}`}
                    >
                      <Zap className="w-3 h-3 fill-white" />
                      <span>B</span>
                    </button>

                    {/* Fast SELL */}
                    <button
                      type="button"
                      onClick={() => onOpenOrder(inst, 'SELL')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-xs tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1"
                      title={`Sell ${inst.symbol}`}
                    >
                      <Zap className="w-3 h-3 fill-white" />
                      <span>S</span>
                    </button>

                    {/* Technical Candlestick Chart Button */}
                    {onOpenChart && (
                      <button
                        type="button"
                        onClick={() => onOpenChart(inst)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#142032] dark:hover:bg-[#1A2B44] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-[#1E2E44]"
                        title="View Candlestick Chart"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                    )}

                    {/* Option Chain Button */}
                    {hasOptionChain && onOpenOptionChain && (
                      <button
                        type="button"
                        onClick={() => onOpenOptionChain(inst)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#142032] dark:hover:bg-[#1A2B44] text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-[#1E2E44]"
                        title="Open Option Chain"
                      >
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Day Low / High Range Bar */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-[#142032] flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                <span>L: ₹{inst.low.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-[#142032] rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                    style={{ width: `${rangePos}%` }}
                  />
                </div>
                <span>H: ₹{inst.high.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
              </div>
            </div>
          );
        })}

        {filteredInstruments.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs bg-white dark:bg-[#0A101C] rounded-2xl border border-slate-200 dark:border-[#162234]">
            No instruments found matching your search and category filter.
          </div>
        )}
      </div>
    </div>
  );
};
