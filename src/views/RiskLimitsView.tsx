import React, { useState } from 'react';
import {
  Plus,
  Pencil,
  AlertTriangle,
  Shield,
  TrendingDown,
  AlertCircle,
  X,
  CheckCircle2,
  Lock,
  Zap,
  Sliders
} from 'lucide-react';

export interface RiskProfileItem {
  profileId: string;
  name: string;
  maxOrderQty: string;
  maxExposure: string;
  dailyLossLimit: string;
  marginReq: string;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
}

export interface RiskEventItem {
  eventId: string;
  client: string;
  symbol: string;
  event: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  date: string;
  status: 'ACTIVE' | 'RESOLVED';
}

const initialRiskProfiles: RiskProfileItem[] = [
  {
    profileId: 'RP001',
    name: 'Conservative',
    maxOrderQty: '10,000',
    maxExposure: '$50,000',
    dailyLossLimit: '$2,000',
    marginReq: '5%',
    status: 'ACTIVE',
    description: 'Entry-tier conservative leverage and strict daily drawdowns'
  },
  {
    profileId: 'RP002',
    name: 'Standard',
    maxOrderQty: '100,000',
    maxExposure: '$500,000',
    dailyLossLimit: '$10,000',
    marginReq: '2%',
    status: 'ACTIVE',
    description: 'Standard margin limits for experienced retail traders'
  },
  {
    profileId: 'RP003',
    name: 'Professional',
    maxOrderQty: '1,000,000',
    maxExposure: '$5,000,000',
    dailyLossLimit: '$50,000',
    marginReq: '1%',
    status: 'ACTIVE',
    description: 'High capacity institutional exposure tier with custom thresholds'
  }
];

const initialRiskEvents: RiskEventItem[] = [
  {
    eventId: 'RE001',
    client: 'Alexander Hunt',
    symbol: 'EUR/INR',
    event: 'Daily loss limit reached 80%',
    severity: 'HIGH',
    date: '2023-06-23 11:00',
    status: 'ACTIVE'
  },
  {
    eventId: 'RE002',
    client: 'Maya Patel',
    symbol: 'BTC/INR',
    event: 'Position size exceeds standard limit',
    severity: 'MEDIUM',
    date: '2023-06-23 10:22',
    status: 'ACTIVE'
  },
  {
    eventId: 'RE003',
    client: 'Isabella Torres',
    symbol: 'AAPL',
    event: 'Order blocked: insufficient margin',
    severity: 'HIGH',
    date: '2023-06-23 09:15',
    status: 'RESOLVED'
  }
];

interface RiskLimitsViewProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const RiskLimitsView: React.FC<RiskLimitsViewProps> = ({ onNotify }) => {
  const [profiles, setProfiles] = useState<RiskProfileItem[]>(initialRiskProfiles);
  const [events, setEvents] = useState<RiskEventItem[]>(initialRiskEvents);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RiskProfileItem | null>(null);

  // Form states for creating new risk profile
  const [newProfileName, setNewProfileName] = useState('');
  const [newMaxQty, setNewMaxQty] = useState('');
  const [newMaxExposure, setNewMaxExposure] = useState('');
  const [newDailyLoss, setNewDailyLoss] = useState('');
  const [newMarginReq, setNewMarginReq] = useState('');

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      notify('Please specify a profile name', 'warning');
      return;
    }

    const newId = `RP00${profiles.length + 1}`;
    const newProfile: RiskProfileItem = {
      profileId: newId,
      name: newProfileName,
      maxOrderQty: newMaxQty || '50,000',
      maxExposure: newMaxExposure || '$250,000',
      dailyLossLimit: newDailyLoss || '$5,000',
      marginReq: newMarginReq || '3%',
      status: 'ACTIVE'
    };

    setProfiles(prev => [...prev, newProfile]);
    notify(`Risk profile "${newProfileName}" (${newId}) created successfully!`, 'success');
    setShowCreateModal(false);
    setNewProfileName('');
    setNewMaxQty('');
    setNewMaxExposure('');
    setNewDailyLoss('');
    setNewMarginReq('');
  };

  const handleSaveEditProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    setProfiles(prev =>
      prev.map(p => (p.profileId === editingProfile.profileId ? editingProfile : p))
    );
    notify(`Updated risk limits for ${editingProfile.name}`, 'success');
    setEditingProfile(null);
  };

  const handleToggleEventStatus = (event: RiskEventItem) => {
    const nextStatus = event.status === 'ACTIVE' ? 'RESOLVED' : 'ACTIVE';
    setEvents(prev =>
      prev.map(e => (e.eventId === event.eventId ? { ...e, status: nextStatus } : e))
    );
    notify(`Risk event ${event.eventId} marked as ${nextStatus}`, 'info');
  };

  const renderSeverityBadge = (sev: 'HIGH' | 'MEDIUM' | 'LOW') => {
    if (sev === 'HIGH') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
          HIGH
        </span>
      );
    }
    if (sev === 'MEDIUM') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#291e0a] border border-[#78350f] text-[#fbbf24]">
          MEDIUM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#0b2149] border border-[#0369a1] text-[#38bdf8]">
        LOW
      </span>
    );
  };

  const renderStatusBadge = (status: 'ACTIVE' | 'RESOLVED' | 'INACTIVE') => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          ACTIVE
        </span>
      );
    }
    if (status === 'RESOLVED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#2dd4bf]">
          RESOLVED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#192233] border border-[#334155] text-slate-400">
        INACTIVE
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb matching Screenshot 8 */}
      <div className="text-xs text-slate-400">
        <span className="text-slate-500">Dashboard</span>
        <span className="mx-2 text-slate-600">&gt;</span>
        <span className="text-slate-300 font-medium">Risk &amp; Limits</span>
      </div>

      {/* Header + Create Risk Profile Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight">Risk &amp; Limits</h1>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563eb] hover:bg-blue-600 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
        >
          <Plus size={14} />
          Create Risk Profile
        </button>
      </div>

      {/* 4 Stat Summary Cards matching Screenshot 8 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: RISK ALERTS */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">RISK ALERTS</p>
            <p className="text-2xl font-bold text-white mt-1">2</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#310e18] border border-[#7f1d1d] flex items-center justify-center text-[#f87171]">
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* Card 2: BLOCKED ORDERS */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">BLOCKED ORDERS</p>
            <p className="text-2xl font-bold text-white mt-1">1</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#291e0a] border border-[#78350f] flex items-center justify-center text-[#fbbf24]">
            <Shield size={18} />
          </div>
        </div>

        {/* Card 3: HIGH EXPOSURE */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">HIGH EXPOSURE</p>
            <p className="text-2xl font-bold text-white mt-1">3</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#2a170a] border border-[#9a3412] flex items-center justify-center text-[#f97316]">
            <TrendingDown size={18} />
          </div>
        </div>

        {/* Card 4: MARGIN ALERTS */}
        <div className="bg-[#091122] border border-[#131e36] rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">MARGIN ALERTS</p>
            <p className="text-2xl font-bold text-white mt-1">2</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#291e0a] border border-[#78350f] flex items-center justify-center text-[#fbbf24]">
            <AlertCircle size={18} />
          </div>
        </div>
      </div>

      {/* Section 1: Risk Profiles */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-white tracking-wide">Risk Profiles</h2>

        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[840px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">PROFILE ID</th>
                  <th className="py-3.5 px-4">NAME</th>
                  <th className="py-3.5 px-4">MAX ORDER QTY</th>
                  <th className="py-3.5 px-4">MAX EXPOSURE</th>
                  <th className="py-3.5 px-4">DAILY LOSS LIMIT</th>
                  <th className="py-3.5 px-4">MARGIN REQ</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {profiles.map(item => (
                  <tr key={item.profileId} className="hover:bg-[#0c152a] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{item.profileId}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{item.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-200">{item.maxOrderQty}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-200">{item.maxExposure}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#f87171]">{item.dailyLossLimit}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-200">{item.marginReq}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => setEditingProfile(item)}
                        title="Edit Risk Profile"
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 2: Recent Risk Events */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-white tracking-wide">Recent Risk Events</h2>

        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[840px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">EVENT ID</th>
                  <th className="py-3.5 px-4">CLIENT</th>
                  <th className="py-3.5 px-4">SYMBOL</th>
                  <th className="py-3.5 px-4">EVENT</th>
                  <th className="py-3.5 px-4">SEVERITY</th>
                  <th className="py-3.5 px-4">DATE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {events.map(ev => (
                  <tr
                    key={ev.eventId}
                    onClick={() => handleToggleEventStatus(ev)}
                    className="hover:bg-[#0c152a] cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{ev.eventId}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{ev.client}</td>
                    <td className="py-3.5 px-4 font-bold text-white font-mono">{ev.symbol}</td>
                    <td className="py-3.5 px-4 text-slate-300">{ev.event}</td>
                    <td className="py-3.5 px-4">{renderSeverityBadge(ev.severity)}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{ev.date}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge(ev.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Risk Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[#2563eb]" />
                <h3 className="text-sm font-bold text-white">Create New Risk Profile</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Profile Name</label>
                <input
                  type="text"
                  required
                  value={newProfileName}
                  onChange={e => setNewProfileName(e.target.value)}
                  placeholder="e.g. Ultra-High Net Worth Scalper"
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Max Order Qty</label>
                  <input
                    type="text"
                    value={newMaxQty}
                    onChange={e => setNewMaxQty(e.target.value)}
                    placeholder="e.g. 250,000"
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Max Exposure ($)</label>
                  <input
                    type="text"
                    value={newMaxExposure}
                    onChange={e => setNewMaxExposure(e.target.value)}
                    placeholder="e.g. $1,000,000"
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Daily Loss Limit ($)</label>
                  <input
                    type="text"
                    value={newDailyLoss}
                    onChange={e => setNewDailyLoss(e.target.value)}
                    placeholder="e.g. $25,000"
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Margin Requirement (%)</label>
                  <input
                    type="text"
                    value={newMarginReq}
                    onChange={e => setNewMarginReq(e.target.value)}
                    placeholder="e.g. 2%"
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-lg text-slate-300 text-[11px]">
                Breaching the daily loss limit or margin requirements automatically triggers RMS auto square-off and freezes order placement.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-semibold"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Risk Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-[#38bdf8]" />
                <h3 className="text-sm font-bold text-white">Edit Profile: {editingProfile.profileId}</h3>
              </div>
              <button onClick={() => setEditingProfile(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditProfile} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Profile Name</label>
                <input
                  type="text"
                  required
                  value={editingProfile.name}
                  onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Max Order Qty</label>
                  <input
                    type="text"
                    value={editingProfile.maxOrderQty}
                    onChange={e => setEditingProfile({ ...editingProfile, maxOrderQty: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Max Exposure</label>
                  <input
                    type="text"
                    value={editingProfile.maxExposure}
                    onChange={e => setEditingProfile({ ...editingProfile, maxExposure: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Daily Loss Limit</label>
                  <input
                    type="text"
                    value={editingProfile.dailyLossLimit}
                    onChange={e => setEditingProfile({ ...editingProfile, dailyLossLimit: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Margin Req</label>
                  <input
                    type="text"
                    value={editingProfile.marginReq}
                    onChange={e => setEditingProfile({ ...editingProfile, marginReq: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
