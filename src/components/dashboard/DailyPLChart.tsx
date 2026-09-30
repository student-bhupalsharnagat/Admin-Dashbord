import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { DailyPLPoint } from '../../types';
import { DisplayCurrency, formatSignedMoney } from '../../utils/currency';

interface DailyPLChartProps {
  data: DailyPLPoint[];
  mtdBadge?: string;
  rawTotal?: number;
  currency?: DisplayCurrency;
  rangeLabel?: string;
}

export const DailyPLChart: React.FC<DailyPLChartProps> = ({
  data,
  mtdBadge = '',
  rawTotal = 0,
  currency = 'INR',
  rangeLabel = 'Last 30 days'
}) => {
  const values = data.map(point => point.pl);
  const min = Math.min(0, ...values, 0);
  const max = Math.max(0, ...values, 0);
  const span = Math.max(max - min, 1);
  const domainMin = min - span * 0.15;
  const domainMax = max + span * 0.15;
  const badge = typeof rawTotal === 'number' && data.length > 0
    ? formatSignedMoney(rawTotal, currency)
    : mtdBadge;
  const profitable = rawTotal >= 0;

  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-5 flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Daily P&L
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{rangeLabel}</p>
        </div>

        <div className={`text-xs font-bold px-3 py-1 rounded-full border tracking-tight ${
          profitable
            ? 'text-[#10b981] bg-[#10b981]/10 border-[#10b981]/30'
            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
        }`}>
          {badge || '₹0'}
        </div>
      </div>

      <div className="h-56 w-full min-w-0">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-[#16233d] rounded-lg">
            No ledger P&L in this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -5, bottom: 0 }}>
              <defs>
                <linearGradient id="cyanWave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#17233f" vertical={false} />
              <XAxis
                dataKey="displayDay"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#17233f' }}
                minTickGap={18}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#17233f' }}
                domain={[domainMin, domainMax]}
                tickFormatter={val => `${val}K`}
              />
              <ReferenceLine y={0} stroke="#22355c" strokeDasharray="2 2" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as DailyPLPoint;
                    return (
                      <div className="bg-[#0b1222] border border-[#213254] rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                        <div className="font-semibold text-slate-300 pb-1 border-b border-[#1b2b4e]">
                          {item.displayDay}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">Net platform P&L:</span>
                          <span
                            className={`font-mono font-bold ${
                              item.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatSignedMoney(item.pl * 1000, currency)}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="pl"
                stroke="#06b6d4"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#cyanWave)"
                activeDot={{ r: 5, fill: '#22d3ee', stroke: '#083344', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
