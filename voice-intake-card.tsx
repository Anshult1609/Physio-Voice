'use client';

import React, { useState, useEffect, useRef } from 'react';
import { parseVoiceIntake } from '@/lib/voice-parser';
import { registerPatientWithPlan } from '@/lib/supabase';
import { ParsedVoiceIntake } from '@/lib/types';

export default function VoiceIntakeCard({
  onPatientSaved,
}: {
  onPatientSaved?: (patient: any) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isManualMode, setIsManualMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Structured fields for review & correction
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    phone: '',
    chiefComplaint: '',
    plannedSessions: '10',
    firstAppointmentAt: '',
    reminderConsent: true,
  });

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check browser Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setIsManualMode(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Optimized for Indian English accents, fallback 'en-US'

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      // Parse structured entities on the fly
      const parsed = parseVoiceIntake(currentTranscript);
      setFormData(prev => ({
        ...prev,
        fullName: parsed.fullName || prev.fullName,
        age: parsed.age ? String(parsed.age) : prev.age,
        phone: parsed.phone || prev.phone,
        chiefComplaint: parsed.chiefComplaint || prev.chiefComplaint,
        plannedSessions: parsed.plannedSessions ? String(parsed.plannedSessions) : prev.plannedSessions,
      }));
    };

    recognition.onerror = (err: any) => {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.chiefComplaint) {
      alert('Please fill in Patient Name, Phone Number, and Health Problem.');
      return;
    }

    setSaving(true);
    setSavedSuccess(null);
    try {
      const result = await registerPatientWithPlan({
        fullName: formData.fullName,
        age: parseInt(formData.age, 10) || 30,
        phone: formData.phone,
        chiefComplaint: formData.chiefComplaint,
        plannedSessions: parseInt(formData.plannedSessions, 10) || 5,
        firstAppointmentAt: formData.firstAppointmentAt || undefined,
        reminderConsent: formData.reminderConsent,
      });

      const uid = (result.patient as any)?.uid || 'PV-New';
      setSavedSuccess(`Patient registered successfully! Assigned UID: ${uid}`);
      if (onPatientSaved) onPatientSaved(result.patient);

      // Reset
      setFormData({
        fullName: '',
        age: '',
        phone: '',
        chiefComplaint: '',
        plannedSessions: '10',
        firstAppointmentAt: '',
        reminderConsent: true,
      });
      setTranscript('');
    } catch (err: any) {
      alert(`Registration failed: ${err.message || 'Database error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎙️ Voice Patient Registration</h2>
          <p className="text-xs text-slate-500">Speak or type patient details for hands-free clinical intake</p>
        </div>
        <button
          type="button"
          onClick={() => setIsManualMode(!isManualMode)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
        >
          {isManualMode ? 'Switch to Voice Mode' : 'Switch to Manual Form'}
        </button>
      </div>

      {savedSuccess && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-sm font-medium flex items-center justify-between">
          <span>✅ {savedSuccess}</span>
          <button onClick={() => setSavedSuccess(null)} className="text-xs text-emerald-600 underline">Dismiss</button>
        </div>
      )}

      {/* Voice Recording Control */}
      {!isManualMode && (
        <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
          <button
            type="button"
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all shadow-lg ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse ring-8 ring-rose-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
            title={isListening ? 'Click to stop listening' : 'Click to start speaking'}
          >
            {isListening ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" />
              </svg>
            )}
          </button>

          <p className="mt-3 text-sm font-medium text-slate-700">
            {isListening ? '🎙️ Listening... Speak patient details now' : 'Tap to start speaking patient details'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Example: <em>"Register Ramesh Kumar, age 45, phone 9876543210, problem cervical pain, 10 sessions"</em>
          </p>

          {transcript && (
            <div className="mt-4 p-3 bg-white rounded-lg border text-left text-xs text-slate-600 italic">
              <strong>Spoken Transcript:</strong> "{transcript}"
            </div>
          )}
        </div>
      )}

      {/* Editable Structured Fields Review Card */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Review & Correction Before Saving</span>
          <span className="text-indigo-600">All fields editable</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Patient Full Name *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Age</label>
              <input
                type="number"
                min="1"
                max="120"
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                placeholder="e.g. 45"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Planned Sessions</label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.plannedSessions}
                onChange={e => setFormData({ ...formData, plannedSessions: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mobile / WhatsApp Number *</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">First Appointment (Optional)</label>
            <input
              type="datetime-local"
              value={formData.firstAppointmentAt}
              onChange={e => setFormData({ ...formData, firstAppointmentAt: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Health Problem / Chief Complaint *</label>
          <textarea
            required
            rows={2}
            value={formData.chiefComplaint}
            onChange={e => setFormData({ ...formData, chiefComplaint: e.target.value })}
            placeholder="e.g. Lower back pain with radiating sciatica to left leg"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="reminderConsent"
            checked={formData.reminderConsent}
            onChange={e => setFormData({ ...formData, reminderConsent: e.target.checked })}
            className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <label htmlFor="reminderConsent" className="text-xs text-slate-600">
            Patient consents to receive 1-day appointment reminders via WhatsApp
          </label>
        </div>

        <div className="pt-3 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setFormData({ fullName: '', age: '', phone: '', chiefComplaint: '', plannedSessions: '10', firstAppointmentAt: '', reminderConsent: true })}
            className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving to Database...' : 'Save Patient Record & Allot UID'}
          </button>
        </div>
      </form>
    </div>
  );
}
