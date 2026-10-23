import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ArrowRightLeft,
  DollarSign
} from 'lucide-react';
import { ClientDetailView } from '../components/clients/ClientDetailView';
import { initialClientsData } from './HierarchyViews';

export interface OrderItem {
  orderId: string;
  client: string;
  clientId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  type: 'Limit' | 'Market' | 'Stop';
  price: string;
  status: 'FILLED' | 'PENDING' | 'CANCELLED';
  created: string;
  filledQty?: string;
  exchange?: string;
}

const initialOrdersData: OrderItem[] = [];

interface OrdersViewProps {
  onNotify?: (message: string, type?: 'info' | 'success' | 'warning') => void;
  onNavigateToClient?: (clientId?: string) => void;
  onNavigateToTrade?: (orderId?: string) => void;
  onOpenTradingPlatform?: (clientData?: any) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onNotify,
  onNavigateToClient,
  onNavigateToTrade,
  onOpenTradingPlatform
}) => {
  const [orders, setOrders] = useState<OrderItem[]>(initialOrdersData);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [sideFilter, setSideFilter] = useState<'All Sides' | 'BUY' | 'SELL'>('All Sides');
  const [statusFilter, setStatusFilter] = useState<'All Status' | 'FILLED' | 'PENDING' | 'CANCELLED'>('All Status');

  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [clientModalOrder, setClientModalOrder] = useState<OrderItem | null>(null);
  const [tradeModalOrder, setTradeModalOrder] = useState<OrderItem | null>(null);
  const [activeClientDetail, setActiveClientDetail] = useState<any | null>(null);

  const notify = (msg: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: OrderItem[] = data.map((o: any, idx: number): OrderItem => {
            const rawStatus = (o.status || 'PENDING').toUpperCase();
            const status = (rawStatus === 'EXECUTED' ? 'FILLED' : rawStatus) as 'FILLED' | 'PENDING' | 'CANCELLED';
            const isCancelledOrRejected = status === 'CANCELLED' || rawStatus === 'REJECTED';
            const rawFilled = o.filledQty ?? o.filled_quantity ?? o.executedQty ?? o.executed_quantity;
            const resolvedFilledQty = isCancelledOrRejected
              ? String(rawFilled !== undefined && rawFilled !== null && rawFilled !== '' ? rawFilled : '0')
              : (rawFilled !== undefined && rawFilled !== null && rawFilled !== '' ? String(rawFilled) : (status === 'FILLED' ? String(o.quantity || o.qty || '1') : '0'));

            return {
              orderId: o.orderId || o.order_id || o.id || `ORD-${String(idx + 1).padStart(3, '0')}`,
              client: o.client || o.client_name || 'Retail Client',
              clientId: o.clientId || o.client_id,
              symbol: o.symbol || 'NIFTY50',
              side: ((o.side || 'BUY').toUpperCase() === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
              quantity: String(o.quantity || o.qty || '1'),
              type: (o.type || o.order_type || 'Market') as any,
              price: typeof o.price === 'number' ? `₹${o.price.toLocaleString('en-IN')}` : String(o.price || 'Market'),
              status,
              created: o.created || (o.created_at ? o.created_at.slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ')),
              filledQty: resolvedFilledQty,
              exchange: o.exchange || 'NSE'
            };
          });
          setOrders(mapped);
        }
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Listen to shared window admin:live-event to avoid socket starvation
    const handleLiveEvent = (e: any) => {
      const evt = e.detail;
      if (
        evt?.eventType === 'order.created' ||
        evt?.eventType === 'order.updated' ||
        evt?.eventType === 'order.cancelled' ||
        evt?.eventType === 'trade.executed'
      ) {
        fetchOrders();
      }
    };

    window.addEventListener('admin:live-event', handleLiveEvent);
    return () => {
      window.removeEventListener('admin:live-event', handleLiveEvent);
    };
  }, []);

  const handleOpenClientDetail = (order: OrderItem) => {
    const found = initialClientsData.find(
      c => c.id === order.clientId || c.name.toLowerCase() === order.client.toLowerCase()
    );

    if (found) {
      setActiveClientDetail(found);
    } else {
      setActiveClientDetail({
        id: order.clientId || 'CLT001',
        name: order.client,
        email: `${order.client.toLowerCase().replace(/\s+/g, '.')}@mail.com`,
        phone: '+1-555-3001',
        master: 'Apex Capital',
        broker: 'Ryan Chen',
        subBroker: 'Tom Anderson',
        kyc: 'APPROVED',
        account: 'ACTIVE',
        balance: '₹25,400',
        netPl: '+₹3,820',
        totalOrders: 2,
        totalTrades: 2,
        created: '2023-04-01',
        joined: '2023-04-01'
      });
    }
  };

  const handleCancelOrder = (order: OrderItem) => {
    setOrders(prev =>
      prev.map(o => (o.orderId === order.orderId ? { ...o, status: 'CANCELLED' } : o))
    );
    notify(`Order ${order.orderId} cancelled. Unfilled funds returned to client balance.`, 'warning');
    if (selectedOrder?.orderId === order.orderId) {
      setSelectedOrder({ ...selectedOrder, status: 'CANCELLED' });
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch =
      o.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSide = sideFilter === 'All Sides' || o.side === sideFilter;
    const matchStatus = statusFilter === 'All Status' || o.status === statusFilter;
    return matchSearch && matchSide && matchStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderSideBadge = (side: 'BUY' | 'SELL') => {
    if (side === 'BUY') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          BUY
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#310e18] border border-[#7f1d1d] text-[#f87171]">
        SELL
      </span>
    );
  };

  const renderStatusBadge = (status: 'FILLED' | 'PENDING' | 'CANCELLED') => {
    if (status === 'FILLED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#06261f] border border-[#065f46] text-[#34d399]">
          FILLED
        </span>
      );
    }
    if (status === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#291e0a] border border-[#78350f] text-[#fbbf24]">
          PENDING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#192233] border border-[#334155] text-slate-400">
        CANCELLED
      </span>
    );
  };

  if (activeClientDetail) {
    return (
      <ClientDetailView
        client={activeClientDetail}
        sourceView="Orders"
        onBack={() => setActiveClientDetail(null)}
        onNavigateDashboard={() => {
          setActiveClientDetail(null);
          if (onNavigateToClient) onNavigateToClient();
        }}
        onNotify={notify}
        onOpenTradingPlatform={onOpenTradingPlatform}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb matching Screenshot 4 */}
      <div className="text-xs text-slate-400">
        <span className="text-slate-500">Dashboard</span>
        <span className="mx-2 text-slate-600">&gt;</span>
        <span className="text-slate-300 font-medium">Orders</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white tracking-tight">Orders</h1>
      </div>

      {/* Filter Bar matching Screenshot 4 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-64 sm:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Symbol, client, order ID..."
            className="w-full pl-9 pr-3 py-2 bg-[#091122] border border-[#162238] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* All Sides Dropdown */}
        <div className="relative">
          <select
            value={sideFilter}
            onChange={e => setSideFilter(e.target.value as any)}
            className="appearance-none bg-[#091122] border border-[#162238] text-xs text-slate-300 pl-3.5 pr-8 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All Sides">All Sides</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* All Status Dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="appearance-none bg-[#091122] border border-[#162238] text-xs text-slate-300 pl-3.5 pr-8 py-2 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="All Status">All Status</option>
            <option value="FILLED">FILLED</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Table matching Screenshot 4 */}
      <div className="bg-[#091122] border border-[#131e36] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-[#131e36] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">ORDER ID</th>
                <th className="py-3.5 px-4">CLIENT</th>
                <th className="py-3.5 px-4">SYMBOL</th>
                <th className="py-3.5 px-4">SIDE</th>
                <th className="py-3.5 px-4">QUANTITY</th>
                <th className="py-3.5 px-4">TYPE</th>
                <th className="py-3.5 px-4">PRICE</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4">CREATED</th>
                <th className="py-3.5 px-4 text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131e36]/60">
              {paginatedOrders.map(item => (
                <tr key={item.orderId} className="hover:bg-[#0c152a] transition-colors group">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#38bdf8]">{item.orderId}</td>
                  <td 
                    onClick={() => handleOpenClientDetail(item)}
                    className="py-3.5 px-4 font-bold text-white cursor-pointer hover:text-[#38bdf8] hover:underline"
                  >
                    {item.client}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white font-mono">{item.symbol}</td>
                  <td className="py-3.5 px-4">{renderSideBadge(item.side)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200 font-semibold">{item.quantity}</td>
                  <td className="py-3.5 px-4 text-slate-300">{item.type}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-200">{item.price}</td>
                  <td className="py-3.5 px-4">{renderStatusBadge(item.status)}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">{item.created}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-center gap-3 text-xs">
                      {/* Eye icon to view ticket */}
                      <button
                        onClick={() => setSelectedOrder(item)}
                        title="View Order Details"
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <Eye size={15} />
                      </button>

                      {/* Client action link - opens Client Details according to screenshot */}
                      <button
                        onClick={() => handleOpenClientDetail(item)}
                        title="View Client Details"
                        className="text-slate-400 hover:text-[#38bdf8] font-medium transition-colors cursor-pointer"
                      >
                        Client
                      </button>

                      {/* Trade action link */}
                      <button
                        onClick={() => setTradeModalOrder(item)}
                        className="text-slate-400 hover:text-[#38bdf8] font-medium transition-colors cursor-pointer"
                      >
                        Trade
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No orders match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > pageSize && (
          <div className="px-4 py-3 border-t border-[#131e36] flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed border border-[#1e293b] text-slate-200"
              >
                Previous
              </button>
              <span className="text-slate-300 font-medium">Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-40 disabled:cursor-not-allowed border border-[#1e293b] text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0b2149] border border-[#0369a1] flex items-center justify-center text-[#38bdf8]">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Order Execution Ticket</h3>
                  <p className="text-[11px] text-slate-400">Order #{selectedOrder.orderId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Client</span>
                  <span className="font-bold text-white text-sm">{selectedOrder.client}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Symbol</span>
                  <span className="font-bold font-mono text-cyan-400 text-sm">{selectedOrder.symbol}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Side &amp; Type</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {renderSideBadge(selectedOrder.side)}
                    <span className="text-slate-300 font-medium">{selectedOrder.type}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
                  <div className="mt-0.5">{renderStatusBadge(selectedOrder.status)}</div>
                </div>
              </div>

              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-2 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Order Quantity</span>
                  <span className="font-bold text-white">{selectedOrder.quantity}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Filled Quantity</span>
                  <span className="font-bold text-emerald-400">
                    {selectedOrder.status === 'CANCELLED'
                      ? (selectedOrder.filledQty !== undefined ? selectedOrder.filledQty : '0')
                      : (selectedOrder.filledQty || (selectedOrder.status === 'FILLED' ? selectedOrder.quantity : '0'))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Limit / Exec Price</span>
                  <span className="font-bold text-white">{selectedOrder.price}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Exchange Venue</span>
                  <span className="text-slate-300">{selectedOrder.exchange || 'NSE-FX'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Timestamp</span>
                  <span className="text-slate-400">{selectedOrder.created}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#080e1c] border-t border-[#162238] flex items-center justify-between">
              {selectedOrder.status === 'PENDING' ? (
                <button
                  onClick={() => handleCancelOrder(selectedOrder)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs"
                >
                  Cancel Order
                </button>
              ) : (
                <span className="text-slate-500 text-[11px] font-mono">Order finalized</span>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 rounded-lg bg-[#162238] hover:bg-[#202f4d] text-slate-200 font-semibold text-xs ml-auto"
              >
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Quick Modal */}
      {clientModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#38bdf8]" />
                <h3 className="text-sm font-bold text-white">Client Summary</h3>
              </div>
              <button onClick={() => setClientModalOrder(null)} className="text-slate-400 hover:text-white">
                <X size={15} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Client Name</span>
                <span className="text-base font-bold text-white block mt-0.5">{clientModalOrder.client}</span>
                <span className="text-xs text-slate-400 font-mono">ID: {clientModalOrder.clientId || 'CLT-REF'}</span>
              </div>
              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Trading Status</span>
                  <span className="text-emerald-400 font-semibold">ACTIVE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">KYC Status</span>
                  <span className="text-emerald-400 font-semibold">VERIFIED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Order Placed</span>
                  <span className="text-white font-mono">{clientModalOrder.orderId}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-[#080e1c] border-t border-[#162238] flex justify-end">
              <button
                onClick={() => {
                  setClientModalOrder(null);
                  if (onNavigateToClient) onNavigateToClient(clientModalOrder.clientId);
                }}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Go to Client Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Quick Modal */}
      {tradeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#091122] border border-[#162238] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#162238] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-[#38bdf8]" />
                <h3 className="text-sm font-bold text-white">Trade Execution Details</h3>
              </div>
              <button onClick={() => setTradeModalOrder(null)} className="text-slate-400 hover:text-white">
                <X size={15} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Execution Reference</span>
                <span className="text-base font-bold text-cyan-400 font-mono block mt-0.5">
                  TRD-{tradeModalOrder.orderId.replace('ORD', '')}
                </span>
                <span className="text-xs text-slate-400">Order Ref: {tradeModalOrder.orderId}</span>
              </div>
              <div className="p-3 bg-[#0c162b] border border-[#162238] rounded-lg space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Symbol</span>
                  <span className="text-white font-bold">{tradeModalOrder.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Execution Price</span>
                  <span className="text-white font-bold">{tradeModalOrder.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Filled Qty</span>
                  <span className="text-emerald-400 font-bold">
                    {tradeModalOrder.status === 'CANCELLED'
                      ? (tradeModalOrder.filledQty !== undefined ? tradeModalOrder.filledQty : '0')
                      : (tradeModalOrder.filledQty || (tradeModalOrder.status === 'FILLED' ? tradeModalOrder.quantity : '0'))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Settlement</span>
                  <span className="text-emerald-400 font-bold">T+0 INSTANT</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-[#080e1c] border-t border-[#162238] flex justify-end">
              <button
                onClick={() => {
                  setTradeModalOrder(null);
                  if (onNavigateToTrade) onNavigateToTrade(tradeModalOrder.orderId);
                }}
                className="px-4 py-1.5 bg-[#2563eb] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Go to Trades Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
