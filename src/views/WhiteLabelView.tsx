import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  Upload,
  Globe,
  Mail,
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Users,
  Building2,
  BarChart3,
  Sliders,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  History,
  ExternalLink,
  Save,
  Send,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Eye,
  Lock,
  ChevronDown,
  Info
} from 'lucide-react';
import { TenantBranding, TenantDomain, TenantPlatformConfig, BrandingAuditLog } from '../types';

interface WhiteLabelViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  onLaunchTradingPlatform?: (domain?: string, tenantId?: string) => void;
  selectedTenantScope?: string | null;
}

export const WhiteLabelView: React.FC<WhiteLabelViewProps> = ({
  onNotify,
  onLaunchTradingPlatform,
  selectedTenantScope
}) => {
  // Navigation Sub-Tabs within White Label
  const [activeSubTab, setActiveSubTab] = useState<'branding' | 'platform' | 'domains' | 'audit' | 'preview'>('branding');

  // Tenants List loaded dynamically from real backend
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(selectedTenantScope || '');

  // Fetch real tenants on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTenantsList() {
      try {
        const res = await fetch('/api/admin/tenants');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && isMounted) {
            const mapped = data.map((t: any) => ({
              id: t.id,
              name: t.name || t.tenant_name || t.id,
              code: t.code || t.tenant_code || t.id.slice(0, 3).toUpperCase()
            }));
            setTenants(mapped);
            if (!selectedTenantScope && mapped[0]) {
              setSelectedTenantId(mapped[0].id);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load tenants list in WhiteLabelView:', e);
      }
    }
    loadTenantsList();
    return () => { isMounted = false; };
  }, []);

  // Active Branding State
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [platformConfig, setPlatformConfig] = useState<TenantPlatformConfig | null>(null);
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [auditLogs, setAuditLogs] = useState<BrandingAuditLog[]>([]);

  // Loading & Saving States
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // New Domain Form Modal/State
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newDomainType, setNewDomainType] = useState<'PRIMARY' | 'ALTERNATE' | 'SUBDOMAIN'>('PRIMARY');
  const [addingDomain, setAddingDomain] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with selectedTenantScope if passed from top header
  useEffect(() => {
    if (selectedTenantScope && selectedTenantScope !== selectedTenantId) {
      setSelectedTenantId(selectedTenantScope);
    }
  }, [selectedTenantScope]);

  // Load all configurations for the selected tenant
  const loadTenantData = async (tenantId: string) => {
    setLoading(true);
    try {
      // 1. Fetch Branding
      const bRes = await fetch(`/api/admin/white-label/${tenantId}`);
      if (bRes.ok) {
        const bData = await bRes.json();
        setBranding(bData);
      }

      // 2. Fetch Platform Config & Feature Flags
      const pRes = await fetch(`/api/admin/white-label/${tenantId}/platform-config`);
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlatformConfig(pData);
      }

      // 3. Fetch Domains
      const dRes = await fetch('/api/admin/white-label/domains/all');
      if (dRes.ok) {
        const allDomains: TenantDomain[] = await dRes.json();
        setDomains(allDomains.filter(d => d.tenant_id === tenantId));
      }

      // 4. Fetch Audit Logs
      const aRes = await fetch('/api/admin/white-label/audit-logs');
      if (aRes.ok) {
        const allLogs: BrandingAuditLog[] = await aRes.json();
        setAuditLogs(allLogs.filter(l => l.tenant_id === tenantId));
      }
    } catch (err) {
      console.error('Failed to load white-label configuration:', err);
      onNotify?.('Error loading configuration from backend', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenantData(selectedTenantId);
  }, [selectedTenantId]);

  // Handlers for Branding Field Updates
  const handleBrandingChange = (field: keyof TenantBranding, value: any) => {
    if (!branding) return;
    setBranding({
      ...branding,
      [field]: value
    });
  };

  // Handlers for Platform Feature Flags Updates
  const handlePlatformConfigToggle = (field: keyof TenantPlatformConfig) => {
    if (!platformConfig) return;
    setPlatformConfig({
      ...platformConfig,
      [field]: !platformConfig[field]
    });
  };

  // Upload Logo or Asset
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !branding) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const hasValidExt = /\.(png|jpe?g|svg|webp|gif)$/i.test(file.name);
    if (!allowedTypes.includes(file.type.toLowerCase()) && !hasValidExt) {
      onNotify?.('Please upload a valid image file (PNG, SVG, JPEG, or WebP).', 'warning');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      onNotify?.('File size exceeds the 5MB maximum limit.', 'warning');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Url = reader.result as string;
        try {
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');
          // Upload to AssetStorageProvider backend endpoint with auth and credentials
          const res = await fetch('/api/admin/white-label/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({
              tenantId: selectedTenantId,
              assetType: 'LOGO',
              filename: file.name,
              mimeType: file.type || 'image/png',
              contentBase64OrUrl: base64Url
            })
          });

          if (res.ok) {
            const stored = await res.json();
            const finalUrl = stored.publicUrl || stored.public_url || base64Url;
            handleBrandingChange('logo_url', finalUrl);
            onNotify?.(`Platform logo "${file.name}" uploaded successfully!`, 'success');
          } else {
            // High reliability fallback: Store base64 data URL directly into draft config
            handleBrandingChange('logo_url', base64Url);
            onNotify?.(`Platform logo "${file.name}" loaded into configuration. Click Save Draft to persist.`, 'success');
          }
        } catch {
          // Direct fallback to data URL in case of network or proxy issue
          handleBrandingChange('logo_url', base64Url);
          onNotify?.(`Platform logo loaded into configuration. Click Save Draft to persist.`, 'success');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      onNotify?.('Upload failed: ' + err.message, 'warning');
    }
  };

  // 1. Save Draft Workflow
  const handleSaveDraft = async () => {
    if (!branding) return;
    setSavingDraft(true);
    try {
      const res = await fetch(`/api/admin/white-label/${selectedTenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding)
      });

      if (res.ok) {
        const updated = await res.json();
        setBranding(updated);
        onNotify?.('Draft branding configuration saved successfully.', 'success');
      } else {
        throw new Error('Failed to save draft');
      }
    } catch (err: any) {
      onNotify?.(err.message || 'Failed to save draft', 'warning');
    } finally {
      setSavingDraft(false);
    }
  };

  // 2. Publish to Live Trading Platform Workflow
  const handlePublish = async () => {
    if (!branding) return;
    setPublishing(true);
    try {
      // First save any unsaved draft changes
      await fetch(`/api/admin/white-label/${selectedTenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding)
      });

      // Also persist platform config
      if (platformConfig) {
        await fetch(`/api/admin/white-label/${selectedTenantId}/platform-config`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(platformConfig)
        });
      }

      // Publish action
      const pRes = await fetch(`/api/admin/white-label/${selectedTenantId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin published live white-label branding' })
      });

      if (pRes.ok) {
        const published = await pRes.json();
        setBranding(published);
        onNotify?.(`Branding published live (v${published.version || 2})! Trading Platform now reflects these changes.`, 'success');
        // Reload audit logs
        loadTenantData(selectedTenantId);
      } else {
        const errJson = await pRes.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || 'Failed to publish branding to Trading Platform');
      }
    } catch (err: any) {
      onNotify?.(err.message || 'Failed to publish changes', 'warning');
    } finally {
      setPublishing(false);
    }
  };

  // 3. Rollback to Previous Version Workflow
  const handleRollback = async () => {
    setRollingBack(true);
    try {
      const res = await fetch(`/api/admin/white-label/${selectedTenantId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        const rolled = await res.json();
        setBranding(rolled);
        onNotify?.('Successfully rolled back to previous branding version!', 'info');
        loadTenantData(selectedTenantId);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'No previous version snapshot available to restore.');
      }
    } catch (err: any) {
      onNotify?.(err.message, 'warning');
    } finally {
      setRollingBack(false);
    }
  };

  // 4. Save Platform Feature Flags
  const handleSavePlatformConfig = async () => {
    if (!platformConfig) return;
    try {
      const res = await fetch(`/api/admin/white-label/${selectedTenantId}/platform-config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(platformConfig)
      });
      if (res.ok) {
        const updated = await res.json();
        setPlatformConfig(updated);
        onNotify?.('Platform feature flags and controls updated successfully.', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Failed to update platform controls on Trading Platform');
      }
    } catch (err: any) {
      onNotify?.(err.message || 'Failed to update platform controls', 'warning');
    }
  };

  // 5. Add Custom Domain
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainInput.trim()) return;
    setAddingDomain(true);
    try {
      const res = await fetch('/api/admin/white-label/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: selectedTenantId,
          domain: newDomainInput.trim(),
          domainType: newDomainType,
          isPrimary: newDomainType === 'PRIMARY'
        })
      });

      if (res.ok) {
        const added = await res.json();
        setDomains(prev => [...prev, added]);
        setNewDomainInput('');
        onNotify?.(`Domain "${added.domain}" added. DNS verification initiated.`, 'success');
      } else {
        const err = await res.json();
        onNotify?.(err.error || 'Failed to add domain', 'warning');
      }
    } catch (err: any) {
      onNotify?.(err.message, 'warning');
    } finally {
      setAddingDomain(false);
    }
  };

  // 6. Verify Domain DNS & Activate SSL
  const handleVerifyDomain = async (domainId: string) => {
    try {
      const res = await fetch(`/api/admin/white-label/domains/${domainId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const updated = await res.json();
        setDomains(prev => prev.map(d => (d.id === domainId ? updated : d)));
        onNotify?.('Domain DNS verified and SSL certificate provisioned!', 'success');
      }
    } catch (err) {
      onNotify?.('Verification failed', 'warning');
    }
  };

  // 7. Delete Domain
  const handleDeleteDomain = async (domainId: string) => {
    if (!window.confirm('Are you sure you want to remove this custom domain?')) return;
    try {
      const res = await fetch(`/api/admin/white-label/domains/${domainId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDomains(prev => prev.filter(d => d.id !== domainId));
        onNotify?.('Domain removed', 'info');
      }
    } catch (err) {
      onNotify?.('Failed to delete domain', 'warning');
    }
  };

  const primaryDomain = domains.find(d => d.is_primary)?.domain || branding?.custom_domain || 'trade.alphaprime.com';

  return (
    <div className="space-y-6">
      {/* Top Header: Title, Tenant Selector, and Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#142038]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">White-Label & Branding Engine</h1>
            {branding?.status && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  branding.status === 'PUBLISHED'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                {branding.status} (v{branding.version || 1})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure tenant branding, domains, and platform controls. Changes directly affect the Tenant Trading Platform.
          </p>
        </div>

        {/* Tenant Switcher & Live Launch Action */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="relative">
            <select
              value={selectedTenantId}
              onChange={e => setSelectedTenantId(e.target.value)}
              className="bg-[#0b1328] border border-[#1e2d4d] text-white rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer pr-8"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {onLaunchTradingPlatform && (
            <button
              onClick={() => onLaunchTradingPlatform(primaryDomain, selectedTenantId)}
              className="px-3.5 py-2 rounded-lg bg-[#142345] hover:bg-[#1a2f5c] border border-blue-500/30 text-blue-400 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Launch Tenant Trading Platform in Terminal mode"
            >
              <ExternalLink size={13} />
              <span>Launch Platform</span>
            </button>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="px-4 py-2 rounded-lg bg-[#0e172e] hover:bg-[#152345] border border-[#1a2948] text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save size={13} />
            <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {publishing ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            <span>Publish to Live</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-[#142038] overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
        <button
          onClick={() => setActiveSubTab('branding')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'branding'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette size={14} />
          <span>Brand Identity & Theme</span>
        </button>

        <button
          onClick={() => setActiveSubTab('platform')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'platform'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders size={14} />
          <span>Platform Feature Controls</span>
        </button>

        <button
          onClick={() => setActiveSubTab('domains')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'domains'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe size={14} />
          <span>Domain & SSL Management ({domains.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'audit'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History size={14} />
          <span>Version & Audit Logs</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 space-y-2">
          <RefreshCw size={24} className="animate-spin mx-auto text-blue-400" />
          <p className="text-xs">Loading tenant white-label configuration...</p>
        </div>
      ) : activeSubTab === 'branding' ? (
        /* ========================================================================= */
        /* TAB 1: BRAND IDENTITY & THEMING                                           */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Configuration Form (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Card 1: Brand Identity */}
            <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles size={15} className="text-blue-400" />
                <span>Brand Identity</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={branding?.brand_name || ''}
                    onChange={e => handleBrandingChange('brand_name', e.target.value)}
                    placeholder="e.g. AlphaPrime Trading"
                    className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Short Name / Ticker</label>
                  <input
                    type="text"
                    value={branding?.short_name || ''}
                    onChange={e => handleBrandingChange('short_name', e.target.value)}
                    placeholder="e.g. APC"
                    className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">Marketing Tagline</label>
                <input
                  type="text"
                  value={branding?.tagline || ''}
                  onChange={e => handleBrandingChange('tagline', e.target.value)}
                  placeholder="e.g. Institutional Grade Multi-Asset Execution"
                  className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Logo Configuration Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs text-slate-400 font-medium">
                    Platform Logo (PNG, SVG, WebP, or JPEG)
                  </label>
                  {branding?.logo_url && (
                    <button
                      type="button"
                      onClick={() => {
                        handleBrandingChange('logo_url', '');
                        onNotify?.('Logo cleared from draft configuration.', 'info');
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer transition-colors"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>

                {/* Direct Image URL input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={branding?.logo_url || ''}
                    onChange={e => handleBrandingChange('logo_url', e.target.value)}
                    placeholder="Enter image URL (e.g. https://... or /kwikTradeLogo.png)"
                    className="flex-1 bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#142038] hover:bg-[#1a2b4b] text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-lg border border-[#1e2f52] transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <Upload size={13} />
                    <span>Upload File</span>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.svg,.webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                {/* Upload & Preview Dropzone Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-[#1e2d4d] hover:border-blue-500 bg-[#080e1c] rounded-lg p-4 text-center cursor-pointer transition-colors group"
                >
                  {branding?.logo_url ? (
                    <div className="flex flex-wrap items-center justify-center gap-6">
                      {/* Dark preview */}
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-slate-500 font-mono">Dark:</div>
                        <div className="h-12 px-3 rounded-lg bg-[#070d18] border border-white/10 flex items-center justify-center">
                          <img
                            src={branding.logo_url}
                            alt="Brand Logo Preview Dark"
                            className="h-8 max-w-[140px] object-contain"
                            onError={e => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>

                      {/* Light preview */}
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-slate-500 font-mono">Light:</div>
                        <div className="h-12 px-3 rounded-lg bg-white border border-slate-300 flex items-center justify-center">
                          <img
                            src={branding.logo_url}
                            alt="Brand Logo Preview Light"
                            className="h-8 max-w-[140px] object-contain"
                            onError={e => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-left">
                        <div className="text-xs text-blue-400 font-bold group-hover:underline">
                          Replace Logo
                        </div>
                        <div className="text-[11px] text-slate-500">Click to select new image file</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload size={20} className="text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-300 font-medium">Click to upload brand logo or drag & drop</p>
                      <p className="text-[11px] text-slate-500">PNG, SVG, WebP, or JPEG (Max 5MB)</p>
                    </div>
                  )}
                </div>

                {/* Quick 1-Click Preset Broker Logos */}
                <div className="pt-1">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
                    Quick Preset Logos:
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      {
                        name: 'KwikTrade Pro',
                        url: '/kwikTradeLogo.png'
                      },
                      {
                        name: 'Vertex Trading',
                        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=140&auto=format&fit=crop&q=80'
                      },
                      {
                        name: 'Alpha Prime Capital',
                        url: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=140&auto=format&fit=crop&q=80'
                      },
                      {
                        name: 'Apex Securities',
                        url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=140&auto=format&fit=crop&q=80'
                      }
                    ].map(preset => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          handleBrandingChange('logo_url', preset.url);
                          onNotify?.(`Preset logo "${preset.name}" applied.`, 'success');
                        }}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                          branding?.logo_url === preset.url
                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 font-bold'
                            : 'bg-[#080e1c] text-slate-400 border-[#142038] hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Color Palette */}
            <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Palette size={15} className="text-blue-400" />
                <span>Color Palette (Injected as CSS Variables)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Primary Color */}
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Primary Brand Color</label>
                  <div className="flex items-center gap-2 bg-[#080e1c] border border-[#142038] rounded-lg p-1.5">
                    <input
                      type="color"
                      value={branding?.primary_color || '#2563eb'}
                      onChange={e => handleBrandingChange('primary_color', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={branding?.primary_color || '#2563eb'}
                      onChange={e => handleBrandingChange('primary_color', e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Secondary / Header</label>
                  <div className="flex items-center gap-2 bg-[#080e1c] border border-[#142038] rounded-lg p-1.5">
                    <input
                      type="color"
                      value={branding?.secondary_color || '#0f172a'}
                      onChange={e => handleBrandingChange('secondary_color', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={branding?.secondary_color || '#0f172a'}
                      onChange={e => handleBrandingChange('secondary_color', e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Accent / Highlights</label>
                  <div className="flex items-center gap-2 bg-[#080e1c] border border-[#142038] rounded-lg p-1.5">
                    <input
                      type="color"
                      value={branding?.accent_color || '#38bdf8'}
                      onChange={e => handleBrandingChange('accent_color', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={branding?.accent_color || '#38bdf8'}
                      onChange={e => handleBrandingChange('accent_color', e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Background Color */}
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">App Background</label>
                  <div className="flex items-center gap-2 bg-[#080e1c] border border-[#142038] rounded-lg p-1.5">
                    <input
                      type="color"
                      value={branding?.background_color || '#080d1a'}
                      onChange={e => handleBrandingChange('background_color', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={branding?.background_color || '#080d1a'}
                      onChange={e => handleBrandingChange('background_color', e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Surface Color */}
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Card / Panel Surface</label>
                  <div className="flex items-center gap-2 bg-[#080e1c] border border-[#142038] rounded-lg p-1.5">
                    <input
                      type="color"
                      value={branding?.surface_color || '#0d1528'}
                      onChange={e => handleBrandingChange('surface_color', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 shrink-0"
                    />
                    <input
                      type="text"
                      value={branding?.surface_color || '#0d1528'}
                      onChange={e => handleBrandingChange('surface_color', e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Support Contact & Legal Links */}
            <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Mail size={15} className="text-blue-400" />
                <span>Contact Details & Legal Compliance</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Support Email</label>
                  <input
                    type="email"
                    value={branding?.support_email || ''}
                    onChange={e => handleBrandingChange('support_email', e.target.value)}
                    placeholder="support@tenant.com"
                    className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-medium mb-1">Support Phone</label>
                  <input
                    type="tel"
                    value={branding?.support_phone || ''}
                    onChange={e => handleBrandingChange('support_phone', e.target.value)}
                    placeholder="+91 22 6800 1200"
                    className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 font-medium mb-1">Footer Copyright Text</label>
                <input
                  type="text"
                  value={branding?.footer_text || ''}
                  onChange={e => handleBrandingChange('footer_text', e.target.value)}
                  placeholder="© 2024 AlphaPrime Capital. All rights reserved."
                  className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Mini Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye size={14} />
                <span>Live Preview: {branding?.brand_name || 'Trading Desk'}</span>
              </span>

              {onLaunchTradingPlatform && (
                <button
                  onClick={() => onLaunchTradingPlatform(primaryDomain, selectedTenantId)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Full Platform</span>
                  <ExternalLink size={12} />
                </button>
              )}
            </div>

            {/* Simulated Desktop Preview Frame */}
            <div
              className="rounded-2xl border border-[#182645] p-5 shadow-2xl space-y-4 transition-all"
              style={{
                backgroundColor: branding?.background_color || '#080d1a',
                color: branding?.text_color || '#f8fafc'
              }}
            >
              {/* Simulated Browser Address Bar */}
              <div className="bg-black/40 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-white/10 text-[11px] font-mono text-slate-400">
                <Lock size={11} className="text-emerald-400" />
                <span className="text-slate-200 font-bold">https://{primaryDomain}</span>
              </div>

              {/* Header Preview */}
              <div
                className="rounded-xl p-3 flex items-center justify-between border border-white/10"
                style={{ backgroundColor: branding?.surface_color || '#0d1528' }}
              >
                <div className="flex items-center gap-2">
                  {branding?.logo_url ? (
                    <img src={branding.logo_url} alt="Logo" className="h-6 object-contain" />
                  ) : (
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: branding?.primary_color || '#2563eb' }}
                    >
                      {branding?.short_name || <TrendingUp size={14} />}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-white tracking-tight">
                      {branding?.brand_name || 'TradeMatrix'}
                    </span>
                    {branding?.tagline && (
                      <span className="text-[9px] text-slate-400 truncate max-w-[140px]">
                        {branding.tagline}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="text-[10px] px-2 py-0.5 rounded font-bold text-white"
                  style={{ backgroundColor: branding?.primary_color || '#2563eb' }}
                >
                  Trade Terminal
                </div>
              </div>

              {/* Login Card Preview */}
              <div
                className="rounded-xl p-4 border border-white/10 text-center space-y-3"
                style={{ backgroundColor: branding?.surface_color || '#0d1528' }}
              >
                <h4 className="text-xs font-bold text-white">
                  {branding?.brand_name ? `Welcome to ${branding.brand_name}` : (branding?.login_title || 'Sign In to Your Account')}
                </h4>
                {branding?.tagline && (
                  <p className="text-[10px] text-slate-400 -mt-1">
                    {branding.tagline}
                  </p>
                )}
                <div className="space-y-1.5">
                  <div className="h-7 rounded bg-black/30 border border-white/10" />
                  <div className="h-7 rounded bg-black/30 border border-white/10" />
                </div>
                <button
                  type="button"
                  className="w-full py-1.5 rounded-lg text-white font-bold text-[11px] shadow-sm transition-opacity"
                  style={{ backgroundColor: branding?.primary_color || '#2563eb' }}
                >
                  Secure Sign In
                </button>
              </div>

              {/* Trading Stats Mini Row */}
              <div className="grid grid-cols-3 gap-2">
                {['NIFTY 50', 'BANKNIFTY', 'RELIANCE'].map(sym => (
                  <div
                    key={sym}
                    className="p-2 rounded-lg border border-white/5 text-center"
                    style={{ backgroundColor: branding?.surface_color || '#0d1528' }}
                  >
                    <div className="text-[9px] text-slate-400">{sym}</div>
                    <div
                      className="text-[11px] font-mono font-bold mt-0.5"
                      style={{ color: branding?.accent_color || '#10b981' }}
                    >
                      +0.85%
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Preview with Support & Copyright */}
              <div className="pt-2 border-t border-white/10 text-[9px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <span className="truncate">Support: {branding?.support_email || 'support@trading.com'}</span>
                  {branding?.support_phone && <span>Tel: {branding.support_phone}</span>}
                </div>
                <div className="text-[9px] text-slate-500 truncate">
                  {branding?.footer_text || `© 2026 ${branding?.brand_name || 'Trading Desk'}. All rights reserved.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'platform' ? (
        /* ========================================================================= */
        /* TAB 2: PLATFORM FEATURE CONTROLS & EMERGENCY HALTS                        */
        /* ========================================================================= */
        <div className="max-w-4xl space-y-6">
          <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#142038]">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Sliders size={16} className="text-blue-400" />
                  <span>Platform Feature Flags for {branding?.brand_name || selectedTenantId}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggling these switches controls what capabilities are permitted on the tenant trading terminal.
                </p>
              </div>

              <button
                onClick={handleSavePlatformConfig}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Apply Feature Changes
              </button>
            </div>

            {/* Feature Flags Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Trading Engine Enabled */}
              <div className="p-4 rounded-xl bg-[#080e1c] border border-[#142038] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Trading Engine Active</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Permits order routing & live trade matching
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlatformConfigToggle('trading_enabled')}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer p-0.5 flex items-center ${
                    platformConfig?.trading_enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Web Trading Enabled */}
              <div className="p-4 rounded-xl bg-[#080e1c] border border-[#142038] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Web Terminal Trading</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Allows traders to access web browser terminal
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlatformConfigToggle('web_trading_enabled')}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer p-0.5 flex items-center ${
                    platformConfig?.web_trading_enabled ? 'bg-blue-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Client Registration Enabled */}
              <div className="p-4 rounded-xl bg-[#080e1c] border border-[#142038] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Public Account Registration</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Allow new traders to create accounts directly
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlatformConfigToggle('registration_enabled')}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer p-0.5 flex items-center ${
                    platformConfig?.registration_enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Mobile Trading Enabled */}
              <div className="p-4 rounded-xl bg-[#080e1c] border border-[#142038] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Mobile App Access</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Permits iOS & Android mobile trading app sessions
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlatformConfigToggle('mobile_trading_enabled')}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer p-0.5 flex items-center ${
                    platformConfig?.mobile_trading_enabled ? 'bg-blue-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Maintenance Mode */}
              <div className="p-4 rounded-xl bg-[#080e1c] border border-amber-500/30 flex items-center justify-between sm:col-span-2">
                <div>
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Maintenance Mode</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Locks platform and presents a custom maintenance announcement to all users
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlatformConfigToggle('maintenance_mode')}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer p-0.5 flex items-center ${
                    platformConfig?.maintenance_mode ? 'bg-amber-600 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            {/* Maintenance Message Input */}
            {platformConfig?.maintenance_mode && (
              <div className="space-y-1.5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <label className="block text-xs font-bold text-amber-300">
                  Maintenance Broadcast Message
                </label>
                <input
                  type="text"
                  value={platformConfig.maintenance_message || ''}
                  onChange={e =>
                    setPlatformConfig({
                      ...platformConfig,
                      maintenance_message: e.target.value
                    })
                  }
                  placeholder="System undergoing scheduled weekend infrastructure maintenance. Resuming Monday 08:00 AM."
                  className="w-full bg-[#080e1c] border border-amber-500/40 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            )}
          </div>
        </div>
      ) : activeSubTab === 'domains' ? (
        /* ========================================================================= */
        /* TAB 3: DOMAINS & SSL MANAGEMENT                                           */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Add Domain Card */}
          <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Plus size={16} className="text-blue-400" />
              <span>Connect New Custom Domain</span>
            </h3>

            <form onSubmit={handleAddDomain} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-xs text-slate-400 font-medium mb-1">
                  Fully Qualified Domain Name (FQDN)
                </label>
                <input
                  type="text"
                  required
                  value={newDomainInput}
                  onChange={e => setNewDomainInput(e.target.value)}
                  placeholder="e.g. trade.mybroker.com"
                  className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 font-medium mb-1">Domain Type</label>
                <select
                  value={newDomainType}
                  onChange={e => setNewDomainType(e.target.value as any)}
                  className="w-full bg-[#080e1c] border border-[#142038] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="PRIMARY">PRIMARY DOMAIN</option>
                  <option value="ALTERNATE">ALTERNATE ALIAS</option>
                  <option value="SUBDOMAIN">SUBDOMAIN</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={addingDomain}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>{addingDomain ? 'Provisioning...' : 'Add Domain'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Existing Domains Table */}
          <div className="bg-[#0b1328] border border-[#142038] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#142038] flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Configured Tenant Domains ({domains.length})
              </h3>
              <span className="text-[11px] text-slate-400">DNS Resolution: Automatic Edge Routing</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-[#142038] text-slate-400 text-[11px]">
                    <th className="p-3">Domain</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">DNS Status</th>
                    <th className="p-3">SSL Certificate</th>
                    <th className="p-3">Primary</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#142038]">
                  {domains.map(d => (
                    <tr key={d.id} className="hover:bg-[#0e172e]">
                      <td className="p-3 font-mono font-bold text-white flex items-center gap-2">
                        <Globe size={14} className="text-blue-400 shrink-0" />
                        <span>{d.domain}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300">
                          {d.domain_type}
                        </span>
                      </td>
                      <td className="p-3">
                        {d.is_verified ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 flex items-center gap-1 w-fit">
                            <Check size={11} />
                            <span>VERIFIED</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1 w-fit">
                            <Clock size={11} />
                            <span>PENDING_DNS</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.ssl_status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {d.ssl_status}
                        </span>
                      </td>
                      <td className="p-3">
                        {d.is_primary ? (
                          <span className="text-xs font-bold text-blue-400">Yes (Default)</span>
                        ) : (
                          <span className="text-xs text-slate-500">No</span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {!d.is_verified && (
                          <button
                            onClick={() => handleVerifyDomain(d.id)}
                            className="px-2.5 py-1 rounded bg-[#142445] hover:bg-blue-600 text-blue-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Verify DNS
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteDomain(d.id)}
                          className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Domain"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 4: VERSION HISTORY & AUDIT LOGS                                       */
        /* ========================================================================= */
        <div className="space-y-6 max-w-5xl">
          {/* Rollback Card */}
          <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw size={16} className="text-amber-400" />
                <span>Version Rollback</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Revert to the previously published branding state if recent changes caused formatting or visual discrepancies.
              </p>
            </div>

            <button
              onClick={handleRollback}
              disabled={rollingBack}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RotateCcw size={13} />
              <span>{rollingBack ? 'Rolling back...' : 'Rollback to Previous Version'}</span>
            </button>
          </div>

          {/* Audit Trail Table */}
          <div className="bg-[#0b1328] border border-[#142038] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#142038] flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Branding Audit Logs ({auditLogs.length})
              </h3>
              <span className="text-[11px] text-slate-400">Strict Tamper-Proof Audit Trail</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No branding changes recorded for this tenant yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#142038] text-slate-400 text-[11px]">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#142038] font-mono">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#0e172e]">
                        <td className="p-3 text-slate-400 text-[11px]">{log.created_at}</td>
                        <td className="p-3 font-bold text-white font-sans">
                          {log.actor} <span className="text-[10px] text-slate-500 font-mono">({log.role})</span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300 font-sans">{log.entity}</td>
                        <td className="p-3 text-slate-400 text-[11px] font-sans">
                          {log.details?.reason || JSON.stringify(log.details) || 'Standard update'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
