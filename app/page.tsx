'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Users, 
  Calendar, 
  AlertTriangle, 
  Mic, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Send, 
  Plus, 
  Sparkles, 
  ChevronRight, 
  TrendingUp, 
  UserPlus
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { generateWhatsAppReminderUrl, generatePackageUpdateUrl } from '@/lib/whatsapp/generator';

export default function DashboardPage() {
  const { 
    therapist, 
    appointments, 
    patients, 
    updateReminderStatus, 
    setIsVoiceModalOpen 
  } = useApp();

  // Low package balance patients (<= 2 sessions left)
  const lowSessionPatients = patients.filter((p) => {
    const activeEp = p.episodes[0];
    return activeEp && activeEp.remaining_sessions <= 2 && activeEp.status === 'ACTIVE';
  });

  const handleSendReminder = (apt: typeof appointments[0]) => {
    const url = generateWhatsAppReminderUrl({
      patientName: apt.patientName,
      patientPhone: apt.patientPhone,
      clinicName: therapist.clinic_name,
      therapistName: 'Sharma',
      appointmentTime: `Today at ${new Date(apt.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    });
    window.open(url, '_blank');
    updateReminderStatus(apt.id, 'SENT');
  };

  const handlePackageAlertWhatsApp = (patient: typeof patients[0]) => {
    const ep = patient.episodes[0];
    if (!ep) return;

    const url = generatePackageUpdateUrl({
      patientName: patient.full_name,
      patientPhone: patient.phone,
      clinicName: therapist.clinic_name,
      episodeTitle: ep.title,
      attendedSessions: ep.attended_sessions,
      remainingSessions: ep.remaining_sessions,
    });
    window.open(url, '_blank');
  };

  const attendedTodayCount = appointments.filter((a) => a.status === 'COMPLETED').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Clinician Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-teal-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Independent Practice Mode
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Good day, {therapist.full_name.split(',')[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-teal-100/80 leading-relaxed">
            You have <strong className="text-white font-bold">{appointments.length} patients</strong> scheduled. Dictate intakes in English or Hinglish using the voice button.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-xs text-slate-900 bg-white hover:bg-teal-50 shadow-lg shadow-black/10 active:scale-95 transition-all"
          >
            <Mic className="w-4 h-4 text-teal-600" />
            <span>Voice Intake</span>
          </button>
          
          <Link
            href="/patients/register"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs text-teal-100 bg-teal-800/80 hover:bg-teal-700 border border-teal-700/60 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Patient</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Appointments */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Today&apos;s Schedule
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {appointments.length}
            </p>
            <p className="text-xs text-teal-700 font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {attendedTodayCount} Attended today
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Active Patients */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Patients
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {patients.length}
            </p>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              In ongoing treatment
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Low Sessions Alert */}
        <div className="bg-white p-5 rounded-3xl border border-amber-200 bg-amber-50/40 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
              Package Renewals
            </p>
            <p className="text-2xl font-black text-amber-950 mt-1">
              {lowSessionPatients.length}
            </p>
            <p className="text-xs text-amber-800 font-bold mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> &le; 2 sessions left
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-200/60 text-amber-800 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Monthly Attendance */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Package Sessions
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {patients.reduce((sum, p) => sum + (p.episodes[0]?.total_package_sessions || 0), 0)}
            </p>
            <p className="text-xs text-emerald-700 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 94% retention rate
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Main Grid: Today's Queue & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Today's Queue (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Today&apos;s Appointment Queue
              </h2>
              <p className="text-xs text-slate-500">
                Sessions scheduled for today with remaining package counters
              </p>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              Full Calendar <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {appointments.map((apt) => {
              const patient = patients.find((p) => p.id === apt.patient_id);
              const ep = patient?.episodes[0];
              const isLow = ep && ep.remaining_sessions <= 2;
              const attendedCount = ep?.attended_sessions ?? 5;
              const totalCount = ep?.total_package_sessions ?? 10;
              const remainingCount = ep?.remaining_sessions ?? 5;

              return (
                <div
                  key={apt.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Left: Time & Patient */}
                  <div className="flex items-start gap-4">
                    <div className="px-3.5 py-2.5 rounded-2xl bg-slate-100 text-slate-800 font-mono font-extrabold text-xs text-center min-w-[75px] shadow-sm">
                      <Clock className="w-3.5 h-3.5 mx-auto text-teal-600 mb-0.5" />
                      {new Date(apt.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/patients/${apt.patient_id}`}
                          className="font-extrabold text-sm text-slate-900 hover:text-teal-600 transition-colors"
                        >
                          {apt.patientName}
                        </Link>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {apt.patientCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        {apt.episodeTitle}
                      </p>
                      
                      {/* Package Progress Meter */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isLow ? 'bg-amber-500' : 'bg-teal-500'}`}
                            style={{ width: `${(attendedCount / totalCount) * 100}%` }}
                          ></div>
                        </div>
                        <span className={`text-[11px] font-bold ${isLow ? 'text-amber-800' : 'text-slate-600'}`}>
                          {attendedCount}/{totalCount} sessions ({remainingCount} left)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleSendReminder(apt)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        apt.reminder_status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                      }`}
                      title="Send WhatsApp appointment reminder"
                    >
                      <Send className="w-3 h-3 text-teal-600" />
                      <span>{apt.reminder_status === 'SENT' ? 'Reminder Sent' : 'WhatsApp'}</span>
                    </button>

                    <Link
                      href={`/patients/${apt.patient_id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      <span>Chart</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Low-Session Package Renewal Alerts */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Low Package Alert
            </h2>
            <p className="text-xs text-slate-500">
              Patients nearing completion of their therapy package
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
            {lowSessionPatients.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                All patient packages have active session balances!
              </div>
            ) : (
              lowSessionPatients.map((patient) => {
                const ep = patient.episodes[0];
                return (
                  <div
                    key={patient.id}
                    className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-bold text-xs text-slate-900 hover:text-teal-700"
                      >
                        {patient.full_name}
                      </Link>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900">
                        {ep.remaining_sessions} left
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-slate-600 font-medium">
                      {ep.title}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 font-medium">
                        Attended {ep.attended_sessions} of {ep.total_package_sessions}
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePackageAlertWhatsApp(patient)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 hover:text-teal-950"
                      >
                        <Send className="w-3 h-3" /> WhatsApp
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            <div className="pt-2 border-t border-slate-100 text-center">
              <Link
                href="/patients?filter=LOW_BALANCE"
                className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                Review all low session packages <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Practice Tip */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 text-teal-950 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
              <Sparkles className="w-4 h-4 text-teal-600" />
              Voice Tip for Quick Intakes
            </div>
            <p className="text-xs text-teal-800 leading-relaxed font-medium">
              You can dictate both English and Hindi medical phrases: &ldquo;Post-op knee swelling hai, 10 days package, fee 6000&rdquo;. Physio Voice automatically parses and creates the chart.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
