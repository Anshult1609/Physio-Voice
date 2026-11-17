'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Activity, 
  Users, 
  UserPlus, 
  Calendar as CalendarIcon, 
  Mic, 
  LogOut, 
  HeartPulse, 
  AlertTriangle,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Sparkles
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { NotificationPopover } from './NotificationPopover';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { therapist, patients, logout, setIsVoiceModalOpen } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Calculate low package count
  const lowSessionCount = patients.filter((p) => {
    const activeEp = p.episodes[0];
    return activeEp && activeEp.remaining_sessions <= 2;
  }).length;

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Activity, badge: null },
    { label: 'Patients Directory', href: '/patients', icon: Users, badge: patients.length },
    { label: 'New Patient Intake', href: '/patients/register', icon: UserPlus, badge: 'Voice / Form' },
    { label: 'Appointment Calendar', href: '/calendar', icon: CalendarIcon, badge: null },
  ];

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Do not render sidebar on login page
  if (pathname === '/login') return null;

  return (
    <>
      {/* Mobile Top Navigation Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-sm">
              <HeartPulse className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight text-base">
              Physio<span className="text-teal-600">Voice</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationPopover />
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Intake</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Section */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          
          {/* Logo & Clinic Header */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
                <HeartPulse className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-teal-600 transition-colors">
                  Physio<span className="text-teal-600">Voice</span>
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-teal-700">
                  Clinical Copilot
                </span>
              </div>
            </Link>

            {/* Close Button on Mobile */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Clinic Badge */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Active Clinic</span>
              <span className="flex items-center gap-1 text-emerald-600 font-semibold normal-case">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 truncate" title={therapist.clinic_name}>
              {therapist.clinic_name}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Lic: {therapist.registration_number}
            </p>
          </div>

          {/* Primary Quick Voice CTA */}
          <button
            onClick={() => {
              setIsVoiceModalOpen(true);
              setIsMobileOpen(false);
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-teal-600/25 active:scale-95 transition-all group"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-teal-200 opacity-75"></span>
              <Mic className="w-4 h-4 text-white relative" />
            </div>
            <span>Voice Patient Intake</span>
          </button>

          {/* Nav Items */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Clinical Navigation
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 shadow-sm border border-teal-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-teal-200 text-teal-900' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Package Balance Alert Widget */}
          {lowSessionCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Package Alert
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">
                  {lowSessionCount}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-tight">
                {lowSessionCount} {lowSessionCount === 1 ? 'patient has' : 'patients have'} &le; 2 sessions remaining in their therapy package.
              </p>
              <Link
                href="/patients?filter=LOW_BALANCE"
                onClick={() => setIsMobileOpen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 hover:text-teal-950 underline"
              >
                Review renewals <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}

        </div>

        {/* Footer Section: User Profile & Sign Out */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              NS
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">
                {therapist.full_name}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {therapist.email}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link
              href="/login"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Link>

            <span className="text-[10px] text-slate-400 font-mono">
              v1.0 MVP
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
