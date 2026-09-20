import React, { useState } from 'react';
import {
  TrendingUp,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Building,
  CheckCircle,
  HelpCircle,
  X,
  ArrowRight,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { AuthUser, Tenant, UserRole } from '../../types';

interface AuthScreenProps {
  onLogin: (user: AuthUser) => void;
  tenants: Tenant[];
}

type DemoRoleKey = 'Super Admin' | 'Master' | 'Broker' | 'Sub-Broker' | 'Client';

interface DemoAccountConfig {
  key: DemoRoleKey;
  label: string;
  email: string;
  role: UserRole;
  name: string;
  tenantId: string;
  tenantName: string;
  password: string;
}

const DEMO_ACCOUNTS: Record<DemoRoleKey, DemoAccountConfig> = {
  'Super Admin': {
    key: 'Super Admin',
    label: 'Super Admin',
    email: 'admin@platform.com',
    role: 'SUPER_ADMIN',
    name: 'Admin John',
    tenantId: 'GLOBAL',
    tenantName: 'All Tenants (Global Scope)',
    password: 'password123'
  },
  'Master': {
    key: 'Master',
    label: 'Master',
    email: 'master@alphaprime.com',
    role: 'MASTER',
    name: 'Suresh Nambiar',
    tenantId: 'TNT-001',
    tenantName: 'Alpha Prime Capital',
    password: 'password123'
  },
  'Broker': {
    key: 'Broker',
    label: 'Broker',
    email: 'broker@alphaprime.com',
    role: 'BROKER',
    name: 'Rajesh Mehta',
    tenantId: 'TNT-001',
    tenantName: 'Alpha Prime Capital',
    password: 'password123'
  },
  'Sub-Broker': {
    key: 'Sub-Broker',
    label: 'Sub-Broker',
    email: 'subbroker@alphaprime.com',
    role: 'SUB_BROKER',
    name: 'Vikram Singhania',
    tenantId: 'TNT-001',
    tenantName: 'Alpha Prime Capital',
    password: 'password123'
  },
  'Client': {
    key: 'Client',
    label: 'Client',
    email: 'client@alphaprime.com',
    role: 'CLIENT',
    name: 'Arjun Patel',
    tenantId: 'TNT-001',
    tenantName: 'Alpha Prime Capital',
    password: 'password123'
  }
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, tenants }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [selectedDemoRole, setSelectedDemoRole] = useState<DemoRoleKey>('Super Admin');

  // Sign in form state (prefilled with exact email from screenshot)
  const [email, setEmail] = useState('admin@platform.com');
  const [password, setPassword] = useState('password123');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sign up form state
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpRole, setSignUpRole] = useState<UserRole>('CLIENT');
  const [signUpTenantId, setSignUpTenantId] = useState(tenants[0]?.id || 'TNT-001');
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Modals
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Quick Login click
  const handleSelectDemoAccount = (roleKey: DemoRoleKey) => {
    setSelectedDemoRole(roleKey);
    const demo = DEMO_ACCOUNTS[roleKey];
    setEmail(demo.email);
    setPassword(demo.password);
    setErrorMessage('');
  };

  // Handle Sign In submission
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password
        }),
        credentials: 'include'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Authentication failed');
      }

      if (data.user) {
        onLogin(data.user);
      } else {
        throw new Error('No user data returned from authentication server');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sign Up submission
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword) {
      setErrorMessage('Please fill out all required fields.');
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms of Service to continue.');
      return;
    }

    if (signUpPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpName.trim(),
          email: signUpEmail.trim(),
          password: signUpPassword,
          role: signUpRole,
          tenantId: signUpTenantId
        }),
        credentials: 'include'
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onLogin(data.user);
      } else {
        throw new Error(data.message || data.error || 'Account registration failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Account registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050811] text-slate-100 flex flex-col lg:grid lg:grid-cols-2 relative selection:bg-blue-600 selection:text-white">
      {/* LEFT SIDE: Platform Branding, Mission & Live Platform Metrics */}
      <div className="relative bg-[#060b17] border-b lg:border-b-0 lg:border-r border-[#15223e] flex flex-col justify-between p-6 sm:p-10 lg:p-16 overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Brand Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
            <TrendingUp size={22} className="stroke-[2.5]" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            TradeMatrix
          </span>
        </div>

        {/* Center Content: Title, Description, 2x2 Metric Cards */}
        <div className="relative z-10 my-10 lg:my-auto max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.12]">
            Multi-Tenant
            <br />
            Trading Platform
          </h1>

          <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed max-w-lg">
            Full-stack broker management system with real-time trading, KYC compliance, fund management, and hierarchical user control.
          </p>

          {/* 2x2 Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-10">
            {/* Card 1 */}
            <div className="bg-[#0b1325]/70 border border-[#172544] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#38bdf8] tracking-tight">
                3,073
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Active Clients
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0b1325]/70 border border-[#172544] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#38bdf8] tracking-tight">
                ₹172M
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Total Volume
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0b1325]/70 border border-[#172544] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#38bdf8] tracking-tight">
                98.7%
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Uptime SLA
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-[#0b1325]/70 border border-[#172544] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#38bdf8] tracking-tight">
                43
              </div>
              <div className="text-xs text-slate-400 font-medium mt-1">
                Active Brokers
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="relative z-10 text-xs text-slate-500 font-medium">
          © 2024 TradeMatrix. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Form (Sign In / Sign Up) */}
      <div className="relative bg-[#050811] flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14 min-h-[600px]">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {authMode === 'signin' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {authMode === 'signin'
                ? 'Sign in to your account to continue'
                : 'Register as a tenant broker, sub-broker, or trading client'}
            </p>
          </div>

          {/* Quick Login Demo Accounts Box (Shown in Sign-In mode) */}
          {authMode === 'signin' && (
            <div className="bg-[#0b1325]/50 border border-[#172544] rounded-xl p-3.5 sm:p-4 mb-6">
              <span className="text-[11px] text-slate-400 font-medium block mb-2.5">
                Quick login (demo accounts):
              </span>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {(['Super Admin', 'Master', 'Broker', 'Sub-Broker', 'Client'] as DemoRoleKey[]).map(roleKey => {
                  const isSelected = selectedDemoRole === roleKey;
                  return (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => handleSelectDemoAccount(roleKey)}
                      className={`px-2.5 sm:px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-[#152445] text-white border border-blue-500/50 shadow-sm shadow-blue-500/10'
                          : 'bg-[#0d172e] text-slate-300 border border-[#1b2b4d] hover:bg-[#13203e] hover:text-white'
                      }`}
                    >
                      {roleKey}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              {errorMessage}
            </div>
          )}

          {/* SIGN IN FORM */}
          {authMode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email / Username Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email / Username
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@platform.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#091021] border border-[#1a2849] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[#091021] border border-[#1a2849] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password row */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded bg-[#091021] border-[#1a2849] text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotPassword(true);
                    setForgotSubmitted(false);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary Sign In Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 bg-[#2563eb] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg shadow-lg shadow-blue-600/30 active:scale-[0.99] transition-all cursor-pointer"
              >
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>

              {/* Toggle to Sign Up */}
              <div className="text-center pt-3 text-xs text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setErrorMessage('');
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  Sign Up
                </button>
              </div>
            </form>
          ) : (
            /* SIGN UP FORM */
            <form onSubmit={handleSignUp} className="space-y-3.5">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    required
                    value={signUpName}
                    onChange={e => setSignUpName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-4 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Business Email
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={e => setSignUpEmail(e.target.value)}
                    placeholder="rahul@tradepro.io"
                    className="w-full pl-10 pr-4 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Role & Tenant Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Role Category
                  </label>
                  <select
                    value={signUpRole}
                    onChange={e => setSignUpRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CLIENT">Client (Trader)</option>
                    <option value="SUB_BROKER">Sub-Broker</option>
                    <option value="BROKER">Broker</option>
                    <option value="MASTER">Master Franchise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Affiliated Tenant
                  </label>
                  <select
                    value={signUpTenantId}
                    onChange={e => setSignUpTenantId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Create Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="password"
                    required
                    value={signUpPassword}
                    onChange={e => setSignUpPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-10 pr-4 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="password"
                    required
                    value={signUpConfirmPassword}
                    onChange={e => setSignUpConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-10 pr-4 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Agree to terms */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="w-3.5 h-3.5 mt-0.5 rounded bg-[#091021] border-[#1a2849] text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>
                    I accept the{' '}
                    <span className="text-blue-400 hover:underline">Terms of Service</span> and{' '}
                    <span className="text-blue-400 hover:underline">Privacy Policy</span>.
                  </span>
                </label>
              </div>

              {/* Submit Sign Up */}
              <button
                type="submit"
                className="w-full mt-2 py-2.5 px-4 bg-[#2563eb] hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-lg shadow-blue-600/30 transition-all"
              >
                Create Account
              </button>

              {/* Toggle to Sign In */}
              <div className="text-center pt-2 text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage('');
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* FLOATING HELP BUTTON: Bottom-Right (as in screenshot) */}
      <button
        onClick={() => setShowHelpModal(true)}
        className="fixed bottom-6 right-6 w-9 h-9 rounded-full bg-white text-slate-900 font-bold text-sm flex items-center justify-center shadow-xl hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all z-30"
        title="Platform Help & Demo Credentials"
        aria-label="Platform Help"
      >
        ?
      </button>

      {/* HELP & DEMO ACCOUNTS MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-[#172544] rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#172544]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">TradeMatrix Demo Access</h3>
                  <p className="text-xs text-slate-400">Multi-tenant role hierarchy reference</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Click any of the role badges on the login screen to automatically test the platform under that persona:
              </p>

              {Object.values(DEMO_ACCOUNTS).map(acc => (
                <div
                  key={acc.key}
                  onClick={() => {
                    handleSelectDemoAccount(acc.key);
                    setShowHelpModal(false);
                  }}
                  className="p-3 rounded-xl bg-[#0e1933] border border-[#1a2d54] hover:border-blue-500/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{acc.label}</span>
                    <span className="font-mono text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Email: <span className="font-mono text-slate-200">{acc.email}</span>
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">
                    Tenant: {acc.tenantName}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#172544] flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1325] border border-[#172544] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#172544]">
              <h3 className="text-base font-bold text-white">Reset Password</h3>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {forgotSubmitted ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle size={24} />
                </div>
                <h4 className="text-sm font-semibold text-white">Reset Link Sent</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  If an account exists for <span className="text-white font-mono">{forgotEmail}</span>, instructions have been sent.
                </p>
                <button
                  onClick={() => setShowForgotPassword(false)}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (forgotEmail.trim()) {
                    setForgotSubmitted(true);
                  }
                }}
                className="py-4 space-y-4 text-xs"
              >
                <p className="text-slate-300">
                  Enter your registered business email and we will generate an emergency recovery link.
                </p>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="admin@platform.com"
                    className="w-full px-3 py-2 bg-[#091021] border border-[#1a2849] rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="px-3 py-2 rounded-lg bg-[#0e172e] text-slate-300 hover:bg-[#13203e]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
