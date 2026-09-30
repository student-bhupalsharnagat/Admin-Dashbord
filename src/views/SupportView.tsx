import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Clock,
  MessageSquare,
  CheckCircle2,
  Search,
  Eye,
  Check,
  X,
  Send,
  User,
  Calendar,
  AlertCircle,
  Lock
} from 'lucide-react';
import { hasPermission } from '../utils/rbac';

export interface SupportTicketItem {
  id: string;
  ticketId: string;
  createdBy: string;
  subject: string;
  category: 'WITHDRAWAL' | 'KYC' | 'ACCOUNT' | 'TRADING' | 'DEPOSIT';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN PROGRESS' | 'PENDING' | 'RESOLVED';
  assignedTo: string;
  date: string;
  description?: string;
  messages?: { sender: string; time: string; text: string; isAdmin: boolean }[];
}

interface SupportViewProps {
  onNotify?: (msg: string, type?: 'info' | 'success' | 'warning') => void;
  currentUser?: { role?: string; name?: string } | null;
}

export const SupportView: React.FC<SupportViewProps> = ({ onNotify, currentUser }) => {
  const canApprove = hasPermission(currentUser?.role, 'SUPPORT', 'APPROVE');
  const canEdit = hasPermission(currentUser?.role, 'SUPPORT', 'EDIT');
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  
  // Modals state
  const [selectedTicketForDetail, setSelectedTicketForDetail] = useState<SupportTicketItem | null>(null);
  const [drawerReplyText, setDrawerReplyText] = useState('');
  const [ticketForReply, setTicketForReply] = useState<SupportTicketItem | null>(null);
  const [replyText, setReplyText] = useState('');

  // Fetch live support tickets from backend API
  useEffect(() => {
    fetch('/api/admin/support', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (Array.isArray(data)) {
          const mapped: SupportTicketItem[] = data.map((d: any) => ({
            id: d.id,
            ticketId: d.ticket_id || d.ticketId || d.id,
            createdBy: d.client_name || d.createdBy || 'Client User',
            subject: d.subject || 'Support Request',
            category: (d.category?.toUpperCase() || 'TRADING') as any,
            priority: (d.priority?.toUpperCase() || 'MEDIUM') as any,
            status: (d.status === 'IN_PROGRESS' ? 'IN PROGRESS' : d.status?.toUpperCase() || 'OPEN') as any,
            assignedTo: d.assigned_to || d.assignedTo || 'Support Desk',
            date: d.created_at ? d.created_at.split('T')[0] : (d.date || '2024-04-15'),
            description: d.description || d.subject,
            messages: d.messages || [
              {
                sender: d.client_name || d.createdBy || 'Client',
                time: d.created_at ? d.created_at.replace('T', ' ').substring(0, 16) : '2024-04-15 10:00',
                text: d.description || d.subject,
                isAdmin: false
              }
            ]
          }));
          setTickets(mapped);
        }
      })
      .catch(() => {
        setTickets([]);
      });
  }, []);

  // Calculate KPIs
  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const pendingCount = tickets.filter(t => t.status === 'PENDING').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const handleResolveTicket = async (ticketId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' })
      });
    } catch {
      // Non-blocking
    }
    setTickets(prev =>
      prev.map(t => (t.ticketId === ticketId ? { ...t, status: 'RESOLVED' } : t))
    );
    if (selectedTicketForDetail?.ticketId === ticketId) {
      setSelectedTicketForDetail(prev => prev ? { ...prev, status: 'RESOLVED' } : null);
    }
    onNotify?.(`Ticket ${ticketId} marked as RESOLVED`, 'success');
  };

  const handleSendDrawerReply = async () => {
    if (!selectedTicketForDetail || !drawerReplyText.trim()) return;

    const messageText = drawerReplyText.trim();
    const ticketTargetId = selectedTicketForDetail.id || selectedTicketForDetail.ticketId;
    try {
      await fetch(`/api/admin/support/${ticketTargetId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
    } catch {
      // Non-blocking
    }

    const newMessage = {
      sender: 'Admin Support',
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      text: messageText,
      isAdmin: true
    };

    setTickets(prev =>
      prev.map(t =>
        t.ticketId === selectedTicketForDetail.ticketId
          ? {
              ...t,
              status: t.status === 'OPEN' ? 'IN PROGRESS' : t.status,
              messages: [...(t.messages || []), newMessage]
            }
          : t
      )
    );

    setSelectedTicketForDetail(prev =>
      prev
        ? {
            ...prev,
            status: prev.status === 'OPEN' ? 'IN PROGRESS' : prev.status,
            messages: [...(prev.messages || []), newMessage]
          }
        : null
    );

    setDrawerReplyText('');
    onNotify?.(`Reply sent for Ticket ${selectedTicketForDetail.ticketId}`, 'success');
  };

  const handleSendReply = async () => {
    if (!ticketForReply || !replyText.trim()) return;

    const messageText = replyText.trim();
    const ticketTargetId = ticketForReply.id || ticketForReply.ticketId;
    try {
      await fetch(`/api/admin/support/${ticketTargetId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText })
      });
    } catch {
      // Non-blocking
    }

    const newMessage = {
      sender: 'Admin John (Super Admin)',
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      text: messageText,
      isAdmin: true
    };

    setTickets(prev =>
      prev.map(t =>
        t.ticketId === ticketForReply.ticketId
          ? {
              ...t,
              status: 'IN PROGRESS',
              messages: [...(t.messages || []), newMessage]
            }
          : t
      )
    );

    if (selectedTicketForDetail?.ticketId === ticketForReply.ticketId) {
      setSelectedTicketForDetail(prev =>
        prev
          ? {
              ...prev,
              status: 'IN PROGRESS',
              messages: [...(prev.messages || []), newMessage]
            }
          : null
      );
    }

    setReplyText('');
    setTicketForReply(null);
    onNotify?.(`Response sent to ${ticketForReply.createdBy} for ticket ${ticketForReply.ticketId}`, 'success');
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch =
      searchQuery === '' ||
      ticket.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.createdBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.assignedTo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      ticket.status.toUpperCase() === statusFilter.toUpperCase();

    const matchesPriority =
      priorityFilter === 'ALL' ||
      ticket.priority.toUpperCase() === priorityFilter.toUpperCase();

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Support Tickets</h1>
      </div>

      {/* 4 KPI Cards matching Screenshot 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Tickets */}
        <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              OPEN TICKETS
            </span>
            <div className="text-2xl font-bold text-white mt-1.5">{openCount}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <HelpCircle size={18} />
          </div>
        </div>

        {/* Pending */}
        <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              PENDING
            </span>
            <div className="text-2xl font-bold text-white mt-1.5">{pendingCount}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock size={18} />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              IN PROGRESS
            </span>
            <div className="text-2xl font-bold text-white mt-1.5">{inProgressCount}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <MessageSquare size={18} />
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-[#0b1328] border border-[#142038] rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              RESOLVED
            </span>
            <div className="text-2xl font-bold text-white mt-1.5">{resolvedCount}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tickets..."
            className="w-full bg-[#0b1328] border border-[#142038] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status Dropdown */}
        <div className="w-36">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full bg-[#0b1328] border border-[#142038] text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="OPEN">Open</option>
            <option value="IN PROGRESS">In Progress</option>
            <option value="PENDING">Pending</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        {/* Priority Dropdown */}
        <div className="w-36">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="w-full bg-[#0b1328] border border-[#142038] text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Priority</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Tickets Table matching Screenshot 3 */}
      <div className="bg-[#0b1328] border border-[#142038] rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="border-b border-[#142038] text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">TICKET ID</th>
              <th className="py-3 px-4">CREATED BY</th>
              <th className="py-3 px-4">SUBJECT</th>
              <th className="py-3 px-4">CATEGORY</th>
              <th className="py-3 px-4">PRIORITY</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4">ASSIGNED TO</th>
              <th className="py-3 px-4">DATE</th>
              <th className="py-3 px-4 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#142038] text-xs">
            {filteredTickets.map(ticket => (
              <tr
                key={ticket.id}
                className="hover:bg-[#0e1935] transition-colors"
              >
                {/* TICKET ID */}
                <td className="py-3.5 px-4 font-mono font-bold text-[#3b82f6]">
                  <button
                    onClick={() => {
                      setSelectedTicketForDetail(ticket);
                      setDrawerReplyText('');
                    }}
                    className="hover:underline cursor-pointer"
                  >
                    {ticket.ticketId}
                  </button>
                </td>

                {/* CREATED BY - Clickable client name per user request */}
                <td className="py-3.5 px-4 font-medium text-slate-200">
                  <button
                    onClick={() => {
                      setSelectedTicketForDetail(ticket);
                      setDrawerReplyText('');
                    }}
                    className="hover:text-blue-400 hover:underline cursor-pointer text-left font-medium transition-colors"
                  >
                    {ticket.createdBy}
                  </button>
                </td>

                {/* SUBJECT */}
                <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                  {ticket.subject}
                </td>

                {/* CATEGORY */}
                <td className="py-3.5 px-4">
                  <span className="px-2 py-0.5 rounded bg-blue-950/40 text-blue-400 font-mono text-[10px] font-medium border border-blue-900/40">
                    {ticket.category}
                  </span>
                </td>

                {/* PRIORITY */}
                <td className="py-3.5 px-4">
                  <span
                    className={`font-bold text-[10px] uppercase ${
                      ticket.priority === 'HIGH'
                        ? 'text-red-400'
                        : ticket.priority === 'MEDIUM'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {ticket.priority}
                  </span>
                </td>

                {/* STATUS */}
                <td className="py-3.5 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      ticket.status === 'OPEN'
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : ticket.status === 'IN PROGRESS'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : ticket.status === 'PENDING'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {ticket.status}
                  </span>
                </td>

                {/* ASSIGNED TO */}
                <td className="py-3.5 px-4 text-slate-400">
                  {ticket.assignedTo}
                </td>

                {/* DATE */}
                <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                  {ticket.date}
                </td>

                {/* ACTIONS */}
                <td className="py-3.5 px-4 text-right">
                  <div className="flex items-center justify-end gap-2 text-slate-400">
                    <button
                      onClick={() => {
                        setSelectedTicketForDetail(ticket);
                        setDrawerReplyText('');
                      }}
                      title="View Ticket Details"
                      className="p-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <Eye size={14} />
                    </button>
                    {canApprove && (
                      <button
                        onClick={e => handleResolveTicket(ticket.ticketId, e)}
                        title="Mark as Resolved"
                        className="p-1 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => setTicketForReply(ticket)}
                        title="Reply to Ticket"
                        className="p-1 hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ticket Details Right-Side Drawer (Exact match to Screenshot 2026-09-11 004507.png) */}
      {selectedTicketForDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-lg md:max-w-xl bg-[#080f1e] border-l border-[#142038] h-full overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#142038] flex items-center justify-between shrink-0 bg-[#080f1e]">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Ticket {selectedTicketForDetail.ticketId}
              </h2>
              <button
                onClick={() => setSelectedTicketForDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5 flex-1">
              {/* Badges */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    selectedTicketForDetail.priority === 'HIGH'
                      ? 'bg-[#2b1218] border border-[#551b22] text-[#f87171]'
                      : selectedTicketForDetail.priority === 'MEDIUM'
                      ? 'bg-[#2b2110] border border-[#5c4418] text-[#fbbf24]'
                      : 'bg-[#0a1e3b] border border-[#0d3b6f] text-[#38bdf8]'
                  }`}
                >
                  {selectedTicketForDetail.priority}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    selectedTicketForDetail.status === 'OPEN'
                      ? 'bg-[#0a1e3b] border border-[#0d3b6f] text-[#38bdf8]'
                      : selectedTicketForDetail.status === 'IN PROGRESS'
                      ? 'bg-[#082a2e] border border-[#0e5c63] text-[#2dd4bf]'
                      : selectedTicketForDetail.status === 'PENDING'
                      ? 'bg-[#2b2110] border border-[#5c4418] text-[#fbbf24]'
                      : 'bg-[#06261f] border border-[#065f46] text-[#34d399]'
                  }`}
                >
                  {selectedTicketForDetail.status}
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h1 className="text-base font-bold text-white tracking-tight">
                  {selectedTicketForDetail.subject}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  By {selectedTicketForDetail.createdBy} • {selectedTicketForDetail.date}
                </p>
              </div>

              {/* Info Cards */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#091122] border border-[#142038] rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-slate-400 block">Category</span>
                    <span className="text-xs font-bold text-white mt-1 block capitalize">
                      {selectedTicketForDetail.category.toLowerCase()}
                    </span>
                  </div>
                  <div className="bg-[#091122] border border-[#142038] rounded-xl p-3.5">
                    <span className="text-[11px] font-medium text-slate-400 block">Assigned To</span>
                    <span className="text-xs font-bold text-white mt-1 block">
                      {selectedTicketForDetail.assignedTo}
                    </span>
                  </div>
                </div>
                <div className="bg-[#091122] border border-[#142038] rounded-xl p-3.5">
                  <span className="text-[11px] font-medium text-slate-400 block">Created</span>
                  <span className="text-xs font-bold text-white mt-1 block font-mono">
                    {selectedTicketForDetail.date}
                  </span>
                </div>
              </div>

              {/* Conversation Section */}
              <div>
                <span className="text-xs font-medium text-slate-400 block mb-2">Conversation</span>
                <div className="space-y-3">
                  {/* Initial Ticket Message */}
                  <div className="bg-[#091122] border border-[#142038] rounded-xl p-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedTicketForDetail.createdBy.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-white">{selectedTicketForDetail.createdBy}</span>
                      <span className="text-[11px] font-mono text-slate-400">{selectedTicketForDetail.date}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed pl-8">
                      {selectedTicketForDetail.description || selectedTicketForDetail.subject}
                    </p>
                  </div>

                  {/* Subsequent Thread Messages */}
                  {selectedTicketForDetail.messages?.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-4 border ${
                        msg.isAdmin
                          ? 'bg-[#0c162b] border-[#1d2f54]'
                          : 'bg-[#091122] border-[#142038]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className={`w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${
                            msg.isAdmin ? 'bg-emerald-600' : 'bg-[#2563eb]'
                          }`}
                        >
                          {msg.sender.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-white">{msg.sender}</span>
                        <span className="text-[11px] font-mono text-slate-400">{msg.time}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed pl-8">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reply Section */}
              <div>
                <span className="text-xs font-medium text-slate-400 block mb-2">Reply</span>
                <textarea
                  rows={3}
                  value={drawerReplyText}
                  onChange={e => setDrawerReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  className="w-full bg-[#091122] border border-[#142038] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center gap-3 pt-2">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={handleSendDrawerReply}
                    disabled={!drawerReplyText.trim()}
                    className="px-4 py-2 rounded-lg bg-[#0c162b] hover:bg-[#13203c] border border-[#1a2b4c] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Send Reply
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0c162b] border border-[#1a2b4c] text-slate-500 text-xs font-medium">
                    <Lock size={12} className="text-amber-400" />
                    Reply Restricted
                  </span>
                )}
                {selectedTicketForDetail.status !== 'RESOLVED' && canApprove && (
                  <button
                    type="button"
                    onClick={() => handleResolveTicket(selectedTicketForDetail.ticketId)}
                    className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#10b981] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reply Modal */}
      {ticketForReply && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[#0c152a] border border-[#1d2d50] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#162340]">
              <h3 className="text-sm font-bold text-white">
                Reply to Ticket {ticketForReply.ticketId} ({ticketForReply.createdBy})
              </h3>
              <button
                onClick={() => setTicketForReply(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Response Message:
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type your response to the client..."
                  className="w-full bg-[#091020] border border-[#182645] rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTicketForReply(null)}
                className="px-3.5 py-1.5 rounded-lg bg-transparent hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                className="px-4 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Send size={13} />
                Send Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
