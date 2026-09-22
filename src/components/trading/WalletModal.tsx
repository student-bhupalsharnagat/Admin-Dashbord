import React, { useState } from 'react';
import { X, Wallet, ArrowDownRight, ArrowUpRight, Copy, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { ClientWallet } from '../../types/trading';

interface WalletModalProps {
  isOpen: boolean;
  wallet: ClientWallet;
  onClose: () => void;
  onDeposit: (amount: number, method: string) => void;
  onWithdraw: (amount: number, bank: string) => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  wallet,
  onClose,
  onDeposit,
  onWithdraw
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'WITHDRAW' | 'TRANSACTIONS'>('DEPOSIT');
  const [depositAmount, setDepositAmount] = useState('50000');
  const [depositMethod, setDepositMethod] = useState<'UPI' | 'NETBANKING'>('UPI');
  const [withdrawAmount, setWithdrawAmount] = useState('10000');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank •••• 8912');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const quickAmounts = ['10000', '25000', '50000', '100000', '250000'];

  const [transactions, setTransactions] = useState([
    { id: 'TX-901', type: 'DEPOSIT', amount: 50000, method: 'UPI Instant (GPay)', status: 'SUCCESS', time: 'Today, 10:45 AM', refId: 'UPI/2026/892183' },
    { id: 'TX-902', type: 'MARGIN_CREDIT', amount: 14200, method: 'Position Exit Realized P&L', status: 'SUCCESS', time: 'Today, 02:15 PM', refId: 'TRD/2026/091244' },
    { id: 'TX-903', type: 'DEPOSIT', amount: 100000, method: 'Net Banking (HDFC)', status: 'SUCCESS', time: 'Yesterday, 09:12 AM', refId: 'NB/2026/410291' },
    { id: 'TX-904', type: 'WITHDRAWAL', amount: 25000, method: 'IMPS to HDFC Bank (8912)', status: 'SUCCESS', time: '28 Aug, 04:30 PM', refId: 'WDR/2026/184910' }
  ]);

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 100) return;

    setIsProcessing(true);
    setTimeout(() => {
      onDeposit(amt, depositMethod === 'UPI' ? 'UPI Instant (GPay)' : 'Net Banking (HDFC)');
      setTransactions(prev => [
        {
          id: `TX-${Date.now().toString().slice(-4)}`,
          type: 'DEPOSIT',
          amount: amt,
          method: depositMethod === 'UPI' ? 'UPI Instant (GPay)' : 'Net Banking',
          status: 'SUCCESS',
          time: 'Just now',
          refId: `REF/${Date.now().toString().slice(-6)}`
        },
        ...prev
      ]);
      setIsProcessing(false);
      setActiveTab('TRANSACTIONS');
    }, 600);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt > wallet.availableBalance) return;

    setIsProcessing(true);
    setTimeout(() => {
      onWithdraw(amt, selectedBank);
      setTransactions(prev => [
        {
          id: `TX-${Date.now().toString().slice(-4)}`,
          type: 'WITHDRAWAL',
          amount: amt,
          method: `IMPS to ${selectedBank}`,
          status: 'SUCCESS',
          time: 'Just now',
          refId: `WDR/${Date.now().toString().slice(-6)}`
        },
        ...prev
      ]);
      setIsProcessing(false);
      setActiveTab('TRANSACTIONS');
    }, 600);
  };

  const copyVpa = () => {
    navigator.clipboard?.writeText('pay.vertextrading@hdfcbank');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in">
      <div
        className="w-full max-w-xl bg-white dark:bg-[#070D18] border border-slate-200 dark:border-[#1A2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1A2638] bg-slate-50 dark:bg-[#0B111C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                Trading Wallet & Funds
              </h3>
              <p className="text-[11px] text-slate-500">Instant deposits & 24/7 withdrawals</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Overview Cards */}
        <div className="p-5 border-b border-slate-100 dark:border-[#142032] bg-slate-50/50 dark:bg-[#09111D]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-[#1A2638]">
              <span className="text-[10px] text-slate-400 block font-semibold">Available</span>
              <span className="text-sm font-mono font-bold text-amber-500 mt-0.5 block truncate">
                ₹{wallet.availableBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-[#1A2638]">
              <span className="text-[10px] text-slate-400 block font-semibold">Used Margin</span>
              <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200 mt-0.5 block truncate">
                ₹{wallet.usedMargin.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-[#1A2638]">
              <span className="text-[10px] text-slate-400 block font-semibold">Today's P&L</span>
              <span className="text-sm font-mono font-bold text-emerald-500 mt-0.5 block truncate">
                +₹{wallet.todayPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#0E1626] border border-slate-200 dark:border-[#1A2638]">
              <span className="text-[10px] text-slate-400 block font-semibold">Total P&L</span>
              <span className="text-sm font-mono font-bold text-emerald-500 mt-0.5 block truncate">
                +₹{wallet.totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-[#1A2638] px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('DEPOSIT')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'DEPOSIT'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Deposit Funds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('WITHDRAW')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'WITHDRAW'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Withdraw Funds
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TRANSACTIONS')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'TRANSACTIONS'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Ledger & History
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'DEPOSIT' && (
            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Payment Method Toggle */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                  Deposit Method
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#070D18] p-1 rounded-xl border border-slate-200 dark:border-[#162234]">
                  <button
                    type="button"
                    onClick={() => setDepositMethod('UPI')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      depositMethod === 'UPI' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    UPI Instant (GPay / PhonePe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositMethod('NETBANKING')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      depositMethod === 'NETBANKING' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    Net Banking (Instant)
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                  Deposit Amount (₹)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] focus:border-amber-500 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-slate-900 dark:text-white outline-none"
                  placeholder="Enter amount"
                />
              </div>

              {/* Quick Amounts */}
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-slate-100 dark:bg-[#0E1626] border border-slate-200 dark:border-[#1E2E44] text-slate-700 dark:text-slate-300 hover:border-amber-500 cursor-pointer"
                  >
                    +₹{parseInt(amt).toLocaleString()}
                  </button>
                ))}
              </div>

              {depositMethod === 'UPI' ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Merchant VPA:</span>
                    <button
                      type="button"
                      onClick={copyVpa}
                      className="text-amber-500 font-mono font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>pay.vertextrading@hdfcbank</span>
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Scan or transfer to this verified trading merchant VPA for zero-fee instant deposit.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234] text-xs space-y-1">
                  <span className="text-slate-400 block font-semibold">Supported Banks:</span>
                  <span className="text-slate-300">HDFC Bank, ICICI Bank, State Bank of India, Axis Bank, Kotak Mahindra.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessing ? 'Processing Instant Deposit...' : `Deposit ₹${parseInt(depositAmount || '0').toLocaleString()} to Margin`}
              </button>
            </form>
          )}

          {activeTab === 'WITHDRAW' && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">
                  Withdrawal Bank Account
                </label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedBank}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10">
                    VERIFIED
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">
                    Withdrawal Amount (₹)
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Max: ₹{wallet.availableBalance.toLocaleString()}
                  </span>
                </div>
                <input
                  type="number"
                  min="500"
                  max={wallet.availableBalance}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#162234] focus:border-amber-500 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#09111D] border border-slate-200 dark:border-[#162234] text-xs text-slate-400 space-y-1">
                <p>• Payout is processed instantly via IMPS to your registered bank account.</p>
                <p>• Zero withdrawal charges apply.</p>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessing ? 'Processing IMPS Transfer...' : `Withdraw ₹${parseInt(withdrawAmount || '0').toLocaleString()} to Bank`}
              </button>
            </form>
          )}

          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-2.5">
              {transactions.map(tx => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#162234] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        tx.type === 'DEPOSIT' || tx.type === 'MARGIN_CREDIT'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      {tx.type === 'DEPOSIT' || tx.type === 'MARGIN_CREDIT' ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {tx.method}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {tx.time} • Ref: {tx.refId}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-mono font-bold block ${
                        tx.type === 'DEPOSIT' || tx.type === 'MARGIN_CREDIT'
                          ? 'text-emerald-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.type === 'DEPOSIT' || tx.type === 'MARGIN_CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
