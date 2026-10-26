'use client';

import React, { useState } from 'react';
import VoiceIntakeCard from '@/components/voice-intake-card';
import PatientDashboard from '@/components/patient-dashboard';
import FeedbackModal from '@/components/feedback-modal';

export default function PhysioVoiceApp() {
  const [activeTab, setActiveTab] = useState<'register' | 'dashboard' | 'reminders'>('register');
  const [feedbackTarget, setFeedbackTarget] = useState<{ patientId: string; planId?: string } | null>(null);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800">
      {/* Top Clinic Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              PV
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-slate-900 tracking-tight">Physio Voice</h1>
              <p className="text-[11px] text-slate-500 font-medium">Independent Physiotherapy Practice Management</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('register')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'register'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎙️ Register Patient
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'dashboard'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📋 Patient Records & UID
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition relative ${
                activeTab === 'reminders'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔔 1-Day Reminders
              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                Auto
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'register' && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto mb-2">
              <h2 className="text-2xl font-bold text-slate-900">Voice-Assisted Patient Registration</h2>
              <p className="text-xs text-slate-500 mt-1">
                Speak patient details to automatically convert them into structured clinical records, or switch to manual input anytime.
              </p>
            </div>
            <VoiceIntakeCard onPatientSaved={() => setActiveTab('dashboard')} />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <PatientDashboard
              onOpenFeedback={(patientId, planId) => setFeedbackTarget({ patientId, planId })}
            />
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">⏰ Automated 1-Day Appointment Reminders</h3>
                <p className="text-xs text-slate-500">
                  Scanned daily at 08:00 AM via Vercel Cron. Prepares instant WhatsApp direct reminders for tomorrow's sessions.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                Active Cron Engine
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border text-xs text-slate-600 space-y-2">
              <p><strong>Reminder Workflow:</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Every morning at 08:00 AM, the Vercel Cron endpoint (<code>/api/cron/reminders</code>) detects appointments for tomorrow.</li>
                <li>WhatsApp messages are automatically formatted with patient name, appointment time, clinic details, and session progress.</li>
                <li>Therapists can click <strong>"WhatsApp Reminder"</strong> to trigger the chat with one tap, or let automated background queues handle dispatch.</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Feedback Modal */}
      {feedbackTarget && (
        <FeedbackModal
          patientId={feedbackTarget.patientId}
          treatmentPlanId={feedbackTarget.planId}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
