import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Plus,
  Eye,
  Pencil,
  UserPlus,
  Link as LinkIcon,
  BarChart2,
  FileText,
  Wallet,
  X,
  ChevronDown,
  Check,
  Copy,
  Crown,
  Building2,
  Users,
  Shield,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Master, Broker, SubBroker, Client, Tenant } from '../types';
import { ClientDetailView } from '../components/clients/ClientDetailView';

export interface HierarchyViewsProps {
  level: 'masters' | 'brokers' | 'sub-brokers' | 'clients' | 'tree';
  masters: Master[];
  brokers: Broker[];
  subBrokers: SubBroker[];
  clients: Client[];
  tenants: Tenant[];
  onNavigateTab?: (tab: string) => void;
  onCreateMaster?: () => void;
  onCreateBroker?: () => void;
  onAddClient?: () => void;
  onToggleStatus?: (type: string, id: string, current: string) => Promise<void>;
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
  onOpenTradingPlatform?: (clientData?: any) => void;
}

// Initial screenshot dataset for Masters
const initialMastersData = [
  {
    id: 'MST001',
    name: 'Apex Capital Group',
    company: 'Apex Capital Ltd',
    email: 'admin@apexcapital.com',
    brokers: 12,
    clients: 847,
    turnover: '₹48.2M',
    commission: '₹241,000',
    status: 'ACTIVE',
    created: '2023-01-15',
    region: 'West (Mumbai)',
    phone: '+91 98200 44551'
  },
  {
    id: 'MST002',
    name: 'Meridian Trading',
    company: 'Meridian Holdings',
    email: 'ops@meridian.com',
    brokers: 8,
    clients: 523,
    turnover: '₹29.1M',
    commission: '₹145,500',
    status: 'ACTIVE',
    created: '2023-02-20',
    region: 'North (Delhi)',
    phone: '+91 98110 33221'
  },
  {
    id: 'MST003',
    name: 'Summit Forex',
    company: 'Summit Financial',
    email: 'admin@summitfx.com',
    brokers: 5,
    clients: 312,
    turnover: '₹17.6M',
    commission: '₹88,000',
    status: 'INACTIVE',
    created: '2023-04-10',
    region: 'South (Bangalore)',
    phone: '+91 98450 11992'
  },
  {
    id: 'MST004',
    name: 'Global Markets Ltd',
    company: 'Global Markets',
    email: 'admin@globalmarkets.com',
    brokers: 15,
    clients: 1204,
    turnover: '₹68.5M',
    commission: '₹342,500',
    status: 'ACTIVE',
    created: '2022-11-05',
    region: 'East (Kolkata)',
    phone: '+91 98300 77441'
  },
  {
    id: 'MST005',
    name: 'Pacific Trade Co',
    company: 'Pacific Holdings',
    email: 'ops@pacifictrade.com',
    brokers: 3,
    clients: 187,
    turnover: '₹9.4M',
    commission: '₹47,000',
    status: 'SUSPENDED',
    created: '2023-06-22',
    region: 'West (Ahmedabad)',
    phone: '+91 97200 55112'
  }
];

// Initial screenshot dataset for Brokers
const initialBrokersData = [
  {
    id: 'BRK001',
    name: 'Ryan Chen',
    master: 'Apex Capital Group',
    email: 'ryan.chen@apex.com',
    subBrokers: 6,
    clients: 128,
    turnover: '$8.2M',
    commission: '$41,000',
    status: 'ACTIVE',
    phone: '+1 555-0192',
    created: '2023-01-20'
  },
  {
    id: 'BRK002',
    name: 'Sarah Mitchell',
    master: 'Apex Capital Group',
    email: 's.mitchell@apex.com',
    subBrokers: 4,
    clients: 95,
    turnover: '$5.6M',
    commission: '$28,000',
    status: 'ACTIVE',
    phone: '+1 555-0184',
    created: '2023-02-14'
  },
  {
    id: 'BRK003',
    name: 'James Okafor',
    master: 'Meridian Trading',
    email: 'j.okafor@meridian.com',
    subBrokers: 3,
    clients: 67,
    turnover: '$3.8M',
    commission: '$19,000',
    status: 'ACTIVE',
    phone: '+44 20 7946 0912',
    created: '2023-03-01'
  },
  {
    id: 'BRK004',
    name: 'Priya Sharma',
    master: 'Global Markets Ltd',
    email: 'p.sharma@globalmarkets.com',
    subBrokers: 8,
    clients: 213,
    turnover: '$12.4M',
    commission: '$62,000',
    status: 'ACTIVE',
    phone: '+91 98201 11223',
    created: '2022-12-10'
  },
  {
    id: 'BRK005',
    name: 'Marcus Williams',
    master: 'Summit Forex',
    email: 'm.williams@summitfx.com',
    subBrokers: 2,
    clients: 41,
    turnover: '$2.1M',
    commission: '$10,500',
    status: 'SUSPENDED',
    phone: '+1 555-0144',
    created: '2023-04-18'
  },
  {
    id: 'BRK006',
    name: 'Elena Kovacs',
    master: 'Meridian Trading',
    email: 'e.kovacs@meridian.com',
    subBrokers: 5,
    clients: 88,
    turnover: '$5.0M',
    commission: '$25,000',
    status: 'INACTIVE',
    phone: '+49 30 123456',
    created: '2023-03-25'
  }
];

// Initial screenshot dataset for Sub-Brokers
const initialSubBrokersData = [
  {
    id: 'SBK001',
    name: 'Tom Anderson',
    parentBroker: 'Ryan Chen',
    email: 't.anderson@broker.com',
    clients: 22,
    turnover: '$1.20M',
    commission: '$6,000',
    status: 'ACTIVE',
    created: '2023-03-01',
    phone: '+1 555-0811'
  },
  {
    id: 'SBK002',
    name: 'Lisa Park',
    parentBroker: 'Ryan Chen',
    email: 'l.park@broker.com',
    clients: 18,
    turnover: '$0.98M',
    commission: '$4,900',
    status: 'ACTIVE',
    created: '2023-03-15',
    phone: '+1 555-0922'
  },
  {
    id: 'SBK003',
    name: 'Carlos Rivera',
    parentBroker: 'Sarah Mitchell',
    email: 'c.rivera@broker.com',
    clients: 15,
    turnover: '$0.82M',
    commission: '$4,100',
    status: 'ACTIVE',
    created: '2023-04-10',
    phone: '+34 91 123 4567'
  },
  {
    id: 'SBK004',
    name: 'Aisha Hassan',
    parentBroker: 'James Okafor',
    email: 'a.hassan@broker.com',
    clients: 12,
    turnover: '$0.65M',
    commission: '$3,250',
    status: 'INACTIVE',
    created: '2023-05-20',
    phone: '+971 4 123 4567'
  },
  {
    id: 'SBK005',
    name: 'David Kim',
    parentBroker: 'Priya Sharma',
    email: 'd.kim@broker.com',
    clients: 31,
    turnover: '$1.78M',
    commission: '$8,900',
    status: 'ACTIVE',
    created: '2023-02-28',
    phone: '+82 2 123 4567'
  }
];

// Initial screenshot dataset for Clients
export const initialClientsData = [
  {
    id: 'CLT001',
    name: 'Alexander Hunt',
    email: 'a.hunt@mail.com',
    master: 'Apex Capital',
    broker: 'Ryan Chen',
    subBroker: 'Tom Anderson',
    kyc: 'APPROVED',
    account: 'ACTIVE',
    balance: '₹25,400',
    netPl: '+₹3,820',
    pl: '+3820',
    phone: '+1-555-3001',
    openPositions: 2,
    totalOrders: 2,
    totalTrades: 2,
    created: '2023-04-01',
    joined: '2023-04-01'
  },
  {
    id: 'CLT002',
    name: 'Sophia Lee',
    email: 's.lee@mail.com',
    master: 'Apex Capital',
    broker: 'Ryan Chen',
    subBroker: 'Tom Anderson',
    kyc: 'APPROVED',
    account: 'ACTIVE',
    balance: '₹12,100',
    netPl: '-₹540',
    pl: '-540',
    phone: '+1 555-0102',
    openPositions: 1,
    totalOrders: 4,
    totalTrades: 3,
    created: '2023-02-10',
    joined: '2023-02-10'
  },
  {
    id: 'CLT003',
    name: 'Nathan Brooks',
    email: 'n.brooks@mail.com',
    master: 'Meridian Trading',
    broker: 'James Okafor',
    subBroker: 'Kavita Roy',
    kyc: 'PENDING',
    account: 'PENDING',
    balance: '₹5,000',
    netPl: '+₹0',
    pl: '+0',
    phone: '+44 20 7946 0103',
    openPositions: 0,
    totalOrders: 0,
    totalTrades: 0,
    created: '2023-03-05',
    joined: '2023-03-05'
  },
  {
    id: 'CLT004',
    name: 'Maya Patel',
    email: 'm.patel@mail.com',
    master: 'Global Markets',
    broker: 'Priya Sharma',
    subBroker: 'Anand Verma',
    kyc: 'APPROVED',
    account: 'ACTIVE',
    balance: '₹48,200',
    netPl: '+₹11,240',
    pl: '+11240',
    phone: '+91 98201 0104',
    openPositions: 5,
    totalOrders: 8,
    totalTrades: 7,
    created: '2022-12-15',
    joined: '2022-12-15'
  },
  {
    id: 'CLT005',
    name: 'Ethan Clarke',
    email: 'e.clarke@mail.com',
    master: 'Apex Capital',
    broker: 'Sarah Mitchell',
    subBroker: 'Tom Anderson',
    kyc: 'REJECTED',
    account: 'SUSPENDED',
    balance: '₹0',
    netPl: '+₹0',
    pl: '+0',
    phone: '+1 555-0105',
    openPositions: 0,
    totalOrders: 1,
    totalTrades: 0,
    created: '2023-04-02',
    joined: '2023-04-02'
  },
  {
    id: 'CLT006',
    name: 'Isabella Torres',
    email: 'i.torres@mail.com',
    master: 'Global Markets',
    broker: 'Priya Sharma',
    subBroker: 'Anand Verma',
    kyc: 'APPROVED',
    account: 'ACTIVE',
    balance: '₹31,500',
    netPl: '+₹5,680',
    pl: '+5680',
    phone: '+34 91 123 0106',
    openPositions: 2,
    totalOrders: 3,
    totalTrades: 3,
    created: '2023-02-18',
    joined: '2023-02-18'
  }
];

// Normalization helpers to ensure both initial static mock data and backend API entities render seamlessly without crashes
const normalizeMaster = (m: any) => ({
  ...m,
  id: String(m.id || `MST-${Math.random().toString().slice(2, 6)}`),
  name: m.name || m.tenant_name || 'Master Admin',
  company: m.company || m.tenant_name || m.name || 'Master Corp',
  email: m.email || 'master@tradematrix.io',
  brokers: typeof m.brokers === 'number' ? m.brokers : (m.brokers_count ?? 0),
  clients: typeof m.clients === 'number' ? m.clients : (m.clients_count ?? 0),
  turnover: m.turnover || '₹0',
  commission: m.commission || m.commission_earned || '₹0',
  status: (m.status || 'ACTIVE').toUpperCase(),
  created: m.created || m.created_at || '2023-01-15',
  region: m.region || 'North India',
  phone: m.phone || '+91 98000 00000',
  tenant_id: m.tenant_id,
  tenant_name: m.tenant_name
});

const normalizeBroker = (b: any) => ({
  ...b,
  id: String(b.id || `BRK-${Math.random().toString().slice(2, 6)}`),
  name: b.name || 'Broker Admin',
  master: b.master || b.master_name || b.parent_master_name || 'Master Admin',
  master_id: b.master_id,
  company: b.company || b.tenant_name || b.name || 'Broker Services',
  email: b.email || 'broker@tradematrix.io',
  subBrokers: typeof b.subBrokers === 'number' ? b.subBrokers : (b.sub_brokers_count ?? 0),
  clients: typeof b.clients === 'number' ? b.clients : (b.clients_count ?? 0),
  turnover: b.turnover || '₹0',
  commission: b.commission || b.commission_earned || '₹0',
  status: (b.status || 'ACTIVE').toUpperCase(),
  created: b.created || b.created_at || '2023-01-15',
  phone: b.phone || '+91 98000 00000',
  tenant_id: b.tenant_id,
  tenant_name: b.tenant_name
});

const normalizeSubBroker = (sb: any) => ({
  ...sb,
  id: String(sb.id || `SBRK-${Math.random().toString().slice(2, 6)}`),
  name: sb.name || 'Sub-Broker Admin',
  parentBroker: sb.parentBroker || sb.broker_name || sb.parent_broker_name || 'Broker Admin',
  broker_id: sb.broker_id,
  email: sb.email || 'subbroker@tradematrix.io',
  clients: typeof sb.clients === 'number' ? sb.clients : (sb.clients_count ?? 0),
  turnover: sb.turnover || '₹0',
  commission: sb.commission || sb.commission_earned || '₹0',
  status: (sb.status || 'ACTIVE').toUpperCase(),
  created: sb.created || sb.created_at || '2023-01-15',
  phone: sb.phone || '+91 98000 00000',
  tenant_id: sb.tenant_id,
  tenant_name: sb.tenant_name
});

const normalizeClient = (c: any) => ({
  ...c,
  id: String(c.id || `CLI-${Math.random().toString().slice(2, 6)}`),
  name: c.name || 'Client Trader',
  email: c.email || 'trader@tradematrix.io',
  phone: c.phone || '+91 98000 00000',
  master: c.master || c.master_name || 'Master Admin',
  broker: c.broker || c.broker_name || 'Broker Admin',
  subBroker: c.subBroker || c.sub_broker_name || c.parent_sub_broker_name || 'Sub-Broker Admin',
  account: (c.account || c.status || 'ACTIVE').toUpperCase(),
  kyc: (c.kyc || c.kyc_status || 'PENDING').toUpperCase(),
  balance: c.balance || (c.wallet_balance !== undefined ? `₹${Number(c.wallet_balance).toLocaleString('en-IN')}` : '₹0'),
  equity: c.equity || (c.available_margin !== undefined ? `₹${Number(c.available_margin).toLocaleString('en-IN')}` : '₹0'),
  margin: c.margin || '₹0',
  pl: c.pl || (c.todays_pl !== undefined ? (c.todays_pl >= 0 ? `+₹${c.todays_pl}` : `-₹${Math.abs(c.todays_pl)}`) : '+₹0'),
  trades: typeof c.trades === 'number' ? c.trades : (c.open_positions_count ?? 0),
  joined: c.joined || c.created_at || '2023-01-15',
  tenant_id: c.tenant_id,
  tenant_name: c.tenant_name
});

export const HierarchyViews: React.FC<HierarchyViewsProps> = ({
  level,
  masters: propMasters,
  brokers: propBrokers,
  subBrokers: propSubBrokers,
  clients: propClients,
  onNavigateTab,
  onCreateMaster,
  onCreateBroker,
  onAddClient,
  onToggleStatus,
  onNotify,
  onOpenTradingPlatform
}) => {
  // Local state for entities ensuring screenshot data is shown and editable
  const [mastersList, setMastersList] = useState(() => (initialMastersData || []).map(normalizeMaster));
  const [brokersList, setBrokersList] = useState(() => (initialBrokersData || []).map(normalizeBroker));
  const [subBrokersList, setSubBrokersList] = useState(() => (initialSubBrokersData || []).map(normalizeSubBroker));
  const [clientsList, setClientsList] = useState(() => (initialClientsData || []).map(normalizeClient));
  const [activeClientDetail, setActiveClientDetail] = useState<any | null>(null);

  // Synchronize state with real API data passed via props
  React.useEffect(() => {
    if (propMasters && propMasters.length > 0) {
      setMastersList(propMasters.map(normalizeMaster));
    }
  }, [propMasters]);

  React.useEffect(() => {
    if (propBrokers && propBrokers.length > 0) {
      setBrokersList(propBrokers.map(normalizeBroker));
    }
  }, [propBrokers]);

  React.useEffect(() => {
    if (propSubBrokers && propSubBrokers.length > 0) {
      setSubBrokersList(propSubBrokers.map(normalizeSubBroker));
    }
  }, [propSubBrokers]);

  React.useEffect(() => {
    if (propClients && propClients.length > 0) {
      setClientsList(propClients.map(normalizeClient));
    }
  }, [propClients]);

  // Search and dropdown filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [kycFilter, setKycFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');

  // Interactive Modals State
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [modalType, setModalType] = useState<
    'view' | 'edit' | 'create' | 'link' | 'stats' | 'wallet' | 'kyc' | null
  >(null);

  // Form state for creating or editing
  const [formData, setFormData] = useState<any>({});

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) {
      onNotify(msg, type);
    }
  };

  const executeToggleStatus = async (entity: any) => {
    const current = entity.status || entity.account || 'ACTIVE';
    const nextStatus = current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      if (onToggleStatus) {
        await onToggleStatus(level, entity.id, current);
      } else {
        const res = await fetch(`/api/admin/${level}/${entity.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
        if (!res.ok) throw new Error('Status update failed');
      }

      if (level === 'masters') {
        setMastersList(prev => prev.map(m => m.id === entity.id ? { ...m, status: nextStatus } : m));
      } else if (level === 'brokers') {
        setBrokersList(prev => prev.map(b => b.id === entity.id ? { ...b, status: nextStatus } : b));
      } else if (level === 'sub-brokers') {
        setSubBrokersList(prev => prev.map(s => s.id === entity.id ? { ...s, status: nextStatus } : s));
      } else if (level === 'clients') {
        setClientsList(prev => prev.map(c => c.id === entity.id ? { ...c, account: nextStatus, status: nextStatus } : c));
      }
      if (selectedEntity && selectedEntity.id === entity.id) {
        setSelectedEntity({ ...selectedEntity, status: nextStatus, account: nextStatus });
      }
      notify(`${entity.name} status updated to ${nextStatus}`, 'success');
    } catch {
      notify(`Failed to update status for ${entity.name}`, 'warning');
    }
  };

  // Status Badge Helper matching screenshot palette
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          ACTIVE
        </span>
      );
    }
    if (s === 'INACTIVE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#192233] border border-[#334155] text-slate-400">
          INACTIVE
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
        SUSPENDED
      </span>
    );
  };

  // KYC Badge Helper matching screenshot palette
  const renderKycBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          APPROVED
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#2f220d] border border-[#785012] text-[#fbbf24]">
          PENDING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
        REJECTED
      </span>
    );
  };

  // Account Badge Helper matching screenshot palette
  const renderAccountBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          ACTIVE
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#2f220d] border border-[#785012] text-[#fbbf24]">
          PENDING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
        SUSPENDED
      </span>
    );
  };

  // P&L formatting (+green, -red)
  const renderPL = (pl: string | number) => {
    const str = String(pl);
    const isNegative = str.startsWith('-');
    return (
      <span
        className={`font-mono font-medium ${
          isNegative ? 'text-[#f87171]' : 'text-[#34d399]'
        }`}
      >
        {str}
      </span>
    );
  };

  // Filtered lists with bulletproof optional chaining & fallback string conversions
  const filteredMasters = useMemo(() => {
    return mastersList.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        (item.id || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.company || item.tenant_name || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q);
      const itemStatus = (item.status || 'ACTIVE').toUpperCase();
      const matchStatus =
        statusFilter === 'ALL' || itemStatus === statusFilter.toUpperCase();
      return matchQuery && matchStatus;
    });
  }, [mastersList, searchQuery, statusFilter]);

  const filteredBrokers = useMemo(() => {
    return brokersList.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        (item.id || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.master || item.master_name || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q);
      const itemStatus = (item.status || 'ACTIVE').toUpperCase();
      const matchStatus =
        statusFilter === 'ALL' || itemStatus === statusFilter.toUpperCase();
      return matchQuery && matchStatus;
    });
  }, [brokersList, searchQuery, statusFilter]);

  const filteredSubBrokers = useMemo(() => {
    return subBrokersList.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        (item.id || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.parentBroker || item.broker_name || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q);
      const itemStatus = (item.status || 'ACTIVE').toUpperCase();
      const matchStatus =
        statusFilter === 'ALL' || itemStatus === statusFilter.toUpperCase();
      return matchQuery && matchStatus;
    });
  }, [subBrokersList, searchQuery, statusFilter]);

  const filteredClients = useMemo(() => {
    return clientsList.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        (item.id || '').toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q) ||
        (item.master || item.master_name || '').toLowerCase().includes(q) ||
        (item.broker || item.broker_name || '').toLowerCase().includes(q);
      const itemKyc = (item.kyc || item.kyc_status || 'PENDING').toUpperCase();
      const itemAccount = (item.account || item.status || 'ACTIVE').toUpperCase();
      const matchKyc =
        kycFilter === 'ALL' || itemKyc === kycFilter.toUpperCase();
      const matchAccount =
        accountFilter === 'ALL' || itemAccount === accountFilter.toUpperCase();
      return matchQuery && matchKyc && matchAccount;
    });
  }, [clientsList, searchQuery, kycFilter, accountFilter]);

  // CSV Export Handler
  const handleExport = () => {
    let dataToExport: any[] = [];
    let filename = '';

    if (level === 'masters') {
      dataToExport = filteredMasters;
      filename = 'masters-export.csv';
    } else if (level === 'brokers') {
      dataToExport = filteredBrokers;
      filename = 'brokers-export.csv';
    } else if (level === 'sub-brokers') {
      dataToExport = filteredSubBrokers;
      filename = 'sub-brokers-export.csv';
    } else if (level === 'clients') {
      dataToExport = filteredClients;
      filename = 'clients-export.csv';
    }

    if (dataToExport.length === 0) {
      notify('No records to export', 'warning');
      return;
    }

    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map(row => Object.values(row).join(',')).join('\n');
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${dataToExport.length} ${level} records to ${filename}`, 'success');
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    if (level === 'masters' && onCreateMaster) {
      // Also provide local form support if needed
      setFormData({
        id: `MST00${mastersList.length + 1}`,
        name: '',
        company: '',
        email: '',
        status: 'ACTIVE',
        brokers: 0,
        clients: 0,
        turnover: '₹0.0M',
        commission: '₹0'
      });
      setModalType('create');
    } else if (level === 'brokers' && onCreateBroker) {
      setFormData({
        id: `BRK00${brokersList.length + 1}`,
        name: '',
        master: mastersList[0]?.name || 'Apex Capital Group',
        email: '',
        status: 'ACTIVE',
        subBrokers: 0,
        clients: 0,
        turnover: '$0.0M',
        commission: '$0'
      });
      setModalType('create');
    } else if (level === 'sub-brokers') {
      setFormData({
        id: `SBK00${subBrokersList.length + 1}`,
        name: '',
        parentBroker: brokersList[0]?.name || 'Ryan Chen',
        email: '',
        status: 'ACTIVE',
        clients: 0,
        turnover: '$0.0M',
        commission: '$0'
      });
      setModalType('create');
    } else if (level === 'clients' && onAddClient) {
      setFormData({
        id: `CLT00${clientsList.length + 1}`,
        name: '',
        email: '',
        master: mastersList[0]?.name || 'Apex Capital',
        broker: brokersList[0]?.name || 'Ryan Chen',
        kyc: 'PENDING',
        account: 'ACTIVE',
        balance: '$10,000',
        pl: '+0'
      });
      setModalType('create');
    } else {
      setFormData({
        id: `NEW-${Date.now().toString().slice(-4)}`,
        status: 'ACTIVE'
      });
      setModalType('create');
    }
  };

  // Save Created Entity
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      notify('Please provide a name', 'warning');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    try {
      if (level === 'masters') {
        const newMaster = {
          id: formData.id || `MST00${mastersList.length + 1}`,
          name: formData.name,
          company: formData.company || `${formData.name} Ltd`,
          email: formData.email || `admin@${formData.name.toLowerCase().replace(/\s+/g, '')}.com`,
          brokers: Number(formData.brokers) || 0,
          clients: Number(formData.clients) || 0,
          turnover: formData.turnover || '₹0.0M',
          commission: formData.commission || '₹0',
          status: formData.status || 'ACTIVE',
          created: today,
          region: formData.region || 'West (Mumbai)',
          phone: formData.phone || '+91 98000 00000'
        };
        const res = await fetch('/api/admin/masters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMaster)
        });
        const saved = res.ok ? await res.json() : newMaster;
        setMastersList([saved, ...mastersList]);
        notify(`Master ${saved.name} (${saved.id}) created successfully!`, 'success');
      } else if (level === 'brokers') {
        const newBroker = {
          id: formData.id || `BRK00${brokersList.length + 1}`,
          name: formData.name,
          master: formData.master || 'Apex Capital Group',
          email: formData.email || `broker@${formData.name.toLowerCase().replace(/\s+/g, '')}.com`,
          subBrokers: Number(formData.subBrokers) || 0,
          clients: Number(formData.clients) || 0,
          turnover: formData.turnover || '$0.0M',
          commission: formData.commission || '$0',
          status: formData.status || 'ACTIVE',
          created: today,
          phone: formData.phone || '+1 555-0100'
        };
        const res = await fetch('/api/admin/brokers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newBroker)
        });
        const saved = res.ok ? await res.json() : newBroker;
        setBrokersList([saved, ...brokersList]);
        notify(`Broker ${saved.name} (${saved.id}) registered!`, 'success');
      } else if (level === 'sub-brokers') {
        const newSub = {
          id: formData.id || `SBK00${subBrokersList.length + 1}`,
          name: formData.name,
          parentBroker: formData.parentBroker || 'Ryan Chen',
          email: formData.email || `sub@${formData.name.toLowerCase().replace(/\s+/g, '')}.com`,
          clients: Number(formData.clients) || 0,
          turnover: formData.turnover || '$0.0M',
          commission: formData.commission || '$0',
          status: formData.status || 'ACTIVE',
          created: today,
          phone: formData.phone || '+1 555-0200'
        };
        const res = await fetch('/api/admin/sub-brokers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSub)
        });
        const saved = res.ok ? await res.json() : newSub;
        setSubBrokersList([saved, ...subBrokersList]);
        notify(`Sub-Broker ${saved.name} (${saved.id}) added!`, 'success');
      } else if (level === 'clients') {
        const newClient = {
          id: formData.id || `CLT00${clientsList.length + 1}`,
          name: formData.name,
          email: formData.email || `client@mail.com`,
          master: formData.master || 'Apex Capital',
          broker: formData.broker || 'Ryan Chen',
          kyc: formData.kyc || 'PENDING',
          account: formData.account || 'ACTIVE',
          balance: formData.balance || '$10,000',
          pl: '+0',
          openPositions: 0,
          created: today,
          phone: formData.phone || '+1 555-0300'
        };
        const res = await fetch('/api/admin/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newClient)
        });
        const saved = res.ok ? await res.json() : newClient;
        setClientsList([saved, ...clientsList]);
        notify(`Client ${saved.name} (${saved.id}) onboarded!`, 'success');
      }
    } catch {
      notify(`Failed to save ${level} entity`, 'warning');
    }

    setModalType(null);
  };

  // Save Edited Entity
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntity) return;

    try {
      await fetch(`/api/admin/${level}/${selectedEntity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch {}

    if (level === 'masters') {
      setMastersList(prev =>
        prev.map(m => (m.id === selectedEntity.id ? { ...m, ...formData } : m))
      );
      notify(`Updated master ${formData.name || selectedEntity.name}`, 'success');
    } else if (level === 'brokers') {
      setBrokersList(prev =>
        prev.map(b => (b.id === selectedEntity.id ? { ...b, ...formData } : b))
      );
      notify(`Updated broker ${formData.name || selectedEntity.name}`, 'success');
    } else if (level === 'sub-brokers') {
      setSubBrokersList(prev =>
        prev.map(s => (s.id === selectedEntity.id ? { ...s, ...formData } : s))
      );
      notify(`Updated sub-broker ${formData.name || selectedEntity.name}`, 'success');
    } else if (level === 'clients') {
      setClientsList(prev =>
        prev.map(c => (c.id === selectedEntity.id ? { ...c, ...formData } : c))
      );
      notify(`Updated client ${formData.name || selectedEntity.name}`, 'success');
    }

    setModalType(null);
    setSelectedEntity(null);
  };

  // Quick Action Buttons
  const handleQuickAction = (action: string, entity: any) => {
    setSelectedEntity(entity);
    if (action === 'view') {
      if (level === 'clients') {
        setActiveClientDetail(entity);
        return;
      }
      setModalType('view');
    } else if (action === 'edit') {
      setFormData({ ...entity });
      setModalType('edit');
    } else if (action === 'link') {
      setModalType('link');
    } else if (action === 'stats') {
      setModalType('stats');
    } else if (action === 'wallet') {
      setFormData({ amount: '1000', type: 'DEPOSIT' });
      setModalType('wallet');
    } else if (action === 'kyc') {
      setModalType('kyc');
    } else if (action === 'userplus') {
      notify(`Provisioning downline delegate under ${entity.name}...`, 'info');
    }
  };

  // If viewing a client detail, render the dedicated ClientDetailView
  if (level === 'clients' && activeClientDetail) {
    return (
      <ClientDetailView
        client={activeClientDetail}
        onBack={() => setActiveClientDetail(null)}
        onNavigateDashboard={() => {
          if (onNavigateTab) {
            onNavigateTab('dashboard');
          } else {
            setActiveClientDetail(null);
          }
        }}
        onNotify={notify}
        onOpenTradingPlatform={onOpenTradingPlatform}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Page Header (Title + Subtitle + Action Button) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {level === 'masters' && 'Masters'}
            {level === 'brokers' && 'Brokers'}
            {level === 'sub-brokers' && 'Sub-Brokers'}
            {level === 'clients' && 'Clients'}
            {level === 'tree' && 'Downline Hierarchy Tree'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {level === 'masters' && `${mastersList.length} total masters registered`}
            {level === 'brokers' && `${brokersList.length} registered brokers`}
            {level === 'sub-brokers' && `${subBrokersList.length} registered sub-brokers`}
            {level === 'clients' && `${clientsList.length} registered clients`}
            {level === 'tree' && 'Visual 4-tier delegation tree'}
          </p>
        </div>

        {level !== 'tree' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1d4ed8] hover:bg-blue-600 font-semibold text-xs text-white rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={14} className="stroke-[2.5]" />
            <span>
              {level === 'masters' && 'Create Master'}
              {level === 'brokers' && 'Create Broker'}
              {level === 'sub-brokers' && 'Add Sub-Broker'}
              {level === 'clients' && 'Add Client'}
            </span>
          </button>
        )}
      </div>

      {/* 2. Filter Bar (Search Input + Dropdown Filters + Export Button) */}
      {level !== 'tree' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {/* Search input with exact placeholder */}
            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  level === 'masters'
                    ? 'Search masters...'
                    : level === 'brokers'
                    ? 'Search brokers...'
                    : level === 'sub-brokers'
                    ? 'Search sub-brokers...'
                    : 'Search clients...'
                }
                className="w-full pl-9 pr-3 py-1.5 bg-[#0b1220] border border-[#142038] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Status Dropdown (Masters, Brokers, Sub-Brokers) */}
            {level !== 'clients' && (
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="appearance-none bg-[#0b1220] border border-[#142038] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
                <ChevronDown
                  size={13}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
              </div>
            )}

            {/* Clients specific filters: All KYC & All Accounts */}
            {level === 'clients' && (
              <>
                <div className="relative">
                  <select
                    value={kycFilter}
                    onChange={e => setKycFilter(e.target.value)}
                    className="appearance-none bg-[#0b1220] border border-[#142038] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All KYC</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <ChevronDown
                    size={13}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>

                <div className="relative">
                  <select
                    value={accountFilter}
                    onChange={e => setAccountFilter(e.target.value)}
                    className="appearance-none bg-[#0b1220] border border-[#142038] rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Accounts</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                  <ChevronDown
                    size={13}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Export Button matching screenshot */}
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0b1220] hover:bg-[#111c33] border border-[#142038] rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <Download size={13} className="text-slate-400" />
            <span>Export</span>
          </button>
        </div>
      )}

      {/* 3. Tables Matching Screenshots */}

      {/* MASTERS TABLE (Screenshot 1) */}
      {level === 'masters' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[920px]">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-[#060c18]">
                  <th className="py-3 px-4">MASTER ID</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">COMPANY</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">BROKERS</th>
                  <th className="py-3 px-4">CLIENTS</th>
                  <th className="py-3 px-4">TURNOVER</th>
                  <th className="py-3 px-4">COMMISSION</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">CREATED</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101a2e]">
                {filteredMasters.map(master => (
                  <tr
                    key={master.id}
                    className="hover:bg-[#0c1527] transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-[#38bdf8] cursor-pointer hover:underline">
                      <span onClick={() => handleQuickAction('view', master)}>
                        {master.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                      {master.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      {master.company}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-normal">
                      {master.email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {master.brokers}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {Number(master.clients || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 font-medium">
                      {master.turnover}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-[#34d399]">
                      {master.commission}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(master.status)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {master.created}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={() => handleQuickAction('view', master)}
                          title="View Details"
                          className="hover:text-white transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('edit', master)}
                          title="Edit Master"
                          className="hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('userplus', master)}
                          title="Add Broker"
                          className="hover:text-emerald-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <UserPlus size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('link', master)}
                          title="API / Domain Keys"
                          className="hover:text-purple-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <LinkIcon size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('stats', master)}
                          title="Performance & Turnover"
                          className="hover:text-amber-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <BarChart2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMasters.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-500">
                      No masters found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BROKERS TABLE (Screenshot 2) */}
      {level === 'brokers' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[920px]">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-[#060c18]">
                  <th className="py-3 px-4">BROKER ID</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">MASTER</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">SUB-BROKERS</th>
                  <th className="py-3 px-4">CLIENTS</th>
                  <th className="py-3 px-4">TURNOVER</th>
                  <th className="py-3 px-4">COMMISSION</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101a2e]">
                {filteredBrokers.map(broker => (
                  <tr
                    key={broker.id}
                    className="hover:bg-[#0c1527] transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-[#38bdf8] cursor-pointer hover:underline">
                      <span onClick={() => handleQuickAction('view', broker)}>
                        {broker.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                      {broker.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      {broker.master}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-normal">
                      {broker.email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {broker.subBrokers}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {broker.clients}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 font-medium">
                      {broker.turnover}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-[#34d399]">
                      {broker.commission}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(broker.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={() => handleQuickAction('view', broker)}
                          title="View Details"
                          className="hover:text-white transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('edit', broker)}
                          title="Edit Broker"
                          className="hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('userplus', broker)}
                          title="Add Sub-Broker"
                          className="hover:text-emerald-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <UserPlus size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('link', broker)}
                          title="API Keys / Downline"
                          className="hover:text-purple-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <LinkIcon size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('stats', broker)}
                          title="Turnover Performance"
                          className="hover:text-amber-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <BarChart2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBrokers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No brokers found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-BROKERS TABLE (Screenshot 3) */}
      {level === 'sub-brokers' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-[#060c18]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">PARENT BROKER</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">CLIENTS</th>
                  <th className="py-3 px-4">TURNOVER</th>
                  <th className="py-3 px-4">COMMISSION</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">CREATED</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101a2e]">
                {filteredSubBrokers.map(sub => (
                  <tr
                    key={sub.id}
                    className="hover:bg-[#0c1527] transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-[#38bdf8] cursor-pointer hover:underline">
                      <span onClick={() => handleQuickAction('view', sub)}>
                        {sub.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
                      {sub.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      {sub.parentBroker}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-normal">
                      {sub.email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-200 font-medium">
                      {sub.clients}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 font-medium">
                      {sub.turnover}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-[#34d399]">
                      {sub.commission}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(sub.status)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {sub.created}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={() => handleQuickAction('view', sub)}
                          title="View Details"
                          className="hover:text-white transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('edit', sub)}
                          title="Edit Sub-Broker"
                          className="hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSubBrokers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No sub-brokers found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLIENTS TABLE (Screenshot 4) */}
      {level === 'clients' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead>
                <tr className="border-b border-[#121d33] text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-[#060c18]">
                  <th className="py-3 px-4">CLIENT ID</th>
                  <th className="py-3 px-4">NAME</th>
                  <th className="py-3 px-4">EMAIL</th>
                  <th className="py-3 px-4">MASTER</th>
                  <th className="py-3 px-4">BROKER</th>
                  <th className="py-3 px-4">KYC</th>
                  <th className="py-3 px-4">ACCOUNT</th>
                  <th className="py-3 px-4">BALANCE</th>
                  <th className="py-3 px-4">P&L</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#101a2e]">
                {filteredClients.map(client => (
                  <tr
                    key={client.id}
                    className="hover:bg-[#0c1527] transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-[#38bdf8] cursor-pointer hover:underline">
                      <span onClick={() => setActiveClientDetail(client)}>
                        {client.id}
                      </span>
                    </td>
                    <td 
                      onClick={() => setActiveClientDetail(client)}
                      className="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap cursor-pointer hover:text-blue-400 hover:underline"
                    >
                      {client.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-normal">
                      {client.email}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      {client.master}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      {client.broker}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderKycBadge(client.kyc)}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderAccountBadge(client.account)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-200 font-medium">
                      {client.balance}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderPL(client.pl)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={() => handleQuickAction('view', client)}
                          title="View Portfolio & Profile"
                          className="hover:text-white transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('edit', client)}
                          title="Edit Client"
                          className="hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('kyc', client)}
                          title="KYC Compliance Docs"
                          className="hover:text-emerald-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <FileText size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('wallet', client)}
                          title="Deposit / Adjust Funds"
                          className="hover:text-amber-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Wallet size={13} />
                        </button>
                        <button
                          onClick={() => handleQuickAction('userplus', client)}
                          title="Assign Sub-Broker / Refer"
                          className="hover:text-purple-400 transition-colors p-1 rounded hover:bg-slate-800/50 cursor-pointer"
                        >
                          <UserPlus size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No clients found matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TREE VIEW (Downline Tree) */}
      {level === 'tree' && (
        <div className="bg-[#070e1b] border border-[#121d33] rounded-xl p-5 space-y-4">
          <div className="text-slate-300 text-xs">
            Multi-tier delegation relationship view from Master entities down to Brokers, Sub-Brokers, and Clients:
          </div>

          <div className="space-y-3">
            {mastersList.map(m => (
              <div
                key={m.id}
                className="bg-[#0b1324] border border-[#14213d] rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Crown size={15} />
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs flex items-center gap-2">
                        <span>{m.name}</span>
                        <span className="text-[#38bdf8] font-mono text-[11px]">{m.id}</span>
                        {renderStatusBadge(m.status)}
                      </div>
                      <div className="text-[10px] text-slate-400">{m.company} • {m.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">Turnover: <span className="font-mono text-slate-200">{m.turnover}</span></div>
                    <div className="text-[10px] text-emerald-400 font-mono">Commission: {m.commission}</div>
                  </div>
                </div>

                {/* Brokers under this master */}
                <div className="pl-6 border-l-2 border-[#16274a] space-y-2">
                  {brokersList
                    .filter(b => b.master === m.name)
                    .map(b => (
                      <div
                        key={b.id}
                        className="bg-[#0d172e] border border-[#162547] rounded-lg p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 size={13} className="text-blue-400" />
                          <span className="font-semibold text-slate-200">{b.name}</span>
                          <span className="text-[#38bdf8] font-mono text-[10px]">({b.id})</span>
                          {renderStatusBadge(b.status)}
                        </div>
                        <div className="font-mono text-[11px] text-slate-300">
                          Turnover: {b.turnover} • Comm: <span className="text-emerald-400">{b.commission}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MODALS */}

      {/* VIEW DETAILS MODAL */}
      {modalType === 'view' && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-[#142340]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-mono text-xs font-bold">
                  {selectedEntity.id}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {selectedEntity.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 capitalize">
                    {level.slice(0, -1)} Profile & Hierarchy Details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121f3b] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#080e1c] p-3 rounded-xl border border-[#121f3b]">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Status</span>
                  <div className="mt-1">{renderStatusBadge(selectedEntity.status || selectedEntity.account)}</div>
                </div>
                {selectedEntity.kyc && (
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">KYC Compliance</span>
                    <div className="mt-1">{renderKycBadge(selectedEntity.kyc)}</div>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Email Address</span>
                  <div className="text-slate-200 font-medium truncate mt-0.5">{selectedEntity.email}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Phone / Contact</span>
                  <div className="text-slate-200 font-medium mt-0.5">{selectedEntity.phone || '+1 555-0199'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedEntity.company && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Company Entity</span>
                    <span className="text-white font-semibold text-xs">{selectedEntity.company}</span>
                  </div>
                )}
                {selectedEntity.master && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Parent Master</span>
                    <span className="text-white font-semibold text-xs">{selectedEntity.master}</span>
                  </div>
                )}
                {selectedEntity.broker && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Parent Broker</span>
                    <span className="text-white font-semibold text-xs">{selectedEntity.broker}</span>
                  </div>
                )}
                {selectedEntity.parentBroker && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Parent Broker</span>
                    <span className="text-white font-semibold text-xs">{selectedEntity.parentBroker}</span>
                  </div>
                )}
                {selectedEntity.turnover && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Total Turnover</span>
                    <span className="text-slate-200 font-mono font-bold text-xs">{selectedEntity.turnover}</span>
                  </div>
                )}
                {selectedEntity.commission && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Accrued Commission</span>
                    <span className="text-[#34d399] font-mono font-bold text-xs">{selectedEntity.commission}</span>
                  </div>
                )}
                {selectedEntity.balance && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Current Balance</span>
                    <span className="text-slate-200 font-mono font-bold text-xs">{selectedEntity.balance}</span>
                  </div>
                )}
                {selectedEntity.pl !== undefined && (
                  <div className="p-2.5 rounded-lg bg-[#0d162a] border border-[#152342]">
                    <span className="text-slate-400 text-[10px] block">Trading P&L</span>
                    <div className="mt-0.5">{renderPL(selectedEntity.pl)}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#142340] bg-[#091122] flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Created: {selectedEntity.created || '2023-01-15'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeToggleStatus(selectedEntity)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    (selectedEntity.status === 'ACTIVE' || selectedEntity.account === 'ACTIVE')
                      ? 'bg-rose-950/60 hover:bg-rose-900 border border-rose-600/40 text-rose-300'
                      : 'bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-300'
                  }`}
                >
                  {(selectedEntity.status === 'ACTIVE' || selectedEntity.account === 'ACTIVE') ? 'Suspend Entity' : 'Activate Entity'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-1.5 bg-[#172545] hover:bg-[#1f315a] text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ENTITY MODAL */}
      {modalType === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-[#142340]">
              <h3 className="font-bold text-white text-sm">
                {level === 'masters' && 'Create Master Account'}
                {level === 'brokers' && 'Create New Broker'}
                {level === 'sub-brokers' && 'Add Sub-Broker'}
                {level === 'clients' && 'Onboard Client'}
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121f3b] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                  {level === 'masters' ? 'Master / Entity Name' : 'Full Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Global Trading"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {level === 'masters' && (
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Capital Ltd"
                    value={formData.company || ''}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {level === 'brokers' && (
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    Assign Parent Master
                  </label>
                  <select
                    value={formData.master || ''}
                    onChange={e => setFormData({ ...formData, master: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {mastersList.map(m => (
                      <option key={m.id} value={m.name}>
                        {m.name} ({m.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {level === 'sub-brokers' && (
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    Assign Parent Broker
                  </label>
                  <select
                    value={formData.parentBroker || ''}
                    onChange={e => setFormData({ ...formData, parentBroker: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {brokersList.map(b => (
                      <option key={b.id} value={b.name}>
                        {b.name} ({b.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {level === 'clients' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                      Master
                    </label>
                    <select
                      value={formData.master || ''}
                      onChange={e => setFormData({ ...formData, master: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {mastersList.map(m => (
                        <option key={m.id} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                      Broker
                    </label>
                    <select
                      value={formData.broker || ''}
                      onChange={e => setFormData({ ...formData, broker: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {brokersList.map(b => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@firm.com"
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                    Status
                  </label>
                  <select
                    value={formData.status || 'ACTIVE'}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                {level === 'clients' ? (
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                      Initial Balance
                    </label>
                    <input
                      type="text"
                      placeholder="$10,000"
                      value={formData.balance || '$10,000'}
                      onChange={e => setFormData({ ...formData, balance: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">
                      Initial Commission Split
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ₹50,000 or $5,000"
                      value={formData.commission || ''}
                      onChange={e => setFormData({ ...formData, commission: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#142340]">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#14213d] hover:bg-[#1a2c52] text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {modalType === 'edit' && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-[#142340]">
              <h3 className="font-bold text-white text-sm">
                Edit {selectedEntity.id} ({selectedEntity.name})
              </h3>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#121f3b] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-medium">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-medium">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">Status</label>
                  <select
                    value={formData.status || formData.account || 'ACTIVE'}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        status: e.target.value,
                        account: e.target.value
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                {level === 'clients' && (
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">KYC</label>
                    <select
                      value={formData.kyc || 'APPROVED'}
                      onChange={e => setFormData({ ...formData, kyc: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="APPROVED">APPROVED</option>
                      <option value="PENDING">PENDING</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#142340]">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#14213d] hover:bg-[#1a2c52] text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API / LINK KEY MODAL */}
      {modalType === 'link' && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#142340]">
              <div className="flex items-center gap-2">
                <LinkIcon size={16} className="text-purple-400" />
                <h3 className="font-bold text-white text-sm">
                  API & Webhook Access: {selectedEntity.name}
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-slate-400 text-[11px]">Production API Key</span>
                <div className="flex items-center gap-2 mt-1 bg-[#080e1c] border border-[#152342] rounded-lg px-3 py-2">
                  <code className="text-purple-300 font-mono text-[11px] truncate flex-1">
                    tm_live_sec_{selectedEntity.id.toLowerCase()}_{Math.random().toString(36).substring(2, 10)}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText?.(`tm_live_sec_${selectedEntity.id}`);
                      notify('Copied API Key to clipboard!', 'success');
                    }}
                    className="text-slate-400 hover:text-white"
                    title="Copy"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px]">Webhook Endpoint URL</span>
                <div className="flex items-center gap-2 mt-1 bg-[#080e1c] border border-[#152342] rounded-lg px-3 py-2">
                  <code className="text-slate-300 font-mono text-[11px] truncate flex-1">
                    https://api.tradematrix.io/v1/webhooks/{selectedEntity.id.toLowerCase()}
                  </code>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS MODAL */}
      {modalType === 'stats' && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#142340]">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Turnover & Performance: {selectedEntity.name}
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#080e1c] border border-[#152342]">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Turnover</span>
                <div className="text-white font-mono font-bold text-base mt-1">
                  {selectedEntity.turnover || '$10.5M'}
                </div>
                <span className="text-[10px] text-emerald-400 font-medium">↑ +14.2% MoM</span>
              </div>
              <div className="p-3 rounded-xl bg-[#080e1c] border border-[#152342]">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Commission</span>
                <div className="text-[#34d399] font-mono font-bold text-base mt-1">
                  {selectedEntity.commission || '$52,000'}
                </div>
                <span className="text-[10px] text-slate-400">Settled T+1</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#080e1c] border border-[#152342] space-y-2">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Traders Downline Active</span>
                <span className="text-white font-bold">{selectedEntity.clients || 140}</span>
              </div>
              <div className="w-full bg-[#121f3d] h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[78%]" />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-1.5 rounded-lg bg-[#14213d] hover:bg-[#1a2c52] text-slate-200 font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALLET FUNDS MODAL (For Clients) */}
      {modalType === 'wallet' && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#142340]">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Manage Funds: {selectedEntity.name}
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-[#080e1c] rounded-xl border border-[#152342] flex justify-between items-center">
              <span className="text-slate-400">Current Balance</span>
              <span className="font-mono text-white font-bold text-sm">{selectedEntity.balance}</span>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1 font-medium">Adjustment Amount ($)</label>
              <input
                type="number"
                placeholder="1000"
                value={formData.amount || '1000'}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-1.5 bg-[#080e1c] border border-[#152342] rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const currentNum = parseFloat(selectedEntity.balance.replace(/[^0-9.-]+/g, '')) || 0;
                  const addNum = parseFloat(formData.amount) || 0;
                  const newBal = `$${(currentNum + addNum).toLocaleString()}`;
                  setClientsList(prev =>
                    prev.map(c => (c.id === selectedEntity.id ? { ...c, balance: newBal } : c))
                  );
                  notify(`Deposited $${addNum.toLocaleString()} to ${selectedEntity.name}`, 'success');
                  setModalType(null);
                }}
                className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
              >
                + Deposit Funds
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentNum = parseFloat(selectedEntity.balance.replace(/[^0-9.-]+/g, '')) || 0;
                  const subNum = parseFloat(formData.amount) || 0;
                  const newBal = `$${Math.max(0, currentNum - subNum).toLocaleString()}`;
                  setClientsList(prev =>
                    prev.map(c => (c.id === selectedEntity.id ? { ...c, balance: newBal } : c))
                  );
                  notify(`Withdrew $${subNum.toLocaleString()} from ${selectedEntity.name}`, 'info');
                  setModalType(null);
                }}
                className="py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
              >
                - Withdraw Funds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KYC MODAL (For Clients) */}
      {modalType === 'kyc' && selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0b1426] border border-[#172647] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#142340]">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-400" />
                <h3 className="font-bold text-white text-sm">
                  KYC Documents: {selectedEntity.name}
                </h3>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-[#080e1c] rounded-xl border border-[#152342] flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-200">National ID / Passport</div>
                  <div className="text-[10px] text-slate-400">Verified via OCR • Exp: 2028-10</div>
                </div>
                <span className="text-emerald-400 font-bold text-[10px]">VERIFIED</span>
              </div>
              <div className="p-3 bg-[#080e1c] rounded-xl border border-[#152342] flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-200">Proof of Address / Bank Statement</div>
                  <div className="text-[10px] text-slate-400">Utility bill submitted</div>
                </div>
                <span className="text-emerald-400 font-bold text-[10px]">VERIFIED</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <span className="text-slate-400">Current Status: {renderKycBadge(selectedEntity.kyc)}</span>
              <button
                onClick={() => {
                  setClientsList(prev =>
                    prev.map(c =>
                      c.id === selectedEntity.id
                        ? { ...c, kyc: c.kyc === 'APPROVED' ? 'PENDING' : 'APPROVED' }
                        : c
                    )
                  );
                  notify(`Updated KYC status for ${selectedEntity.name}`, 'success');
                  setModalType(null);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg cursor-pointer"
              >
                Toggle Approved/Pending
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
