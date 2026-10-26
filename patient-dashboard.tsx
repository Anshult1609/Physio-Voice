'use client';

import React, { useState } from 'react';
import { getPatientByUID, recordSessionAttendance } from '@/lib/supabase';
import { generateWhatsAppReminder } from '@/lib/whatsapp';

export default function PatientDashboard({
  onOpenFeedback,
}: {
  onOpenFeedback?: (patientId: string, planId?: string) => void;
}) {
  const [searchUID, setSearchUID] = useState('');
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUID.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await getPatientByUID(searchUID.trim());
      if (!data) {
        setError(`No patient found matching UID "${searchUID}". Please verify the number.`);
        setPatient(null);
      } else {
        setPatient(data);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching patient record');
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceCheckIn = async (plan: any) => {
    if (!plan || plan.completed_sessions >= plan.planned_sessions) {
      alert('All planned sessions for this treatment plan have already been completed!');
      return;
    }

    setUpdatingAttendance(true);
    try {
      await recordSessionAttendance({
        treatmentPlanId: plan.id,
        sessionNumber: plan.completed_sessions + 1,
      });

      // Refresh patient data
      const refreshed = await getPatientByUID(patient.uid);
      setPatient(refreshed);
    } catch (err: any) {
      alert(`Could not update attendance: ${err.message}`);
    } finally {
      setUpdatingAttendance(false);
    }
  };

  const activePlan = patient?.treatment_plans?.find((p: any) => p.status === 'ACTIVE') || patient?.treatment_plans?.[0];
  const completedCount = activePlan?.completed_sessions || 0;
  const totalCount = activePlan?.planned_sessions || 0;
  const remainingCount = Math.max(0, totalCount - completedCount);
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 max-w-4xl mx-auto space-y-6">
      {/* UID Search Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-800">🔍 Digital Patient Record & History</h2>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
            Search by UID Number
          </span>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchUID}
            onChange={e => setSearchUID(e.target.value)}
            placeholder="Enter Unique Identification Number (e.g. PV-2026-0001 or 1001)..."
            className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Find Patient'}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Patient Record Profile */}
      {patient && (
        <div className="space-y-6 border-t pt-5">
          {/* Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-md">
                  {patient.uid}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{patient.full_name}</h3>
                <span className="text-xs text-slate-500">({patient.age} yrs, {patient.gender})</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                📞 Phone: <strong>{patient.phone}</strong> • Reminder Consent: {patient.reminder_consent ? '✅ Yes' : '❌ No'}
              </p>
            </div>

            <div className="flex gap-2">
              {/* WhatsApp Quick Reminder */}
              <button
                type="button"
                onClick={() => {
                  const { url } = generateWhatsAppReminder({
                    patientName: patient.full_name,
                    patientPhone: patient.phone,
                    clinicName: 'Physio Voice Clinic',
                    sessionTimeFormatted: 'Tomorrow at your scheduled slot',
                    sessionNumber: completedCount + 1,
                    totalSessions: totalCount,
                  });
                  window.open(url, '_blank');
                }}
                className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1.5"
              >
                <span>💬 WhatsApp Reminder</span>
              </button>

              {/* Feedback Button */}
              {onOpenFeedback && (
                <button
                  type="button"
                  onClick={() => onOpenFeedback(patient.id, activePlan?.id)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
                >
                  ⭐ Add Feedback
                </button>
              )}
            </div>
          </div>

          {/* Session Attendance & Remaining Counter (Problem Solved: Tracking remaining sessions) */}
          {activePlan && (
            <div className="p-5 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-indigo-950">
                    Current Treatment Plan: {activePlan.chief_complaint}
                  </h4>
                  <p className="text-xs text-indigo-700">Status: {activePlan.status} • Started: {activePlan.start_date}</p>
                </div>
                <button
                  type="button"
                  disabled={updatingAttendance || remainingCount === 0}
                  onClick={() => handleAttendanceCheckIn(activePlan)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {updatingAttendance ? 'Updating...' : '✅ Mark Attendance & Update Session'}
                </button>
              </div>

              {/* Progress Counters */}
              <div className="grid grid-cols-3 gap-3 text-center pt-2">
                <div className="p-3 bg-white rounded-lg border">
                  <div className="text-xs text-slate-500 font-medium">Planned Sessions</div>
                  <div className="text-xl font-extrabold text-slate-800">{totalCount}</div>
                </div>
                <div className="p-3 bg-white rounded-lg border">
                  <div className="text-xs text-slate-500 font-medium">Completed / Attended</div>
                  <div className="text-xl font-extrabold text-emerald-600">{completedCount}</div>
                </div>
                <div className="p-3 bg-white rounded-lg border">
                  <div className="text-xs text-slate-500 font-medium">Remaining Sessions</div>
                  <div className="text-xl font-extrabold text-amber-600">{remainingCount}</div>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Rehabilitation Progress</span>
                  <span>{progressPercent}% Completed</span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Historical Treatment Episodes (Problem Solved: Returning patient with new problems) */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800">Treatment History & Past Records</h4>
            {patient.treatment_plans && patient.treatment_plans.length > 0 ? (
              <div className="space-y-2">
                {patient.treatment_plans.map((tp: any) => (
                  <div key={tp.id} className="p-3.5 border rounded-lg bg-white flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{tp.chief_complaint}</div>
                      <div className="text-xs text-slate-500">
                        {tp.completed_sessions} of {tp.planned_sessions} sessions completed • Status: {tp.status}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      tp.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {tp.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No past treatment history recorded.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
