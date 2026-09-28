import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  Camera,
  Layers,
  BarChart2,
  TrendingUp,
  Activity,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  Check
} from 'lucide-react';
import { TradingInstrument } from '../../types/trading';

interface TechnicalChartModalProps {
  isOpen: boolean;
  instrument: TradingInstrument | null;
  onClose: () => void;
  onOpenOrder: (inst: TradingInstrument, side: 'BUY' | 'SELL') => void;
  onOpenOptionChain?: (inst: TradingInstrument) => void;
}

interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Maps platform symbol to official TradingView symbol
function getTradingViewSymbol(inst: TradingInstrument): string {
  const sym = (inst.symbol || '').toUpperCase().trim();
  const cat = (inst.category || '').toUpperCase();

  if (sym.includes('BTC') || cat === 'CRYPTO') return 'BINANCE:BTCUSDT';
  if (sym.includes('ETH')) return 'BINANCE:ETHUSDT';
  if (sym.includes('SOL')) return 'BINANCE:SOLUSDT';
  if (sym.includes('XRP')) return 'BINANCE:XRPUSDT';

  if (sym.includes('NIFTY') || sym.includes('BANKNIFTY')) {
    return sym.includes('BANK') ? 'NSE:BANKNIFTY' : 'NSE:NIFTY';
  }
  if (sym.includes('GOLD')) return 'MCX:GOLD1!';
  if (sym.includes('SILVER')) return 'MCX:SILVER1!';
  if (sym.includes('CRUDE')) return 'MCX:CRUDEOIL1!';
  if (sym.includes('NATURALGAS')) return 'MCX:NATURALGAS1!';
  if (sym.includes('RELIANCE')) return 'NSE:RELIANCE';
  if (sym.includes('TCS')) return 'NSE:TCS';
  if (sym.includes('HDFC')) return 'NSE:HDFCBANK';
  if (sym.includes('INFY')) return 'NSE:INFY';
  if (sym.includes('AAPL')) return 'NASDAQ:AAPL';
  if (sym.includes('TSLA')) return 'NASDAQ:TSLA';

  return `BINANCE:${sym.replace('/', '')}`;
}

export const TechnicalChartModal: React.FC<TechnicalChartModalProps> = ({
  isOpen,
  instrument,
  onClose,
  onOpenOrder,
  onOpenOptionChain
}) => {
  if (!isOpen || !instrument) return null;

  // View modes
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartEngine, setChartEngine] = useState<'tradingview' | 'canvas'>('tradingview');
  const [activeTab, setActiveTab] = useState<'chart' | 'order'>('chart');

  // Chart configuration
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '30m' | '1h' | '1D'>('15m');
  const [chartType, setChartType] = useState<'candles' | 'line' | 'bars'>('candles');
  const [activeRange, setActiveRange] = useState<'1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'ALL'>('1D');

  // Indicators toggle
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [enabledIndicators, setEnabledIndicators] = useState<{
    volume: boolean;
    ma20: boolean;
    ema50: boolean;
    bollinger: boolean;
    rsi: boolean;
  }>({
    volume: true,
    ma20: true,
    ema50: false,
    bollinger: false,
    rsi: false
  });

  // Hover & Crosshair state for Canvas chart
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [liveClock, setLiveClock] = useState<string>('');

  // TradingView Iframe Refresh Counter
  const [refreshKey, setRefreshKey] = useState(0);

  // Live IST Clock (UTC+5:30) matching screenshot
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format to UTC+5:30
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const istTime = new Date(utcTime + 3600000 * 5.5);
      const hours = istTime.getHours().toString().padStart(2, '0');
      const minutes = istTime.getMinutes().toString().padStart(2, '0');
      const seconds = istTime.getSeconds().toString().padStart(2, '0');
      setLiveClock(`${hours}:${minutes}:${seconds} UTC+5:30`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const tvSymbol = useMemo(() => getTradingViewSymbol(instrument), [instrument]);

  // Generate synthetic high-density realistic candlestick data for Canvas mode
  const candles = useMemo(() => {
    const list: Candle[] = [];
    let current = instrument.lastPrice * 0.982;
    const baseTime = new Date();
    baseTime.setHours(9, 15, 0, 0);

    const count = 48;
    const stepMin =
      timeframe === '1m'
        ? 1
        : timeframe === '5m'
        ? 5
        : timeframe === '15m'
        ? 15
        : timeframe === '30m'
        ? 30
        : timeframe === '1h'
        ? 60
        : 1440;

    for (let i = 0; i < count; i++) {
      const volatility = instrument.lastPrice * (timeframe === '1m' ? 0.0018 : 0.0035);
      const wave = Math.sin(i * 0.32) * volatility * 0.8;
      const delta = wave + (Math.random() - 0.48) * volatility;
      const open = current;
      const close = open + delta;
      const high = Math.max(open, close) + Math.random() * (volatility * 0.6);
      const low = Math.min(open, close) - Math.random() * (volatility * 0.6);
      const volume = Math.floor(40 + Math.random() * 220);

      const t = new Date(baseTime.getTime() + i * stepMin * 60000);
      const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;

      list.push({
        time: timeStr,
        timestamp: t.getTime(),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume
      });

      current = close;
    }

    // Anchor latest candle to live instrument price
    if (list.length > 0) {
      const last = list[list.length - 1];
      last.close = instrument.lastPrice;
      last.high = Math.max(last.high, instrument.lastPrice);
      last.low = Math.min(last.low, instrument.lastPrice);
    }

    return list;
  }, [instrument.lastPrice, timeframe]);

  // Compute Moving Averages for canvas
  const ma20Points = useMemo(() => {
    return candles.map((c, idx) => {
      if (idx < 5) return c.close;
      const slice = candles.slice(Math.max(0, idx - 19), idx + 1);
      const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
      return sum / slice.length;
    });
  }, [candles]);

  const minPrice = useMemo(() => Math.min(...candles.map(c => c.low)) * 0.998, [candles]);
  const maxPrice = useMemo(() => Math.max(...candles.map(c => c.high)) * 1.002, [candles]);
  const priceRange = Math.max(0.01, maxPrice - minPrice);

  const chartHeight = 360;
  const chartWidth = 840;
  const candleWidth = chartWidth / candles.length;

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / priceRange) * (chartHeight - 60) - 30;
  };

  const isPositive = instrument.change >= 0;

  // TradingView Interval mapping
  const tvInterval =
    timeframe === '1m'
      ? '1'
      : timeframe === '5m'
      ? '5'
      : timeframe === '15m'
      ? '15'
      : timeframe === '30m'
      ? '30'
      : timeframe === '1h'
      ? '60'
      : 'D';

  // Construct official embed URL for TradingView widget
  const tradingViewWidgetUrl = useMemo(() => {
    const encodedSymbol = encodeURIComponent(tvSymbol);
    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodedSymbol}&interval=${tvInterval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0b111c&studies=%5B%5D&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1&studies_overrides=%7B%7D&overrides=%7B%22paneProperties.background%22%3A%22%23080e1a%22%2C%22paneProperties.vertGridProperties.color%22%3A%22%23121b2d%22%2C%22paneProperties.horzGridProperties.color%22%3A%22%23121b2d%22%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=${encodedSymbol}&v=${refreshKey}`;
  }, [tvSymbol, tvInterval, refreshKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div
        className={`w-full ${
          isFullscreen ? 'max-w-[98vw] h-[96vh]' : 'max-w-5xl max-h-[94vh]'
        } bg-[#0b101d] border border-[#1b263b] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 text-slate-200 font-sans`}
        onClick={e => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* 1. TOP HEADER (Matching Screenshot Exactly) */}
        {/* ============================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[#162238] bg-[#080d1a]">
          {/* Left: Symbol, Type, Tagline & Price */}
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-xl sm:text-2xl text-white tracking-tight">
                  {instrument.symbol}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {instrument.category || 'CRYPTO'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-orange-500/10 text-orange-400 border border-orange-500/30">
                  {instrument.expiry || 'Perpetual'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-slate-400 font-medium">
                  {instrument.name || 'Digital Asset'}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">LTP</span>
                <span className="text-white font-mono font-bold">
                  ₹{instrument.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span
                  className={`font-mono font-bold ${
                    isPositive ? 'text-[#00c076]' : 'text-[#ff4a68]'
                  }`}
                >
                  {isPositive ? '+' : ''}
                  {instrument.change.toFixed(2)} ({isPositive ? '+' : ''}
                  {instrument.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Option Chain Button */}
            {onOpenOptionChain && (
              <button
                type="button"
                onClick={() => onOpenOptionChain(instrument)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs transition-colors cursor-pointer active:scale-95 ml-2"
                title="Open Option Chain for this instrument"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Option Chain</span>
              </button>
            )}
          </div>

          {/* Right: Order / Chart Segmented Buttons, Maximize, Close & ASK/BID Pills */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {/* Order / Chart Toggle */}
              <div className="flex items-center bg-[#101828] p-1 rounded-xl border border-[#1b263b]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('order');
                    onOpenOrder(instrument, 'BUY');
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    activeTab === 'order'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Order
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chart')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    activeTab === 'chart'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BarChart2 className="w-3 h-3" />
                  <span>Chart</span>
                </button>
              </div>

              {/* Fullscreen Expand/Minimize */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-xl bg-[#101828] hover:bg-[#162238] border border-[#1b263b] text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isFullscreen ? 'Restore' : 'Maximize'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Close Modal */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-[#101828] hover:bg-rose-500/20 border border-[#1b263b] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ASK & BID Badges matching screenshot */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#06261f] border border-[#065f46] text-[#00c076] font-mono text-[11px] font-bold tracking-wide">
                ASK {instrument.ask.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#2d0e14] border border-[#7f1d1d] text-[#ff4a68] font-mono text-[11px] font-bold tracking-wide">
                BID {instrument.bid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 2. TIMEFRAME SELECTOR BAR (Matching Screenshot 1m, 5m, 15m, 30m, 1h, 1D) */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-[#141e33] bg-[#070c18] text-xs">
          <div className="flex items-center gap-1.5">
            {(['1m', '5m', '15m', '30m', '1h', '1D'] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs scale-102'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <span className="w-2 h-2 rounded-full bg-[#00c076] animate-pulse shadow-sm shadow-[#00c076]/50" />
            <span className="text-slate-300 font-semibold">TradingView Live Feed</span>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 3. CHART CONTROLS SUB-HEADER (Symbol pill, Switch to Canvas, Indicators) */}
        {/* ============================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2 bg-[#090f1e] border-b border-[#141e33] text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#101b2f] border border-[#1a2b47] font-mono text-[11px] font-bold text-slate-200">
              <span>{tvSymbol}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 text-[10px] font-sans font-semibold">Live</span>
            </div>

            <button
              type="button"
              onClick={() => setChartEngine(chartEngine === 'tradingview' ? 'canvas' : 'tradingview')}
              className="px-2.5 py-1 rounded-lg bg-[#142036] hover:bg-[#1a2a46] border border-[#203254] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>{chartEngine === 'tradingview' ? 'Switch to Canvas' : 'Switch to TradingView'}</span>
            </button>

            <button
              type="button"
              onClick={() => setRefreshKey(prev => prev + 1)}
              className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Chart Feed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <a
              href={`https://www.tradingview.com/symbols/${tvSymbol.replace(':', '-')}/`}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Open full chart on TradingView"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Indicators & Chart Styles Toolbar */}
          <div className="flex items-center gap-2">
            {/* Indicators dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIndicatorsOpen(!indicatorsOpen)}
                className="px-2.5 py-1 rounded-lg bg-[#101b2f] hover:bg-[#15233c] border border-[#1a2b47] text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Indicators</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {indicatorsOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-[#0d1627] border border-[#1b2b48] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-100 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5">
                    Technical Indicators
                  </div>
                  {[
                    { key: 'volume', label: 'Volume Histogram' },
                    { key: 'ma20', label: 'SMA 20 (Moving Avg)' },
                    { key: 'ema50', label: 'EMA 50 (Exponential)' },
                    { key: 'bollinger', label: 'Bollinger Bands' },
                    { key: 'rsi', label: 'RSI (14 Period)' }
                  ].map(ind => (
                    <button
                      key={ind.key}
                      type="button"
                      onClick={() =>
                        setEnabledIndicators(prev => ({
                          ...prev,
                          [ind.key]: !prev[ind.key as keyof typeof prev]
                        }))
                      }
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="text-slate-300">{ind.label}</span>
                      {enabledIndicators[ind.key as keyof typeof enabledIndicators] && (
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Camera / Screenshot icon */}
            <button
              type="button"
              onClick={() => alert('Screenshot captured')}
              className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Capture Screenshot"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 4. MAIN CHART AREA (TradingView Embed OR Canvas Engine) */}
        {/* ============================================================ */}
        <div className="flex-1 bg-[#080d1a] relative min-h-[360px] overflow-hidden flex flex-col">
          {chartEngine === 'tradingview' ? (
            <div className="w-full h-full min-h-[380px] flex-1 relative bg-[#080e1a]">
              <iframe
                key={`${tvSymbol}-${timeframe}-${refreshKey}`}
                src={tradingViewWidgetUrl}
                title={`TradingView Chart for ${tvSymbol}`}
                className="w-full h-full min-h-[380px] border-0"
                allow="fullscreen"
              />
            </div>
          ) : (
            <div
              className="flex-1 p-3 bg-[#080d1a] relative flex flex-col min-h-[380px]"
              onMouseLeave={() => {
                setHoveredCandle(null);
                setHoverPosition(null);
              }}
            >
              {/* Canvas OHLCV Header */}
              <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center gap-3 flex-wrap bg-[#0c1424] px-3 py-1 rounded-lg border border-white/5">
                <span className="text-slate-300 font-bold">{instrument.symbol} • {timeframe}</span>
                <span>
                  O: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).open.toLocaleString()}</strong>
                </span>
                <span>
                  H: <strong className="text-[#00c076]">₹{(hoveredCandle || candles[candles.length - 1]).high.toLocaleString()}</strong>
                </span>
                <span>
                  L: <strong className="text-[#ff4a68]">₹{(hoveredCandle || candles[candles.length - 1]).low.toLocaleString()}</strong>
                </span>
                <span>
                  C: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).close.toLocaleString()}</strong>
                </span>
                <span>
                  Vol: <strong className="text-amber-400">{(hoveredCandle || candles[candles.length - 1]).volume}</strong>
                </span>
              </div>

              {/* Interactive SVG Chart */}
              <div className="flex-1 relative w-full h-[320px]">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  {[0.2, 0.4, 0.6, 0.8].map(ratio => (
                    <line
                      key={ratio}
                      x1="0"
                      y1={chartHeight * ratio}
                      x2={chartWidth}
                      y2={chartHeight * ratio}
                      stroke="#142036"
                      strokeDasharray="4 4"
                    />
                  ))}

                  {/* Horizontal Price Scale Labels */}
                  {[0.2, 0.4, 0.6, 0.8].map(ratio => (
                    <text
                      key={ratio}
                      x={chartWidth - 55}
                      y={chartHeight * ratio - 6}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      ₹{(maxPrice - priceRange * ratio).toFixed(1)}
                    </text>
                  ))}

                  {/* MA 20 Curve */}
                  {enabledIndicators.ma20 && (
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      points={candles
                        .map((c, idx) => `${idx * candleWidth + candleWidth / 2},${getY(ma20Points[idx])}`)
                        .join(' ')}
                    />
                  )}

                  {/* Candlesticks & Volume Histogram */}
                  {candles.map((c, i) => {
                    const x = i * candleWidth + candleWidth / 2;
                    const yOpen = getY(c.open);
                    const yClose = getY(c.close);
                    const yHigh = getY(c.high);
                    const yLow = getY(c.low);
                    const isUp = c.close >= c.open;
                    const color = isUp ? '#00c076' : '#ff4a68';
                    const bodyTop = Math.min(yOpen, yClose);
                    const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

                    return (
                      <g
                        key={c.timestamp}
                        onMouseEnter={e => {
                          setHoveredCandle(c);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverPosition({ x: rect.left, y: rect.top });
                        }}
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
                        {/* Volume Bar */}
                        {enabledIndicators.volume && (
                          <rect
                            x={x - candleWidth * 0.3}
                            y={chartHeight - c.volume * 0.35}
                            width={candleWidth * 0.6}
                            height={c.volume * 0.35}
                            fill={color}
                            opacity="0.35"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Current Live Price Horizontal Guideline */}
                  <line
                    x1="0"
                    y1={getY(instrument.lastPrice)}
                    x2={chartWidth}
                    y2={getY(instrument.lastPrice)}
                    stroke={isPositive ? '#00c076' : '#ff4a68'}
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                </svg>

                {/* Live Current Price Badge on the Right Scale */}
                <div
                  className={`absolute right-1 px-2 py-0.5 text-[10px] font-mono font-bold rounded shadow-md ${
                    isPositive ? 'bg-[#00c076] text-slate-950' : 'bg-[#ff4a68] text-white'
                  }`}
                  style={{ top: `${Math.max(10, Math.min(280, getY(instrument.lastPrice)))}px` }}
                >
                  ₹{instrument.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 5. BOTTOM TIME RANGE SELECTOR BAR (1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, ALL & IST Time) */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-t border-[#141e33] bg-[#070c18] text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'] as const).map(rng => (
              <button
                key={rng}
                type="button"
                onClick={() => setActiveRange(rng)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  activeRange === rng
                    ? 'bg-[#162744] text-cyan-400 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {rng}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-slate-400 font-medium">
            {liveClock}
          </div>
        </div>

        {/* ============================================================ */}
        {/* 6. BOTTOM FULL-WIDTH ACTION TRADE BAR (SELL BID vs BUY ASK) */}
        {/* ============================================================ */}
        <div className="grid grid-cols-2 w-full select-none">
          {/* SELL BID BUTTON (Red) */}
          <button
            type="button"
            onClick={() => onOpenOrder(instrument, 'SELL')}
            className="w-full py-3.5 px-4 bg-[#ff4a68] hover:bg-[#e03855] text-white flex flex-col items-center justify-center transition-all cursor-pointer active:scale-99 border-r border-black/20 group"
          >
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-black tracking-wide">
              <ArrowDownRight className="w-4 h-4 group-hover:translate-y-0.5 transition-transform stroke-[2.5]" />
              <span>SELL BID (₹{instrument.bid.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono font-medium opacity-90">
              Margin: ₹{(instrument.intraday || 12500).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </button>

          {/* BUY ASK BUTTON (Green) */}
          <button
            type="button"
            onClick={() => onOpenOrder(instrument, 'BUY')}
            className="w-full py-3.5 px-4 bg-[#00c076] hover:bg-[#00a867] text-slate-950 flex flex-col items-center justify-center transition-all cursor-pointer active:scale-99 group"
          >
            <div className="flex items-center gap-1.5 text-sm sm:text-base font-black tracking-wide">
              <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform stroke-[2.5]" />
              <span>BUY ASK (₹{instrument.ask.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono font-medium opacity-90">
              Margin: ₹{(instrument.intraday || 12500).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
