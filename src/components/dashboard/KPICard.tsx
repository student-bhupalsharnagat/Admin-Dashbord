import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  badge?: string;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badgeColor?: string;
  valueClassName?: string;
  subtitleClassName?: string;
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  badge,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBg = 'bg-[#0f1d38]',
  badgeColor,
  valueClassName = 'text-white',
  subtitleClassName = 'text-emerald-400',
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#0b1325] border border-[#16233d] rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-[#22355c] hover:bg-[#0e182e] shadow-sm ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Top row: Title on left, Icon container on right */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {title}
        </span>
        <div
          className={`w-8 h-8 rounded-lg ${iconBg} border border-white/5 flex items-center justify-center shrink-0`}
        >
          <Icon size={16} className={iconColor} />
        </div>
      </div>

      {/* Center: Large bold value */}
      <div className={`text-xl sm:text-2xl font-bold tracking-tight leading-tight truncate my-0.5 ${valueClassName}`}>
        {value}
      </div>

      {/* Bottom: Trend / Subtitle */}
      {(subtitle || badge) && (
        <div className={`text-xs font-semibold mt-1 truncate flex items-center gap-1 ${subtitleClassName || badgeColor || ''}`}>
          {subtitle || badge}
        </div>
      )}
    </div>
  );
};

