import React, { useState } from 'react';
import {
  X,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Star,
  Layers,
  Search,
  Activity,
  Maximize2,
  TrendingUp,
  ShieldCheck,
  Check
} from 'lucide-react';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  id: number;
  title: string;
  description: string;
  icon: any;
  highlight: string;
}

export const TourModal: React.FC<TourModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps: TourStep[] = [
    {
      id: 1,
      title: 'Your Live Watchlist',
      description: 'Keep the instruments you follow in one place and monitor their latest market prices, live tick movements, and bid/ask spreads.',
      icon: Star,
      highlight: 'Spotlight strip & category filters keep you on top of NSE, MCX, Crypto, and Forex.'
    },
    {
      id: 2,
      title: 'Explore Markets & Categories',
      description: 'Switch between market categories (Commodity, Equity, Index, Options, Crypto, Forex) to quickly discover opportunities.',
      icon: Layers,
      highlight: 'Instant multi-segment filtering with custom lot sizes and trading limits.'
    },
    {
      id: 3,
      title: 'Instant Search & Filter',
      description: 'Search for any contract by ticker, symbol, or full name to open its deep market order book in milliseconds.',
      icon: Search,
      highlight: 'Type symbol names like NIFTY, GOLD, BTC, or SBIN for instant results.'
    },
    {
      id: 4,
      title: 'Live Spotlight Terminal',
      description: 'Inspect real-time Bid/Ask depth, open/high/low/prev-close metrics, and execute with 1-click Quick Buy or Quick Sell.',
      icon: Activity,
      highlight: 'Full Level 2 order book simulation with sub-second price updates.'
    },
    {
      id: 5,
      title: 'Option Chain & Technical Chart',
      description: 'Open the Strike Price Option Chain with full Call (CE) and Put (PE) Greeks, or launch the TradingView-style candlestick chart with custom timeframes.',
      icon: Maximize2,
      highlight: 'Real-time strike ladder, implied volatility, open interest, and technical indicators.'
    },
    {
      id: 6,
      title: '1-Click Order Execution',
      description: 'Choose Intraday MIS or Holding CNC, select order lots, enter Stop Loss / Target triggers, and send orders straight to the matching engine.',
      icon: TrendingUp,
      highlight: 'Zero latency validation with automated leverage margin verification.'
    },
    {
      id: 7,
      title: 'Portfolio & Real-Time MTM',
      description: 'Track open positions with live Mark-to-Market (MTM) calculations, view realized gains, and close positions individually or in bulk.',
      icon: ShieldCheck,
      highlight: 'Instant margin release and live P&L updates synchronized across your desk.'
    }
  ];

  const currentStep = steps[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const IconComponent = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                Platform Quick Tour
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Step {currentStepIndex + 1} of {steps.length}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="p-6 space-y-5">
          {/* Step Icon Badge */}
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
              <IconComponent className="w-8 h-8" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h4 className="text-lg font-black text-slate-900 dark:text-white">
              {currentStep.title}
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              {currentStep.description}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
            {currentStep.highlight}
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-6 bg-amber-500'
                    : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#0B111C] border-t border-slate-200 dark:border-[#1A2638] flex items-center justify-between">
          <button
            type="button"
            disabled={isFirst}
            onClick={handlePrev}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer transition-all active:scale-95"
          >
            <span>{isLast ? 'Complete & Start Trading' : 'Next Step'}</span>
            {isLast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
