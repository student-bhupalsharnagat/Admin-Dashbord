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
import { ClientRegistrationPoint } from '../../types';
import { chartAxisMax } from '../../utils/currency';

interface NewClientRegistrationsChartProps {
  data?: ClientRegistrationPoint[];
  rangeLabel?: string;
}

export const NewClientRegistrationsChart: React.FC<NewClientRegistrationsChartProps> = ({
  data = [],
  rangeLabel = 'Last 30 days'
}) => {
  const yMax = chartAxisMax(data.map(point => point.count), 4);
  const total = data.reduce((sum, point) => sum + Number(point.count || 0), 0);

  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-5 flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            New Client Registrations
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
            {rangeLabel} · {total.toLocaleString()} new
          </p>
        </div>
      </div>

      <div className="h-64 w-full min-w-0">
        {total === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500 border border-dashed border-[#16233d] rounded-lg">
            No new client accounts in this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#16233d" vertical={false} />
              <XAxis
                dataKey="month"
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
                allowDecimals={false}
                domain={[0, yMax]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const count = payload[0].value;
                    return (
                      <div className="bg-[#091020] border border-[#1b2b4e] rounded-lg p-2.5 shadow-xl text-xs space-y-1 z-50">
                        <div className="font-semibold text-slate-200 pb-1 border-b border-[#16233d]">
                          {label}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-blue-400 font-medium">
                          <span>New Registrations:</span>
                          <span className="font-mono font-bold">{count}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="count"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
