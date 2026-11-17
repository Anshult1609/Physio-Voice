'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Send, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Phone,
  Sparkles,
  AlertCircle,
  Activity,
  Check,
  CalendarDays,
  Edit2,
  CalendarX,
  RefreshCw,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useApp, FullAppointment } from '@/context/AppContext';
import { generateWhatsAppReminderUrl } from '@/lib/whatsapp/generator';
import { AppointmentStatusType } from '@/types/database';

export default function CalendarSchedulerPage() {
  const { 
    appointments, 
    patients, 
    addAppointment, 
    updateAppointmentStatus, 
    rescheduleAppointment,
    editAppointment,
    cancelAppointment,
    updateReminderStatus, 
    therapist 
  } = useApp();

  const [selectedDate, setSelectedDate] = useState('2026-11-17');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'SCHEDULED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED'>('ALL');
  
  // Modals state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [activeModalAppointment, setActiveModalAppointment] = useState<FullAppointment | null>(null);
  const [modalType, setModalType] = useState<'EDIT' | 'RESCHEDULE' | 'CANCEL' | null>(null);

  // New booking form state
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [newTimeSlot, setNewTimeSlot] = useState('11:00');
  const [newDuration, setNewDuration] = useState('45');
  const [newTreatmentNotes, setNewTreatmentNotes] = useState('Follow-up physiotherapy & mobilization session');

  // Edit / Reschedule Modal form state
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('Patient requested new time slot');
  const [cancelReason, setCancelReason] = useState('Patient unwell / travel');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredAppointments = appointments.filter((apt) => {
    // Filter by appointment date
    const aptDate = apt.scheduled_start.split('T')[0];
    const matchesDate = aptDate === selectedDate;
    if (!matchesDate) return false;

    if (selectedStatusFilter === 'ALL') return true;
    if (selectedStatusFilter === 'ATTENDED') {
      return apt.status === 'ATTENDED' || apt.status === 'COMPLETED';
    }
    return apt.status === selectedStatusFilter;
  });

  const handleSendReminder = (apt: FullAppointment) => {
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

    const url = generateWhatsAppReminderUrl({
      patientName: apt.patientName,
      patientPhone: apt.patientPhone,
      clinicName: therapist.clinic_name,
      therapistName: 'Sharma',
      appointmentTime: `${new Date(apt.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${formattedDate}`,
      instructions: 'Please wear comfortable loose clothing and arrive 5 minutes early.',
    });

    // Open WhatsApp client link - Invariant: Do not claim sent unless provider confirms delivery!
    window.open(url, '_blank');
    showToast(`WhatsApp chat opened for ${apt.patientName}. Delivery unconfirmed until verified by provider webhook.`);
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    const patient = patients.find((p) => p.id === selectedPatientId);
    const activeEp = patient?.episodes[0];

    const [hours, mins] = newTimeSlot.split(':');
    const startObj = new Date(`${selectedDate}T${hours || '10'}:${mins || '00'}:00`);
    const endObj = new Date(startObj.getTime() + parseInt(newDuration || '45') * 60000);

    const newApt = addAppointment({
      patientId: selectedPatientId,
      episodeId: activeEp?.id,
      scheduledStart: startObj.toISOString(),
      scheduledEnd: endObj.toISOString(),
      notes: newTreatmentNotes,
    });

    // Automatically register reminder in scheduler with timezone & duplicate prevention
    fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: selectedPatientId,
        appointmentId: newApt.id,
        scheduledStart: startObj.toISOString(),
        recipientPhone: patient?.phone || '',
        patientName: patient?.full_name || 'Patient',
        clinicName: therapist.clinic_name,
        therapistName: therapist.full_name,
        channel: 'IN_APP',
        hoursBefore: 2,
      }),
    }).catch((err) => console.warn('Reminder scheduler register error:', err));

    setIsBookModalOpen(false);
    setNewTreatmentNotes('Follow-up physiotherapy & mobilization session');
    showToast(`Appointment booked for ${patient?.full_name}! (In-app reminder scheduled)`);
  };

  const handleDateShift = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Open Edit Modal
  const openEditModal = (apt: FullAppointment) => {
    setActiveModalAppointment(apt);
    const d = new Date(apt.scheduled_start);
    setEditDate(d.toISOString().split('T')[0]);
    setEditTime(d.toTimeString().slice(0, 5));
    setEditNotes(apt.notes || '');
    setModalType('EDIT');
  };

  // Open Reschedule Modal
  const openRescheduleModal = (apt: FullAppointment) => {
    setActiveModalAppointment(apt);
    const d = new Date(apt.scheduled_start);
    setEditDate(d.toISOString().split('T')[0]);
    setEditTime(d.toTimeString().slice(0, 5));
    setRescheduleReason('Patient requested different slot');
    setModalType('RESCHEDULE');
  };

  // Open Cancel Modal
  const openCancelModal = (apt: FullAppointment) => {
    setActiveModalAppointment(apt);
    setCancelReason('Patient unwell / personal conflict');
    setModalType('CANCEL');
  };

  // Submit Reschedule
  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalAppointment) return;

    const [h, m] = editTime.split(':');
    const startObj = new Date(`${editDate}T${h || '10'}:${m || '00'}:00`);
    const endObj = new Date(startObj.getTime() + 45 * 60000);

    rescheduleAppointment(
      activeModalAppointment.id,
      startObj.toISOString(),
      endObj.toISOString(),
      rescheduleReason
    );

    setModalType(null);
    showToast(`Appointment rescheduled to ${editDate} at ${editTime}!`);
  };

  // Submit Edit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalAppointment) return;

    const [h, m] = editTime.split(':');
    const startObj = new Date(`${editDate}T${h || '10'}:${m || '00'}:00`);
    const endObj = new Date(startObj.getTime() + 45 * 60000);

    editAppointment(activeModalAppointment.id, {
      scheduledStart: startObj.toISOString(),
      scheduledEnd: endObj.toISOString(),
      notes: editNotes,
    });

    setModalType(null);
    showToast('Appointment details updated successfully!');
  };

  // Submit Cancellation
  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalAppointment) return;

    cancelAppointment(activeModalAppointment.id, cancelReason);
    setModalType(null);
    showToast(`Appointment cancelled. Reason: ${cancelReason}`);
  };

  // Attendance status quick toggle
  const handleStatusChange = (apt: FullAppointment, newStatus: AppointmentStatusType) => {
    updateAppointmentStatus(apt.id, newStatus);
    if (newStatus === 'ATTENDED' || newStatus === 'COMPLETED') {
      showToast(`✓ Marked as ATTENDED. 1 session decremented from package (${apt.remainingSessions - 1} left).`);
    } else if (newStatus === 'NO_SHOW') {
      showToast(`⚠️ Marked as NO-SHOW. Patient did not attend.`);
    } else if (newStatus === 'CANCELLED') {
      showToast(`Appointment marked as CANCELLED.`);
    }
  };

  const formattedDisplayDate = new Date(selectedDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-teal-900 text-white text-xs font-bold shadow-xl flex items-center justify-between animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-300 hover:text-white px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Appointment Calendar & Attendance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule visits, record verified attendance, reschedule slots, and send WhatsApp reminders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsBookModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Book New Appointment</span>
          </button>
        </div>
      </div>

      {/* Date Navigation & Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateShift(-1)}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2 px-2">
            <CalendarIcon className="w-4 h-4 text-teal-600" />
            <span>{formattedDisplayDate}</span>
          </div>

          <button
            onClick={() => handleDateShift(1)}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate('2026-11-17')}
            className="ml-2 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Today
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ml-1 text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {/* Filter by Status */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'SCHEDULED', 'ATTENDED', 'NO_SHOW', 'CANCELLED'] as const).map((status) => {
            const count = appointments.filter((a) => {
              const aptDate = a.scheduled_start.split('T')[0];
              if (aptDate !== selectedDate) return false;
              if (status === 'ALL') return true;
              if (status === 'ATTENDED') return a.status === 'ATTENDED' || a.status === 'COMPLETED';
              return a.status === status;
            }).length;

            return (
              <button
                key={status}
                onClick={() => setSelectedStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedStatusFilter === status
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Appointment Slots List */}
      <div className="space-y-3">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8 space-y-2">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">No appointments scheduled</h3>
            <p className="text-xs text-slate-400">
              There are no {selectedStatusFilter.toLowerCase()} appointment slots on {formattedDisplayDate}.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setIsBookModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book Appointment</span>
              </button>
            </div>
          </div>
        ) : (
          filteredAppointments.map((apt) => {
            const isAttended = apt.status === 'COMPLETED' || apt.status === 'ATTENDED';
            const isNoShow = apt.status === 'NO_SHOW';
            const isCancelled = apt.status === 'CANCELLED';
            const isRescheduled = apt.status === 'RESCHEDULED';
            const isLowSession = apt.remainingSessions <= 2;

            const timeString = new Date(apt.scheduled_start).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={apt.id}
                className={`bg-white p-5 rounded-3xl border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
                  isAttended 
                    ? 'border-emerald-300 bg-emerald-50/20' 
                    : isNoShow
                    ? 'border-rose-300 bg-rose-50/20'
                    : isCancelled
                    ? 'border-slate-200 opacity-60 bg-slate-50'
                    : isRescheduled
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200 hover:border-teal-400 hover:shadow-md'
                }`}
              >
                {/* Left: Slot Time & Patient Info */}
                <div className="flex items-start gap-4">
                  <div className={`px-4 py-3 rounded-2xl border font-mono font-extrabold text-xs text-center min-w-[90px] shadow-sm ${
                    isAttended
                      ? 'bg-emerald-100/70 border-emerald-200 text-emerald-950'
                      : isNoShow
                      ? 'bg-rose-100/70 border-rose-200 text-rose-950'
                      : isCancelled
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : 'bg-teal-50/80 border-teal-100 text-teal-900'
                  }`}>
                    <Clock className="w-4 h-4 mx-auto mb-0.5 text-teal-600" />
                    {timeString}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/patients/${apt.patient_id}`}
                        className="font-extrabold text-sm text-slate-900 hover:text-teal-600 transition-colors"
                      >
                        {apt.patientName}
                      </Link>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {apt.patientCode}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 font-mono font-medium">
                        <Phone className="w-3 h-3 text-slate-400" />
                        +91 {apt.patientPhone}
                      </span>

                      {/* Status Badge */}
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                        isAttended
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : isNoShow
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : isCancelled
                          ? 'bg-slate-200 text-slate-700 border-slate-300'
                          : isRescheduled
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-blue-100 text-blue-900 border-blue-300'
                      }`}>
                        {apt.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-medium">
                      Condition: <strong>{apt.episodeTitle}</strong>
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-0.5">
                      <span className={`text-[11px] font-bold ${
                        isLowSession ? 'text-amber-700 font-extrabold' : 'text-teal-700'
                      }`}>
                        Package Balance: {apt.remainingSessions} sessions left
                      </span>

                      {apt.notes && (
                        <span className="text-[11px] text-slate-500 italic">
                          • {apt.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions, Attendance Controls, Rescheduling */}
                <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                  
                  {/* Attendance Confirmation Action Buttons */}
                  <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(apt, 'ATTENDED')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isAttended
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                      title="Confirm patient attendance (decrements 1 session from package)"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Attended</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(apt, 'NO_SHOW')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isNoShow
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                      }`}
                      title="Mark as No-Show (does not decrement sessions)"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>No-Show</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCancelModal(apt)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        isCancelled
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Cancel appointment"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Reschedule Button */}
                  <button
                    type="button"
                    onClick={() => openRescheduleModal(apt)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
                    title="Reschedule to another date or time"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-500" />
                    <span>Reschedule</span>
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(apt)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
                    title="Edit Notes & Duration"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* WhatsApp Reminder Button */}
                  <button
                    type="button"
                    onClick={() => handleSendReminder(apt)}
                    title="Open WhatsApp draft in client. Note: External message delivery is unconfirmed until verified by provider."
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <Link
                    href={`/patients/${apt.patient_id}`}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Chart
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Book New Appointment */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                Book Patient Consultation Slot
              </h3>
              <button
                onClick={() => setIsBookModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select Patient *
                </label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.patient_code}) — {p.episodes[0]?.title || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newTimeSlot}
                    onChange={(e) => setNewTimeSlot(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Duration (Minutes)
                  </label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    <option value="30">30 Mins (Follow-up)</option>
                    <option value="45">45 Mins (Standard)</option>
                    <option value="60">60 Mins (Comprehensive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Session Focus / Notes
                </label>
                <textarea
                  rows={2}
                  value={newTreatmentNotes}
                  onChange={(e) => setNewTreatmentNotes(e.target.value)}
                  placeholder="e.g. Quadriceps strengthening, IFT, joint mobilization"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <p className="text-[11px] text-teal-800 bg-teal-50 p-2.5 rounded-xl border border-teal-200">
                💡 Remaining package sessions will decrease <strong>only when attendance is confirmed</strong> upon patient arrival.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  Schedule Appointment
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: Reschedule Appointment */}
      {modalType === 'RESCHEDULE' && activeModalAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Reschedule Appointment
                </h3>
                <p className="text-xs text-slate-500">
                  {activeModalAppointment.patientName} ({activeModalAppointment.patientCode})
                </p>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    New Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    New Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Rescheduling Reason
                </label>
                <select
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="Patient requested different slot">Patient requested different slot</option>
                  <option value="Clinician schedule conflict">Clinician schedule conflict</option>
                  <option value="Traffic / Transit delay">Traffic / Transit delay</option>
                  <option value="Medical emergency">Medical emergency</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: Edit Appointment Details */}
      {modalType === 'EDIT' && activeModalAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Edit Appointment Details
                </h3>
                <p className="text-xs text-slate-500">
                  {activeModalAppointment.patientName} ({activeModalAppointment.patientCode})
                </p>
              </div>
              <button
                onClick={() => setModalType(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Clinical Notes / Treatment Plan
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 4: Cancel Appointment Confirmation */}
      {modalType === 'CANCEL' && activeModalAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-xl">
                <CalendarX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Cancel Appointment?
                </h3>
                <p className="text-xs text-slate-500">
                  {activeModalAppointment.patientName} — {activeModalAppointment.episodeTitle}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel this appointment slot? <strong>No session fee or package decrement will occur.</strong>
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                >
                  <option value="Patient unwell / illness">Patient unwell / illness</option>
                  <option value="Personal travel / out of town">Personal travel / out of town</option>
                  <option value="Clinic closed / holiday">Clinic closed / holiday</option>
                  <option value="Patient requested cancellation">Patient requested cancellation</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all"
                >
                  Cancel Slot
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
