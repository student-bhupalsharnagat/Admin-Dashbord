import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { VolumeCommissionChartPoint } from '../../types';

interface VolumeCommissionChartProps {
  data: VolumeCommissionChartPoint[];
}

export const VolumeCommissionChart: React.FC<VolumeCommissionChartProps> = ({ data }) => {
  const [timeRange, setTimeRange] = useState<'7D' | '15D' | '30D' | '3M'>('15D');

  return (
    <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 flex flex-col h-full shadow-sm">
      {/* Header with Title, Legends, and Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Trading Volume & Commission
          </h3>
        </div>

        <div className="flex items-center gap-4">
          {/* Legends */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              <span className="text-slate-400">Volume</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span className="text-slate-400">Commission</span>
            </div>
          </div>

          {/* Time range selector */}
          <div className="flex items-center bg-[#131f38] p-0.5 rounded-lg border border-[#1b2b4e] text-[11px]">
            {(['7D', '15D', '30D', '3M'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="volGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#17233f" vertical={false} />
            <XAxis
              dataKey="displayDate"
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
              tickFormatter={val => `₹${val}M`}
              domain={[0, 12]}
              ticks={[0, 3, 6, 9, 12]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as VolumeCommissionChartPoint;
                  return (
                    <div className="bg-[#0b1222] border border-[#213254] rounded-lg p-2.5 shadow-xl text-xs space-y-1 z-50">
                      <div className="font-semibold text-slate-300 pb-1 border-b border-[#1b2b4e]">
                        {item.date}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-blue-400">
                        <span>Volume:</span>
                        <span className="font-mono font-bold">₹{item.volume.toFixed(2)} Cr</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400">
                        <span>Commission:</span>
                        <span className="font-mono font-bold">₹{(item.commission * 100).toFixed(1)} L</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="volume"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#60a5fa', stroke: '#1e3a8a', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="commission"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#34d399', stroke: '#064e3b', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
