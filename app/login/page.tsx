'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HeartPulse, 
  Mic, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Mail, 
  Sparkles,
  Phone,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useApp();

  const [email, setEmail] = useState('drsharma@physiovoice.in');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      login(email);
      router.push('/');
    }, 600);
  };

  const handleDemoLogin = () => {
    setEmail('drsharma@physiovoice.in');
    setPassword('demo2026');
    setIsLoading(true);

    setTimeout(() => {
      login('drsharma@physiovoice.in');
      router.push('/');
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 border border-slate-100">
        
        {/* Left Side: Healthcare SaaS Showcase (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-teal-800 via-teal-900 to-slate-900 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-slate-950 shadow-lg shadow-teal-500/30">
                <HeartPulse className="w-6 h-6 text-teal-950" />
              </div>
              <div>
                <span className="text-2xl font-black tracking-tight text-white">
                  Physio<span className="text-teal-400">Voice</span>
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-teal-200/80">
                  Clinical Copilot
                </span>
              </div>
            </div>

            {/* Tagline */}
            <div className="space-y-2 pt-2">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug text-white">
                The Voice-First Practice OS for Independent Physiotherapists
              </h2>
              <p className="text-xs text-teal-100/80 leading-relaxed">
                Replace bulky paper registers, Excel sheets, and mental session math with speech-powered intake and automated WhatsApp patient updates.
              </p>
            </div>

            {/* Value Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-300 shrink-0 mt-0.5">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Speech-to-Structured Intake</span>
                  <span className="text-[11px] text-teal-100/70">Dictate in English or Hinglish; Whisper & GPT-4o fill clinical charts.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Auto Package Decrement</span>
                  <span className="text-[11px] text-teal-100/70">Tracks &lsquo;attended vs remaining&rsquo; sessions automatically per episode.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-300 shrink-0 mt-0.5">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">1-Click WhatsApp Reminders</span>
                  <span className="text-[11px] text-teal-100/70">Pre-filled appointments & low package alerts straight to patient chat.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Quote */}
          <div className="relative z-10 pt-6 mt-6 border-t border-teal-700/50">
            <p className="text-[11px] italic text-teal-100/80">
              &ldquo;I save at least 45 minutes every evening. The package session meter completely stopped billing disputes with patients.&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-teal-400 text-teal-950 font-bold text-[10px] flex items-center justify-center">
                NS
              </div>
              <span className="text-[11px] font-semibold text-white">Dr. Neha Sharma, MPT (Ortho)</span>
            </div>
          </div>
        </div>

        {/* Right Side: Sign-In Form (7 cols) */}
        <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center space-y-6">
          
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold border border-teal-200">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              DPDPA 2023 Compliant Healthcare System
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Clinician Sign In
            </h1>
            <p className="text-xs text-slate-500">
              Access your practice records, patient timelines, and voice intake copilot.
            </p>
          </div>

          {/* Fast 1-Click Demo Sign-in Button */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600" />
                Instant Demo Access
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 font-semibold">
                1-Click
              </span>
            </div>
            <p className="text-[11px] text-teal-700">
              Explore all screens with pre-loaded patient charts, session progress bars, and calendar slots.
            </p>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-teal-600/25 active:scale-95 transition-all"
            >
              <span>Launch Demo as Dr. Sharma</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Or sign in with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            
            {/* Email */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Therapist Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. drsharma@physiovoice.in"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">
                  Password
                </label>
                <a href="#demo" onClick={handleDemoLogin} className="text-teal-600 font-medium hover:underline text-[11px]">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="text-slate-600 font-medium text-xs">Keep clinic signed in on this device</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer clinic note */}
          <div className="pt-2 text-center text-[11px] text-slate-400">
            Protected by end-to-end encrypted medical protocols. Not for public patient login.
          </div>

        </div>

      </div>
    </div>
  );
}
