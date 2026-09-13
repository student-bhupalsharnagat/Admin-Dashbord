import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { SubBroker } from '../../types';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  subBrokers: SubBroker[];
  onSubmit: (data: any) => Promise<void>;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({
  isOpen,
  onClose,
  subBrokers,
  onSubmit
}) => {
  const [subBrokerId, setSubBrokerId] = useState(subBrokers[0]?.id || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('250000');
  const [marginMultiplier, setMarginMultiplier] = useState('4x');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        sub_broker_id: subBrokerId,
        name,
        email,
        phone,
        wallet_balance: parseFloat(initialDeposit) || 0,
        available_margin: (parseFloat(initialDeposit) || 0) * (parseInt(marginMultiplier) || 4)
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#0e1629] border border-[#1b2b4e] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#18243e] sticky top-0 bg-[#0e1629] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add Trading Client</h3>
              <p className="text-xs text-slate-400">Onboard client under Sub-Broker hierarchy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#152340] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Assigned Sub-Broker</label>
            <select
              value={subBrokerId}
              onChange={e => setSubBrokerId(e.target.value)}
              className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              required
            >
              {subBrokers.map(sb => (
                <option key={sb.id} value={sb.id}>
                  {sb.name} ({sb.code}) — {sb.tenant_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Client Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Vikramaditya Sen"
              className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="client@gmail.com"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98000 00000"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Initial Wallet Balance (₹)</label>
              <input
                type="number"
                value={initialDeposit}
                onChange={e => setInitialDeposit(e.target.value)}
                placeholder="250000"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Intraday Margin Multiplier</label>
              <select
                value={marginMultiplier}
                onChange={e => setMarginMultiplier(e.target.value)}
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="1x">1x (Cash Only)</option>
                <option value="2x">2x Exposure</option>
                <option value="4x">4x Standard</option>
                <option value="5x">5x Institutional</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-[#18243e] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#131f38] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 font-semibold text-white transition-colors shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Onboarding...' : 'Onboard Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
