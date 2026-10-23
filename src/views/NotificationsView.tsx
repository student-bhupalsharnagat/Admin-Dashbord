import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Cpu,
  UserX,
  Check,
  Clock,
  ExternalLink,
  Trash2,
  Filter,
  Bell
} from 'lucide-react';
import { NavigationTab } from '../components/layout/AdminSidebar';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timeAgo: string;
  category: 'System' | 'Trading' | 'Funds' | 'KYC' | 'Support';
  read: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  targetTab?: NavigationTab;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'KYC Document Submitted',
    message: 'Nathan Brooks submitted KYC documents for review.',
    timeAgo: '10 mins ago',
    category: 'KYC',
    read: false,
    icon: UserCheck,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    targetTab: 'kyc'
  },
  {
    id: 'notif-2',
    title: 'Withdrawal Request',
    message: 'Maya Patel requested withdrawal of ₹12,000.',
    timeAgo: '25 mins ago',
    category: 'Funds',
    read: false,
    icon: DollarSign,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    targetTab: 'funds'
  },
  {
    id: 'notif-3',
    title: 'Large Order Alert',
    message: 'Order ORD002 - BTC/INR ₹15,059 executed by Maya Patel.',
    timeAgo: '1 hr ago',
    category: 'Trading',
    read: false,
    icon: TrendingUp,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    targetTab: 'orders'
  },
  {
    id: 'notif-4',
    title: 'New Support Ticket',
    message: 'Isabella Torres opened ticket TKT005 - Deposit issue.',
    timeAgo: '2 hrs ago',
    category: 'Support',
    read: true,
    icon: MessageSquare,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    targetTab: 'support'
  },
  {
    id: 'notif-5',
    title: 'System Update',
    message: 'Platform maintenance scheduled for Sunday 2AM UTC.',
    timeAgo: '5 hrs ago',
    category: 'System',
    read: true,
    icon: Cpu,
    iconBg: 'bg-slate-700/20',
    iconColor: 'text-slate-400'
  },
  {
    id: 'notif-6',
    title: 'KYC Rejected',
    message: 'Ethan Clarke KYC was rejected - document quality issue.',
    timeAgo: '1 day ago',
    category: 'KYC',
    read: true,
    icon: UserX,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    targetTab: 'kyc'
  }
];

interface NotificationsViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onNavigateTab?: (tab: NavigationTab) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onNotify,
  onNavigateTab
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const storedRead: string[] = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
      return INITIAL_NOTIFICATIONS.map(n => ({
        ...n,
        read: storedRead.includes(n.id) ? true : n.read
      }));
    } catch {
      return INITIAL_NOTIFICATIONS;
    }
  });
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const res = await fetch('/api/admin/notifications', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            const storedRead: string[] = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
            const resolveIcon = (category: string, title: string) => {
              if (category === 'KYC' || title.toLowerCase().includes('kyc')) return { icon: UserCheck, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400' };
              if (category === 'Funds' || title.toLowerCase().includes('withdrawal') || title.toLowerCase().includes('deposit')) return { icon: DollarSign, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-400' };
              if (category === 'Trading' || title.toLowerCase().includes('order')) return { icon: TrendingUp, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400' };
              if (category === 'Support' || title.toLowerCase().includes('ticket')) return { icon: MessageSquare, iconBg: 'bg-purple-500/10', iconColor: 'text-purple-400' };
              return { icon: Bell, iconBg: 'bg-slate-700/20', iconColor: 'text-slate-400' };
            };

            const mapped: NotificationItem[] = data.map((d: any, idx: number) => {
              const category = d.category || 'System';
              const title = d.title || 'Notification';
              const iconMeta = resolveIcon(category, title);
              return {
                id: d.id || `notif-backend-${idx}`,
                title,
                message: d.message || d.details || '',
                timeAgo: d.timeAgo || (d.created_at ? new Date(d.created_at).toLocaleTimeString() : 'Just now'),
                category: (['System', 'Trading', 'Funds', 'KYC', 'Support'].includes(category) ? category : 'System') as any,
                read: storedRead.includes(d.id) || d.is_read || d.read || false,
                icon: iconMeta.icon,
                iconBg: iconMeta.iconBg,
                iconColor: iconMeta.iconColor,
                targetTab: d.target_tab || d.targetTab || undefined
              };
            });

            // Ensure baseline 3 notifications (KYC Document Submitted, Withdrawal Request, Large Order Alert) are retained
            const existingTitles = new Set(mapped.map(m => m.title.toLowerCase().trim()));
            const missingBaselines = INITIAL_NOTIFICATIONS.filter(b => !existingTitles.has(b.title.toLowerCase().trim()));
            setNotifications([...mapped, ...missingBaselines]);
          }
        }
      } catch {
        // Keeps state
      }
    };
    fetchNotifications();
    return () => {
      isMounted = false;
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    const allIds = notifications.map(n => n.id);
    try {
      localStorage.setItem('admin_read_notifications', JSON.stringify(allIds));
      await fetch('/api/admin/notifications/all/read', { method: 'POST' });
    } catch {}
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onNotify?.('All notifications marked as read', 'success');
  };

  const handleToggleRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    let willBeRead = false;
    setNotifications(prev =>
      prev.map(n => {
        if (n.id === id) {
          willBeRead = !n.read;
          return { ...n, read: willBeRead };
        }
        return n;
      })
    );
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('admin_read_notifications') || '[]');
      if (willBeRead) {
        if (!stored.includes(id)) stored.push(id);
      } else {
        const idx = stored.indexOf(id);
        if (idx !== -1) stored.splice(idx, 1);
      }
      localStorage.setItem('admin_read_notifications', JSON.stringify(stored));
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      await fetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch {
      // Ignored
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    onNotify?.('Notification removed', 'info');
  };

  const handleItemClick = (item: NotificationItem) => {
    // mark read
    if (!item.read) {
      handleToggleRead(item.id);
    }
    // navigate if targetTab available
    if (item.targetTab && onNavigateTab) {
      onNavigateTab(item.targetTab);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'Unread') return !n.read;
    return n.category.toLowerCase() === activeCategory.toLowerCase();
  });

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Unread', label: 'Unread', count: unreadCount },
    { id: 'System', label: 'System' },
    { id: 'Trading', label: 'Trading' },
    { id: 'Funds', label: 'Funds' },
    { id: 'KYC', label: 'KYC' },
    { id: 'Support', label: 'Support' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Title and Mark all as read */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs font-semibold text-[#3b82f6] hover:text-blue-400 transition-colors cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Category Tabs matching Screenshot 2 */}
      <div className="flex items-center gap-6 border-b border-[#142038] text-xs font-medium overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
        {categories.map(tab => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`pb-3 relative transition-colors flex items-center gap-1.5 cursor-pointer ${
                isActive ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Notification Items List Container */}
      <div className="bg-[#0b1328] border border-[#142038] rounded-xl divide-y divide-[#142038] overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No notifications found for this category.
          </div>
        ) : (
          filteredNotifications.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-4 flex items-start gap-4 hover:bg-[#0e1935] transition-colors cursor-pointer group ${
                  !item.read ? 'bg-[#0c1630]/60' : ''
                }`}
              >
                {/* Icon box */}
                <div
                  className={`w-9 h-9 rounded-lg ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0 mt-0.5`}
                >
                  <Icon size={18} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white tracking-tight">
                      {item.title}
                    </h4>
                    {!item.read && (
                      <span className="w-2 h-2 rounded-full bg-[#2563eb] inline-block shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {item.message}
                  </p>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                    <Clock size={11} />
                    <span>{item.timeAgo}</span>
                  </div>
                </div>

                {/* Hover/Touch Actions */}
                <div className="flex items-center gap-1 sm:gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={e => handleToggleRead(item.id, e)}
                    title={item.read ? 'Mark as unread' : 'Mark as read'}
                    className="p-1.5 rounded-md hover:bg-[#152342] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Check size={14} className={item.read ? 'text-slate-500' : 'text-blue-400'} />
                  </button>
                  {item.targetTab && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onNavigateTab?.(item.targetTab!);
                      }}
                      title="Navigate to related section"
                      className="p-1.5 rounded-md hover:bg-[#152342] text-slate-400 hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  <button
                    onClick={e => handleDelete(item.id, e)}
                    title="Dismiss notification"
                    className="p-1.5 rounded-md hover:bg-[#152342] text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
