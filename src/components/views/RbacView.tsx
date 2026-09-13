import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Users,
  Key,
  Lock,
  Plus,
  Search,
  Filter,
  Check,
  X,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
  Edit2,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import {
  RoleDefinition,
  RbacUser,
  RbacAuditLogItem,
  ResourceModule,
  PermissionAction,
  UserRole,
  AuthUser
} from '../../types';
import {
  ALL_MODULES,
  ALL_ACTIONS,
  MODULE_METADATA,
  ACTION_METADATA,
  getRoleBadgeStyle,
  hasPermission
} from '../../utils/rbac';

interface RbacViewProps {
  currentUser?: AuthUser | null;
  onSwitchUserRole?: (role: UserRole) => void;
}

export const RbacView: React.FC<RbacViewProps> = ({
  currentUser,
  onSwitchUserRole
}) => {
  const [activeTab, setActiveTab] = useState<'roles' | 'matrix' | 'users' | 'simulator' | 'audit'>('roles');
  
  // Data states
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [users, setUsers] = useState<RbacUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<RbacAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selection & Matrix states
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('SUPER_ADMIN');
  const [editablePermissions, setEditablePermissions] = useState<Record<ResourceModule, PermissionAction[]>>({} as any);
  const [hasUnsavedMatrixChanges, setHasUnsavedMatrixChanges] = useState(false);
  const [moduleSearchQuery, setModuleSearchQuery] = useState('');

  // User management states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // Modals
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [showAssignUserModal, setShowAssignUserModal] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<RbacUser | null>(null);

  // New role form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('blue');
  const [cloneFromRole, setCloneFromRole] = useState<string>('BROKER');

  // Assign user form state
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleCode, setAssignRoleCode] = useState<string>('BROKER');
  const [assignTenantId, setAssignTenantId] = useState('TNT-001');

  // Simulator states
  const [simRole, setSimRole] = useState<UserRole>('BROKER');
  const [simModule, setSimModule] = useState<ResourceModule>('TRADING_ORDERS');
  const [simAction, setSimAction] = useState<PermissionAction>('EXECUTE');

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, usersRes, logsRes] = await Promise.all([
        fetch('/api/admin/rbac/roles'),
        fetch('/api/admin/rbac/users'),
        fetch('/api/admin/rbac/audit-logs')
      ]);

      if (rolesRes.ok) {
        const rolesData: RoleDefinition[] = await rolesRes.json();
        setRoles(rolesData);
        // Default editable permissions
        const currentSelected = rolesData.find(r => r.code === selectedRoleForMatrix) || rolesData[0];
        if (currentSelected) {
          setSelectedRoleForMatrix(currentSelected.code as string);
          setEditablePermissions(JSON.parse(JSON.stringify(currentSelected.permissions)));
        }
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData);
      }
    } catch (err: any) {
      console.error('Error loading RBAC data:', err);
      setErrorMessage('Failed to connect to RBAC service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When changing selected role in matrix, update editable permissions copy
  const handleSelectRoleForMatrix = (roleCode: string) => {
    if (hasUnsavedMatrixChanges) {
      if (!window.confirm('You have unsaved permission changes. Discard and switch role?')) {
        return;
      }
    }
    setSelectedRoleForMatrix(roleCode);
    const targetRole = roles.find(r => r.code === roleCode || r.id === roleCode);
    if (targetRole) {
      setEditablePermissions(JSON.parse(JSON.stringify(targetRole.permissions)));
      setHasUnsavedMatrixChanges(false);
    }
  };

  // Toggle specific action for a module
  const togglePermission = (module: ResourceModule, action: PermissionAction) => {
    const role = roles.find(r => r.code === selectedRoleForMatrix);
    if (role?.isSystemRole && role.code === 'SUPER_ADMIN') {
      alert('Super Administrator role possesses permanent root authority across all modules.');
      return;
    }

    const currentModulePerms = editablePermissions[module] || [];
    let updated: PermissionAction[];
    if (currentModulePerms.includes(action)) {
      updated = currentModulePerms.filter(a => a !== action);
    } else {
      updated = [...currentModulePerms, action];
    }

    setEditablePermissions(prev => ({
      ...prev,
      [module]: updated
    }));
    setHasUnsavedMatrixChanges(true);
  };

  // Toggle all actions for a single module
  const toggleAllForModule = (module: ResourceModule) => {
    const currentModulePerms = editablePermissions[module] || [];
    const role = roles.find(r => r.code === selectedRoleForMatrix);
    if (role?.isSystemRole && role.code === 'SUPER_ADMIN') return;

    if (currentModulePerms.length === ALL_ACTIONS.length) {
      setEditablePermissions(prev => ({
        ...prev,
        [module]: []
      }));
    } else {
      setEditablePermissions(prev => ({
        ...prev,
        [module]: [...ALL_ACTIONS]
      }));
    }
    setHasUnsavedMatrixChanges(true);
  };

  // Save modified permissions for selected role
  const handleSavePermissions = async () => {
    const role = roles.find(r => r.code === selectedRoleForMatrix);
    if (!role) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rbac/roles/${role.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions: editablePermissions
        })
      });

      if (res.ok) {
        const updatedRole = await res.json();
        setRoles(prev => prev.map(r => r.id === updatedRole.id ? updatedRole : r));
        setHasUnsavedMatrixChanges(false);
        setSuccessMessage(`Permissions successfully saved for role ${role.name}`);
        setTimeout(() => setSuccessMessage(null), 4000);
        // Refresh audit logs
        const logsRes = await fetch('/api/admin/rbac/audit-logs');
        if (logsRes.ok) setAuditLogs(await logsRes.json());
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to update role permissions');
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error saving permissions');
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Create Custom Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    const sourceRole = roles.find(r => r.code === cloneFromRole);
    const clonedPerms = sourceRole ? JSON.parse(JSON.stringify(sourceRole.permissions)) : {};

    setSaving(true);
    try {
      const codeGenerated = newRoleCode.trim() 
        ? newRoleCode.toUpperCase().replace(/\s+/g, '_')
        : `ROLE_${newRoleName.toUpperCase().replace(/\s+/g, '_')}`;

      const res = await fetch('/api/admin/rbac/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName,
          code: codeGenerated,
          description: newRoleDesc || 'Custom role configured by administrator.',
          badgeColor: newRoleColor,
          permissions: clonedPerms
        })
      });

      if (res.ok) {
        const createdRole = await res.json();
        setRoles(prev => [...prev, createdRole]);
        setShowCreateRoleModal(false);
        setNewRoleName('');
        setNewRoleCode('');
        setNewRoleDesc('');
        setSuccessMessage(`New role '${createdRole.name}' created successfully!`);
        setTimeout(() => setSuccessMessage(null), 4000);
        setSelectedRoleForMatrix(createdRole.code);
        setEditablePermissions(createdRole.permissions);
        setActiveTab('matrix');
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to create role');
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error creating role');
    } finally {
      setSaving(false);
    }
  };

  // Delete Custom Role
  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Are you sure you want to delete role '${roleName}'? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/rbac/roles/${roleId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setRoles(prev => prev.filter(r => r.id !== roleId));
        setSuccessMessage(`Role '${roleName}' deleted successfully.`);
        setTimeout(() => setSuccessMessage(null), 4000);
        if (selectedRoleForMatrix === roleId) {
          setSelectedRoleForMatrix('SUPER_ADMIN');
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Cannot delete system role.');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting role');
    }
  };

  // Reassign User Role
  const handleAssignUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/rbac/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: assignUserId,
          roleCode: assignRoleCode
        })
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setShowAssignUserModal(false);
        setSelectedUserForEdit(null);
        setSuccessMessage(`User ${updatedUser.name} role successfully updated to ${updatedUser.roleName}`);
        setTimeout(() => setSuccessMessage(null), 4000);
        // Refresh audit logs
        const logsRes = await fetch('/api/admin/rbac/audit-logs');
        if (logsRes.ok) setAuditLogs(await logsRes.json());
      } else {
        const err = await res.json();
        setErrorMessage(err.error || 'Failed to reassign user');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error assigning user');
    } finally {
      setSaving(false);
    }
  };

  // Filtered modules for matrix search
  const filteredModules = ALL_MODULES.filter(mod => {
    const meta = MODULE_METADATA[mod];
    if (!moduleSearchQuery.trim()) return true;
    const q = moduleSearchQuery.toLowerCase();
    return mod.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q) || meta.description.toLowerCase().includes(q);
  });

  // Filtered users for user tab
  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearchQuery.trim() || 
      u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.tenantName.toLowerCase().includes(userSearchQuery.toLowerCase());
    
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const activeMatrixRole = roles.find(r => r.code === selectedRoleForMatrix) || roles[0];

  // Simulator test evaluation
  const simResultAllowed = hasPermission(simRole, simModule, simAction);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Notification */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 bg-rose-950/70 border border-rose-500/40 rounded-xl text-rose-300 text-sm shadow-lg animate-in fade-in">
          <AlertTriangle size={18} className="shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#0a1226] p-6 rounded-2xl border border-[#1b2b4d] shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 shrink-0">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Role-Based Access Control (RBAC)
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Live Server Enforcement
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Configure system and custom roles, edit granular resource permission matrices, govern staff authorizations, and inspect audit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => setShowCreateRoleModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>Create Custom Role</span>
          </button>
          <button
            onClick={() => {
              setAssignUserId('');
              setAssignRoleCode('BROKER');
              setShowAssignUserModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111c34] hover:bg-[#162444] border border-[#1d2d50] text-slate-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <Users size={15} className="text-slate-400" />
            <span>Assign Staff Role</span>
          </button>
          <button
            onClick={fetchData}
            title="Refresh RBAC state"
            className="p-2 rounded-xl bg-[#111c34] hover:bg-[#162444] border border-[#1d2d50] text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0b1327] p-5 rounded-2xl border border-[#182645] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Configured Roles</span>
            <div className="text-2xl font-extrabold text-white mt-1">{roles.length}</div>
            <span className="text-[11px] text-purple-400 font-medium mt-1 inline-block">
              {roles.filter(r => r.isSystemRole).length} System, {roles.filter(r => !r.isSystemRole).length} Custom
            </span>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
            <Shield size={22} />
          </div>
        </div>

        <div className="bg-[#0b1327] p-5 rounded-2xl border border-[#182645] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Assigned Staff Users</span>
            <div className="text-2xl font-extrabold text-white mt-1">{users.length}</div>
            <span className="text-[11px] text-emerald-400 font-medium mt-1 inline-block">
              {users.filter(u => u.status === 'ACTIVE').length} Active Accounts
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-[#0b1327] p-5 rounded-2xl border border-[#182645] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Governed Modules</span>
            <div className="text-2xl font-extrabold text-white mt-1">{ALL_MODULES.length}</div>
            <span className="text-[11px] text-blue-400 font-medium mt-1 inline-block">
              7 Actions per Resource
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <Key size={22} />
          </div>
        </div>

        <div className="bg-[#0b1327] p-5 rounded-2xl border border-[#182645] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">RBAC Security Mode</span>
            <div className="text-lg font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Strict Enforced
            </div>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
              Backend Middleware Active
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
            <Lock size={22} />
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#1b2b4d] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'roles'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
          }`}
        >
          <Shield size={16} />
          <span>Roles Directory</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#111c34] text-[10px] font-mono text-slate-300">
            {roles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'matrix'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
          }`}
        >
          <Sliders size={16} />
          <span>Permissions Matrix</span>
          {hasUnsavedMatrixChanges && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
          }`}
        >
          <Users size={16} />
          <span>User Role Assignments</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#111c34] text-[10px] font-mono text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'simulator'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
          }`}
        >
          <Sparkles size={16} />
          <span>Permission Simulator</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            activeTab === 'audit'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0e172e]'
          }`}
        >
          <Clock size={16} />
          <span>RBAC Audit Trail</span>
          <span className="px-1.5 py-0.2 rounded-full bg-[#111c34] text-[10px] font-mono text-slate-300">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ROLES DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => {
              const badge = getRoleBadgeStyle(role.code);
              const allowedModulesCount = Object.values(role.permissions || {}).filter(
                arr => Array.isArray(arr) && arr.length > 0
              ).length;

              return (
                <div
                  key={role.id}
                  className="bg-[#0b1327] rounded-2xl border border-[#182645] hover:border-[#2a4073] p-5 transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                            {role.name}
                          </h3>
                          {role.isSystemRole ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                              System
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Custom
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs text-slate-400 mt-0.5 block">
                          {role.code}
                        </span>
                      </div>

                      <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {role.userCount} Users
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {role.description}
                    </p>

                    <div className="pt-2 border-t border-[#14203a] flex items-center justify-between text-xs text-slate-400">
                      <span>Accessible Modules</span>
                      <span className="font-bold text-slate-200">
                        {allowedModulesCount} / {ALL_MODULES.length}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-[#14203a] flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        handleSelectRoleForMatrix(role.code);
                        setActiveTab('matrix');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Sliders size={13} />
                      <span>Configure Permissions</span>
                    </button>

                    {onSwitchUserRole && (
                      <button
                        onClick={() => onSwitchUserRole(role.code as UserRole)}
                        title={`Preview UI as ${role.name}`}
                        className="py-2 px-2.5 rounded-xl bg-[#121c35] hover:bg-[#18274a] border border-[#1b2b4d] text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                      >
                        <Eye size={14} />
                      </button>
                    )}

                    {!role.isSystemRole && (
                      <button
                        onClick={() => handleDeleteRole(role.id, role.name)}
                        title="Delete custom role"
                        className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium transition-all cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERACTIVE PERMISSIONS MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Role selector bar and search */}
          <div className="bg-[#0b1327] p-4 rounded-2xl border border-[#182645] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Editing Role:
              </span>
              <div className="relative">
                <select
                  value={selectedRoleForMatrix}
                  onChange={(e) => handleSelectRoleForMatrix(e.target.value)}
                  className="bg-[#111c36] border border-[#1f3056] text-white text-xs font-bold rounded-xl px-3.5 py-2 pr-8 appearance-none focus:outline-hidden focus:border-blue-500 cursor-pointer shadow-inner"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.code}) {r.isSystemRole ? '★' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {activeMatrixRole?.isSystemRole && activeMatrixRole.code === 'SUPER_ADMIN' && (
                <span className="text-[11px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg">
                  Super Administrator has immutable root authorization across all resources.
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter resource module..."
                  value={moduleSearchQuery}
                  onChange={(e) => setModuleSearchQuery(e.target.value)}
                  className="bg-[#111c36] border border-[#1f3056] text-xs text-white placeholder-slate-500 rounded-xl pl-8 pr-3 py-1.5 w-48 sm:w-60 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleSavePermissions}
                disabled={saving || !hasUnsavedMatrixChanges || activeMatrixRole?.code === 'SUPER_ADMIN'}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  hasUnsavedMatrixChanges && activeMatrixRole?.code !== 'SUPER_ADMIN'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                    : 'bg-[#152342] text-slate-500 cursor-not-allowed border border-[#1d2f59]'
                }`}
              >
                <Check size={14} />
                <span>{saving ? 'Saving...' : 'Save Permissions'}</span>
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-[#0b1327] rounded-2xl border border-[#182645] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#182645] bg-[#0d162e]">
                    <th className="py-3.5 px-4 font-bold text-slate-300 min-w-[220px]">
                      Resource Module
                    </th>
                    {ALL_ACTIONS.map(action => {
                      const meta = ACTION_METADATA[action];
                      return (
                        <th key={action} className="py-3.5 px-3 font-semibold text-center text-slate-300 min-w-[90px]">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${meta.badgeColor}`}>
                            {action}
                          </span>
                        </th>
                      );
                    })}
                    <th className="py-3.5 px-3 font-semibold text-center text-slate-400 min-w-[80px]">
                      Toggle
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#14203a]">
                  {filteredModules.map(mod => {
                    const meta = MODULE_METADATA[mod];
                    const activeActions = editablePermissions[mod] || [];
                    const allGranted = activeActions.length === ALL_ACTIONS.length;

                    return (
                      <tr key={mod} className="hover:bg-[#0f1b36] transition-colors group">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                            {meta.label}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            {mod}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">
                            {meta.description}
                          </div>
                        </td>

                        {ALL_ACTIONS.map(action => {
                          const isGranted = activeActions.includes(action);
                          return (
                            <td key={action} className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => togglePermission(mod, action)}
                                disabled={activeMatrixRole?.code === 'SUPER_ADMIN'}
                                className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all cursor-pointer ${
                                  isGranted
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-[#121c36] text-slate-600 border border-[#1b2b4d] hover:border-slate-500 hover:text-slate-400'
                                }`}
                                title={`${isGranted ? 'Revoke' : 'Grant'} ${action} on ${meta.label}`}
                              >
                                {isGranted ? <Check size={14} className="stroke-[3]" /> : <X size={12} />}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAllForModule(mod)}
                            disabled={activeMatrixRole?.code === 'SUPER_ADMIN'}
                            className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                          >
                            {allGranted ? 'None' : 'All'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: USER ROLE ASSIGNMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-[#0b1327] p-4 rounded-2xl border border-[#182645] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff user by name, email, tenant..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="bg-[#111c36] border border-[#1f3056] text-xs text-white placeholder-slate-500 rounded-xl pl-8 pr-3 py-1.5 w-64 sm:w-80 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-[#111c36] border border-[#1f3056] text-xs text-slate-300 rounded-xl px-3 py-1.5 focus:outline-hidden focus:border-blue-500"
              >
                <option value="ALL">All Roles ({users.length})</option>
                {roles.map(r => (
                  <option key={r.id} value={r.code}>{r.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setAssignUserId('');
                setAssignRoleCode('BROKER');
                setShowAssignUserModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>Add Staff User</span>
            </button>
          </div>

          <div className="bg-[#0b1327] rounded-2xl border border-[#182645] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#182645] bg-[#0d162e]">
                    <th className="py-3.5 px-4 font-bold text-slate-300">Staff Member</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Assigned Role</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Tenant Scope</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300 text-center">2FA Security</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300">Last Login</th>
                    <th className="py-3.5 px-4 font-bold text-slate-300 text-center">Status</th>
                    <th className="py-3.5 px-4 font-bold text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#14203a]">
                  {filteredUsers.map(user => {
                    const badge = getRoleBadgeStyle(user.role as string);

                    return (
                      <tr key={user.id} className="hover:bg-[#0f1b36] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-white">{user.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-lg font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {user.roleName || user.role}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{user.tenantName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{user.tenantId}</div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {user.twoFactorEnabled ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-medium">
                              <Check size={11} /> Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-medium">
                              <AlertTriangle size={11} /> Disabled
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {user.lastLogin}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            user.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {user.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserForEdit(user);
                                setAssignUserId(user.id);
                                setAssignRoleCode(user.role as string);
                                setShowAssignUserModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#142240] hover:bg-[#1a2d54] text-blue-400 border border-blue-500/20 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Change Role
                            </button>

                            {onSwitchUserRole && (
                              <button
                                onClick={() => onSwitchUserRole(user.role as UserRole)}
                                title={`Simulate UI as ${user.name} (${user.role})`}
                                className="p-1.5 rounded-lg bg-[#142240] hover:bg-[#1a2d54] text-slate-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PERMISSION TESTER & SIMULATOR */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-[#0b1327] p-5 rounded-2xl border border-[#182645] space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles size={16} className="text-blue-400" />
                Interactive Permission Evaluator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Test whether an arbitrary role is authorized to perform an action against any platform resource module.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target User Role</label>
                <select
                  value={simRole}
                  onChange={(e) => setSimRole(e.target.value as UserRole)}
                  className="w-full bg-[#111c36] border border-[#1f3056] text-white text-xs rounded-xl px-3 py-2 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.code}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Resource Module</label>
                <select
                  value={simModule}
                  onChange={(e) => setSimModule(e.target.value as ResourceModule)}
                  className="w-full bg-[#111c36] border border-[#1f3056] text-white text-xs rounded-xl px-3 py-2 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {ALL_MODULES.map(mod => (
                    <option key={mod} value={mod}>{MODULE_METADATA[mod].label} ({mod})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Attempted Action</label>
                <select
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value as PermissionAction)}
                  className="w-full bg-[#111c36] border border-[#1f3056] text-white text-xs rounded-xl px-3 py-2 focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {ALL_ACTIONS.map(act => (
                    <option key={act} value={act}>{act} ({ACTION_METADATA[act].label})</option>
                  ))}
                </select>
              </div>
            </div>

            {onSwitchUserRole && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onSwitchUserRole(simRole)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Eye size={15} />
                  <span>Switch Live Session to {simRole.replace(/_/g, ' ')}</span>
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-[#0b1327] p-6 rounded-2xl border border-[#182645] flex flex-col justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">
                Real-Time Policy Decision Result
              </span>

              <div className={`p-6 rounded-2xl border flex items-start gap-4 ${
                simResultAllowed
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}>
                {simResultAllowed ? (
                  <CheckCircle2 size={36} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={36} className="text-rose-400 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1">
                  <div className="text-lg font-bold">
                    {simResultAllowed ? 'Access Granted (Authorized)' : 'Access Denied (Forbidden)'}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {simResultAllowed ? (
                      <>
                        Role <strong className="text-white">{simRole}</strong> is granted permission to perform <strong className="text-emerald-400">{simAction}</strong> on module <strong className="text-white">{simModule}</strong>.
                      </>
                    ) : (
                      <>
                        Role <strong className="text-white">{simRole}</strong> does <strong>NOT</strong> have permission to perform <strong className="text-rose-400">{simAction}</strong> on module <strong className="text-white">{simModule}</strong>. Backend endpoints will return HTTP 403 Forbidden.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Module Capabilities Breakdown for Chosen Role */}
              <div className="mt-6">
                <h4 className="text-xs font-bold text-slate-300 mb-3">
                  All Granted Actions for {simRole} on {MODULE_METADATA[simModule].label}:
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ALL_ACTIONS.map(act => {
                    const granted = hasPermission(simRole, simModule, act);
                    return (
                      <div
                        key={act}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          granted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-[#101930] border-[#182645] text-slate-500'
                        }`}
                      >
                        <span className="font-mono font-semibold">{act}</span>
                        {granted ? <Check size={14} className="text-emerald-400" /> : <X size={12} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#14203a] flex items-center justify-between text-xs text-slate-400">
              <span>Security Rule: Server-Side Authority Verification</span>
              <span className="font-mono text-emerald-400">status: active</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RBAC AUDIT TRAIL */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-[#0b1327] rounded-2xl border border-[#182645] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#182645] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-purple-400" />
              RBAC Mutation Audit Records
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Immutable ledger of role & permission changes
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#182645] bg-[#0d162e]">
                  <th className="py-3 px-4 font-bold text-slate-300">Timestamp</th>
                  <th className="py-3 px-4 font-bold text-slate-300">Actor</th>
                  <th className="py-3 px-4 font-bold text-slate-300">Action Type</th>
                  <th className="py-3 px-4 font-bold text-slate-300">Target</th>
                  <th className="py-3 px-4 font-bold text-slate-300">Details</th>
                  <th className="py-3 px-4 font-bold text-slate-400 font-mono">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#14203a]">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-[#0f1b36] transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{log.actorName}</div>
                      <div className="text-[10px] text-purple-400 font-mono">{log.actorRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {log.targetRoleOrUser}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {log.details}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE CUSTOM ROLE */}
      {/* ========================================================================= */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0b1327] border border-[#1d2f59] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-[#182645] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Shield size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Custom Role</h3>
                  <p className="text-xs text-slate-400">Define role identifier and inherit baseline permissions</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateRoleModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#121c36] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Junior Compliance Officer"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="w-full bg-[#111c36] border border-[#1f3056] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role Code (Unique Identifier)</label>
                <input
                  type="text"
                  placeholder="e.g. JUNIOR_COMPLIANCE (Auto-generated if blank)"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  className="w-full bg-[#111c36] border border-[#1f3056] rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe the operational responsibilities of this role..."
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  className="w-full bg-[#111c36] border border-[#1f3056] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Clone Baseline Permissions From</label>
                <select
                  value={cloneFromRole}
                  onChange={(e) => setCloneFromRole(e.target.value)}
                  className="w-full bg-[#111c36] border border-[#1f3056] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.code}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-[#182645] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateRoleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#111c36] hover:bg-[#172547] border border-[#1f3056] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !newRoleName.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {saving ? 'Creating...' : 'Create Role & Configure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ASSIGN USER ROLE */}
      {/* ========================================================================= */}
      {showAssignUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#0b1327] border border-[#1d2f59] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-[#182645] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedUserForEdit ? `Reassign ${selectedUserForEdit.name}` : 'Assign Staff User Role'}
                  </h3>
                  <p className="text-xs text-slate-400">Map user account to security role</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAssignUserModal(false);
                  setSelectedUserForEdit(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#121c36] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignUserRole} className="p-5 space-y-4">
              {!selectedUserForEdit && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Select User Account *</label>
                  <select
                    required
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full bg-[#111c36] border border-[#1f3056] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">-- Choose User --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) - Current: {u.roleName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Security Role *</label>
                <select
                  required
                  value={assignRoleCode}
                  onChange={(e) => setAssignRoleCode(e.target.value)}
                  className="w-full bg-[#111c36] border border-[#1f3056] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-blue-500 cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-[#182645] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignUserModal(false);
                    setSelectedUserForEdit(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#111c36] hover:bg-[#172547] border border-[#1f3056] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !assignUserId}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  {saving ? 'Updating...' : 'Confirm Role Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
