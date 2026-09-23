import React, { useState } from 'react';
import {
  X,
  Plus,
  Search,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  ArrowLeft,
  Headphones,
  User,
  Shield
} from 'lucide-react';

export interface SupportTicket {
  id: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
  lastUpdate: string;
  messages: {
    id: string;
    sender: 'CLIENT' | 'SUPPORT';
    senderName: string;
    message: string;
    timestamp: string;
  }[];
}

interface SupportTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportTicketsModal: React.FC<SupportTicketsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'LIST' | 'CREATE' | 'DETAIL'>('LIST');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New ticket form state
  const [category, setCategory] = useState('Trading & Orders');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Reply message in detail view
  const [replyMessage, setReplyMessage] = useState('');

  // Initial tickets matching reference
  const [tickets, setTickets] = useState<SupportTicket[]>([
    {
      id: 'TCK-8812',
      category: 'Trading & Orders',
      priority: 'HIGH',
      subject: 'Order execution rate query on GOLD FUT Intraday',
      status: 'OPEN',
      createdAt: '22 Sep 2026, 11:15 AM',
      lastUpdate: '22 Sep 2026, 11:20 AM',
      messages: [
        {
          id: 'MSG-1',
          sender: 'CLIENT',
          senderName: 'Demo Trader',
          message: 'Hello Support, I noticed an execution variance of 2 ticks on my market buy order for GOLD FUT. Could you please check the exchange timestamp?',
          timestamp: '22 Sep 2026, 11:15 AM'
        },
        {
          id: 'MSG-2',
          sender: 'SUPPORT',
          senderName: 'VERTEX Compliance Desk',
          message: 'Hi Demo Trader, our surveillance team is inspecting the millisecond order matching log for tick variance. We will update this ticket shortly.',
          timestamp: '22 Sep 2026, 11:20 AM'
        }
      ]
    },
    {
      id: 'TCK-7649',
      category: 'Funds & Margin',
      priority: 'MEDIUM',
      subject: 'Instant UPI deposit ledger reconciliation confirmation',
      status: 'RESOLVED',
      createdAt: '21 Sep 2026, 04:30 PM',
      lastUpdate: '21 Sep 2026, 04:32 PM',
      messages: [
        {
          id: 'MSG-3',
          sender: 'CLIENT',
          senderName: 'Demo Trader',
          message: 'Deposited ₹50,000 via UPI Instant GPay. Required confirmation of margin availability.',
          timestamp: '21 Sep 2026, 04:30 PM'
        },
        {
          id: 'MSG-4',
          sender: 'SUPPORT',
          senderName: 'VERTEX Clearing Corp',
          message: 'The transaction has been fully cleared with NPCI UTR: 202609214491. Funds are credited to your Available Margin.',
          timestamp: '21 Sep 2026, 04:32 PM'
        }
      ]
    }
  ]);

  const activeTicket = tickets.find(t => t.id === selectedTicketId);

  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    const newTicket: SupportTicket = {
      id: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      category,
      priority,
      subject: subject.trim(),
      status: 'OPEN',
      createdAt: 'Just now',
      lastUpdate: 'Just now',
      messages: [
        {
          id: `MSG-${Date.now()}`,
          sender: 'CLIENT',
          senderName: 'Demo Trader',
          message: message.trim(),
          timestamp: 'Just now'
        }
      ]
    };

    setTickets([newTicket, ...tickets]);
    setSubject('');
    setMessage('');
    setSelectedTicketId(newTicket.id);
    setMode('DETAIL');
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicketId) return;

    setTickets(prev =>
      prev.map(t => {
        if (t.id === selectedTicketId) {
          return {
            ...t,
            lastUpdate: 'Just now',
            messages: [
              ...t.messages,
              {
                id: `MSG-${Date.now()}`,
                sender: 'CLIENT',
                senderName: 'Demo Trader',
                message: replyMessage.trim(),
                timestamp: 'Just now'
              }
            ]
          };
        }
        return t;
      })
    );
    setReplyMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C]">
          <div className="flex items-center gap-3">
            {mode !== 'LIST' && (
              <button
                type="button"
                onClick={() => setMode('LIST')}
                className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Headphones className="w-5 h-5 text-amber-500" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {mode === 'CREATE' ? 'Create New Ticket' : mode === 'DETAIL' ? `Ticket #${activeTicket?.id}` : 'Support & Compliance Tickets'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'LIST' && (
              <button
                type="button"
                id="new-ticket-btn"
                onClick={() => setMode('CREATE')}
                className="py-1.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>New Ticket</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {mode === 'LIST' && (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* 4 Stats Grid */}
            <div className="grid grid-cols-4 bg-slate-50 dark:bg-[#0B111C] border border-slate-200 dark:border-[#162234] rounded-xl p-3 text-center divide-x divide-slate-200 dark:divide-[#162234]">
              <div>
                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">{totalCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">TOTAL</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-amber-500 font-mono">{openCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">OPEN</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-blue-400 font-mono">{inProgressCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">IN PROGRESS</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black text-emerald-400 font-mono">{resolvedCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">RESOLVED</div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by ticket ID, subject, or category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#182538] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#080E18] p-1 rounded-xl border border-slate-200 dark:border-[#182538]">
                {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                      statusFilter === tab
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket List */}
            <div className="space-y-2">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No tickets found matching your filter.
                </div>
              ) : (
                filteredTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                      setMode('DETAIL');
                    }}
                    className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#0B111C] border border-slate-200 dark:border-[#162234] hover:border-amber-500/50 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-500 text-xs">
                          #{ticket.id}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {ticket.category}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            ticket.priority === 'URGENT'
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : ticket.priority === 'HIGH'
                              ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ticket.status === 'RESOLVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : ticket.status === 'IN_PROGRESS'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {ticket.subject}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200 dark:border-[#142032]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Created: {ticket.createdAt}</span>
                      </span>
                      <span>{ticket.messages.length} messages</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Mode: Create Ticket Form */}
        {mode === 'CREATE' && (
          <form onSubmit={handleCreateTicket} className="p-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#182538] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="Trading & Orders">Trading & Orders</option>
                  <option value="Funds & Margin">Funds & Margin</option>
                  <option value="KYC & Account">KYC & Account</option>
                  <option value="Technical Bug">Technical Bug</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#182538] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                Subject
              </label>
              <input
                type="text"
                required
                placeholder="Brief summary of the issue..."
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#182538] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                Detailed Message
              </label>
              <textarea
                required
                rows={5}
                placeholder="Describe your issue with exact order ID, symbol, or transaction details..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#182538] rounded-xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#162234]">
              <button
                type="button"
                onClick={() => setMode('LIST')}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer"
              >
                Submit Ticket
              </button>
            </div>
          </form>
        )}

        {/* Mode: Ticket Detail & Conversation */}
        {mode === 'DETAIL' && activeTicket && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Ticket Info Header */}
            <div className="p-4 bg-slate-50 dark:bg-[#09111D] border-b border-slate-200 dark:border-[#162234] space-y-1 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-500">
                  #{activeTicket.id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeTicket.status === 'RESOLVED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {activeTicket.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeTicket.subject}
              </h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>Category: {activeTicket.category}</span>
                <span>•</span>
                <span>Priority: {activeTicket.priority}</span>
              </p>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {activeTicket.messages.map(msg => {
                const isMe = msg.sender === 'CLIENT';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                      {isMe ? <User className="w-3 h-3 text-amber-500" /> : <Shield className="w-3 h-3 text-emerald-400" />}
                      <span className="font-bold">{msg.senderName}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                          : 'bg-slate-100 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1A2638] text-slate-900 dark:text-slate-100 rounded-bl-xs'
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply Input Bar */}
            <form onSubmit={handleSendReply} className="p-3 bg-slate-50 dark:bg-[#0B111C] border-t border-slate-200 dark:border-[#162234] flex gap-2 shrink-0">
              <input
                type="text"
                placeholder="Type your message to compliance support..."
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                className="flex-1 bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
