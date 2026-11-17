'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { VoiceAssistantModal } from './VoiceAssistantModal';
import { NotificationPopover } from './NotificationPopover';
import { useApp } from '@/context/AppContext';
import { Mic, Search, Calendar as CalendarIcon, HeartPulse } from 'lucide-react';
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isVoiceModalOpen, setIsVoiceModalOpen, therapist } = useApp();

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  const currentDateFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        
        {/* Top Header Bar for Desktop */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-8 items-center justify-between">
          
          {/* Left search indicator / context */}
          <div className="flex items-center gap-4">
            <Link
              href="/patients"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 text-xs font-medium transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search patients by name, phone or ID...</span>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-400">
                ⌘K
              </kbd>
            </Link>
          </div>

          {/* Right quick controls */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>{currentDateFormatted}</span>
            </div>

            {/* In-App Reminders & Delivery Center */}
            <NotificationPopover />

            <button
              type="button"
              onClick={() => setIsVoiceModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-sm shadow-teal-600/20 active:scale-95 transition-all"
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-teal-200 opacity-75"></span>
                <Mic className="w-3.5 h-3.5 text-white relative" />
              </div>
              <span>Voice Intake</span>
            </button>

            <div className="h-5 w-px bg-slate-200"></div>

            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center shadow-sm">
                NS
              </div>
              <div className="hidden xl:block text-left">
                <span className="text-xs font-bold text-slate-800 block leading-tight">
                  {therapist.full_name}
                </span>
                <span className="text-[10px] text-teal-700 font-semibold">
                  Independent Clinician
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Physio Voice AI Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </div>
  );
}
