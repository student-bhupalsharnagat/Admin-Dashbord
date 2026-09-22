import React, { useState, useMemo } from 'react';
import {
  X,
  Zap,
  Sliders,
  BarChart2,
  Maximize2,
  Minimize2,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  TrendingUp,
  Clock,
  Check
} from 'lucide-react';
import { TradingInstrument, ClientWallet, ClientOrder } from '../../types/trading';

interface OrderModalProps {
  isOpen: boolean;
  instrument: TradingInstrument | null;
  initialSide?: 'BUY' | 'SELL';
  wallet: ClientWallet;
  onClose: () => void;
  onPlaceOrder: (order: Partial<ClientOrder>) => void;
  onOpenChart?: (inst: TradingInstrument) => void;
  onOpenOptionChain?: (inst: TradingInstrument) => void;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  instrument,
  initialSide = 'BUY',
  wallet,
  onClose,
  onPlaceOrder,
  onOpenChart,
  onOpenOptionChain
}) => {
  if (!isOpen || !instrument) return null;

  // View mode inside modal: 'ORDER' or 'CHART'
  const [modalTab, setModalTab] = useState<'ORDER' | 'CHART'>('ORDER');
  const [isExpanded, setIsExpanded] = useState(false);

  // Order configuration
  const [product, setProduct] = useState<'INTRADAY' | 'HOLDING'>('INTRADAY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(instrument.lastPrice);
  const [unitMode, setUnitMode] = useState<'LOTS' | 'QTY'>('LOTS');
  const [lots, setLots] = useState<number>(1);
  const [enableSLTarget, setEnableSLTarget] = useState(false);
  const [stopLoss, setStopLoss] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Technical chart controls for when CHART tab is active
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '1D'>('15m');
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);

  const effectiveQty = unitMode === 'LOTS' ? lots * instrument.lotSize : lots;
  const effectiveLots = unitMode === 'LOTS' ? lots : Math.max(1, Math.round(lots / instrument.lotSize));

  // Margin requirement calculation
  const marginPerLot = product === 'INTRADAY' ? instrument.intraday : instrument.holding;
  const totalMarginRequired = marginPerLot * effectiveLots;
  const hasSufficientMargin = wallet.availableBalance >= totalMarginRequired;

  const isPositive = instrument.change >= 0;

  // Execute order handler (works for either BUY or SELL button)
  const handleExecute = (side: 'BUY' | 'SELL') => {
    setIsSubmitting(true);
    setTimeout(() => {
      onPlaceOrder({
        symbol: instrument.symbol,
        category: instrument.category,
        type: side,
        orderType,
        product,
        lots: effectiveLots,
        quantity: effectiveQty,
        price: orderType === 'LIMIT' ? limitPrice : (side === 'BUY' ? instrument.ask : instrument.bid),
        status: orderType === 'MARKET' ? 'EXECUTED' : 'OPEN',
        executionPrice: orderType === 'MARKET' ? (side === 'BUY' ? instrument.ask : instrument.bid) : undefined,
        stopLoss: enableSLTarget && stopLoss ? Number(stopLoss) : undefined,
        target: enableSLTarget && target ? Number(target) : undefined
      });
      setIsSubmitting(false);
      onClose();
    }, 350);
  };

  // Generate realistic candles for the Chart tab
  const candles = useMemo(() => {
    const list: Candle[] = [];
    let current = instrument.lastPrice * 0.988;
    const baseTime = new Date();
    baseTime.setHours(9, 15, 0, 0);

    const count = 32;
    const stepMin = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : 1440;

    for (let i = 0; i < count; i++) {
      const volatility = instrument.lastPrice * 0.003;
      const delta = (Math.sin(i * 0.4) + (Math.random() - 0.48)) * volatility;
      const open = current;
      const close = open + delta;
      const high = Math.max(open, close) + Math.random() * (volatility * 0.7);
      const low = Math.min(open, close) - Math.random() * (volatility * 0.7);
      const volume = Math.floor(40 + Math.random() * 120);

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

    if (list.length > 0) {
      list[list.length - 1].close = instrument.lastPrice;
      list[list.length - 1].high = Math.max(list[list.length - 1].high, instrument.lastPrice);
      list[list.length - 1].low = Math.min(list[list.length - 1].low, instrument.lastPrice);
    }

    return list;
  }, [instrument, timeframe]);

  const minPrice = Math.min(...candles.map(c => c.low));
  const maxPrice = Math.max(...candles.map(c => c.high));
  const priceRange = Math.max(0.01, maxPrice - minPrice);
  const chartHeight = 240;
  const chartWidth = 640;
  const candleWidth = chartWidth / candles.length;

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / priceRange) * (chartHeight - 40) - 20;
  };

  return (
    <div
      id="order-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="order-modal-container"
        className={`w-full ${
          isExpanded ? 'max-w-4xl' : 'max-w-xl'
        } bg-[#080E18] text-white border border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200`}
        onClick={e => e.stopPropagation()}
      >
        {/* TOP BAR / HEADER */}
        <div className="px-5 py-3.5 border-b border-[#1A2638] bg-[#0A1220] flex items-center justify-between gap-3">
          {/* Left: Instrument Symbol + Badges + LTP */}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white">
                {instrument.symbol}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                {instrument.category}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {instrument.expiry}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-1 flex items-baseline gap-2 flex-wrap">
              <span>{instrument.name} • LTP ₹{instrument.lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{instrument.change.toFixed(2)} ({isPositive ? '+' : ''}{instrument.changePercent.toFixed(2)}%)
              </span>
            </p>
          </div>

          {/* Right: Tab Switcher (Order / Chart) + Expand + Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#101A2B] p-0.5 rounded-xl border border-[#1E2E44]">
              <button
                type="button"
                id="modal-tab-order"
                onClick={() => setModalTab('ORDER')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  modalTab === 'ORDER'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Order
              </button>
              <button
                type="button"
                id="modal-tab-chart"
                onClick={() => setModalTab('CHART')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  modalTab === 'CHART'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Chart</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg bg-[#121E30] hover:bg-[#1A2A42] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#121E30] hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUB-HEADER ROW: Option Chain + Ask / Bid Pills */}
        <div className="px-5 py-2.5 bg-[#070D16] border-b border-[#142032] flex items-center justify-between gap-3 flex-wrap">
          <div>
            {(instrument.category === 'INDEX' || instrument.category === 'COMMODITY') && onOpenOptionChain && (
              <button
                type="button"
                id="modal-open-option-chain-btn"
                onClick={() => {
                  onClose();
                  onOpenOptionChain(instrument);
                }}
                className="px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Option Chain</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
              ASK {instrument.ask.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
              BID {instrument.bid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* TAB CONTENT: ORDER VS CHART */}
        {modalTab === 'ORDER' ? (
          <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* 1. PRODUCT CARDS: Intraday vs Holding */}
            <div className="grid grid-cols-2 gap-3">
              {/* Intraday Card */}
              <div
                id="product-card-intraday"
                onClick={() => setProduct('INTRADAY')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  product === 'INTRADAY'
                    ? 'border-2 border-amber-500 bg-amber-500/10 shadow-sm shadow-amber-500/10'
                    : 'border-[#1A2638] bg-[#0A1220] hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-bold text-slate-400">Intraday</div>
                <div className="text-lg sm:text-xl font-mono font-black text-white mt-1">
                  ₹{instrument.intraday.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Holding Card */}
              <div
                id="product-card-holding"
                onClick={() => setProduct('HOLDING')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  product === 'HOLDING'
                    ? 'border-2 border-amber-500 bg-amber-500/10 shadow-sm shadow-amber-500/10'
                    : 'border-[#1A2638] bg-[#0A1220] hover:border-slate-600'
                }`}
              >
                <div className="text-xs font-bold text-slate-400">Holding</div>
                <div className="text-lg sm:text-xl font-mono font-black text-white mt-1">
                  ₹{instrument.holding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* 2. METRICS 3-BOX ROW: OPEN, HIGH, LOW */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-[#0A1220] border border-[#162234] text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">OPEN</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-slate-200 mt-0.5 block">
                  {instrument.open.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0A1220] border border-[#162234] text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">HIGH</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                  {instrument.high.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0A1220] border border-[#162234] text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">LOW</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-rose-400 mt-0.5 block">
                  {instrument.low.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* 3. LOTS & UNITS ROW: MAX LOTS, ORDER LOTS, LOT SIZE, SWITCH TO QTY */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
              <div className="p-2.5 rounded-xl bg-[#0A1220] border border-[#162234]">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">MAX LOTS</span>
                <span className="text-sm font-mono font-black text-slate-200 mt-0.5 block">
                  {instrument.maxLots}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-[#0E182A] border border-amber-500/40">
                <span className="text-[10px] font-bold text-amber-400 block uppercase">ORDER LOTS</span>
                <input
                  type="number"
                  min="1"
                  max={instrument.maxLots}
                  value={lots}
                  onChange={e => setLots(Math.max(1, Math.min(instrument.maxLots, parseInt(e.target.value) || 1)))}
                  className="w-full bg-transparent font-mono font-black text-sm text-white outline-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#0A1220] border border-[#162234]">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">LOT SIZE</span>
                <span className="text-sm font-mono font-black text-slate-200 mt-0.5 block">
                  {instrument.lotSize}
                </span>
              </div>

              <button
                type="button"
                id="switch-unit-mode-btn"
                onClick={() => setUnitMode(unitMode === 'LOTS' ? 'QTY' : 'LOTS')}
                className="py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold transition-colors cursor-pointer text-center"
              >
                {unitMode === 'LOTS' ? 'Switch to Qty' : 'Switch to Lots'}
              </button>
            </div>

            {/* 4. PRICE & STEPPER ROW */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0A1220] border border-[#162234] gap-3">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block">
                  {orderType === 'MARKET' ? 'Market' : 'Limit'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  PRICE
                </span>
              </div>

              <div className="flex items-center gap-3">
                {orderType === 'LIMIT' && (
                  <input
                    type="number"
                    step="0.05"
                    value={limitPrice}
                    onChange={e => setLimitPrice(parseFloat(e.target.value) || instrument.lastPrice)}
                    className="w-28 px-2 py-1 rounded bg-[#101A2B] border border-amber-500/40 text-sm font-mono font-bold text-white text-right outline-none"
                  />
                )}

                {/* Stepper */}
                <div className="flex items-center rounded-xl bg-[#101A2B] border border-[#1E2E44] p-0.5">
                  <button
                    type="button"
                    onClick={() => setLots(Math.max(1, lots - 1))}
                    className="w-8 h-8 rounded-lg bg-[#16243A] hover:bg-[#1E304C] text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-mono font-bold text-slate-200 whitespace-nowrap">
                    {lots} {unitMode === 'LOTS' ? 'LOT' : 'QTY'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLots(Math.min(instrument.maxLots, lots + 1))}
                    className="w-8 h-8 rounded-lg bg-[#16243A] hover:bg-[#1E304C] text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 5. ORDER TYPE BUTTONS: Market vs Limit */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="order-type-market-btn"
                onClick={() => setOrderType('MARKET')}
                className={`py-2.5 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === 'MARKET'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-[#0A1220] border border-[#1A2638] text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Market</span>
              </button>

              <button
                type="button"
                id="order-type-limit-btn"
                onClick={() => setOrderType('LIMIT')}
                className={`py-2.5 rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === 'LIMIT'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-[#0A1220] border border-[#1A2638] text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Limit</span>
              </button>
            </div>

            {/* 6. SET STOP LOSS / TARGET TOGGLE */}
            <div className="p-3 rounded-xl bg-[#0A1220] border border-[#162234] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-500 text-slate-400 text-[10px] flex items-center justify-center">i</span>
                  <span>Set Stop Loss / Target</span>
                </span>

                <button
                  type="button"
                  id="toggle-sl-target"
                  onClick={() => setEnableSLTarget(!enableSLTarget)}
                  className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                    enableSLTarget ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                      enableSLTarget ? 'left-5.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {enableSLTarget && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Stop Loss Price
                    </label>
                    <input
                      type="number"
                      placeholder={`e.g. ${(instrument.lastPrice * 0.98).toFixed(2)}`}
                      value={stopLoss}
                      onChange={e => setStopLoss(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#101A2B] border border-[#1E2E44] text-xs font-mono text-white outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Target Price
                    </label>
                    <input
                      type="number"
                      placeholder={`e.g. ${(instrument.lastPrice * 1.03).toFixed(2)}`}
                      value={target}
                      onChange={e => setTarget(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[#101A2B] border border-[#1E2E44] text-xs font-mono text-white outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MARGIN STATUS BADGE */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
              <span>Required: ₹{totalMarginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span className={hasSufficientMargin ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                Avail: ₹{wallet.availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {!hasSufficientMargin && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Insufficient margin balance for {effectiveLots} Lots.</span>
              </div>
            )}
          </div>
        ) : (
          /* TAB CONTENT: INTERACTIVE TECHNICAL CHART */
          <div className="p-4 space-y-3 bg-[#070D18]">
            {/* Timeframe Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-[#101A2B] p-1 rounded-xl border border-[#1E2E44]">
                {(['1m', '5m', '15m', '1h', '1D'] as const).map(tf => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      timeframe === tf
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Hover Tooltip */}
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>O: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).open}</strong></span>
                <span>H: <strong className="text-emerald-400">₹{(hoveredCandle || candles[candles.length - 1]).high}</strong></span>
                <span>L: <strong className="text-rose-400">₹{(hoveredCandle || candles[candles.length - 1]).low}</strong></span>
                <span>C: <strong className="text-white">₹{(hoveredCandle || candles[candles.length - 1]).close}</strong></span>
              </div>
            </div>

            {/* SVG Candlestick Canvas */}
            <div className="h-[240px] bg-[#0A101C] rounded-xl border border-[#1A2638] p-2 relative overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                {/* Grid */}
                <line x1="0" y1="60" x2={chartWidth} y2="60" stroke="#162234" strokeDasharray="3 3" />
                <line x1="0" y1="120" x2={chartWidth} y2="120" stroke="#162234" strokeDasharray="3 3" />
                <line x1="0" y1="180" x2={chartWidth} y2="180" stroke="#162234" strokeDasharray="3 3" />

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
                    <g key={c.time + i} onMouseEnter={() => setHoveredCandle(c)} className="cursor-crosshair">
                      <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.5" />
                      <rect
                        x={x - candleWidth * 0.35}
                        y={bodyTop}
                        width={candleWidth * 0.7}
                        height={bodyHeight}
                        fill={color}
                        rx="1"
                      />
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
          </div>
        )}

        {/* DUAL ACTION BUTTONS (EXACTLY AS IN SCREENSHOT 9) */}
        <div className="p-4 border-t border-[#1A2638] bg-[#0A1220] grid grid-cols-2 gap-3">
          {/* SELL BID BUTTON */}
          <button
            type="button"
            id="modal-sell-bid-btn"
            disabled={isSubmitting}
            onClick={() => handleExecute('SELL')}
            className="py-3.5 px-4 rounded-xl bg-[#F43F5E] hover:bg-[#E11D48] active:scale-98 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
            <div className="text-left">
              <span className="block leading-none">SELL BID</span>
              <span className="text-[11px] font-mono opacity-90 font-normal">
                ₹{totalMarginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </button>

          {/* BUY ASK BUTTON */}
          <button
            type="button"
            id="modal-buy-ask-btn"
            disabled={isSubmitting}
            onClick={() => handleExecute('BUY')}
            className="py-3.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-98 text-white font-black text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
            <div className="text-left">
              <span className="block leading-none">BUY ASK</span>
              <span className="text-[11px] font-mono opacity-90 font-normal">
                ₹{totalMarginRequired.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
