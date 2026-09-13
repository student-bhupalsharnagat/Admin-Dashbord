import React, { useState } from 'react';
import {
  Check,
  X,
  CreditCard,
  Shield,
  Download,
  Calendar,
  AlertCircle,
  Building,
  Users,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: string;
  popular?: boolean;
  features: PlanFeature[];
}

const PLANS: PlanItem[] = [
  {
    id: 'basic',
    name: 'BASIC',
    price: 299,
    currency: '₹',
    billingPeriod: '/monthly',
    popular: false,
    features: [
      { name: 'Up to 5 Brokers', included: true },
      { name: 'Up to 200 Clients', included: true },
      { name: 'API Access', included: false },
      { name: 'Basic Reports', included: true },
      { name: 'White Label', included: false },
      { name: 'Email Support', included: true }
    ]
  },
  {
    id: 'professional',
    name: 'PROFESSIONAL',
    price: 799,
    currency: '₹',
    billingPeriod: '/monthly',
    popular: true,
    features: [
      { name: 'Up to 25 Brokers', included: true },
      { name: 'Up to 1000 Clients', included: true },
      { name: 'API Access', included: true },
      { name: 'Advanced Reports', included: true },
      { name: 'White Label', included: true },
      { name: 'Priority Support', included: true }
    ]
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: 2499,
    currency: '₹',
    billingPeriod: '/monthly',
    popular: false,
    features: [
      { name: 'Unlimited Brokers', included: true },
      { name: 'Unlimited Clients', included: true },
      { name: 'API Access', included: true },
      { name: 'Custom Reports', included: true },
      { name: 'White Label', included: true },
      { name: 'Dedicated Support', included: true }
    ]
  }
];

interface ActiveSubscription {
  id: string;
  tenantName: string;
  plan: string;
  monthlyFee: string;
  renewalDate: string;
  brokersUsed: number;
  brokersLimit: number | string;
  clientsUsed: number;
  clientsLimit: number | string;
  status: 'ACTIVE' | 'PENDING_RENEWAL' | 'TRIAL';
}

const INITIAL_SUBSCRIPTIONS: ActiveSubscription[] = [
  {
    id: 'SUB-001',
    tenantName: 'TradeMatrix Primary',
    plan: 'PROFESSIONAL',
    monthlyFee: '₹799/mo',
    renewalDate: '2026-10-01',
    brokersUsed: 14,
    brokersLimit: 25,
    clientsUsed: 420,
    clientsLimit: 1000,
    status: 'ACTIVE'
  },
  {
    id: 'SUB-002',
    tenantName: 'Alpha Prime Capital',
    plan: 'ENTERPRISE',
    monthlyFee: '₹2,499/mo',
    renewalDate: '2026-11-15',
    brokersUsed: 38,
    brokersLimit: 'Unlimited',
    clientsUsed: 2150,
    clientsLimit: 'Unlimited',
    status: 'ACTIVE'
  },
  {
    id: 'SUB-003',
    tenantName: 'Zenith Broking',
    plan: 'BASIC',
    monthlyFee: '₹299/mo',
    renewalDate: '2026-09-28',
    brokersUsed: 4,
    brokersLimit: 5,
    clientsUsed: 188,
    clientsLimit: 200,
    status: 'PENDING_RENEWAL'
  }
];

interface SubscriptionsViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({ onNotify }) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'subscriptions'>('plans');
  const [currentPlan, setCurrentPlan] = useState<string>('PROFESSIONAL');
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanItem | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const handleConfirmPlan = () => {
    if (!selectedPlanForModal) return;
    setCurrentPlan(selectedPlanForModal.name);
    setSelectedPlanForModal(null);
    onNotify?.(`Successfully subscribed to the ${selectedPlanForModal.name} Plan!`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Subscriptions & Plans</h1>
      </div>

      {/* Tabs matching Screenshot 4 */}
      <div className="flex items-center gap-6 border-b border-[#142038] text-xs font-medium">
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 relative transition-colors cursor-pointer ${
            activeTab === 'plans' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Plans</span>
          {activeTab === 'plans' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-3 relative transition-colors cursor-pointer ${
            activeTab === 'subscriptions' ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Subscriptions</span>
          {activeTab === 'subscriptions' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb]" />
          )}
        </button>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(plan => {
              const isPopular = plan.popular;
              const isCurrent = currentPlan === plan.name;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-[#0b1328] rounded-xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 ${
                    isPopular
                      ? 'border-2 border-[#2563eb] shadow-xl shadow-blue-500/5'
                      : 'border border-[#142038] hover:border-[#1d2d50]'
                  }`}
                >
                  {/* Popular Pill Badge on top edge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2563eb] text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-md">
                      Popular
                    </div>
                  )}

                  <div>
                    {/* Plan Name */}
                    <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-3">
                      {plan.name}
                    </h3>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-3xl font-extrabold text-white tracking-tight">
                        {plan.currency}{plan.price}
                      </span>
                      <span className="text-xs text-slate-400 font-normal">
                        {plan.billingPeriod}
                      </span>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-3 text-xs mb-8">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2.5">
                          {feat.included ? (
                            <Check size={15} className="text-emerald-400 shrink-0 stroke-[2.5]" />
                          ) : (
                            <X size={15} className="text-slate-600 shrink-0 stroke-[2.5]" />
                          )}
                          <span
                            className={
                              feat.included
                                ? 'text-slate-200 font-medium'
                                : 'text-slate-500 line-through'
                            }
                          >
                            {feat.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Button Action */}
                  <div>
                    {isPopular ? (
                      <button
                        onClick={() => setSelectedPlanForModal(plan)}
                        className="w-full py-2.5 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
                      >
                        {isCurrent ? 'Current Plan' : 'Choose Plan'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedPlanForModal(plan)}
                        className="w-full py-2.5 rounded-lg bg-[#0e172e] hover:bg-[#152345] border border-[#1e2d4d] text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                      >
                        {isCurrent ? 'Current Plan' : 'Select'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="bg-[#0b1328] border border-[#142038] rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#142038] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">TENANT</th>
                <th className="py-3.5 px-4">CURRENT PLAN</th>
                <th className="py-3.5 px-4">MONTHLY FEE</th>
                <th className="py-3.5 px-4">BROKER USAGE</th>
                <th className="py-3.5 px-4">CLIENT USAGE</th>
                <th className="py-3.5 px-4">RENEWAL DATE</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#142038] text-xs">
              {INITIAL_SUBSCRIPTIONS.map(sub => (
                <tr key={sub.id} className="hover:bg-[#0e1935] transition-colors">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                    <Building size={14} className="text-blue-400 shrink-0" />
                    <span>{sub.tenantName}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-950/40 text-blue-400 font-mono text-[10px] font-bold border border-blue-900/40">
                      {sub.plan}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-200">
                    {sub.monthlyFee}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {sub.brokersUsed} / {sub.brokersLimit}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {sub.clientsUsed} / {sub.clientsLimit}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {sub.renewalDate}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        sub.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {sub.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onNotify?.(`Invoices for ${sub.tenantName} exported`, 'info')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plan Selection Modal */}
      {selectedPlanForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c152a] border border-[#1d2d50] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#162340]">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Confirm {selectedPlanForModal.name} Plan
                </h3>
              </div>
              <button
                onClick={() => setSelectedPlanForModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pricing Details */}
            <div className="bg-[#091020] border border-[#162340] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Billing Interval</span>
                <div className="flex bg-[#070d1a] p-0.5 rounded-lg border border-[#152342] text-xs">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                      billingCycle === 'monthly'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                      billingCycle === 'annual'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Annual (-20%)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#162340]">
                <span className="text-xs text-slate-400">Total Due</span>
                <span className="text-lg font-bold text-white">
                  {billingCycle === 'annual'
                    ? `₹${Math.round(selectedPlanForModal.price * 12 * 0.8)} / yr`
                    : `₹${selectedPlanForModal.price} / mo`}
                </span>
              </div>
            </div>

            {/* Included in this plan summary */}
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="font-semibold text-slate-200 mb-2">Key Inclusions:</div>
              {selectedPlanForModal.features
                .filter(f => f.included)
                .map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    <span>{f.name}</span>
                  </div>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#162340]">
              <button
                type="button"
                onClick={() => setSelectedPlanForModal(null)}
                className="px-4 py-2 rounded-lg bg-transparent hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPlan}
                className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Confirm Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
