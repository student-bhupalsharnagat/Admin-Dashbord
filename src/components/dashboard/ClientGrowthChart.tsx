import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { ClientGrowthChartPoint } from '../../types';

interface ClientGrowthChartProps {
  data: ClientGrowthChartPoint[];
}

export const ClientGrowthChart: React.FC<ClientGrowthChartProps> = ({ data }) => {
  return (
    <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Client Growth</h3>
        <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          +18.4% YoY
        </span>
      </div>

      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#17233f" vertical={false} />
            <XAxis
              dataKey="month"
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
              domain={[0, 1600]}
              ticks={[0, 400, 800, 1200, 1600]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as ClientGrowthChartPoint;
                  return (
                    <div className="bg-[#0b1222] border border-[#213254] rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                      <div className="font-semibold text-slate-300 pb-1 border-b border-[#1b2b4e]">
                        {item.month} 2024
                      </div>
                      <div className="flex items-center justify-between gap-4 text-blue-400">
                        <span>Total Active Clients:</span>
                        <span className="font-mono font-bold">{item.clients.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="clients"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
