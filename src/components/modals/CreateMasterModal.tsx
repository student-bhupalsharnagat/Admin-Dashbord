import React, { useState } from 'react';
import { X, Crown, Building } from 'lucide-react';
import { Tenant } from '../../types';

interface CreateMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  onSubmit: (data: any) => Promise<void>;
}

export const CreateMasterModal: React.FC<CreateMasterModalProps> = ({
  isOpen,
  onClose,
  tenants,
  onSubmit
}) => {
  const [tenantId, setTenantId] = useState(tenants[0]?.id || '');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('West (Mumbai)');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        tenant_id: tenantId,
        name,
        code,
        email,
        phone,
        region
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#18243e] sticky top-0 bg-[#0e1629] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Crown size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create New Master</h3>
              <p className="text-xs text-slate-400">Top-level tenant hierarchy account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#152340] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Select Tenant</label>
            <div className="relative">
              <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={tenantId}
                onChange={e => setTenantId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Master Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Rohan Deshmukh"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Master Code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="e.g. MST-MUM-06"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="master@tenant.com"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1.5">Mobile Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98200 00000"
                className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Operating Region</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="w-full px-3 py-2 bg-[#121c33] border border-[#1e2f52] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="West (Mumbai)">West (Mumbai / Maharashtra)</option>
              <option value="North (NCR)">North (Delhi / NCR)</option>
              <option value="South (Bangalore)">South (Bangalore / Karnataka)</option>
              <option value="South (Hyderabad)">South (Hyderabad / Telangana)</option>
              <option value="East (Kolkata)">East (Kolkata / WB)</option>
            </select>
          </div>

          {/* Footer */}
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
              {loading ? 'Creating...' : 'Create Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
