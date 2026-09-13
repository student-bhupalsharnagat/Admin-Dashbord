import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

export interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

const defaultAllocations: AllocationItem[] = [
  { name: 'Forex', value: 42, color: '#3b82f6' },
  { name: 'Equities', value: 28, color: '#10b981' },
  { name: 'Crypto', value: 18, color: '#8b5cf6' },
  { name: 'Indices', value: 12, color: '#f59e0b' }
];

interface AssetAllocationDonutChartProps {
  data?: AllocationItem[];
}

export const AssetAllocationDonutChart: React.FC<AssetAllocationDonutChartProps> = ({
  data = defaultAllocations
}) => {
  return (
    <div className="bg-[#0b1325] border border-[#16233d] rounded-xl p-5 flex flex-col h-full shadow-sm justify-between">
      {/* Header */}
      <div className="mb-2">
        <h3 className="text-sm font-bold text-white tracking-tight">
          Asset Allocation
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
          By instrument type
        </p>
      </div>

      {/* Donut Area */}
      <div className="h-44 w-full relative flex items-center justify-center min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as AllocationItem;
                  return (
                    <div className="bg-[#091020] border border-[#1b2b4e] rounded-lg p-2 shadow-xl text-xs space-y-1 z-50">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-200">{item.name}</span>
                        <span className="font-mono font-bold text-white ml-auto">{item.value}%</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={74}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend list below */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 pt-3 border-t border-[#16233d]">
        {data.map(item => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-300 font-medium truncate">{item.name}</span>
            </div>
            <span className="font-mono font-bold text-white ml-2">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
