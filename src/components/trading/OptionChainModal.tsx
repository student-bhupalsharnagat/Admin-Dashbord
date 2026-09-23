import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Layers, Zap } from 'lucide-react';
import { TradingInstrument } from '../../types/trading';

interface OptionChainModalProps {
  isOpen: boolean;
  instrument: TradingInstrument | null;
  onClose: () => void;
  onSelectStrike: (symbol: string, side: 'BUY' | 'SELL', price: number) => void;
}

export const OptionChainModal: React.FC<OptionChainModalProps> = ({
  isOpen,
  instrument,
  onClose,
  onSelectStrike
}) => {
  if (!isOpen || !instrument) return null;

  const [selectedExpiry, setSelectedExpiry] = useState('31 Aug');
  const expiries = ['31 Aug', '07 Sep', '14 Sep', '28 Sep'];

  const spot = instrument.lastPrice;
  const step = instrument.category === 'INDEX' ? 100 : instrument.lastPrice > 5000 ? 100 : 20;
  const baseStrike = Math.round(spot / step) * step;

  // Generate 9 strikes around spot
  const strikes = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(offset => {
    const strike = baseStrike + offset * step;
    const isATM = offset === 0;
    const diff = spot - strike;
    
    // Call pricing: In-the-money intrinsic + time value
    const callIntrinsic = Math.max(0, diff);
    const callTimeValue = Math.max(12, 120 - Math.abs(offset) * 22);
    const callLTP = Number((callIntrinsic + callTimeValue).toFixed(2));

    // Put pricing: In-the-money intrinsic + time value
    const putIntrinsic = Math.max(0, -diff);
    const putTimeValue = Math.max(12, 120 - Math.abs(offset) * 22);
    const putLTP = Number((putIntrinsic + putTimeValue).toFixed(2));

    const callOI = Math.floor(18000 + (10 - Math.abs(offset)) * 12500 + (offset * 1234));
    const putOI = Math.floor(21000 + (10 - Math.abs(offset)) * 14200 - (offset * 980));
    const iv = Number((14.5 + Math.abs(offset) * 0.8).toFixed(1));

    return {
      strike,
      isATM,
      callLTP,
      putLTP,
      callOI,
      putOI,
      iv
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#0B111C] border-b border-slate-200 dark:border-[#141E2E] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white truncate">
                  {instrument.symbol} Option Chain
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono shrink-0">
                  Spot: ₹{spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Select any Strike to trade Calls (CE) or Puts (PE)
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            {/* Expiry filter buttons */}
            <div className="flex items-center gap-1 bg-slate-200 dark:bg-[#101928] p-1 rounded-lg border border-slate-300 dark:border-[#1E2E44] overflow-x-auto no-scrollbar">
              {expiries.map(exp => (
                <button
                  key={exp}
                  type="button"
                  onClick={() => setSelectedExpiry(exp)}
                  className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    selectedExpiry === exp
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#142032] hover:bg-slate-300 dark:hover:bg-slate-800 border border-slate-300 dark:border-[#223652] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Option Chain Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-2 sm:p-4 font-mono">
          <table className="w-full min-w-[700px] text-xs text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#0E1726] border-b border-slate-200 dark:border-[#1E2E44] text-[11px] uppercase tracking-wider">
              <tr>
                <th colSpan={4} className="py-2 px-3 text-center bg-emerald-500/10 text-emerald-500 border-r border-slate-200 dark:border-[#1E2E44] font-bold">
                  CALLS (CE)
                </th>
                <th className="py-2 px-3 text-center bg-amber-500/10 text-amber-500 border-r border-slate-200 dark:border-[#1E2E44] font-bold">
                  STRIKE
                </th>
                <th colSpan={4} className="py-2 px-3 text-center bg-rose-500/10 text-rose-500 font-bold">
                  PUTS (PE)
                </th>
              </tr>
              <tr className="bg-slate-50 dark:bg-[#0A101C] text-slate-500 text-[10px] border-b border-slate-200 dark:border-[#1E2E44]">
                <th className="py-1.5 px-3">OI</th>
                <th className="py-1.5 px-3">IV%</th>
                <th className="py-1.5 px-3 text-right">LTP (₹)</th>
                <th className="py-1.5 px-3 border-r border-slate-200 dark:border-[#1E2E44] text-center">TRADE</th>
                <th className="py-1.5 px-3 text-center bg-slate-200/50 dark:bg-slate-900/80 text-amber-500 dark:text-amber-300 border-r border-slate-200 dark:border-[#1E2E44]">PRICE</th>
                <th className="py-1.5 px-3 text-center">TRADE</th>
                <th className="py-1.5 px-3 text-left">LTP (₹)</th>
                <th className="py-1.5 px-3">IV%</th>
                <th className="py-1.5 px-3 text-right">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142032]">
              {strikes.map(row => (
                <tr
                  key={row.strike}
                  className={`hover:bg-slate-100 dark:hover:bg-[#0E1626] transition-colors ${
                    row.isATM ? 'bg-amber-500/10 font-bold' : ''
                  }`}
                >
                  {/* Call OI */}
                  <td className="py-2 px-3 text-slate-500 text-[11px]">
                    {row.callOI.toLocaleString()}
                  </td>
                  {/* Call IV */}
                  <td className="py-2 px-3 text-slate-400 text-[11px]">
                    {row.iv}%
                  </td>
                  {/* Call LTP */}
                  <td className="py-2 px-3 text-right font-bold text-emerald-500">
                    ₹{row.callLTP.toFixed(2)}
                  </td>
                  {/* Call Actions */}
                  <td className="py-2 px-3 border-r border-slate-200 dark:border-[#1E2E44] text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStrike(`${instrument.symbol} ${row.strike} CE`, 'BUY', row.callLTP);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStrike(`${instrument.symbol} ${row.strike} CE`, 'SELL', row.callLTP);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        S
                      </button>
                    </div>
                  </td>

                  {/* Strike Price */}
                  <td className="py-2 px-3 text-center font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-[#09111D] border-r border-slate-200 dark:border-[#1E2E44]">
                    <div className="flex flex-col items-center">
                      <span>{row.strike}</span>
                      {row.isATM && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-sans font-bold uppercase mt-0.5">
                          ATM
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Put Actions */}
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStrike(`${instrument.symbol} ${row.strike} PE`, 'BUY', row.putLTP);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStrike(`${instrument.symbol} ${row.strike} PE`, 'SELL', row.putLTP);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        S
                      </button>
                    </div>
                  </td>
                  {/* Put LTP */}
                  <td className="py-2 px-3 text-left font-bold text-rose-500">
                    ₹{row.putLTP.toFixed(2)}
                  </td>
                  {/* Put IV */}
                  <td className="py-2 px-3 text-slate-400 text-[11px]">
                    {row.iv}%
                  </td>
                  {/* Put OI */}
                  <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                    {row.putOI.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
