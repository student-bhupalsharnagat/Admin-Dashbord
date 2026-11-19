import React, { useState, useEffect, useMemo } from 'react';
import { X, Network, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { Master, Broker, SubBroker, Client } from '../../types';
import { apiFetch } from '../../utils/api';

export interface AssignHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  masters: Master[];
  brokers: Broker[];
  subBrokers: SubBroker[];
  currentUser?: { role?: string; hierarchy_id?: string; name?: string } | null;
  onSuccess?: () => void;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
}

export const AssignHierarchyModal: React.FC<AssignHierarchyModalProps> = ({
  isOpen,
  onClose,
  client,
  masters,
  brokers,
  subBrokers,
  currentUser,
  onSuccess,
  onNotify
}) => {
  const [selectedMasterId, setSelectedMasterId] = useState<string>('');
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('');
  const [selectedSubBrokerId, setSelectedSubBrokerId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Role permissions & lockouts
  const userRole = (currentUser?.role || 'SUPER_ADMIN').toUpperCase();
  const isBrokerUser = userRole === 'BROKER';
  const isMasterUser = userRole === 'MASTER';

  // Initialize selections when client changes or modal opens
  useEffect(() => {
    if (!client || !isOpen) return;

    setErrorMessage(null);

    // 1. Resolve current sub-broker
    const currentSub = subBrokers.find(
      sb => sb.id === client.sub_broker_id || sb.name === client.sub_broker_name || sb.name === (client as any).subBroker
    );
    const initialSubId = currentSub?.id || client.sub_broker_id || '';

    // 2. Resolve current broker
    const currentBroker = brokers.find(
      b => b.id === (currentSub as any)?.broker_id ||
           b.id === (client as any).broker_id ||
           b.name === client.broker_name ||
           b.name === (client as any).broker
    );
    let initialBrokerId = currentBroker?.id || (client as any).broker_id || '';
    if (isBrokerUser && currentUser?.hierarchy_id) {
      initialBrokerId = currentUser.hierarchy_id;
    }

    // 3. Resolve current master
    const currentMaster = masters.find(
      m => m.id === (currentBroker as any)?.master_id ||
           m.id === (client as any).master_id ||
           m.name === client.master_name ||
           m.name === (client as any).master
    );
    let initialMasterId = currentMaster?.id || (client as any).master_id || '';
    if (isMasterUser && currentUser?.hierarchy_id) {
      initialMasterId = currentUser.hierarchy_id;
    }

    setSelectedSubBrokerId(initialSubId);
    setSelectedBrokerId(initialBrokerId);
    setSelectedMasterId(initialMasterId);
  }, [client, isOpen, masters, brokers, subBrokers, isBrokerUser, isMasterUser, currentUser?.hierarchy_id]);

  // Filter available brokers by selected master
  const filteredBrokers = useMemo(() => {
    if (isBrokerUser && currentUser?.hierarchy_id) {
      return brokers.filter(b => b.id === currentUser.hierarchy_id);
    }
    if (!selectedMasterId) return brokers;
    return brokers.filter(b => (b as any).master_id === selectedMasterId || (b as any).masterId === selectedMasterId);
  }, [brokers, selectedMasterId, isBrokerUser, currentUser?.hierarchy_id]);

  // Filter available sub-brokers by selected broker
  const filteredSubBrokers = useMemo(() => {
    if (!selectedBrokerId) {
      if (!selectedMasterId) return subBrokers;
      const validBrokerIds = new Set(filteredBrokers.map(b => b.id));
      return subBrokers.filter(sb => validBrokerIds.has((sb as any).broker_id || (sb as any).brokerId));
    }
    return subBrokers.filter(sb => (sb as any).broker_id === selectedBrokerId || (sb as any).brokerId === selectedBrokerId);
  }, [subBrokers, selectedBrokerId, selectedMasterId, filteredBrokers]);

  if (!isOpen || !client) return null;

  const handleMasterChange = (masterId: string) => {
    setSelectedMasterId(masterId);
    // Reset broker and sub-broker if they don't match the newly chosen master
    if (masterId) {
      const allowedBrokerIds = new Set(
        brokers
          .filter(b => (b as any).master_id === masterId || (b as any).masterId === masterId)
          .map(b => b.id)
      );
      if (selectedBrokerId && !allowedBrokerIds.has(selectedBrokerId)) {
        setSelectedBrokerId('');
        setSelectedSubBrokerId('');
      }
    }
  };

  const handleBrokerChange = (brokerId: string) => {
    setSelectedBrokerId(brokerId);
    if (brokerId) {
      const chosenBroker = brokers.find(b => b.id === brokerId);
      const parentMasterId = (chosenBroker as any)?.master_id || (chosenBroker as any)?.masterId;
      if (parentMasterId && !selectedMasterId) {
        setSelectedMasterId(parentMasterId);
      }
      const allowedSubIds = new Set(
        subBrokers
          .filter(sb => (sb as any).broker_id === brokerId || (sb as any).brokerId === brokerId)
          .map(sb => sb.id)
      );
      if (selectedSubBrokerId && !allowedSubIds.has(selectedSubBrokerId)) {
        setSelectedSubBrokerId('');
      }
    }
  };

  const handleSubBrokerChange = (subBrokerId: string) => {
    setSelectedSubBrokerId(subBrokerId);
    if (subBrokerId) {
      const chosenSub = subBrokers.find(sb => sb.id === subBrokerId);
      const parentBrokerId = (chosenSub as any)?.broker_id || (chosenSub as any)?.brokerId;
      if (parentBrokerId) {
        if (!selectedBrokerId || selectedBrokerId !== parentBrokerId) {
          setSelectedBrokerId(parentBrokerId);
        }
        const parentBroker = brokers.find(b => b.id === parentBrokerId);
        const parentMasterId = (parentBroker as any)?.master_id || (parentBroker as any)?.masterId;
        if (parentMasterId && (!selectedMasterId || selectedMasterId !== parentMasterId)) {
          setSelectedMasterId(parentMasterId);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch(`/api/admin/clients/${encodeURIComponent(client.id)}/hierarchy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterId: selectedMasterId || null,
          brokerId: selectedBrokerId || null,
          subBrokerId: selectedSubBrokerId || null
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to update client hierarchy');
      }

      const clientName = client.name || client.id;
      if (onNotify) {
        onNotify(`Hierarchy assigned & synced for ${clientName}`, 'success');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('[AssignHierarchyModal] Error:', err);
      setErrorMessage(err.message || 'An error occurred while updating hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  // Lineage label resolution for preview
  const resolvedMaster = masters.find(m => m.id === selectedMasterId);
  const resolvedBroker = brokers.find(b => b.id === selectedBrokerId);
  const resolvedSubBroker = subBrokers.find(sb => sb.id === selectedSubBrokerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#172647] sticky top-0 bg-[#0b1426] z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Network size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Assign / Transfer Hierarchy</h3>
              <p className="text-xs text-slate-400">Reassign client downline to Master, Broker, or Sub-Broker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Client Identity Pill */}
        <div className="px-5 sm:px-6 pt-4 pb-1">
          <div className="bg-[#070d19] border border-[#172647] rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">{client.name}</div>
              <div className="text-[11px] font-mono text-blue-400">{client.client_code || client.id}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">Current Sub-Broker</div>
              <div className="text-xs text-slate-200 font-medium">
                {client.sub_broker_name || (client as any).subBroker || 'Unassigned'}
              </div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:px-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2.5 text-rose-300 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Master Assignment */}
          <div>
            <label className="block font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Assigned Master</span>
              {isMasterUser && <span className="text-[10px] text-amber-400 font-mono">Locked to your Master ID</span>}
            </label>
            <select
              value={selectedMasterId}
              onChange={e => handleMasterChange(e.target.value)}
              disabled={isMasterUser || isBrokerUser}
              className="w-full px-3 py-2 bg-[#070d19] border border-[#172647] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Direct Platform / No Master --</option>
              {masters.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>
          </div>

          {/* Broker Assignment */}
          <div>
            <label className="block font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Assigned Broker</span>
              {isBrokerUser && <span className="text-[10px] text-amber-400 font-mono">Locked to your Broker ID</span>}
            </label>
            <select
              value={selectedBrokerId}
              onChange={e => handleBrokerChange(e.target.value)}
              disabled={isBrokerUser}
              className="w-full px-3 py-2 bg-[#070d19] border border-[#172647] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- No Broker Assigned --</option>
              {filteredBrokers.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.id})
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Broker Assignment */}
          <div>
            <label className="block font-medium text-slate-300 mb-1.5">Assigned Sub-Broker</label>
            <select
              value={selectedSubBrokerId}
              onChange={e => handleSubBrokerChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#070d19] border border-[#172647] rounded-xl text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Direct Client (No Sub-Broker) --</option>
              {filteredSubBrokers.map(sb => (
                <option key={sb.id} value={sb.id}>
                  {sb.name} ({sb.id}) {sb.broker_name ? `under ${sb.broker_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Live Hierarchy Path Visualizer */}
          <div className="bg-[#070d19]/80 border border-[#172647] rounded-xl p-3 space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Updated Hierarchy Lineage
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-300">
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {resolvedMaster ? resolvedMaster.name : 'Platform'}
              </span>
              <ArrowRight size={12} className="text-slate-500" />
              <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {resolvedBroker ? resolvedBroker.name : 'Direct'}
              </span>
              <ArrowRight size={12} className="text-slate-500" />
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {resolvedSubBroker ? resolvedSubBroker.name : 'Direct'}
              </span>
              <ArrowRight size={12} className="text-slate-500" />
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                {client.name}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Saving will immediately update PostgreSQL and dispatch HMAC-signed S2S sync to Trading Platform and User Panel.
            </p>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-[#172647] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Synchronizing...</span>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save & Transfer Hierarchy</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
