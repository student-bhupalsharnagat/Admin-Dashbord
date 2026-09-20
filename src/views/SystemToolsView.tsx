import React, { useState, useEffect } from 'react';
import {
  Percent,
  Palette,
  FileText,
  Headphones,
  Shield,
  Settings,
  Download,
  CheckCircle,
  Clock,
  Server,
  Database,
  Lock,
  Sun,
  Moon,
  AlertOctagon,
  Radio,
  Smartphone,
  Laptop,
  Power,
  Ban,
  RefreshCw,
  AlertTriangle,
  Activity,
  Users,
  CheckCircle2,
  XCircle,
  Send,
  Sliders,
  Eye,
  SlidersHorizontal,
  Key
} from 'lucide-react';
import { Tenant } from '../types';
import { useTheme } from '../context/ThemeContext';

interface SystemToolsViewProps {
  section: 'subscriptions' | 'whitelabel' | 'reports' | 'support' | 'audit-logs' | 'settings';
  tenants: Tenant[];
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const SystemToolsView: React.FC<SystemToolsViewProps> = ({
  section,
  tenants,
  onNotify
}) => {
  const { theme, setTheme } = useTheme();

  // Settings Sub-tab: 'emergency' | 'master-limits' | 'platform' | 'architecture'
  const [settingsTab, setSettingsTab] = useState<'emergency' | 'master-limits' | 'platform' | 'architecture'>('emergency');

  // Audit Logs Sub-tab: 'audit-trail' | 'sessions' | 'suspicious-alerts' | 'api-activity'
  const [auditTab, setAuditTab] = useState<'audit-trail' | 'sessions' | 'suspicious-alerts' | 'api-activity'>('audit-trail');

  // Emergency Controls state
  const [tradingPaused, setTradingPaused] = useState(false);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [registrationsEnabled, setRegistrationsEnabled] = useState(true);
  const [apiAccessEnabled, setApiAccessEnabled] = useState(true);
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeEntityId, setFreezeEntityId] = useState('');
  const [freezeEntityType, setFreezeEntityType] = useState<'MASTER' | 'BROKER' | 'USER'>('BROKER');
  const [freezeReason, setFreezeReason] = useState('Regulatory risk investigation');

  // Master Limits state
  const [masterLimits, setMasterLimits] = useState({
    maxUsers: 5000,
    maxBrokers: 50,
    maxTurnoverDaily: 500000000,
    dailyLossCap: 2500000,
    maxLeverage: 10,
    marginCallLevel: 75,
    squareOffLevel: 90
  });

  // Platform state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [platformStatus, setPlatformStatus] = useState({
    web: 'ACTIVE',
    mobile: 'ACTIVE',
    minAppVersion: '2.4.0',
    activeConnections: 1842
  });

  // Sessions state
  const [sessions, setSessions] = useState([
    { id: 'sess_1', userId: 'USR-ADMIN-1', role: 'SUPER_ADMIN', ip: '103.21.244.2', device: 'Chrome / macOS', lastActive: 'Just now', status: 'ACTIVE' },
    { id: 'sess_2', userId: 'MST-001-OWNER', role: 'MASTER', ip: '49.36.120.15', device: 'Firefox / Windows', lastActive: '2m ago', status: 'ACTIVE' },
    { id: 'sess_3', userId: 'BRK-102-MGR', role: 'BROKER', ip: '157.34.88.92', device: 'Safari / iPhone', lastActive: '12m ago', status: 'ACTIVE' },
    { id: 'sess_4', userId: 'CLT-004-TRD', role: 'CLIENT', ip: '115.111.20.5', device: 'TradeMatrix App / Android', lastActive: '45m ago', status: 'ACTIVE' }
  ]);

  // Suspicious Alerts state
  const [suspiciousAlerts, setSuspiciousAlerts] = useState([
    { id: 'ALT-101', severity: 'HIGH', type: 'RAPID_ORDER_PLACEMENT', entity: 'CLT-009', detail: '14 orders placed in 2.1s exceeding throttle rate', status: 'PENDING', time: '10:45 AM' },
    { id: 'ALT-102', severity: 'CRITICAL', type: 'MARGIN_BREACH', entity: 'BRK-104', detail: 'Net margin utilization reached 92.4%', status: 'PENDING', time: '11:12 AM' },
    { id: 'ALT-103', severity: 'MEDIUM', type: 'GEO_IP_ANOMALY', entity: 'USR-882', detail: 'Simultaneous login from Mumbai and Singapore', status: 'RESOLVED', time: '08:30 AM' }
  ]);

  // API Activity logs
  const [apiLogs, setApiLogs] = useState([
    { id: 'REQ-9102', endpoint: '/api/v1/orders/execute', method: 'POST', status: 200, latency: '42ms', ip: '103.21.244.2', time: '11:45:01' },
    { id: 'REQ-9103', endpoint: '/api/v1/feed/depth/NIFTY', method: 'GET', status: 200, latency: '12ms', ip: '49.36.120.15', time: '11:45:03' },
    { id: 'REQ-9104', endpoint: '/api/v1/positions/squareoff', method: 'POST', status: 200, latency: '88ms', ip: '157.34.88.92', time: '11:45:10' },
    { id: 'REQ-9105', endpoint: '/api/v1/auth/token', method: 'POST', status: 401, latency: '65ms', ip: '185.220.101.4', time: '11:45:18' }
  ]);

  // Audit Logs
  const auditLogs = [
    { id: 'AUD-901', actor: 'Admin User (SUPER_ADMIN)', action: 'TENANT_CREATED', target: 'NEXUS (Nexus Securities)', ip: '103.21.244.2', timestamp: '2024-04-15 11:15:02' },
    { id: 'AUD-902', actor: 'Admin User (SUPER_ADMIN)', action: 'KYC_APPROVED', target: 'Arjun Patel (CLT001)', ip: '103.21.244.2', timestamp: '2024-04-15 10:45:18' },
    { id: 'AUD-903', actor: 'System Worker', action: 'MARGIN_ALERT_TRIGGERED', target: 'BRK-101 (82% Utilized)', ip: '127.0.0.1', timestamp: '2024-04-15 09:30:00' },
    { id: 'AUD-904', actor: 'Admin User (SUPER_ADMIN)', action: 'CONFIG_UPDATED', target: 'Global Leverage Cap 5x', ip: '103.21.244.2', timestamp: '2024-04-14 18:00:23' }
  ];

  // Fetch initial emergency and platform statuses
  useEffect(() => {
    fetch('/api/admin/platform-management')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setMaintenanceMode(Boolean(data.maintenanceMode));
          setPlatformStatus(prev => ({
            ...prev,
            web: data.webPlatform || 'ACTIVE',
            mobile: data.mobilePlatform || 'ACTIVE',
            minAppVersion: data.minAppVersion || '2.4.0'
          }));
        }
      })
      .catch(() => {});

    fetch('/api/admin/emergency-controls/trading')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setTradingPaused(Boolean(data.paused));
        }
      })
      .catch(() => {});
  }, []);

  // Emergency Handlers
  const handleToggleTrading = async () => {
    const nextPaused = !tradingPaused;
    try {
      const res = await fetch('/api/admin/emergency-controls/trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !nextPaused, paused: nextPaused, reason: 'Super Admin emergency toggle' })
      });
      if (res.ok) {
        setTradingPaused(nextPaused);
        onNotify?.(
          nextPaused ? 'EMERGENCY: Global Trading PAUSED' : 'Global Trading Resumed',
          nextPaused ? 'warning' : 'success'
        );
      } else {
        onNotify?.('Failed to update trading status', 'warning');
      }
    } catch {
      onNotify?.('Network error updating trading status', 'warning');
    }
  };

  const handleCancelAllOrders = async () => {
    try {
      const res = await fetch('/api/admin/emergency-controls/cancel-all-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Emergency Mass Cancel initiated from Admin console' })
      });
      if (res.ok) {
        const data = await res.json();
        onNotify?.(data.message || 'All open orders cancelled successfully', 'warning');
      } else {
        onNotify?.('Failed to cancel open orders', 'warning');
      }
    } catch {
      onNotify?.('Network error executing cancel all orders', 'warning');
    }
  };

  const handleTriggerKillSwitch = async () => {
    if (killSwitchActive) {
      // Reset
      try {
        const res = await fetch('/api/admin/emergency-controls/kill-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'RESET', reason: 'Manual circuit breaker reset by Super Admin' })
        });
        if (res.ok) {
          setKillSwitchActive(false);
          onNotify?.('Emergency Kill Switch Disarmed & Reset', 'success');
        }
      } catch {
        onNotify?.('Failed to reset kill switch', 'warning');
      }
    } else {
      // Trigger
      try {
        const res = await fetch('/api/admin/emergency-controls/kill-switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'TRIGGER', reason: 'Manual circuit breaker triggered by Super Admin' })
        });
        if (res.ok) {
          setKillSwitchActive(true);
          onNotify?.('CRITICAL: Kill Switch Activated! All pending orders cancelled.', 'warning');
        }
      } catch {
        onNotify?.('Failed to trigger kill switch', 'warning');
      }
    }
  };

  const handleToggleRegistrations = async () => {
    const next = !registrationsEnabled;
    try {
      const res = await fetch('/api/admin/emergency-controls/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
      if (res.ok) {
        setRegistrationsEnabled(next);
        onNotify?.(next ? 'New User Registrations Enabled' : 'New User Registrations FROZEN', 'info');
      }
    } catch {
      onNotify?.('Failed to update registration status', 'warning');
    }
  };

  const handleToggleApiAccess = async () => {
    const next = !apiAccessEnabled;
    try {
      const res = await fetch('/api/admin/emergency-controls/api-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next })
      });
      if (res.ok) {
        setApiAccessEnabled(next);
        onNotify?.(next ? 'Public Trading APIs Enabled' : 'Public Trading APIs BLOCKED', 'info');
      }
    } catch {
      onNotify?.('Failed to update API access status', 'warning');
    }
  };

  const handleFreezeEntity = async () => {
    if (!freezeEntityId.trim()) return;
    try {
      const res = await fetch('/api/admin/emergency-controls/account-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: freezeEntityType,
          entityId: freezeEntityId.trim(),
          action: 'FREEZE',
          reason: freezeReason
        })
      });
      if (res.ok) {
        setFreezeModalOpen(false);
        onNotify?.(`Freezing enforced on ${freezeEntityType} ${freezeEntityId}`, 'warning');
        setFreezeEntityId('');
      }
    } catch {
      onNotify?.(`Failed to freeze ${freezeEntityType}`, 'warning');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/admin/monitoring/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        onNotify?.(`Session ${sessionId} terminated immediately`, 'success');
      }
    } catch {
      onNotify?.(`Failed to terminate session ${sessionId}`, 'warning');
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/admin/monitoring/alerts/${alertId}/resolve`, { method: 'POST' });
      if (res.ok) {
        setSuspiciousAlerts(prev =>
          prev.map(a => (a.id === alertId ? { ...a, status: 'RESOLVED' } : a))
        );
        onNotify?.(`Alert ${alertId} resolved`, 'success');
      }
    } catch {
      onNotify?.(`Failed to resolve alert ${alertId}`, 'warning');
    }
  };

  const handleToggleMaintenance = async () => {
    const next = !maintenanceMode;
    try {
      const res = await fetch('/api/admin/platform-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceMode: next, message: broadcastMessage || 'System maintenance in progress' })
      });
      if (res.ok) {
        setMaintenanceMode(next);
        onNotify?.(next ? 'Maintenance Mode ACTIVE' : 'Maintenance Mode Disabled', next ? 'warning' : 'success');
      }
    } catch {
      onNotify?.('Failed to update maintenance mode', 'warning');
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    try {
      const res = await fetch('/api/admin/platform-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage.trim(), level: 'CRITICAL' })
      });
      if (res.ok) {
        onNotify?.('System-wide push alert dispatched to all active terminals', 'success');
        setBroadcastMessage('');
      }
    } catch {
      onNotify?.('Failed to dispatch push alert', 'warning');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d1527] border border-[#17233f] p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            {section === 'subscriptions' && <Percent size={20} />}
            {section === 'whitelabel' && <Palette size={20} className="text-purple-400" />}
            {section === 'reports' && <FileText size={20} className="text-emerald-400" />}
            {section === 'support' && <Headphones size={20} className="text-amber-400" />}
            {section === 'audit-logs' && <Shield size={20} className="text-cyan-400" />}
            {section === 'settings' && <Settings size={20} />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white capitalize">
              {section === 'subscriptions' && 'SaaS Subscription & Billing Engine'}
              {section === 'whitelabel' && 'White Label & Multi-Tenant Branding'}
              {section === 'reports' && 'Exportable Regulatory & Turnover Reports'}
              {section === 'support' && 'Central Support & Incident Ticketing'}
              {section === 'audit-logs' && 'Central Audit, Sessions & Security Monitoring'}
              {section === 'settings' && 'Platform Settings, Emergency Controls & Master Limits'}
            </h2>
            <p className="text-xs text-slate-400">
              {section === 'subscriptions' && 'Configure SaaS billing models: Fixed monthly, per-user, volume-based, or hybrid'}
              {section === 'whitelabel' && 'Customized login domains, brand logos, color themes, and tenant isolation'}
              {section === 'reports' && 'Generate CSV and audit-ready PDF statements for all brokerage entities'}
              {section === 'support' && 'Manage tenant inquiries, order routing issues, and risk escalations'}
              {section === 'audit-logs' && 'Live session revocation, suspicious telemetry, and immutable audit trails'}
              {section === 'settings' && 'Circuit breakers, Master capacity guardrails, and enterprise architecture'}
            </p>
          </div>
        </div>

        {section === 'settings' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSettingsTab('emergency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                settingsTab === 'emergency'
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <AlertOctagon size={13} /> Emergency
            </button>
            <button
              onClick={() => setSettingsTab('master-limits')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                settingsTab === 'master-limits'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <Sliders size={13} /> Master Limits
            </button>
            <button
              onClick={() => setSettingsTab('platform')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                settingsTab === 'platform'
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <Radio size={13} /> Platform
            </button>
            <button
              onClick={() => setSettingsTab('architecture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                settingsTab === 'architecture'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <Database size={13} /> Architecture
            </button>
          </div>
        )}

        {section === 'audit-logs' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAuditTab('audit-trail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                auditTab === 'audit-trail'
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={13} /> Audit Trail
            </button>
            <button
              onClick={() => setAuditTab('sessions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                auditTab === 'sessions'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <Users size={13} /> Active Sessions
            </button>
            <button
              onClick={() => setAuditTab('suspicious-alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                auditTab === 'suspicious-alerts'
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle size={13} /> Suspicious Alerts
            </button>
            <button
              onClick={() => setAuditTab('api-activity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                auditTab === 'api-activity'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-[#111c34] text-slate-400 hover:text-white'
              }`}
            >
              <Activity size={13} /> API Activity
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions */}
      {section === 'subscriptions' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-blue-400 font-bold uppercase tracking-wider text-[10px]">Tier 1</div>
              <h3 className="text-base font-bold text-white mt-1">Starter Model</h3>
              <div className="text-2xl font-bold text-white mt-3">₹49,999<span className="text-xs text-slate-400 font-normal"> / mo</span></div>
              <ul className="mt-4 space-y-2 text-slate-300">
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Up to 500 Traders</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> 1 Regional Master</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Standard API Gateway</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#17233f] text-slate-400 font-mono text-[11px]">Active on 3 Tenants</div>
          </div>

          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Tier 2</div>
              <h3 className="text-base font-bold text-white mt-1">Professional</h3>
              <div className="text-2xl font-bold text-white mt-3">₹1,49,999<span className="text-xs text-slate-400 font-normal"> / mo</span></div>
              <ul className="mt-4 space-y-2 text-slate-300">
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Up to 2,500 Traders</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> 5 Regional Masters</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> White-Label CNAME</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#17233f] text-slate-400 font-mono text-[11px]">Active on 2 Tenants</div>
          </div>

          <div className="bg-[#0d1527] border-2 border-blue-500/50 rounded-xl p-5 flex flex-col justify-between shadow-lg shadow-blue-500/10">
            <div>
              <div className="text-blue-400 font-bold uppercase tracking-wider text-[10px]">Most Popular</div>
              <h3 className="text-base font-bold text-white mt-1">Enterprise Cloud</h3>
              <div className="text-2xl font-bold text-white mt-3">₹3,99,999<span className="text-xs text-slate-400 font-normal"> / mo</span></div>
              <ul className="mt-4 space-y-2 text-slate-300">
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Unlimited Traders</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Multi-region Masters</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Dedicated Risk Gateway</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> 99.99% Guaranteed SLA</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#17233f] text-emerald-400 font-mono text-[11px]">Active on 1 Tenant</div>
          </div>

          <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-purple-400 font-bold uppercase tracking-wider text-[10px]">Tier 4</div>
              <h3 className="text-base font-bold text-white mt-1">Hybrid Custom</h3>
              <div className="text-2xl font-bold text-white mt-3">0.008%<span className="text-xs text-slate-400 font-normal"> Turnover</span></div>
              <ul className="mt-4 space-y-2 text-slate-300">
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Low base + Volume Billed</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Unlimited downlines</li>
                <li className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400" /> Custom integrations</li>
              </ul>
            </div>
            <div className="mt-6 pt-3 border-t border-[#17233f] text-slate-400 font-mono text-[11px]">Available on request</div>
          </div>
        </div>
      )}

      {/* White-Label Overview */}
      {section === 'whitelabel' && (
        <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-6 text-xs space-y-4">
          <h3 className="font-bold text-white text-sm">Tenant White Label Isolation Matrix</h3>
          <p className="text-slate-400 max-w-2xl">
            Each tenant brokerage operates on their own custom domain and branding assets. Central Admin ensures total data segregation and theme isolation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {tenants.map(t => (
              <div key={t.id} className="p-4 bg-[#111c34] border border-[#1b2c4e] rounded-xl space-y-2">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>{t.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">{t.code}</span>
                </div>
                <div className="text-slate-400">CNAME Domain:</div>
                <div className="font-mono text-blue-400 text-[11px] bg-slate-900/60 p-1.5 rounded break-all">{t.domain}</div>
                <div className="text-slate-400 text-[11px]">Primary Brand Accent:</div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-slate-700 bg-blue-600" />
                  <span className="font-mono text-slate-300">#2563EB</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT LOGS & MONITORING SECTION */}
      {section === 'audit-logs' && (
        <div className="space-y-4">
          {/* Sub-tab 1: System Audit Trail */}
          {auditTab === 'audit-trail' && (
            <div className="bg-[#0d1527] border border-[#17233f] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#17233f] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Immutable Platform Audit Trail</h3>
                  <p className="text-[11px] text-slate-400">Every privileged modification across Masters, Brokers, and Risk caps is permanently recorded.</p>
                </div>
                <button
                  onClick={() => onNotify?.('Exporting audit trail archive to CSV...', 'info')}
                  className="px-3 py-1.5 rounded-lg bg-[#111c34] hover:bg-blue-600 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead>
                    <tr className="bg-[#0b1120] text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">AUDIT ID</th>
                      <th className="py-3 px-4">ACTOR</th>
                      <th className="py-3 px-4">OPERATION</th>
                      <th className="py-3 px-4">TARGET ENTITY</th>
                      <th className="py-3 px-4">CLIENT IP</th>
                      <th className="py-3 px-4 text-right">TIMESTAMP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#17233f]/60">
                    {auditLogs.map(aud => (
                      <tr key={aud.id} className="hover:bg-[#111c34]">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{aud.id}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">{aud.actor}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-blue-500/10 text-blue-400">
                            {aud.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-300">{aud.target}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{aud.ip}</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">{aud.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Active User Sessions */}
          {auditTab === 'sessions' && (
            <div className="bg-[#0d1527] border border-[#17233f] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#17233f] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Active Concurrent Sessions</h3>
                  <p className="text-[11px] text-slate-400">Enforce instant session termination to disconnect compromised credentials.</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {sessions.length} Live Connections
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead>
                    <tr className="bg-[#0b1120] text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">USER ID</th>
                      <th className="py-3 px-4">ROLE</th>
                      <th className="py-3 px-4">DEVICE & CLIENT</th>
                      <th className="py-3 px-4">IP ADDRESS</th>
                      <th className="py-3 px-4">LAST ACTIVITY</th>
                      <th className="py-3 px-4 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#17233f]/60">
                    {sessions.map(s => (
                      <tr key={s.id} className="hover:bg-[#111c34]">
                        <td className="py-3 px-4 font-mono font-bold text-white">{s.userId}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400">
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{s.device}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{s.ip}</td>
                        <td className="py-3 px-4 text-slate-400">{s.lastActive}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleRevokeSession(s.id)}
                            className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Terminate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Suspicious Activity Alerts */}
          {auditTab === 'suspicious-alerts' && (
            <div className="bg-[#0d1527] border border-[#17233f] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#17233f]">
                <h3 className="text-sm font-bold text-white">Automated Risk & Threat Detection</h3>
                <p className="text-[11px] text-slate-400">Real-time surveillance for wash trading, rapid order throttle breaches, and margin limits.</p>
              </div>
              <div className="divide-y divide-[#17233f]/60">
                {suspiciousAlerts.map(alt => (
                  <div key={alt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#111c34]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          alt.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : alt.severity === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {alt.severity}
                        </span>
                        <span className="font-mono text-xs font-bold text-white">{alt.id}</span>
                        <span className="font-mono text-xs text-blue-400">Target: {alt.entity}</span>
                        <span className="text-[11px] text-slate-500">• {alt.time}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">{alt.detail}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {alt.status === 'RESOLVED' ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 size={14} /> Resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResolveAlert(alt.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Resolve Alert
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab 4: API Activity Monitor */}
          {auditTab === 'api-activity' && (
            <div className="bg-[#0d1527] border border-[#17233f] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#17233f] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">High-Frequency API Telemetry</h3>
                  <p className="text-[11px] text-slate-400">Live request stream passing through Central Admin Gateway.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">Live Stream</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[760px]">
                  <thead>
                    <tr className="bg-[#0b1120] text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">REQUEST ID</th>
                      <th className="py-3 px-4">METHOD</th>
                      <th className="py-3 px-4">ENDPOINT</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-4">LATENCY</th>
                      <th className="py-3 px-4">CALLER IP</th>
                      <th className="py-3 px-4 text-right">TIME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#17233f]/60 font-mono">
                    {apiLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#111c34]">
                        <td className="py-3 px-4 text-slate-300">{log.id}</td>
                        <td className="py-3 px-4">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.method === 'POST' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-200">{log.endpoint}</td>
                        <td className="py-3 px-4">
                          <span className={log.status === 200 ? 'text-emerald-400' : 'text-rose-400'}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{log.latency}</td>
                        <td className="py-3 px-4 text-slate-400">{log.ip}</td>
                        <td className="py-3 px-4 text-right text-slate-400">{log.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS & CONTROLS SECTION */}
      {section === 'settings' && (
        <div className="space-y-4">
          {/* Sub-tab 1: Emergency Circuit Breakers */}
          {settingsTab === 'emergency' && (
            <div className="space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <AlertOctagon size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-300">Central Circuit Breakers & Emergency Controls</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Immediate high-authority overrides to halt trading, cancel orders, or lock down compromised accounts during market flash crashes or security events.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kill Switch Card */}
                <div className={`p-5 rounded-xl border transition-all ${
                  killSwitchActive
                    ? 'bg-rose-950/40 border-rose-500 text-white'
                    : 'bg-[#0d1527] border-[#17233f] text-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Power size={18} className={killSwitchActive ? 'text-rose-400' : 'text-slate-400'} />
                      Global Master Kill Switch
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      killSwitchActive ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {killSwitchActive ? 'TRIGGERED' : 'ARMED & READY'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Cancels all pending limit orders instantly across every Master and squares off high-risk positions.
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Actions:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCancelAllOrders}
                        className="px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30"
                        title="Mass cancel all open/pending orders without disarming system trading"
                      >
                        Cancel Open Orders
                      </button>
                      <button
                        type="button"
                        onClick={handleTriggerKillSwitch}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          killSwitchActive
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                        }`}
                      >
                        {killSwitchActive ? 'Reset Kill Switch' : 'TRIGGER KILL SWITCH'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Trading Halt Card */}
                <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Ban size={18} className={tradingPaused ? 'text-amber-400' : 'text-emerald-400'} />
                      Global Market Trading Engine
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tradingPaused ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {tradingPaused ? 'PAUSED' : 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Temporarily stops the order execution matching engine without cancelling existing pending orders.
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Matching Engine:</span>
                    <button
                      onClick={handleToggleTrading}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        tradingPaused
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {tradingPaused ? 'Resume Global Trading' : 'Pause Global Trading'}
                    </button>
                  </div>
                </div>

                {/* New Registrations Card */}
                <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Users size={18} className="text-blue-400" />
                      Client Onboarding & Registrations
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      registrationsEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {registrationsEnabled ? 'OPEN' : 'FROZEN'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Control whether new client and sub-broker signups are accepted across tenant white labels.
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Registration Portal:</span>
                    <button
                      onClick={handleToggleRegistrations}
                      className="px-4 py-2 rounded-lg bg-[#111c34] hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      {registrationsEnabled ? 'Freeze New Signups' : 'Enable New Signups'}
                    </button>
                  </div>
                </div>

                {/* Freeze Specific Entity */}
                <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Lock size={18} className="text-cyan-400" />
                      Targeted Account Freeze
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                      SURVEILLANCE
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Immediately freeze specific Master, Broker, or Client accounts with an audit-logged reason.
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Account Lock:</span>
                    <button
                      onClick={() => setFreezeModalOpen(true)}
                      className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Freeze Entity Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 2: Master Limits & Capacity */}
          {settingsTab === 'master-limits' && (
            <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-6 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Master Account Capacity & Risk Guardrails</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set mandatory caps that apply across all Master accounts and downlines.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-[#111c34] border border-[#1b2c4e] p-4 rounded-xl space-y-1.5">
                  <label className="text-slate-400 font-medium">Max Traders per Master</label>
                  <input
                    type="number"
                    value={masterLimits.maxUsers}
                    onChange={e => setMasterLimits(prev => ({ ...prev, maxUsers: Number(e.target.value) }))}
                    className="w-full bg-[#081022] border border-[#1b2c4e] rounded-lg p-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Default hard ceiling for single Master</span>
                </div>

                <div className="bg-[#111c34] border border-[#1b2c4e] p-4 rounded-xl space-y-1.5">
                  <label className="text-slate-400 font-medium">Max Brokers per Master</label>
                  <input
                    type="number"
                    value={masterLimits.maxBrokers}
                    onChange={e => setMasterLimits(prev => ({ ...prev, maxBrokers: Number(e.target.value) }))}
                    className="w-full bg-[#081022] border border-[#1b2c4e] rounded-lg p-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Maximum allowable downline brokers</span>
                </div>

                <div className="bg-[#111c34] border border-[#1b2c4e] p-4 rounded-xl space-y-1.5">
                  <label className="text-slate-400 font-medium">Daily Loss Hard Cap (₹)</label>
                  <input
                    type="number"
                    value={masterLimits.dailyLossCap}
                    onChange={e => setMasterLimits(prev => ({ ...prev, dailyLossCap: Number(e.target.value) }))}
                    className="w-full bg-[#081022] border border-[#1b2c4e] rounded-lg p-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Auto-freeze trading when breached</span>
                </div>

                <div className="bg-[#111c34] border border-[#1b2c4e] p-4 rounded-xl space-y-1.5">
                  <label className="text-slate-400 font-medium">Max Intraday Leverage Allowed</label>
                  <input
                    type="number"
                    value={masterLimits.maxLeverage}
                    onChange={e => setMasterLimits(prev => ({ ...prev, maxLeverage: Number(e.target.value) }))}
                    className="w-full bg-[#081022] border border-[#1b2c4e] rounded-lg p-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">e.g. 10x for F&O / Equity Intraday</span>
                </div>

                <div className="bg-[#111c34] border border-[#1b2c4e] p-4 rounded-xl space-y-1.5">
                  <label className="text-slate-400 font-medium">Margin Call Threshold (%)</label>
                  <input
                    type="number"
                    value={masterLimits.marginCallLevel}
                    onChange={e => setMasterLimits(prev => ({ ...prev, marginCallLevel: Number(e.target.value) }))}
                    className="w-full bg-[#081022] border border-[#1b2c4e] rounded-lg p-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Warning alert sent to broker</span>
                </div>

                <div className="bg-[#111c34] border border-[#1b2c4e] p-4 rounded-xl space-y-1.5">
                  <label className="text-slate-400 font-medium">Auto Square-Off Level (%)</label>
                  <input
                    type="number"
                    value={masterLimits.squareOffLevel}
                    onChange={e => setMasterLimits(prev => ({ ...prev, squareOffLevel: Number(e.target.value) }))}
                    className="w-full bg-[#081022] border border-[#1b2c4e] rounded-lg p-2 text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Emergency auto-liquidation trigger</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onNotify?.('Master limits and risk guardrails saved successfully', 'success')}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  Save Master Guardrails
                </button>
              </div>
            </div>
          )}

          {/* Sub-tab 3: Platform Availability & Push Broadcasts */}
          {settingsTab === 'platform' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Platform Maintenance Mode Card */}
                <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Laptop size={18} className="text-blue-400" />
                      Platform Maintenance Window
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      maintenanceMode ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {maintenanceMode ? 'MAINTENANCE ON' : 'OPERATIONAL'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Redirects web terminals to a scheduled maintenance screen during database upgrades or weekend settlement.
                  </p>
                  <button
                    onClick={handleToggleMaintenance}
                    className={`mt-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      maintenanceMode
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {maintenanceMode ? 'End Maintenance Mode' : 'Enable Maintenance Mode'}
                  </button>
                </div>

                {/* Mobile Version Management */}
                <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-white text-sm">
                      <Smartphone size={18} className="text-purple-400" />
                      Mobile Trading App Versioning
                    </div>
                    <span className="font-mono text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      v{platformStatus.minAppVersion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Force users on outdated mobile builds to update via App Store / Play Store.
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      defaultValue="2.4.0"
                      className="bg-[#081022] border border-[#1b2c4e] rounded-lg px-3 py-1.5 text-xs text-white font-mono w-28"
                    />
                    <button
                      onClick={() => onNotify?.('Minimum required mobile build updated to v2.4.1', 'success')}
                      className="px-3 py-1.5 rounded-lg bg-[#111c34] hover:bg-blue-600 text-white text-xs font-semibold"
                    >
                      Update Minimum Version
                    </button>
                  </div>
                </div>
              </div>

              {/* Push System-wide Broadcast Message */}
              <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Radio size={18} className="text-amber-400" />
                  Live Notification Broadcast to All Terminals
                </div>
                <p className="text-xs text-slate-400">
                  Sends an instantaneous high-priority ticker banner across every logged-in user screen.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="e.g. Market closure reminder: All intraday MIS positions will auto-square at 15:15 IST."
                    className="flex-1 bg-[#081022] border border-[#1b2c4e] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                  />
                  <button
                    onClick={handleSendBroadcast}
                    disabled={!broadcastMessage.trim()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send size={14} /> Send Broadcast
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab 4: Architecture, RBAC & Lighting */}
          {settingsTab === 'architecture' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Database size={16} className="text-emerald-400" />
                  Central Database Architecture
                </div>
                <p className="text-slate-400 text-[11px]">
                  PostgreSQL cluster with row-level security (RLS) policies enforcing multi-tenant isolation.
                </p>
                <div className="space-y-2 text-slate-300">
                  <div className="flex justify-between py-1 border-b border-[#18243e]">
                    <span>Connection Status:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle size={12} /> Connected & Health Checked
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#18243e]">
                    <span>Data Layer Provider:</span>
                    <span className="font-mono text-blue-400">TradingDataProvider (Enterprise Abstraction)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#18243e]">
                    <span>Isolation Mode:</span>
                    <span className="font-semibold text-slate-200">resolveTenantScope (JWT / Session Strict)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Central Admin API:</span>
                    <span className="font-mono text-slate-200">http://0.0.0.0:3000/api/admin</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Lock size={16} className="text-cyan-400" />
                  Central Super Admin RBAC Security
                </div>
                <p className="text-slate-400 text-[11px]">
                  Backend token authentication enforces role boundary checks. Tenant IDs are never trusted from client payload.
                </p>
                <div className="space-y-2 text-slate-300">
                  <div className="flex justify-between py-1 border-b border-[#18243e]">
                    <span>Current Role:</span>
                    <span className="text-blue-400 font-bold">SUPER_ADMIN (Global Authority)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#18243e]">
                    <span>Cross-Tenant Scope:</span>
                    <span className="text-emerald-400 font-bold">Active</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#18243e]">
                    <span>Session Timeout:</span>
                    <span className="text-slate-300 font-mono">15 minutes idle expiration</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Multi-Factor Authentication:</span>
                    <span className="text-emerald-400 font-bold">Enforced (TOTP Hardware Key)</span>
                  </div>
                </div>
              </div>

              {/* Theme & Display Mode Configuration Card */}
              <div className="bg-[#0d1527] border border-[#17233f] rounded-xl p-5 space-y-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    {theme === 'dark' ? (
                      <Moon size={16} className="text-blue-400" />
                    ) : (
                      <Sun size={16} className="text-amber-500" />
                    )}
                    Platform Appearance & Lighting Mode
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 uppercase tracking-wider">
                    Active: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Seamlessly switch between High-Contrast Obsidian Dark Mode (optimized for prolonged trading terminal operations) and Daylight Clean Light Mode (designed for administrative clarity and audit inspections).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                        : 'border-[#18243e] bg-[#090f1e] text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0b1328] border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Moon size={16} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs text-white">Dark Theme (Default)</div>
                      <div className="text-[11px] text-slate-400">Obsidian Navy & Low Blue-Light Contrast</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                        : 'border-[#18243e] bg-[#090f1e] text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                      <Sun size={16} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-xs text-white">Light Theme</div>
                      <div className="text-[11px] text-slate-400">Daylight Slate, Clean White & High Contrast</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Freeze Entity Modal */}
      {freezeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#0c152a] border border-[#1d2d50] rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#162340]">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertOctagon size={18} />
                Emergency Entity Freeze
              </div>
              <button
                onClick={() => setFreezeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Entity Type</label>
                <select
                  value={freezeEntityType}
                  onChange={e => setFreezeEntityType(e.target.value as any)}
                  className="w-full bg-[#081022] border border-[#162442] rounded-lg p-2.5 text-white"
                >
                  <option value="MASTER">Master Account</option>
                  <option value="BROKER">Broker Account</option>
                  <option value="USER">Client Trader</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Entity ID or Code</label>
                <input
                  type="text"
                  value={freezeEntityId}
                  onChange={e => setFreezeEntityId(e.target.value)}
                  placeholder="e.g. BRK-102 or CLT004"
                  className="w-full bg-[#081022] border border-[#162442] rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Audit Justification / Reason</label>
                <textarea
                  rows={3}
                  value={freezeReason}
                  onChange={e => setFreezeReason(e.target.value)}
                  className="w-full bg-[#081022] border border-[#162442] rounded-lg p-2.5 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#162340]">
              <button
                onClick={() => setFreezeModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#111c34] text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleFreezeEntity}
                disabled={!freezeEntityId.trim()}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Confirm Emergency Freeze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
