'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Activity, 
  Users, 
  Calendar as CalendarIcon, 
  Mic, 
  Settings, 
  HeartPulse,
  Sparkles
} from 'lucide-react';
import { VoiceIntakeModal } from './VoiceIntakeModal';

export function Navbar() {
  const pathname = usePathname();
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', href: '/', icon: Activity },
    { label: 'Patients', href: '/patients', icon: Users },
    { label: 'Calendar', href: '/calendar', icon: CalendarIcon },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Clinic Branding */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-teal-600 transition-colors">
                    Physio<span className="text-teal-600">Voice</span>
                  </span>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Clinical Copilot
                  </span>
                </div>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsVoiceModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 shadow-lg shadow-teal-600/25 active:scale-95 transition-all"
              >
                <div className="relative flex items-center justify-center">
                  <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-teal-200 opacity-75"></span>
                  <Mic className="w-4 h-4 text-white relative" />
                </div>
                <span>Voice Intake</span>
              </button>

              <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>Dr. Sharma&apos;s Clinic</span>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Voice Intake Modal */}
      <VoiceIntakeModal 
        isOpen={isVoiceModalOpen} 
        onClose={() => setIsVoiceModalOpen(false)} 
      />
    </>
  );
}
