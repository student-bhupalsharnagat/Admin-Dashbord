import React, { useState } from 'react';
import {
  Plus,
  Eye,
  Pencil,
  Copy,
  X,
  Coins,
  Percent,
  Layers,
  FileText,
  DollarSign,
  CheckCircle2,
  Users,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

export interface CommissionPlanItem {
  planId: string;
  planName: string;
  type: 'PERCENTAGE' | 'TIERED' | 'FIXED';
  rate: string;
  instruments: string;
  users: number;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
  masterShare?: string;
  brokerShare?: string;
}

export interface CommissionRuleItem {
  id: string;
  name: string;
  condition: string;
  split: string;
  masterShare: string;
  brokerShare: string;
  subBrokerShare: string;
  baseRate: string;
  overrideMargin: string;
  enforcedAccounts: number;
  activeSlabs: number;
  instruments: string;
  status: 'ACTIVE' | 'INACTIVE';
  joined: string;
  policyType: string;
  description: string;
}

const initialPlansData: CommissionPlanItem[] = [
  {
    planId: 'CP001',
    planName: 'Standard Retail',
    type: 'PERCENTAGE',
    rate: '0.05%',
    instruments: 'All',
    users: 423,
    status: 'ACTIVE',
    description: 'Default markup on standard retail client trades',
    masterShare: '40%',
    brokerShare: '60%'
  },
  {
    planId: 'CP002',
    planName: 'Premium Broker',
    type: 'TIERED',
    rate: '0.02%-0.04%',
    instruments: 'Forex, Indices',
    users: 12,
    status: 'ACTIVE',
    description: 'Volume-discounted tier structure for high turnover accounts',
    masterShare: '30%',
    brokerShare: '70%'
  },
  {
    planId: 'CP003',
    planName: 'Institutional',
    type: 'FIXED',
    rate: '₹5 per lot',
    instruments: 'All',
    users: 5,
    status: 'ACTIVE',
    description: 'Fixed per-lot commission structure for algorithmic funds',
    masterShare: '25%',
    brokerShare: '75%'
  },
  {
    planId: 'CP004',
    planName: 'Legacy Basic',
    type: 'PERCENTAGE',
    rate: '0.08%',
    instruments: 'Equities',
    users: 58,
    status: 'INACTIVE',
    description: 'Archived equity fee plan superseded by Standard Retail',
    masterShare: '50%',
    brokerShare: '50%'
  }
];

// Commission Splitting Rules Dataset for the Rules tab (Rich schema matching screenshot)
const initialRulesData: CommissionRuleItem[] = [
  {
    id: 'RUL-01',
    name: 'Master Override Rule',
    condition: 'Monthly Turnover > ₹10,000,000',
    split: 'Master takes 15% override',
    masterShare: '40%',
    brokerShare: '40%',
    subBrokerShare: '20%',
    baseRate: '₹25,400',
    overrideMargin: '+15.0%',
    enforcedAccounts: 423,
    activeSlabs: 4,
    instruments: 'All Instruments',
    status: 'ACTIVE',
    joined: '2023-04-01',
    policyType: 'Turnover Slab Incentive',
    description: 'Special 15% override pool directed to Masters when downline turnover exceeds 10 million INR.'
  },
  {
    id: 'RUL-02',
    name: 'Sub-Broker Client Rebate',
    condition: 'Direct Client Acquisition',
    split: 'Sub-Broker retains 65% of broker pool',
    masterShare: '20%',
    brokerShare: '15%',
    subBrokerShare: '65%',
    baseRate: '₹12,800',
    overrideMargin: '+8.5%',
    enforcedAccounts: 184,
    activeSlabs: 2,
    instruments: 'Equities & Derivatives',
    status: 'ACTIVE',
    joined: '2023-03-15',
    policyType: 'Direct Acquisition Bonus',
    description: 'Incentivizes sub-brokers by routing 65% of total brokerage back to originating agent.'
  },
  {
    id: 'RUL-03',
    name: 'Crypto Volatility Surcharge',
    condition: 'Crypto Asset Class Trades',
    split: '10 bps platform charge before splits',
    masterShare: '35%',
    brokerShare: '45%',
    subBrokerShare: '20%',
    baseRate: '₹34,200',
    overrideMargin: '+12.0%',
    enforcedAccounts: 92,
    activeSlabs: 3,
    instruments: 'Crypto (BTC, ETH, USDT)',
    status: 'ACTIVE',
    joined: '2023-02-10',
    policyType: 'Asset Surcharge Policy',
    description: 'Applies automated 10 bps liquidity cushion for high-volatility cryptocurrency order flows.'
  },
  {
    id: 'RUL-04',
    name: 'High-Frequency FX Rebate',
    condition: 'Forex Lots > 500 / week',
    split: '₹5/lot flat rebate to executing broker',
    masterShare: '30%',
    brokerShare: '50%',
    subBrokerShare: '20%',
    baseRate: '₹41,500',
    overrideMargin: '+18.2%',
    enforcedAccounts: 58,
    activeSlabs: 5,
    instruments: 'Forex Pairs (EUR/INR, USD/INR)',
    status: 'ACTIVE',
    joined: '2023-01-20',
    policyType: 'Volume Tier Discount',
    description: 'Volume-based tiered rebate for ultra-low latency institutional currency trading.'
  }
];

// Distribution Performance curve data matching Screenshot
const defaultRuleCurveData = [
  { month: 'Jan', value: 88500 },
  { month: 'Feb', value: 90200 },
  { month: 'Mar', value: 89800 },
  { month: 'Apr', value: 92400 },
  { month: 'May', value: 96800 },
  { month: 'Jun', value: 105200 }
];

// Commission Payout Transactions Dataset for Transactions tab
const initialCommissionTxns = [
  { id: 'COM-901', beneficiary: 'Apex Capital Group', role: 'Master', amount: '₹241,000', period: 'May 2023', status: 'PAID', date: '2023-06-05' },
  { id: 'COM-902', beneficiary: 'Ryan Chen', role: 'Broker', amount: '₹142,500', period: 'May 2023', status: 'PAID', date: '2023-06-05' },
  { id: 'COM-903', beneficiary: 'Priya Sharma', role: 'Broker', amount: '₹89,200', period: 'May 2023', status: 'PAID', date: '2023-06-05' },
  { id: 'COM-904', beneficiary: 'Tom Anderson', role: 'Sub-Broker', amount: '₹24,800', period: 'May 2023', status: 'PAID', date: '2023-06-05' }
];

interface CommissionViewProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const CommissionView: React.FC<CommissionViewProps> = ({ onNotify }) => {
  const [plans, setPlans] = useState<CommissionPlanItem[]>(initialPlansData);
  const [activeTab, setActiveTab] = useState<'plans' | 'rules' | 'transactions'>('plans');

  const [selectedPlan, setSelectedPlan] = useState<CommissionPlanItem | null>(null);
  const [editingPlan, setEditingPlan] = useState<CommissionPlanItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanType, setNewPlanType] = useState<'PERCENTAGE' | 'TIERED' | 'FIXED'>('PERCENTAGE');
  const [newPlanRate, setNewPlanRate] = useState('');
  const [newPlanInstruments, setNewPlanInstruments] = useState('All');

  // Rules state matching Screenshot 2026-09-11 001527.png
  const [rulesList, setRulesList] = useState<CommissionRuleItem[]>(initialRulesData);
  const [selectedRule, setSelectedRule] = useState<CommissionRuleItem>(initialRulesData[0]);
  const [ruleSubTab, setRuleSubTab] = useState<
    'Overview' | 'Hierarchy Splits' | 'Slab Tiers' | 'Applicable Instruments' | 'Enforced Accounts' | 'Audit History'
  >('Overview');
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRuleItem | null>(null);

  // Form states for creating rule
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleMasterShare, setNewRuleMasterShare] = useState('40%');
  const [newRuleBrokerShare, setNewRuleBrokerShare] = useState('40%');
  const [newRuleSubBrokerShare, setNewRuleSubBrokerShare] = useState('20%');
  const [newRuleInstruments, setNewRuleInstruments] = useState('All Instruments');
  const [newRulePolicyType, setNewRulePolicyType] = useState('Turnover Slab Incentive');

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const handleToggleRuleStatus = () => {
    const updatedStatus = selectedRule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const updatedRule = { ...selectedRule, status: updatedStatus as 'ACTIVE' | 'INACTIVE' };
    setSelectedRule(updatedRule);
    setRulesList(prev => prev.map(r => r.id === selectedRule.id ? updatedRule : r));
    notify(`Rule ${selectedRule.id} status changed to ${updatedStatus}`, updatedStatus === 'ACTIVE' ? 'success' : 'warning');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRuleCondition.trim()) {
      notify('Please enter rule name and trigger condition', 'warning');
      return;
    }

    const newId = `RUL-0${rulesList.length + 1}`;
    const newRule: CommissionRuleItem = {
      id: newId,
      name: newRuleName,
      condition: newRuleCondition,
      split: `Master: ${newRuleMasterShare}, Broker: ${newRuleBrokerShare}, Sub-Broker: ${newRuleSubBrokerShare}`,
      masterShare: newRuleMasterShare,
      brokerShare: newRuleBrokerShare,
      subBrokerShare: newRuleSubBrokerShare,
      baseRate: '₹28,000',
      overrideMargin: '+14.5%',
      enforcedAccounts: 45,
      activeSlabs: 3,
      instruments: newRuleInstruments,
      status: 'ACTIVE',
      joined: new Date().toISOString().split('T')[0],
      policyType: newRulePolicyType,
      description: `Custom policy rule governing ${newRuleCondition}`
    };

    setRulesList(prev => [...prev, newRule]);
    setSelectedRule(newRule);
    notify(`Commission rule ${newRuleName} (${newId}) created successfully!`, 'success');
    setShowCreateRuleModal(false);
    setNewRuleName('');
    setNewRuleCondition('');
  };

  const handleUpdateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    setRulesList(prev => prev.map(r => r.id === editingRule.id ? editingRule : r));
    if (selectedRule.id === editingRule.id) {
      setSelectedRule(editingRule);
    }
    notify(`Rule ${editingRule.id} updated successfully!`, 'success');
    setEditingRule(null);
  };

  const CustomRuleChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#091122] border border-[#162238] rounded-lg p-2.5 shadow-xl text-xs font-mono">
          <p className="text-slate-400 font-sans font-medium">{label} 2023</p>
          <p className="text-emerald-400 font-bold mt-0.5">
            ₹{payload[0].value.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Distributed Overrides</p>
        </div>
      );
    }
    return null;
  };

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim() || !newPlanRate.trim()) {
      notify('Please enter plan name and rate', 'warning');
      return;
    }

    const newId = `CP00${plans.length + 1}`;
    const newPlan: CommissionPlanItem = {
      planId: newId,
      planName: newPlanName,
      type: newPlanType,
      rate: newPlanRate,
      instruments: newPlanInstruments,
      users: 0,
      status: 'ACTIVE',
      description: 'Custom fee plan created by Super Admin',
      masterShare: '35%',
      brokerShare: '65%'
    };

    setPlans(prev => [...prev, newPlan]);
    notify(`Commission plan ${newPlanName} (${newId}) created successfully!`, 'success');
    setShowCreateModal(false);
    setNewPlanName('');
    setNewPlanRate('');
  };

  const handleDuplicatePlan = (plan: CommissionPlanItem) => {
    const newId = `CP00${plans.length + 1}`;
    const cloned: CommissionPlanItem = {
      ...plan,
      planId: newId,
      planName: `${plan.planName} (Copy)`,
      users: 0,
      status: 'ACTIVE'
    };
    setPlans(prev => [...prev, cloned]);
    notify(`Cloned ${plan.planName} as ${cloned.planName} (${newId})`, 'success');
  };

  const handleUpdatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setPlans(prev => prev.map(p => (p.planId === editingPlan.planId ? editingPlan : p)));
    notify(`Updated commission plan ${editingPlan.planName}`, 'success');
    setEditingPlan(null);
  };

  const renderTypeBadge = (type: 'PERCENTAGE' | 'TIERED' | 'FIXED') => {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#0d233a] border border-[#0369a1] text-[#38bdf8]">
        {type}
      </span>
    );
  };

  const renderStatusBadge = (status: 'ACTIVE' | 'INACTIVE') => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          ACTIVE
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
      {/* Breadcrumb matching Screenshot 7 */}
      <div className="text-xs text-slate-400">
        <span className="text-slate-500">Dashboard</span>
        <span className="mx-2 text-slate-600">&gt;</span>
        <span className="text-slate-300 font-medium">Commission Management</span>
      </div>

      {/* Header + Create Plan Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white tracking-tight">Commission Management</h1>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563eb] hover:bg-blue-600 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
        >
          <Plus size={14} />
          Create Plan
        </button>
      </div>

      {/* Tabs: Plans | Rules | Transactions */}
      <div className="border-b border-[#131e36] flex items-center gap-6 text-sm">
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 font-semibold transition-colors relative ${
            activeTab === 'plans' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Plans
          {activeTab === 'plans' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 font-semibold transition-colors relative ${
            activeTab === 'rules' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Rules
          {activeTab === 'rules' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 font-semibold transition-colors relative ${
            activeTab === 'transactions' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Transactions
          {activeTab === 'transactions' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
          )}
        </button>
      </div>

      {/* Tab 1: Plans Table matching Screenshot 7 */}
      {activeTab === 'plans' && (
        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[860px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">PLAN ID</th>
                  <th className="py-3.5 px-4">PLAN NAME</th>
                  <th className="py-3.5 px-4">TYPE</th>
                  <th className="py-3.5 px-4">RATE</th>
                  <th className="py-3.5 px-4">INSTRUMENTS</th>
                  <th className="py-3.5 px-4">USERS</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {plans.map(item => (
                  <tr key={item.planId} className="hover:bg-[#0c152a] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{item.planId}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{item.planName}</td>
                    <td className="py-3.5 px-4">{renderTypeBadge(item.type)}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 font-semibold">{item.rate}</td>
                    <td className="py-3.5 px-4 text-slate-300">{item.instruments}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-200">{item.users}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2.5 text-slate-400">
                        {/* Eye icon: View plan details */}
                        <button
                          onClick={() => setSelectedPlan(item)}
                          title="View Plan Details"
                          className="p-1 hover:text-white transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        {/* Pencil icon: Edit plan */}
                        <button
                          onClick={() => setEditingPlan(item)}
                          title="Edit Plan"
                          className="p-1 hover:text-cyan-400 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        {/* Copy icon: Duplicate plan */}
                        <button
                          onClick={() => handleDuplicatePlan(item)}
                          title="Clone Plan"
                          className="p-1 hover:text-emerald-400 transition-colors"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Rules Dashboard & Specification (Matches Screenshot 2026-09-11 001527.png) */}
      {activeTab === 'rules' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* 1. HERO CARD (Matches Screenshot exactly) */}
          <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-6">
            {/* Top Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                {/* Avatar / Icon Block */}
                <div className="w-11 h-11 rounded-lg bg-[#06261f] border border-[#065f46] flex items-center justify-center text-[#34d399] font-bold text-lg shrink-0">
                  {selectedRule.name.charAt(0).toUpperCase()}
                </div>

                {/* Title, Badges, Condition, and Hierarchy Lineage */}
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {selectedRule.name}
                    </h1>
                    {selectedRule.status === 'ACTIVE' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
                        INACTIVE
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#092238] border border-[#0369a1] text-[#38bdf8]">
                      POLICY: ENFORCED
                    </span>
                  </div>

                  {/* Subtitle / condition */}
                  <p className="text-xs text-slate-400 font-mono">
                    ID: <span className="text-[#38bdf8] font-semibold">{selectedRule.id}</span> • Condition: <span className="text-amber-400">{selectedRule.condition}</span>
                  </p>

                  {/* Hierarchy lineage (matching screenshot) */}
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-300 font-semibold">{selectedRule.id}</span>
                    <span>•</span>
                    <span className="text-blue-400">Master ({selectedRule.masterShare})</span>
                    <span>&rarr;</span>
                    <span className="text-emerald-400">Broker ({selectedRule.brokerShare})</span>
                    <span>&rarr;</span>
                    <span className="text-purple-400">Sub-Broker ({selectedRule.subBrokerShare})</span>
                  </p>
                </div>
              </div>

              {/* Action buttons (top right) */}
              <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
                <button
                  onClick={() => setEditingRule(selectedRule)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#0e192f] hover:bg-[#152342] text-slate-300 hover:text-white rounded-lg border border-[#1a2947] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Pencil size={13} />
                  <span>Edit Rule</span>
                </button>

                <button
                  onClick={handleToggleRuleStatus}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                    selectedRule.status === 'ACTIVE'
                      ? 'bg-[#1e1018] hover:bg-[#2b1622] text-[#f87171] border-[#551d26]'
                      : 'bg-[#09221b] hover:bg-[#0e352a] text-[#34d399] border-[#0f543e]'
                  }`}
                >
                  <AlertTriangle size={13} />
                  <span>{selectedRule.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</span>
                </button>

                <button
                  onClick={() => setShowCreateRuleModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Create Rule</span>
                </button>
              </div>
            </div>

            {/* 4 Metric Cards (Identical styling to Screenshot) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="bg-[#091122] border border-[#142038] rounded-lg p-3.5 space-y-1">
                <p className="text-[11px] text-slate-400 font-medium">Base Distribution Slab</p>
                <p className="text-lg font-bold text-white font-mono">{selectedRule.baseRate}</p>
              </div>
              <div className="bg-[#091122] border border-[#142038] rounded-lg p-3.5 space-y-1">
                <p className="text-[11px] text-slate-400 font-medium">Net Override Pool</p>
                <p className="text-lg font-bold text-[#34d399] font-mono">{selectedRule.overrideMargin}</p>
              </div>
              <div className="bg-[#091122] border border-[#142038] rounded-lg p-3.5 space-y-1">
                <p className="text-[11px] text-slate-400 font-medium">Enforced Accounts</p>
                <p className="text-lg font-bold text-white font-mono">{selectedRule.enforcedAccounts}</p>
              </div>
              <div className="bg-[#091122] border border-[#142038] rounded-lg p-3.5 space-y-1">
                <p className="text-[11px] text-slate-400 font-medium">Active Slabs</p>
                <p className="text-lg font-bold text-white font-mono">{selectedRule.activeSlabs}</p>
              </div>
            </div>
          </div>

          {/* 2. SUB-TABS (Matches Screenshot Tab Design) */}
          <div className="border-b border-[#131e36] flex items-center gap-1 sm:gap-4 overflow-x-auto text-xs font-medium scrollbar-none">
            {[
              'Overview',
              'Hierarchy Splits',
              'Slab Tiers',
              'Applicable Instruments',
              'Enforced Accounts',
              'Audit History'
            ].map(tab => (
              <button
                key={tab}
                onClick={() => setRuleSubTab(tab as any)}
                className={`py-2.5 px-3 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  ruleSubTab === tab
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* 3. TAB PANELS */}
          {ruleSubTab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Distribution Performance (Matches Portfolio Performance in Screenshot) */}
              <div className="lg:col-span-7 bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Distribution Performance</h3>
                    <p className="text-[11px] text-slate-400">Monthly override volume & payout realization</p>
                  </div>
                  <div className="flex items-center gap-1 bg-[#091122] border border-[#142038] p-1 rounded-lg text-[10px]">
                    {['1D', '1W', '1M', '1Y', 'ALL'].map(tf => (
                      <span
                        key={tf}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          tf === '1M' ? 'bg-[#1d4ed8] text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tf}
                      </span>
                    ))}
                  </div>
                </div>

                {/* AreaChart matching Screenshot 2026-09-11 001527.png */}
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={defaultRuleCurveData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="rulePerfGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="month"
                        stroke="#475569"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1e293b' }}
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={11}
                        tickLine={false}
                        axisLine={{ stroke: '#1e293b' }}
                        domain={[0, 120000]}
                        ticks={[0, 30000, 60000, 90000, 120000]}
                        tickFormatter={(val) => val === 0 ? '0' : `${val}`}
                      />
                      <Tooltip content={<CustomRuleChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={2.2}
                        fillOpacity={1}
                        fill="url(#rulePerfGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom summary stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#131e36]/60 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500">6M Avg Volume</p>
                    <p className="text-xs font-bold text-white font-mono">₹93,816</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Fulfillment</p>
                    <p className="text-xs font-bold text-emerald-400 font-mono">99.8%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Slab Status</p>
                    <p className="text-xs font-bold text-[#38bdf8] font-mono">OPTIMAL</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Rule Information (Matches Client Information in Screenshot) */}
              <div className="lg:col-span-5 bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#131e36]">
                  <h3 className="text-sm font-bold text-white tracking-tight">Rule Information</h3>
                  <span className="text-[11px] font-mono text-[#38bdf8] bg-[#092238] border border-[#0369a1] px-2 py-0.5 rounded">
                    {selectedRule.id}
                  </span>
                </div>

                <div className="divide-y divide-[#131e36]/60 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Rule ID</span>
                    <span className="text-slate-200 font-mono font-semibold">{selectedRule.id}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Policy Type</span>
                    <span className="text-slate-200 font-medium">{selectedRule.policyType}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Trigger Condition</span>
                    <span className="text-amber-400 font-mono font-medium">{selectedRule.condition}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Master Split</span>
                    <span className="text-blue-400 font-bold font-mono">{selectedRule.masterShare} (Override Pool)</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Broker Split</span>
                    <span className="text-emerald-400 font-bold font-mono">{selectedRule.brokerShare} (Direct Execution)</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Sub-Broker Split</span>
                    <span className="text-purple-400 font-bold font-mono">{selectedRule.subBrokerShare} (Originating Agent)</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Applicable Assets</span>
                    <span className="text-slate-300 font-medium">{selectedRule.instruments}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-400">Enacted / Joined</span>
                    <span className="text-slate-300 font-mono">{selectedRule.joined}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab: Hierarchy Splits */}
          {ruleSubTab === 'Hierarchy Splits' && (
            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Commission Split Architecture</h3>
                <p className="text-xs text-slate-400 mt-0.5">Automated multi-tier revenue distribution flowchart for {selectedRule.name}</p>
              </div>

              {/* Visual Split Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Gross Split Distribution</span>
                  <span>100% Volume Pool</span>
                </div>
                <div className="h-6 w-full rounded-lg overflow-hidden flex font-mono text-[11px] font-bold text-white text-center leading-6">
                  <div style={{ width: selectedRule.masterShare }} className="bg-blue-600 hover:bg-blue-500 transition-colors">
                    Master ({selectedRule.masterShare})
                  </div>
                  <div style={{ width: selectedRule.brokerShare }} className="bg-emerald-600 hover:bg-emerald-500 transition-colors">
                    Broker ({selectedRule.brokerShare})
                  </div>
                  <div style={{ width: selectedRule.subBrokerShare }} className="bg-purple-600 hover:bg-purple-500 transition-colors">
                    Sub ({selectedRule.subBrokerShare})
                  </div>
                </div>
              </div>

              {/* Tier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-[#091122] border border-blue-900/40 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase">Tier 1: Master Pool</span>
                    <span className="text-base font-bold text-white font-mono">{selectedRule.masterShare}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Allocated directly to Master account for governance, licensing cushion, and network oversight.
                  </p>
                </div>
                <div className="bg-[#091122] border border-emerald-900/40 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase">Tier 2: Broker Execution</span>
                    <span className="text-base font-bold text-white font-mono">{selectedRule.brokerShare}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Disbursed to primary executing broker responsible for clearing and risk monitoring.
                  </p>
                </div>
                <div className="bg-[#091122] border border-purple-900/40 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 uppercase">Tier 3: Sub-Broker</span>
                    <span className="text-base font-bold text-white font-mono">{selectedRule.subBrokerShare}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Rebate credited to introducing sub-broker or franchise branch on trade settlement.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab: Slab Tiers */}
          {ruleSubTab === 'Slab Tiers' && (
            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Turnover Slabs Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-3">SLAB LEVEL</th>
                      <th className="py-2.5 px-3">TURNOVER RANGE</th>
                      <th className="py-2.5 px-3">EFFECTIVE SPLIT</th>
                      <th className="py-2.5 px-3">BONUS REBATE</th>
                      <th className="py-2.5 px-3">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#131e36]/60">
                    <tr className="hover:bg-[#0c152a]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#38bdf8]">SLAB-A</td>
                      <td className="py-2.5 px-3 text-slate-200">₹0 - ₹2,500,000</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">50% Master / 50% Broker</td>
                      <td className="py-2.5 px-3 text-slate-400">None</td>
                      <td className="py-2.5 px-3"><span className="text-emerald-400 font-bold">ACTIVE</span></td>
                    </tr>
                    <tr className="hover:bg-[#0c152a]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#38bdf8]">SLAB-B</td>
                      <td className="py-2.5 px-3 text-slate-200">₹2,500,000 - ₹10,000,000</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">45% Master / 45% Broker / 10% Sub</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-mono">+2.5 bps</td>
                      <td className="py-2.5 px-3"><span className="text-emerald-400 font-bold">ACTIVE</span></td>
                    </tr>
                    <tr className="hover:bg-[#0c152a]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#38bdf8]">SLAB-C (Current)</td>
                      <td className="py-2.5 px-3 text-slate-200">&gt; ₹10,000,000</td>
                      <td className="py-2.5 px-3 font-mono text-[#38bdf8]">40% Master / 40% Broker / 20% Sub</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-mono">+15% Override Pool</td>
                      <td className="py-2.5 px-3"><span className="text-emerald-400 font-bold">ENFORCED</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab: Applicable Instruments */}
          {ruleSubTab === 'Applicable Instruments' && (
            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Instrument Coverage & Multipliers</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { name: 'Equity Cash & Intraday', code: 'EQ', rate: '0.05%', multiplier: '1.0x', status: 'Enforced' },
                  { name: 'Index & Stock Options', code: 'OPT', rate: '₹20/lot', multiplier: '1.2x', status: 'Enforced' },
                  { name: 'Currency Derivatives', code: 'FX', rate: '0.02%', multiplier: '0.9x', status: 'Enforced' },
                  { name: 'Cryptocurrency Pairs', code: 'CRYPTO', rate: '0.10%', multiplier: '1.5x', status: 'Enforced' }
                ].map(item => (
                  <div key={item.code} className="bg-[#091122] border border-[#142038] rounded-lg p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.name}</span>
                      <span className="text-[10px] font-mono text-[#38bdf8] bg-[#092238] px-1.5 py-0.5 rounded">{item.code}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">Standard Rate: {item.rate}</p>
                    <p className="text-[11px] text-emerald-400 font-semibold">Multiplier: {item.multiplier} • {item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-tab: Enforced Accounts */}
          {ruleSubTab === 'Enforced Accounts' && (
            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Enrolled Brokerage Entities</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-3">ACCOUNT ID</th>
                      <th className="py-2.5 px-3">ENTITY NAME</th>
                      <th className="py-2.5 px-3">ROLE</th>
                      <th className="py-2.5 px-3">MONTHLY VOLUME</th>
                      <th className="py-2.5 px-3">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#131e36]/60">
                    <tr className="hover:bg-[#0c152a]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#38bdf8]">MST-001</td>
                      <td className="py-2.5 px-3 text-white font-semibold">Apex Capital Group</td>
                      <td className="py-2.5 px-3 text-blue-400">Master</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">₹42,800,000</td>
                      <td className="py-2.5 px-3"><span className="text-emerald-400 font-bold">ACTIVE</span></td>
                    </tr>
                    <tr className="hover:bg-[#0c152a]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#38bdf8]">BRK-102</td>
                      <td className="py-2.5 px-3 text-white font-semibold">Ryan Chen</td>
                      <td className="py-2.5 px-3 text-emerald-400">Broker</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">₹18,500,000</td>
                      <td className="py-2.5 px-3"><span className="text-emerald-400 font-bold">ACTIVE</span></td>
                    </tr>
                    <tr className="hover:bg-[#0c152a]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#38bdf8]">SUB-304</td>
                      <td className="py-2.5 px-3 text-white font-semibold">Tom Anderson</td>
                      <td className="py-2.5 px-3 text-purple-400">Sub-Broker</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">₹4,200,000</td>
                      <td className="py-2.5 px-3"><span className="text-emerald-400 font-bold">ACTIVE</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab: Audit History */}
          {ruleSubTab === 'Audit History' && (
            <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Compliance & Policy Audit Trail</h3>
              <div className="space-y-2.5 text-xs">
                {[
                  { action: 'Policy Override Rate Adjusted', user: 'Super Admin', time: '2023-06-01 14:22 UTC', hash: '8f92a1c' },
                  { action: 'Slab-C Turnover Threshold Enforced', user: 'Risk Officer', time: '2023-05-18 09:15 UTC', hash: '4b11f09' },
                  { action: 'Rule Initialized & Provisioned', user: 'System Deployer', time: '2023-04-01 00:00 UTC', hash: '1e37bc4' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#091122] border border-[#142038]">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-white">{item.action}</p>
                      <p className="text-[11px] text-slate-400">Initiator: {item.user} • {item.time}</p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{item.hash}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. ALL COMMISSION RULES DIRECTORY (Selectable List) */}
          <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm space-y-2">
            <div className="p-4 border-b border-[#131e36] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Commission Splitting Rules Directory</h3>
                <p className="text-[11px] text-slate-400">Select any rule below to load its performance metrics and parameters into the dashboard</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">{rulesList.length} Rules Configured</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">RULE ID</th>
                    <th className="py-3.5 px-4">RULE NAME</th>
                    <th className="py-3.5 px-4">TRIGGER CONDITION</th>
                    <th className="py-3.5 px-4">SPLIT BREAKDOWN</th>
                    <th className="py-3.5 px-4">ACCOUNTS</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#131e36]/60">
                  {rulesList.map(rule => (
                    <tr
                      key={rule.id}
                      onClick={() => setSelectedRule(rule)}
                      className={`hover:bg-[#0c152a] transition-colors cursor-pointer ${
                        selectedRule.id === rule.id ? 'bg-[#0b162c] border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{rule.id}</td>
                      <td className="py-3.5 px-4 font-bold text-white">{rule.name}</td>
                      <td className="py-3.5 px-4 font-mono text-amber-400">{rule.condition}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        M:{rule.masterShare} / B:{rule.brokerShare} / S:{rule.subBrokerShare}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-200">{rule.enforcedAccounts}</td>
                      <td className="py-3.5 px-4">
                        {rule.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
                            INACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRule(rule);
                            }}
                            title="Inspect in Dashboard"
                            className="p-1 hover:text-blue-400 transition-colors cursor-pointer"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRule(rule);
                            }}
                            title="Edit Rule"
                            className="p-1 hover:text-amber-400 transition-colors cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Transactions Table */}
      {activeTab === 'transactions' && (
        <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">PAYOUT ID</th>
                  <th className="py-3.5 px-4">BENEFICIARY</th>
                  <th className="py-3.5 px-4">ROLE</th>
                  <th className="py-3.5 px-4">AMOUNT</th>
                  <th className="py-3.5 px-4">PERIOD</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">DISBURSED DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#131e36]/60">
                {initialCommissionTxns.map(t => (
                  <tr key={t.id} className="hover:bg-[#0c152a] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{t.id}</td>
                    <td className="py-3.5 px-4 font-bold text-white">{t.beneficiary}</td>
                    <td className="py-3.5 px-4 text-slate-300">{t.role}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#34d399]">{t.amount}</td>
                    <td className="py-3.5 px-4 text-slate-400">{t.period}</td>
                    <td className="py-3.5 px-4">{renderStatusBadge('ACTIVE')}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Plan Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                  <Coins size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Commission Plan Blueprint</h3>
                  <p className="text-[11px] text-slate-400">{selectedPlan.planId} • {selectedPlan.planName}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPlan(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Plan Type</span>
                  <div className="mt-0.5">{renderTypeBadge(selectedPlan.type)}</div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
                  <div className="mt-0.5">{renderStatusBadge(selectedPlan.status)}</div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Standard Rate</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm">{selectedPlan.rate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Enrolled Users</span>
                  <span className="font-mono text-white font-bold">{selectedPlan.users} Accounts</span>
                </div>
              </div>

              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Applicable Instruments</span>
                  <span className="font-semibold text-slate-200">{selectedPlan.instruments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Master Revenue Share</span>
                  <span className="font-mono text-cyan-400 font-semibold">{selectedPlan.masterShare || '35%'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Broker Direct Share</span>
                  <span className="font-mono text-emerald-400 font-semibold">{selectedPlan.brokerShare || '65%'}</span>
                </div>
                <div className="border-t border-[#162238] pt-2 text-slate-400">
                  <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Plan Description</span>
                  <p className="text-slate-300 leading-relaxed">{selectedPlan.description}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-end">
              <button
                onClick={() => setSelectedPlan(null)}
                className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-[#2563eb]" />
                <h3 className="text-sm font-bold text-white">Create Commission Plan</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Plan Name</label>
                <input
                  type="text"
                  required
                  value={newPlanName}
                  onChange={e => setNewPlanName(e.target.value)}
                  placeholder="e.g. VIP Scalper Spread"
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Plan Type</label>
                  <select
                    value={newPlanType}
                    onChange={e => setNewPlanType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="PERCENTAGE">PERCENTAGE</option>
                    <option value="TIERED">TIERED</option>
                    <option value="FIXED">FIXED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Markup Rate</label>
                  <input
                    type="text"
                    required
                    value={newPlanRate}
                    onChange={e => setNewPlanRate(e.target.value)}
                    placeholder="e.g. 0.03% or ₹4/lot"
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Applicable Instruments</label>
                <input
                  type="text"
                  value={newPlanInstruments}
                  onChange={e => setNewPlanInstruments(e.target.value)}
                  placeholder="e.g. All, Forex, Indices, Crypto"
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-lg text-slate-300 text-[11px]">
                Commission plans automatically apply to enrolled Master, Broker, and Sub-Broker client trading accounts.
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
                  Save &amp; Activate Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-[#38bdf8]" />
                <h3 className="text-sm font-bold text-white">Edit Plan: {editingPlan.planId}</h3>
              </div>
              <button onClick={() => setEditingPlan(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Plan Name</label>
                <input
                  type="text"
                  required
                  value={editingPlan.planName}
                  onChange={e => setEditingPlan({ ...editingPlan, planName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Rate</label>
                  <input
                    type="text"
                    required
                    value={editingPlan.rate}
                    onChange={e => setEditingPlan({ ...editingPlan, rate: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Status</label>
                  <select
                    value={editingPlan.status}
                    onChange={e => setEditingPlan({ ...editingPlan, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Instruments</label>
                <input
                  type="text"
                  value={editingPlan.instruments}
                  onChange={e => setEditingPlan({ ...editingPlan, instruments: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
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

      {/* Create Rule Modal */}
      {showCreateRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#06261f] border border-[#065f46] flex items-center justify-center text-[#34d399]">
                  <Sliders size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Commission Sharing Rule</h3>
                  <p className="text-[11px] text-slate-400">Configure automated multi-tier override & rebate policy</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateRuleModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Master High Volume Bonus"
                  value={newRuleName}
                  onChange={e => setNewRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Policy Type</label>
                  <select
                    value={newRulePolicyType}
                    onChange={e => setNewRulePolicyType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Turnover Slab Incentive">Turnover Slab Incentive</option>
                    <option value="Direct Acquisition Bonus">Direct Acquisition Bonus</option>
                    <option value="Asset Surcharge Policy">Asset Surcharge Policy</option>
                    <option value="Volume Tier Discount">Volume Tier Discount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Instruments</label>
                  <input
                    type="text"
                    placeholder="e.g. All Instruments, Forex, Equities"
                    value={newRuleInstruments}
                    onChange={e => setNewRuleInstruments(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Trigger Condition</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Turnover > ₹15,000,000"
                  value={newRuleCondition}
                  onChange={e => setNewRuleCondition(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2">
                <span className="text-slate-400 block text-[11px] font-bold uppercase">Sharing Splits (%)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-blue-400 block font-semibold mb-1">Master Share</label>
                    <input
                      type="text"
                      value={newRuleMasterShare}
                      onChange={e => setNewRuleMasterShare(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[#091122] border border-[#162238] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 block font-semibold mb-1">Broker Share</label>
                    <input
                      type="text"
                      value={newRuleBrokerShare}
                      onChange={e => setNewRuleBrokerShare(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[#091122] border border-[#162238] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-400 block font-semibold mb-1">Sub-Broker Share</label>
                    <input
                      type="text"
                      value={newRuleSubBrokerShare}
                      onChange={e => setNewRuleSubBrokerShare(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[#091122] border border-[#162238] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateRuleModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-semibold shadow-sm"
                >
                  Deploy Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                  <Pencil size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Commission Rule</h3>
                  <p className="text-[11px] text-slate-400">{editingRule.id} • {editingRule.name}</p>
                </div>
              </div>
              <button onClick={() => setEditingRule(null)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateRule} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={e => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Trigger Condition</label>
                <input
                  type="text"
                  value={editingRule.condition}
                  onChange={e => setEditingRule({ ...editingRule, condition: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2">
                <span className="text-slate-400 block text-[11px] font-bold uppercase">Adjust Sharing Splits (%)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-blue-400 block font-semibold mb-1">Master</label>
                    <input
                      type="text"
                      value={editingRule.masterShare}
                      onChange={e => setEditingRule({ ...editingRule, masterShare: e.target.value })}
                      className="w-full px-2 py-1.5 bg-[#091122] border border-[#162238] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 block font-semibold mb-1">Broker</label>
                    <input
                      type="text"
                      value={editingRule.brokerShare}
                      onChange={e => setEditingRule({ ...editingRule, brokerShare: e.target.value })}
                      className="w-full px-2 py-1.5 bg-[#091122] border border-[#162238] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-purple-400 block font-semibold mb-1">Sub-Broker</label>
                    <input
                      type="text"
                      value={editingRule.subBrokerShare}
                      onChange={e => setEditingRule({ ...editingRule, subBrokerShare: e.target.value })}
                      className="w-full px-2 py-1.5 bg-[#091122] border border-[#162238] rounded text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Instruments</label>
                  <input
                    type="text"
                    value={editingRule.instruments}
                    onChange={e => setEditingRule({ ...editingRule, instruments: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Status</label>
                  <select
                    value={editingRule.status}
                    onChange={e => setEditingRule({ ...editingRule, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[#0c162b] border border-[#162238] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white font-semibold shadow-sm"
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
