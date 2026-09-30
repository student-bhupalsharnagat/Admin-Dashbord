import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { VolumeCommissionChartPoint } from '../../types';
import { DisplayCurrency, INR_PER_USD, chartAxisMax } from '../../utils/currency';

interface TradingVolumeRevenueChartProps {
  data?: VolumeCommissionChartPoint[];
  currency?: DisplayCurrency;
  rangeLabel?: string;
}

export const TradingVolumeRevenueChart: React.FC<TradingVolumeRevenueChartProps> = ({
  data = [],
  currency = 'INR',
  rangeLabel = 'Last 30 days'
}) => {
  const series = useMemo(() => {
    return data.map(point => {
      const volumeInr = Number(point.volume || 0) * 10000000;
      const commissionInr = Number(point.commission || 0) * 100000;
      if (currency === 'USD') {
        return {
          label: point.displayDate || point.date,
          volume: volumeInr / INR_PER_USD / 1000000,
          revenue: commissionInr / INR_PER_USD / 1000
        };
      }
      return {
        label: point.displayDate || point.date,
        volume: Number(point.volume || 0),
        revenue: Number(point.commission || 0)
      };
    });
  }, [data, currency]);

  const volumeUnit = currency === 'USD' ? '$M' : '₹ Cr';
  const revenueUnit = currency === 'USD' ? '$K' : '₹ L';
  const yMax = chartAxisMax(series.flatMap(point => [point.volume, point.revenue]));
  const hasActivity = series.some(point => point.volume > 0 || point.revenue > 0);

  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-5 flex flex-col h-full shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Trading Volume & Commission
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
            {rangeLabel}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
            <span className="text-slate-300 font-medium">Volume ({volumeUnit})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            <span className="text-slate-300 font-medium">Commission ({revenueUnit})</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full min-w-0">
        {!hasActivity ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-[#16233d] rounded-lg">
            No executed volume in this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
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
                dataKey="label"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#16233d' }}
                minTickGap={18}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#16233d' }}
                domain={[0, yMax]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const vol = Number(payload.find(p => p.dataKey === 'volume')?.value || 0);
                    const rev = Number(payload.find(p => p.dataKey === 'revenue')?.value || 0);
                    return (
                      <div className="bg-[#091020] border border-[#1b2b4e] rounded-lg p-2.5 shadow-xl text-xs space-y-1.5 z-50">
                        <div className="font-semibold text-slate-200 pb-1 border-b border-[#16233d]">
                          {label}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-emerald-400 font-medium">
                          <span>Commission:</span>
                          <span className="font-mono font-bold">{rev.toFixed(2)} {revenueUnit}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-blue-400 font-medium">
                          <span>Volume:</span>
                          <span className="font-mono font-bold">{vol.toFixed(2)} {volumeUnit}</span>
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
        )}
      </div>
    </div>
  );
};
