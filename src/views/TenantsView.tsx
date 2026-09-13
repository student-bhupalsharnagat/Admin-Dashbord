import React, { useState } from 'react';
import { Building, Plus, Search, CheckCircle, Ban, Eye, ShieldAlert, Lock } from 'lucide-react';
import { Tenant } from '../types';
import { hasPermission } from '../utils/rbac';

interface TenantsViewProps {
  tenants: Tenant[];
  onOpenCreateTenant: () => void;
  onSelectTenantDetails: (tenant: Tenant) => void;
  onToggleStatus: (id: string, currentStatus: string) => Promise<void>;
  currentUser?: { role?: string; name?: string } | null;
}

export const TenantsView: React.FC<TenantsViewProps> = ({
  tenants,
  onOpenCreateTenant,
  onSelectTenantDetails,
  onToggleStatus,
  currentUser
}) => {
  const canCreate = hasPermission(currentUser?.role, 'TENANTS', 'CREATE');
  const canEdit = hasPermission(currentUser?.role, 'TENANTS', 'EDIT');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = tenants.filter(t => {
    const matchSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.admin_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0d1527] border border-[#17233f] p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Building size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Commercial SaaS Tenants</h2>
            <p className="text-xs text-slate-400">
              Isolated multi-tenant brokerages with dedicated trading desk downlines
            </p>
          </div>
        </div>

        {canCreate ? (
          <button
            onClick={onOpenCreateTenant}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[#2563eb] hover:bg-blue-600 font-semibold text-xs text-white rounded-lg shadow-md shadow-blue-500/20 transition-all w-full sm:w-auto shrink-0 cursor-pointer"
          >
            <Plus size={15} /> Create Tenant
          </button>
        ) : (
          <span className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#10192e] border border-[#1b2848] text-slate-500 text-xs font-medium rounded-lg shrink-0">
            <Lock size={12} className="text-amber-400" /> Creation Restricted
          </span>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search tenant name, code, admin..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0d1527] border border-[#17233f] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Filter Status:</span>
          <div className="flex items-center bg-[#0d1527] border border-[#17233f] p-0.5 rounded-lg text-xs">
            {['ALL', 'ACTIVE', 'SUSPENDED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-[#2563eb] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tenant Table */}
      <div className="bg-[#0d1527] border border-[#17233f] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead>
              <tr className="bg-[#0b1120] text-slate-400 border-b border-[#17233f] text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">TENANT</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">PLAN</th>
                <th className="py-3 px-4">USERS</th>
                <th className="py-3 px-4">TRADING VOLUME</th>
                <th className="py-3 px-4">TOTAL P&L</th>
                <th className="py-3 px-4">COMMISSION</th>
                <th className="py-3 px-4">CREATED</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17233f]/60">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-[#111c34] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-blue-400 font-bold border border-slate-700">
                        {t.code}
                      </span>
                      <span>{t.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Admin: {t.admin_name} ({t.admin_email})
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'ACTIVE'
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                          : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          t.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                      {t.plan}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-200">{t.total_users} Total</div>
                    <div className="text-[11px] text-emerald-400">{t.active_users} Active</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                    {t.trading_volume}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                    +{t.pl}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-300">
                    {t.commission}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {t.created_at}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelectTenantDetails(t)}
                        className="px-2.5 py-1 rounded bg-[#131f38] hover:bg-blue-600/30 text-blue-300 hover:text-blue-100 flex items-center gap-1 transition-colors"
                        title="View Tenant Detail & Downlines"
                      >
                        <Eye size={13} /> View
                      </button>

                      {canEdit && (
                        <button
                          onClick={() => onToggleStatus(t.id, t.status)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                            t.status === 'ACTIVE'
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title={t.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}
                        >
                          {t.status === 'ACTIVE' ? (
                            <>
                              <Ban size={12} /> Suspend
                            </>
                          ) : (
                            <>
                              <CheckCircle size={12} /> Activate
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
