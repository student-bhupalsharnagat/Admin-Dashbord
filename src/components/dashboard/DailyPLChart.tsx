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

interface DailyPLChartProps {
  data: DailyPLPoint[];
  mtdBadge?: string;
}

export const DailyPLChart: React.FC<DailyPLChartProps> = ({
  data,
  mtdBadge = ''
}) => {
  return (
    <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white tracking-tight">
          Daily P&L Trend (April 2024)
        </h3>

        <div className="text-xs font-bold text-[#10b981] bg-[#10b981]/10 px-3 py-1 rounded-full border border-[#10b981]/30 tracking-tight">
          {mtdBadge}
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 w-full min-w-0">
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
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#17233f' }}
              tickFormatter={val => `${val >= 0 ? '₹' : '-₹'}${Math.abs(val)}K`}
              domain={[-95, 220]}
              ticks={[-95, 0, 95, 190, 205]}
            />
            <ReferenceLine y={0} stroke="#22355c" strokeDasharray="2 2" />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as DailyPLPoint;
                  return (
                    <div className="bg-[#0b1222] border border-[#213254] rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                      <div className="font-semibold text-slate-300 pb-1 border-b border-[#1b2b4e]">
                        {item.displayDay}, 2024
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-400">Net Platform P&L:</span>
                        <span
                          className={`font-mono font-bold ${
                            item.pl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.pl >= 0 ? '+' : ''}₹{(item.pl * 1000).toLocaleString()}
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
      </div>
    </div>
  );
};
