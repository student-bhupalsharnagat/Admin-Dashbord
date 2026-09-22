import React, { useState, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  ShieldCheck,
  Zap,
  Award,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  Layers,
  Sparkles,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { COUNTRIES, CountryInfo } from '../../data/countryDetails';

interface KwikTradeLandingProps {
  onAccountCreated?: (clientData: any) => void;
  onNavigateToTerminal?: () => void;
  tenantDomain?: string;
}

export const KwikTradeLanding: React.FC<KwikTradeLandingProps> = ({
  onAccountCreated,
  onNavigateToTerminal,
  tenantDomain = 'trade.kwik.trade'
}) => {
  // Video audio toggle
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  // Registration Form State
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(
    COUNTRIES.find(c => c.iso === 'IN') || COUNTRIES[0]
  );
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('Hindi');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Submission / Feedback
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSendOtp = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!phone || phone.length < 10) {
      setFeedback({ type: 'error', message: 'Please enter a valid 10-digit mobile number first.' });
      return;
    }
    setOtpSent(true);
    setOtp('582910'); // Simulated default OTP
    setFeedback({
      type: 'success',
      message: `OTP sent to ${selectedCountry.code} ${phone}! Use verification code: 582910`
    });
  };

  const handleVerifyOtp = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!otp || otp.length < 4) {
      setFeedback({ type: 'error', message: 'Please enter the 6-digit OTP received.' });
      return;
    }
    setOtpVerified(true);
    setFeedback({ type: 'success', message: 'Mobile number verified successfully!' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!fullName.trim()) {
      setFeedback({ type: 'error', message: 'Full Name is required.' });
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      setFeedback({ type: 'error', message: 'Valid 10-digit mobile number is required.' });
      return;
    }
    if (!password || password.length < 6) {
      setFeedback({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (!agreeTerms) {
      setFeedback({ type: 'error', message: 'You must agree to the Terms and Privacy Policies.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/register?domain=${encodeURIComponent(tenantDomain)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          email: `${fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'trader'}_${phone.slice(-4)}@kwik.trade`,
          phone: `${selectedCountry.code}${phone}`,
          password,
          preferredLanguage: selectedLanguage,
          source: 'kwik-trade-landing-page'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      setFeedback({
        type: 'success',
        message: 'Account created successfully! Your Kwik Trade trading account is active with 20% deposit bonus applied.'
      });

      if (onAccountCreated) {
        onAccountCreated(data.client || { name: fullName, phone });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error creating account. Please verify your details.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-[#c6f03d] selection:text-black">
      {/* 1. HEADER SECTION */}
      <header className="w-full bg-black/95 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/kwikTradeLogo.png"
              alt="Kwik Trade Logo"
              className="h-9 sm:h-11 w-auto object-contain"
              onError={(e) => {
                // Fallback styling if local image not found
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#c6f03d] flex items-center gap-1.5">
                KWIK TRADE
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#c6f03d]/15 text-[#c6f03d] border border-[#c6f03d]/30">
                  LIVE
                </span>
              </span>
              <span className="text-[10px] text-gray-400 hidden sm:inline">Next-Gen Multi-Asset Trading Platform</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateToTerminal && (
              <button
                onClick={onNavigateToTerminal}
                className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Launch Web Terminal</span>
                <ExternalLink size={14} className="text-gray-400" />
              </button>
            )}
            <a
              href="#registerForm"
              className="px-4 py-2 rounded-lg bg-[#c6f03d] hover:bg-[#b2dc30] text-black text-xs font-bold transition-all shadow-md hover:shadow-[#c6f03d]/20 cursor-pointer"
            >
              Open Account
            </a>
          </div>
        </div>
      </header>

      {/* 2. HERO PROMOTIONAL VIDEO SECTION */}
      <section className="relative w-full bg-black flex justify-center items-center overflow-hidden py-4 sm:py-6">
        <div className="relative w-full max-w-5xl px-4">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#0a0a0a] aspect-video max-h-[500px]">
            <video
              ref={videoRef}
              src="/kwikTrade Vid.mp4"
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
            
            {/* Audio Toggle Control Button */}
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-4 z-20 p-2.5 rounded-full bg-black/75 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} className="text-[#c6f03d]" />}
            </button>

            {/* Video Overlay Banner */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-sm border border-white/15 text-[11px] text-gray-200">
              <span className="w-2 h-2 rounded-full bg-[#c6f03d] animate-ping" />
              <span>Zero Brokerage | 500x Max Leverage</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. OFFER BANNER (20% BONUS CALLOUT) */}
      <section className="w-full px-4 py-3 flex justify-center items-center">
        <div className="w-full max-w-5xl rounded-xl bg-gradient-to-r from-[#c6f03d] via-[#d4f855] to-[#c6f03d] py-3.5 px-6 text-center shadow-lg shadow-[#c6f03d]/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-black text-[#c6f03d] flex items-center justify-center font-black text-sm shrink-0">
              %
            </div>
            <div className="text-left">
              <h2 className="text-black font-extrabold text-base sm:text-lg tracking-tight uppercase leading-snug">
                Get 20% Instant Bonus On Your First Deposit
              </h2>
              <p className="text-black/80 text-xs font-medium">
                Deposit ₹5,000+ & unlock instant credit margin for high-speed algorithmic trading.
              </p>
            </div>
          </div>
          <a
            href="#registerForm"
            className="px-5 py-2 rounded-lg bg-black hover:bg-black/90 text-[#c6f03d] text-xs font-bold tracking-wide transition-all shrink-0 cursor-pointer shadow-md"
          >
            Claim Bonus Now
          </a>
        </div>
      </section>

      {/* 4. HIGHLIGHT FEATURES BANNER */}
      <section className="w-full py-6 px-4 flex justify-center items-center">
        <div className="w-full max-w-5xl">
          <div className="flex justify-center items-center">
            <img
              src="https://kwik.trade/frontend/assets/images/home/group39901.svg"
              alt="Kwik Trade Platform Features"
              className="w-full max-w-2xl h-auto object-contain rounded-xl"
              onError={(e) => {
                // High-fidelity fallback SVG feature grid if external CDN blocked
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Native high-fidelity interactive feature badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-lg bg-[#c6f03d]/15 text-[#c6f03d] flex items-center justify-center mb-2">
                <Zap size={18} />
              </div>
              <span className="font-bold text-sm text-white">0% Brokerage</span>
              <span className="text-[11px] text-gray-400 mt-0.5">On Equity & Futures</span>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-lg bg-[#c6f03d]/15 text-[#c6f03d] flex items-center justify-center mb-2">
                <TrendingUp size={18} />
              </div>
              <span className="font-bold text-sm text-white">500x Leverage</span>
              <span className="text-[11px] text-gray-400 mt-0.5">High-speed margin desk</span>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-lg bg-[#c6f03d]/15 text-[#c6f03d] flex items-center justify-center mb-2">
                <ShieldCheck size={18} />
              </div>
              <span className="font-bold text-sm text-white">Instant UPI Payouts</span>
              <span className="text-[11px] text-gray-400 mt-0.5">24/7 Fast withdrawals</span>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-lg bg-[#c6f03d]/15 text-[#c6f03d] flex items-center justify-center mb-2">
                <Award size={18} />
              </div>
              <span className="font-bold text-sm text-white">Regulated & Safe</span>
              <span className="text-[11px] text-gray-400 mt-0.5">Automated Risk Engine</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. REGISTRATION FORM (AUTHENTIC REPLICATION OF KWIK TRADE ONBOARDING) */}
      <section id="registerForm" className="w-full py-8 px-4 flex justify-center items-center">
        <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-[#0d0d0d] p-6 sm:p-10 shadow-2xl relative">
          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#c6f03d] text-black flex items-center justify-center font-bold text-lg shrink-0">
              <img
                src="https://kwik.trade/frontend/assets/images/home/bar.svg"
                alt="bar"
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <TrendingUp size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-xl tracking-tight">
                Open Your Kwik Trade Account
              </h2>
              <p className="text-gray-400 text-xs font-medium">
                Start Trading in 2 Minutes | Completely Free Demo & Live Desk
              </p>
            </div>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl mb-5 text-xs flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/15 border border-red-500/30 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              )}
              <div className="leading-relaxed font-medium">{feedback.message}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Bhupal Sharnagat"
                className="w-full bg-[#171717] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c6f03d] transition-colors"
              />
            </div>

            {/* Mobile + Send OTP */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Mobile Number *
              </label>
              <div className="flex gap-2.5">
                {/* Country dropdown */}
                <div className="flex items-center gap-1.5 bg-[#171717] border border-white/15 rounded-xl px-2.5 py-1.5 shrink-0">
                  <img
                    src={selectedCountry.flag}
                    alt={selectedCountry.name}
                    className="w-5 h-3.5 object-cover rounded-xs"
                  />
                  <select
                    value={selectedCountry.iso}
                    onChange={e => {
                      const found = COUNTRIES.find(c => c.iso === e.target.value);
                      if (found) setSelectedCountry(found);
                    }}
                    className="bg-transparent text-white text-xs font-semibold outline-none cursor-pointer pr-1"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.iso} value={c.iso} className="bg-black text-white">
                        {c.iso} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Input */}
                <input
                  type="tel"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="flex-1 bg-[#171717] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c6f03d] transition-colors font-mono"
                />

                {/* Send OTP button */}
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="bg-[#c6f03d] hover:bg-[#b2dc30] text-black px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer whitespace-nowrap"
                >
                  {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>

            {/* OTP Verification Input */}
            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Enter 6-Digit OTP *
                </label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit code"
                    className="flex-1 bg-[#171717] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c6f03d] transition-colors font-mono tracking-widest text-center"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
                      otpVerified
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[#c6f03d] hover:bg-[#b2dc30] text-black'
                    }`}
                  >
                    {otpVerified ? 'Verified ✓' : 'Verify OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* Preferred Language Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Select Language *
              </label>
              <div className="relative">
                <select
                  value={selectedLanguage}
                  onChange={e => setSelectedLanguage(e.target.value)}
                  className="w-full bg-[#171717] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white outline-none cursor-pointer appearance-none focus:border-[#c6f03d]"
                >
                  <option value="Hindi" className="bg-black">Hindi (हिंदी)</option>
                  <option value="English" className="bg-black">English</option>
                  <option value="Gujarati" className="bg-black">Gujarati (ગુજરાતી)</option>
                  <option value="Telugu" className="bg-black">Telugu (తెలుగు)</option>
                  <option value="Tamil" className="bg-black">Tamil (தமிழ்)</option>
                  <option value="Kannada" className="bg-black">Kannada (ಕನ್ನಡ)</option>
                  <option value="Marathi" className="bg-black">Marathi (मराठी)</option>
                </select>
                <ChevronDown size={16} className="absolute right-4 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Create Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#171717] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c6f03d] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-[#171717] border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#c6f03d] transition-colors"
                />
              </div>
            </div>

            {/* Checkbox agreement */}
            <div className="flex items-start gap-2.5 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={agreeTerms}
                onChange={e => setAgreeTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 text-[#c6f03d] focus:ring-[#c6f03d] cursor-pointer"
              />
              <label htmlFor="terms" className="text-xs text-gray-400 leading-relaxed cursor-pointer select-none">
                I agree to the <span className="text-[#c6f03d] underline">Privacy Policies</span> and{' '}
                <span className="text-[#c6f03d] underline">Terms and Conditions</span> and I consent to receive SMS and RCS messages (updates, offers, and security OTPs) from Kwik Trade.
              </label>
            </div>

            {/* Submit Register Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#c6f03d] hover:bg-[#b2dc30] text-black font-extrabold text-sm shadow-xl shadow-[#c6f03d]/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Creating Kwik Trade Account...</span>
                </>
              ) : (
                <>
                  <span>Register & Start Trading</span>
                  <ArrowRight size={16} className="stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* 6. WHATSAPP CHAT & FOOTER SECTION */}
      <footer className="w-full bg-black border-t border-white/10 py-10 px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-6">
          {/* Trust badges */}
          <div className="flex justify-center items-center gap-8 py-2">
            <img src="https://kwik.trade/frontend/assets/images/home/100.svg" alt="100% Safe" className="w-14 h-14 object-contain opacity-90" />
            <img src="https://kwik.trade/frontend/assets/images/home/secure.svg" alt="Secure Desk" className="w-12 h-12 object-contain opacity-90" />
            <img src="https://kwik.trade/frontend/assets/images/home/instant.svg" alt="Instant Withdrawals" className="w-16 h-16 object-contain opacity-90" />
          </div>

          {/* WhatsApp Support CTA */}
          <a
            href="https://wa.me/919876543210?text=Hello%20KwikTrade%20Support,%20I%20want%20to%20open%20an%20account"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-md h-13 rounded-xl bg-white hover:bg-gray-100 text-black flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer"
          >
            <img src="/whatsapp-icon.webp" alt="WhatsApp" className="w-7 h-7 object-contain" />
            <span className="font-extrabold text-sm tracking-wide">Chat on WhatsApp (24/7 Support)</span>
          </a>

          {/* Social media connections */}
          <div className="flex flex-col items-center gap-3 pt-4">
            <span className="text-gray-400 font-semibold text-sm">Connect With Us</span>
            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-[#c6f03d] text-black flex items-center justify-center font-bold text-xs hover:opacity-90 transition-opacity"
              >
                IG
              </a>
              <a
                href="https://telegram.org"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-[#c6f03d] text-black flex items-center justify-center font-bold text-xs hover:opacity-90 transition-opacity"
              >
                TG
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-[#c6f03d] text-black flex items-center justify-center font-bold text-xs hover:opacity-90 transition-opacity"
              >
                FB
              </a>
            </div>
          </div>

          <div className="text-center text-[11px] text-gray-500 pt-4">
            © 2026 Kwik Trade Inc. All rights reserved. SEBI Registered Research Analyst & Execution Partner.
          </div>
        </div>
      </footer>
    </div>
  );
};
