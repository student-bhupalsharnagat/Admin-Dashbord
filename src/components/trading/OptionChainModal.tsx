import React from 'react';
import { X, TrendingUp, TrendingDown, Zap } from 'lucide-react';
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

  const spot = instrument.lastPrice;
  const step = instrument.category === 'INDEX' ? 100 : 500;
  const baseStrike = Math.round(spot / step) * step;

  // Generate 7 strikes around spot
  const strikes = [-3, -2, -1, 0, 1, 2, 3].map(offset => {
    const strike = baseStrike + offset * step;
    const isATM = offset === 0;
    const callLTP = Math.max(5, (spot - strike) > 0 ? (spot - strike) + 45 : Math.max(10, 65 - Math.abs(offset) * 15));
    const putLTP = Math.max(5, (strike - spot) > 0 ? (strike - spot) + 45 : Math.max(10, 65 - Math.abs(offset) * 15));
    const callOI = Math.floor(15000 + Math.random() * 50000);
    const putOI = Math.floor(18000 + Math.random() * 45000);

    return {
      strike,
      isATM,
      callLTP: Number(callLTP.toFixed(2)),
      putLTP: Number(putLTP.toFixed(2)),
      callOI,
      putOI
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className="w-full max-w-4xl bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {instrument.symbol} Option Chain
              </h3>
              <span className="text-xs font-bold text-slate-500">Expiry: {instrument.expiry}</span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-500 mt-0.5">
              Spot: ₹{spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Option Chain Table */}
        <div className="overflow-x-auto flex-1 p-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1E2E44] text-[10px] font-bold text-slate-400 uppercase">
                <th colSpan={3} className="text-center bg-emerald-500/10 text-emerald-500 py-1.5 rounded-l-lg">
                  CALL OPTIONS (CE)
                </th>
                <th className="text-center bg-amber-500/10 text-amber-500 py-1.5">
                  STRIKE
                </th>
                <th colSpan={3} className="text-center bg-rose-500/10 text-rose-500 py-1.5 rounded-r-lg">
                  PUT OPTIONS (PE)
                </th>
              </tr>
              <tr className="border-b border-slate-200 dark:border-[#1E2E44] text-[10px] text-slate-500 font-mono">
                <th className="py-2 px-2 text-left">OI</th>
                <th className="py-2 px-2 text-right">LTP (₹)</th>
                <th className="py-2 px-2 text-center">Action</th>
                <th className="py-2 px-3 text-center font-bold text-slate-300">PRICE</th>
                <th className="py-2 px-2 text-center">Action</th>
                <th className="py-2 px-2 text-left">LTP (₹)</th>
                <th className="py-2 px-2 text-right">OI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#142032] font-mono">
              {strikes.map(row => (
                <tr
                  key={row.strike}
                  className={`hover:bg-slate-50 dark:hover:bg-[#0E1626] transition-colors ${
                    row.isATM ? 'bg-amber-500/5 font-bold' : ''
                  }`}
                >
                  {/* Call OI */}
                  <td className="py-2.5 px-2 text-slate-400 text-[11px]">
                    {row.callOI.toLocaleString()}
                  </td>
                  {/* Call LTP */}
                  <td className="py-2.5 px-2 text-right font-bold text-emerald-500">
                    ₹{row.callLTP}
                  </td>
                  {/* Call Trade Button */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectStrike(`${instrument.symbol} ${row.strike} CE`, 'BUY', row.callLTP);
                        onClose();
                      }}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                    >
                      BUY
                    </button>
                  </td>
                  {/* Strike Price */}
                  <td className="py-2.5 px-3 text-center font-black text-slate-900 dark:text-white bg-slate-100/50 dark:bg-[#09111D]">
                    {row.strike}
                    {row.isATM && (
                      <span className="block text-[9px] text-amber-500 font-sans uppercase">ATM</span>
                    )}
                  </td>
                  {/* Put Trade Button */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectStrike(`${instrument.symbol} ${row.strike} PE`, 'BUY', row.putLTP);
                        onClose();
                      }}
                      className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-[10px] transition-colors cursor-pointer"
                    >
                      BUY
                    </button>
                  </td>
                  {/* Put LTP */}
                  <td className="py-2.5 px-2 text-left font-bold text-rose-500">
                    ₹{row.putLTP}
                  </td>
                  {/* Put OI */}
                  <td className="py-2.5 px-2 text-right text-slate-400 text-[11px]">
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
