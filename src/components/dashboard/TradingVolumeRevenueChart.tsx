import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export interface VolumeRevenuePoint {
  month: string;
  volume: number;   // in $M
  revenue: number;  // in $K
}

const defaultData: VolumeRevenuePoint[] = [
  { month: 'Jan', volume: 25, revenue: 135 },
  { month: 'Feb', volume: 25, revenue: 142 },
  { month: 'Mar', volume: 28, revenue: 155 },
  { month: 'Apr', volume: 26, revenue: 145 },
  { month: 'May', volume: 45, revenue: 200 },
  { month: 'Jun', volume: 55, revenue: 215 }
];

interface TradingVolumeRevenueChartProps {
  data?: VolumeRevenuePoint[];
}

export const TradingVolumeRevenueChart: React.FC<TradingVolumeRevenueChartProps> = ({
  data = defaultData
}) => {
  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-5 flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Trading Volume & Revenue
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
            Monthly overview — 2023
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
            <span className="text-slate-300 font-medium">Volume ($M)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span className="text-slate-300 font-medium">Revenue ($K)</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="volumeGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#16233d" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#16233d' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#16233d' }}
              domain={[0, 260]}
              ticks={[0, 65, 130, 195, 260]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const vol = payload.find(p => p.dataKey === 'volume')?.value;
                  const rev = payload.find(p => p.dataKey === 'revenue')?.value;
                  return (
                    <div className="bg-[#091020] border border-[#1b2b4e] rounded-lg p-2.5 shadow-xl text-xs space-y-1.5 z-50">
                      <div className="font-semibold text-slate-200 pb-1 border-b border-[#16233d]">
                        {label} 2023
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400 font-medium">
                        <span>Revenue:</span>
                        <span className="font-mono font-bold">${rev}K</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-blue-400 font-medium">
                        <span>Volume:</span>
                        <span className="font-mono font-bold">${vol}M</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#revenueGlow)"
              dot={false}
              activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#0b1325' }}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#volumeGlow)"
              dot={false}
              activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#0b1325' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
