import React, { useState, useMemo } from 'react';
import { X, ArrowLeft, Zap, Maximize2, RefreshCw } from 'lucide-react';
import { TradingInstrument } from '../../types/trading';

interface TechnicalChartModalProps {
  isOpen: boolean;
  instrument: TradingInstrument | null;
  onClose: () => void;
  onOpenOrder: (inst: TradingInstrument, side: 'BUY' | 'SELL') => void;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const TechnicalChartModal: React.FC<TechnicalChartModalProps> = ({
  isOpen,
  instrument,
  onClose,
  onOpenOrder
}) => {
  if (!isOpen || !instrument) return null;

  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1D'>('15m');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  // Generate synthetic realistic candles based on instrument price
  const candles = useMemo(() => {
    const list: Candle[] = [];
    let current = instrument.lastPrice * 0.985;
    const baseTime = new Date();
    baseTime.setHours(9, 15, 0, 0);

    const count = 35;
    const stepMin = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : 1440;

    for (let i = 0; i < count; i++) {
      const volatility = instrument.lastPrice * 0.0035;
      const delta = (Math.sin(i * 0.45) + (Math.random() - 0.48)) * volatility;
      const open = current;
      const close = open + delta;
      const high = Math.max(open, close) + Math.random() * (volatility * 0.8);
      const low = Math.min(open, close) - Math.random() * (volatility * 0.8);
      const volume = Math.floor(50 + Math.random() * 150);

      const t = new Date(baseTime.getTime() + i * stepMin * 60000);
      const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;

      list.push({
        time: timeStr,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume
      });

      current = close;
    }

    // Anchor last candle close to live lastPrice
    if (list.length > 0) {
      list[list.length - 1].close = instrument.lastPrice;
      list[list.length - 1].high = Math.max(list[list.length - 1].high, instrument.lastPrice);
      list[list.length - 1].low = Math.min(list[list.length - 1].low, instrument.lastPrice);
    }

    return list;
  }, [instrument, timeframe]);

  // Compute scale boundaries
  const minPrice = Math.min(...candles.map(c => c.low));
  const maxPrice = Math.max(...candles.map(c => c.high));
  const priceRange = Math.max(0.01, maxPrice - minPrice);

  const chartHeight = 280;
  const chartWidth = 720;
  const candleWidth = chartWidth / candles.length;

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / priceRange) * (chartHeight - 40) - 20;
  };

  const isPositive = instrument.change >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Chart Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                  {instrument.symbol}
                </h3>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {instrument.expiry}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500">
                  {instrument.category}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-mono font-black text-slate-900 dark:text-white">
                  ₹{instrument.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className={`text-xs font-mono font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isPositive ? '↗ +' : '↘ '}
                  {instrument.change.toFixed(2)} ({isPositive ? '+' : ''}
                  {instrument.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-[#121E30] p-1 rounded-xl border border-slate-300 dark:border-[#1E2E44]">
            {(['1m', '5m', '15m', '1h', '1D'] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chart Canvas Area */}
        <div className="flex-1 p-4 bg-slate-900 overflow-x-auto relative min-h-[300px]">
          {/* Tooltip for Hovered Candle */}
          <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center gap-3">
            <span>
              O: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).open}</strong>
            </span>
            <span>
              H: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).high}</strong>
            </span>
            <span>
              L: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).low}</strong>
            </span>
            <span>
              C: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).close}</strong>
            </span>
            <span>
              Vol: <strong className="text-white">{(hoveredCandle || candles[candles.length - 1]).volume}</strong>
            </span>
          </div>

          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-[280px] overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <line x1="0" y1="60" x2={chartWidth} y2="60" stroke="#1E2E44" strokeDasharray="3 3" />
            <line x1="0" y1="130" x2={chartWidth} y2="130" stroke="#1E2E44" strokeDasharray="3 3" />
            <line x1="0" y1="200" x2={chartWidth} y2="200" stroke="#1E2E44" strokeDasharray="3 3" />

            {/* Price labels */}
            <text x={chartWidth - 50} y="55" fill="#64748B" fontSize="9" fontFamily="monospace">
              ₹{(maxPrice - priceRange * 0.2).toFixed(1)}
            </text>
            <text x={chartWidth - 50} y="125" fill="#64748B" fontSize="9" fontFamily="monospace">
              ₹{(minPrice + priceRange * 0.5).toFixed(1)}
            </text>
            <text x={chartWidth - 50} y="195" fill="#64748B" fontSize="9" fontFamily="monospace">
              ₹{(minPrice + priceRange * 0.2).toFixed(1)}
            </text>

            {/* Candlesticks */}
            {candles.map((c, i) => {
              const x = i * candleWidth + candleWidth / 2;
              const yOpen = getY(c.open);
              const yClose = getY(c.close);
              const yHigh = getY(c.high);
              const yLow = getY(c.low);
              const isUp = c.close >= c.open;
              const color = isUp ? '#10B981' : '#F43F5E';
              const bodyTop = Math.min(yOpen, yClose);
              const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

              return (
                <g
                  key={c.time + i}
                  onMouseEnter={() => setHoveredCandle(c)}
                  className="cursor-crosshair"
                >
                  {/* High-Low Wick */}
                  <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.5" />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth * 0.35}
                    y={bodyTop}
                    width={candleWidth * 0.7}
                    height={bodyHeight}
                    fill={color}
                    rx="1"
                  />
                  {/* Volume bar at bottom */}
                  <rect
                    x={x - candleWidth * 0.3}
                    y={chartHeight - c.volume * 0.25}
                    width={candleWidth * 0.6}
                    height={c.volume * 0.25}
                    fill={color}
                    opacity="0.3"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Chart Footer: Fast Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C] flex items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-500">
            Bid: <span className="text-emerald-500 font-bold">₹{instrument.bid}</span> • Ask:{' '}
            <span className="text-rose-500 font-bold">₹{instrument.ask}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenOrder(instrument, 'BUY')}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>BUY</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenOrder(instrument, 'SELL')}
              className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>SELL</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
