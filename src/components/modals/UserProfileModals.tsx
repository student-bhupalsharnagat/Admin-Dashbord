import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  Lock,
  Key,
  Settings,
  Check,
  Smartphone,
  Laptop,
  AlertTriangle,
  Eye,
  EyeOff,
  Bell,
  Volume2,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { AuthUser } from '../../types';
import { useTheme } from '../../context/ThemeContext';

interface UserProfileModalsProps {
  activeModal: 'profile' | 'security' | 'password' | 'settings' | null;
  onClose: () => void;
  currentUser?: AuthUser | null;
  onUpdateUser?: (updated: Partial<AuthUser>) => void;
}

export const UserProfileModals: React.FC<UserProfileModalsProps> = ({
  activeModal,
  onClose,
  currentUser,
  onUpdateUser
}) => {
  const { theme, setTheme } = useTheme();
  // My Profile Form State
  const [profileName, setProfileName] = useState(currentUser?.name || 'Admin John');
  const [profilePhone, setProfilePhone] = useState('+91 98230 44910');
  const [profileDepartment, setProfileDepartment] = useState('Central Operations');
  const [profileSaved, setProfileSaved] = useState(false);

  // Security State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionRevoked, setSessionRevoked] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Settings State
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [orderConfirmation, setOrderConfirmation] = useState(true);
  const [emailDigests, setEmailDigests] = useState(true);
  const [compactDensity, setCompactDensity] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  if (!activeModal) return null;

  // Handle Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      onUpdateUser({ name: profileName });
    }
    setProfileSaved(true);
    setTimeout(() => {
      setProfileSaved(false);
      onClose();
    }, 1200);
  };

  // Handle Change Password Submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordSuccess(true);
    setTimeout(() => {
      setPasswordSuccess(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    }, 1500);
  };

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaved(true);
    setTimeout(() => {
      setSettingsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0b1325] border border-[#1b2b4d] rounded-2xl shadow-2xl shadow-black/90 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal 1: MY PROFILE */}
        {activeModal === 'profile' && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#182647] bg-[#0e172e]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">My Profile</h3>
                  <p className="text-[11px] text-slate-400">Personal details & administrator role</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              {/* Profile Card Summary */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#0f1930] border border-[#1e2f54]">
                <div className="w-14 h-14 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold text-xl shadow-lg shrink-0">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-white truncate">
                    {currentUser?.name || 'Admin John'}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {currentUser?.email || 'admin@platform.com'}
                  </div>
                  <div className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-semibold tracking-wider uppercase">
                    <Shield size={10} />
                    {currentUser?.role ? currentUser.role.replace(/_/g, ' ') : 'SUPER ADMIN'}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#090f1d] border border-[#1a2948] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={currentUser?.email || 'admin@platform.com'}
                    disabled
                    className="w-full px-3 py-2 bg-[#090f1d]/50 border border-[#1a2948] rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Phone Number</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090f1d] border border-[#1a2948] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Department / Unit</label>
                  <input
                    type="text"
                    value={profileDepartment}
                    onChange={e => setProfileDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-[#090f1d] border border-[#1a2948] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Meta Read-Only Info */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#090f1d] border border-[#182647] text-[11px]">
                <div>
                  <span className="text-slate-500 block">Assigned Scope</span>
                  <span className="text-slate-200 font-medium">Global Central Platform</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Account Status</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active & Verified
                  </span>
                </div>
              </div>

              {/* Feedback & Actions */}
              {profileSaved && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} /> Profile updated successfully!
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-md shadow-blue-600/30"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal 2: SECURITY */}
        {activeModal === 'security' && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#182647] bg-[#0e172e]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Security & Access Control</h3>
                  <p className="text-[11px] text-slate-400">Multi-Factor Authentication & active session management</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* 2FA Card */}
              <div className="p-4 rounded-xl bg-[#0f1930] border border-[#1e2f54] flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Smartphone size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs">Two-Factor Authentication (2FA)</div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Protect your admin account with TOTP authenticator app verification.
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-emerald-400">
                      <Check size={12} /> {twoFactorEnabled ? 'Enabled & Active' : 'Disabled (Not Recommended)'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Active Sessions */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                    Active Devices & Sessions
                  </h4>
                  <span className="text-[10px] text-slate-500">2 connected</span>
                </div>

                <div className="space-y-2.5">
                  {/* Session 1 */}
                  <div className="p-3 rounded-xl bg-[#090f1d] border border-[#1a2948] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        <Laptop size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>Chrome / macOS</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            Current Device
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          IP: 103.21.244.12 • Mumbai, India • Active now
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Session 2 */}
                  <div className="p-3 rounded-xl bg-[#090f1d] border border-[#1a2948] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                        <Smartphone size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-white">TradeMatrix Mobile iOS</div>
                        <div className="text-[10px] text-slate-400">
                          IP: 49.36.128.91 • New Delhi, India • 2 hours ago
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {sessionRevoked && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 size={15} /> All secondary sessions have been revoked.
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSessionRevoked(true)}
                  className="mt-3 w-full py-2 px-3 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-colors text-center"
                >
                  Revoke All Other Sessions
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal 3: CHANGE PASSWORD */}
        {activeModal === 'password' && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#182647] bg-[#0e172e]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Change Password</h3>
                  <p className="text-[11px] text-slate-400">Update your security credentials</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4 text-xs">
              {/* Current Password */}
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                    className="w-full pl-3 pr-10 py-2 bg-[#090f1d] border border-[#1a2948] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters with numbers & symbols"
                    required
                    className="w-full pl-3 pr-10 py-2 bg-[#090f1d] border border-[#1a2948] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Password Strength Visualizer */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Password strength:</span>
                      <span
                        className={`font-semibold ${
                          newPassword.length >= 10
                            ? 'text-emerald-400'
                            : newPassword.length >= 6
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {newPassword.length >= 10 ? 'Strong' : newPassword.length >= 6 ? 'Medium' : 'Weak'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          newPassword.length >= 10
                            ? 'w-full bg-emerald-500'
                            : newPassword.length >= 6
                            ? 'w-2/3 bg-amber-500'
                            : 'w-1/3 bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  className="w-full px-3 py-2 bg-[#090f1d] border border-[#1a2948] rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={15} /> {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} /> Password changed successfully!
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-md shadow-blue-600/30"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal 4: SETTINGS */}
        {activeModal === 'settings' && (
          <div>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#182647] bg-[#0e172e]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Settings size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">System & Preferences</h3>
                  <p className="text-[11px] text-slate-400">Adjust personal trading alerts and platform UI</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-6 space-y-4 text-xs">
              {/* Setting 0: Theme Mode (Dark & Light) */}
              <div className="p-3.5 rounded-xl bg-[#090f1d] border border-[#1a2948] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Appearance & Theme</div>
                    <p className="text-[11px] text-slate-400">Choose dashboard interface lighting theme</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider">
                    {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Dark Mode Card */}
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                        : 'border-[#1a2948] bg-[#070d19] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#0b1328] border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                      <Moon size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-white">Dark Mode</div>
                      <div className="text-[10px] text-slate-400 truncate">Obsidian & Navy</div>
                    </div>
                  </button>

                  {/* Light Mode Card */}
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-500/10 text-white shadow-sm'
                        : 'border-[#1a2948] bg-[#070d19] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                      <Sun size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-white">Light Mode</div>
                      <div className="text-[10px] text-slate-400 truncate">Clean Slate & Daylight</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Setting 1: Audio alerts */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090f1d] border border-[#1a2948]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                    <Volume2 size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Real-Time Audio Alerts</div>
                    <p className="text-[11px] text-slate-400">Play chime on trade execution and margin warning</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundAlerts(!soundAlerts)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    soundAlerts ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      soundAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 2: Order confirmation */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090f1d] border border-[#1a2948]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Order Confirmations</div>
                    <p className="text-[11px] text-slate-400">Require double confirmation on square-offs & liquidations</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOrderConfirmation(!orderConfirmation)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    orderConfirmation ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      orderConfirmation ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 3: Email digests */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090f1d] border border-[#1a2948]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Bell size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">Daily Summary Digest</div>
                    <p className="text-[11px] text-slate-400">Receive market close P&L and broker commission reports</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailDigests(!emailDigests)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailDigests ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      emailDigests ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settingsSaved && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 size={15} /> Preferences saved successfully!
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-md shadow-blue-600/30"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
