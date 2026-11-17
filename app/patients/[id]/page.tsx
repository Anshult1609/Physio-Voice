'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Phone, 
  Activity, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Send, 
  Mic, 
  Clock, 
  User, 
  ShieldAlert, 
  FileText,
  DollarSign,
  ChevronDown,
  Sparkles,
  Loader2,
  CalendarDays,
  Edit3,
  Archive,
  History,
  Check,
  XCircle,
  RotateCcw,
  CalendarX,
  Edit2
} from 'lucide-react';
import { useApp, FullPatient, FullAppointment } from '@/context/AppContext';
import { generateWhatsAppReminderUrl, generatePackageUpdateUrl } from '@/lib/whatsapp/generator';
import { AttendanceType, EpisodeStatusType, GenderType, PaymentStatusType, AppointmentStatusType } from '@/types/database';

export default function PatientDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = params?.id as string;

  const { 
    patients, 
    appointments, 
    addSession, 
    addEpisode, 
    updateEpisode, 
    updatePatient, 
    addAppointment,
    updateAppointmentStatus,
    rescheduleAppointment,
    cancelAppointment,
    editAppointment,
    therapist 
  } = useApp();

  // Find patient from app context or fallback to first patient
  const patient = patients.find((p) => p.id === patientId) || patients[0];

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>(
    patient?.episodes[0]?.id || ''
  );

  // Sync selected episode if patient changes
  useEffect(() => {
    if (patient?.episodes && patient.episodes.length > 0) {
      // If URL has action=new-episode, open new episode modal automatically
      if (searchParams.get('action') === 'new-episode') {
        setIsNewEpisodeModalOpen(true);
      }
      if (!patient.episodes.some((e) => e.id === selectedEpisodeId)) {
        setSelectedEpisodeId(patient.episodes[0].id);
      }
    }
  }, [patient, searchParams, selectedEpisodeId]);

  const activeEpisode = patient?.episodes.find((e) => e.id === selectedEpisodeId) || patient?.episodes[0];

  // Modals & Async States
  const [isLogSessionModalOpen, setIsLogSessionModalOpen] = useState(false);
  const [isNewEpisodeModalOpen, setIsNewEpisodeModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  // Appointment scheduling & management states
  const [aptFilter, setAptFilter] = useState<'ALL' | 'SCHEDULED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED'>('ALL');
  const [isBookAptModalOpen, setIsBookAptModalOpen] = useState(false);
  const [activeAptModal, setActiveAptModal] = useState<FullAppointment | null>(null);
  const [aptModalType, setAptModalType] = useState<'RESCHEDULE' | 'CANCEL' | null>(null);

  // Book appointment form state
  const [bookDate, setBookDate] = useState('2026-11-18');
  const [bookTime, setBookTime] = useState('10:00');
  const [bookDuration, setBookDuration] = useState('45');
  const [bookEpisodeId, setBookEpisodeId] = useState(activeEpisode?.id || '');
  const [bookNotes, setBookNotes] = useState('Follow-up physiotherapy & mobilization session');

  // Reschedule form state
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('Patient requested new time slot');

  // Cancel form state
  const [cancelReason, setCancelReason] = useState('Patient unwell / personal conflict');

  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [isSubmittingEpisode, setIsSubmittingEpisode] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'SUCCESS' | 'ERROR'; text: string } | null>(null);

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState(patient?.full_name || '');
  const [editPhone, setEditPhone] = useState(patient?.phone || '');
  const [editAge, setEditAge] = useState<number | ''>(patient?.age ?? '');
  const [editGender, setEditGender] = useState<GenderType>(patient?.gender || 'MALE');
  const [editOccupation, setEditOccupation] = useState(patient?.occupation || '');
  const [editAddress, setEditAddress] = useState(patient?.address || '');
  const [editEmergencyContact, setEditEmergencyContact] = useState(patient?.emergency_contact || '');
  const [editComorbidities, setEditComorbidities] = useState<string[]>(patient?.comorbidities || []);
  const [editMedicalNotes, setEditMedicalNotes] = useState(patient?.medical_history_notes || '');

  // Log session modal form state
  const [sessionPainScore, setSessionPainScore] = useState<number>(3);
  const [sessionAttendance, setSessionAttendance] = useState<AttendanceType>('ATTENDED');
  const [sessionModalities, setSessionModalities] = useState<string[]>(['Ultrasound', 'Theraband Exercises']);
  const [sessionSubjective, setSessionSubjective] = useState('');
  const [sessionObjective, setSessionObjective] = useState('');
  const [sessionExercises, setSessionExercises] = useState('');

  // New episode modal form state
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpComplaint, setNewEpComplaint] = useState('');
  const [newEpBodyPart, setNewEpBodyPart] = useState('Cervical Spine');
  const [newEpSessions, setNewEpSessions] = useState(10);
  const [newEpFee, setNewEpFee] = useState(6000);
  const [newEpAmountPaid, setNewEpAmountPaid] = useState(6000);
  const [newEpPaymentStatus, setNewEpPaymentStatus] = useState<PaymentStatusType>('PAID');
  const [newEpGoals, setNewEpGoals] = useState('');
  const [archivePrevious, setArchivePrevious] = useState(true);

  // Sync edit profile form state when patient changes
  useEffect(() => {
    if (patient) {
      setEditFullName(patient.full_name);
      setEditPhone(patient.phone);
      setEditAge(patient.age ?? '');
      setEditGender(patient.gender);
      setEditOccupation(patient.occupation || '');
      setEditAddress(patient.address || '');
      setEditEmergencyContact(patient.emergency_contact || '');
      setEditComorbidities(patient.comorbidities || []);
      setEditMedicalNotes(patient.medical_history_notes || '');
    }
  }, [patient]);

  if (!patient || !activeEpisode) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-bold text-slate-800">Patient not found</h2>
        <Link href="/patients" className="text-teal-600 text-xs mt-2 inline-block font-semibold">
          ← Return to directory
        </Link>
      </div>
    );
  }

  const isLowPackage = activeEpisode.remaining_sessions <= 2 && activeEpisode.status === 'ACTIVE';
  const progressPercent = activeEpisode.total_package_sessions > 0 
    ? (activeEpisode.attended_sessions / activeEpisode.total_package_sessions) * 100 
    : 0;

  const availableModalities = [
    'IFT', 'Ultrasound', 'TENS', 'SWD', 'Cervical Traction', 'Lumbar Traction',
    'Dry Needling', 'Cupping', 'Theraband Exercises', 
    'Joint Mobilization', 'Cryotherapy', 'Moist Heat Pack', 'Facial PNF', 'Isometric Exercises'
  ];

  const commonBodyParts = [
    'Cervical Spine',
    'Lumbar Spine',
    'Right Knee',
    'Left Knee',
    'Right Shoulder',
    'Left Shoulder',
    'Ankle Joint',
    'Thoracic Spine',
    'Hip Joint',
    'Wrist & Hand',
    'Facial Nerve',
    'Whole Body Rehab',
  ];

  const commonComorbiditiesList = [
    'Hypertension',
    'Type 2 Diabetes',
    'Cardiac Pacemaker (NO Electrotherapy)',
    'Osteoporosis',
    'Hypothyroidism',
    'Previous Spinal Surgery',
  ];

  const toggleSessionModality = (mod: string) => {
    setSessionModalities((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const toggleEditComorbidity = (tag: string) => {
    setEditComorbidities((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const showFeedback = (type: 'SUCCESS' | 'ERROR', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  // 1. Handle Log Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSession(true);

    try {
      addSession(patient.id, activeEpisode.id, {
        attendanceStatus: sessionAttendance,
        painScore: sessionPainScore,
        modalitiesUsed: sessionModalities,
        subjectiveNotes: sessionSubjective || 'Patient reports steady therapeutic progress.',
        objectiveFindings: sessionObjective || 'Joint mobility improving with no adverse swelling.',
        exercisePrescription: sessionExercises || 'Continued prescribed home exercise regimen.',
      });

      setIsLogSessionModalOpen(false);
      setSessionSubjective('');
      setSessionObjective('');
      setSessionExercises('');
      showFeedback('SUCCESS', `Session #${activeEpisode.sessions.length + 1} logged! Remaining sessions: ${Math.max(0, activeEpisode.remaining_sessions - 1)}`);
    } catch (err: any) {
      showFeedback('ERROR', err.message || 'Failed to log session.');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // 2. Handle Create New Treatment Episode (Without overwriting past history)
  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEpTitle.trim() || !newEpComplaint.trim()) {
      showFeedback('ERROR', 'Episode Title and Chief Complaint are required.');
      return;
    }

    setIsSubmittingEpisode(true);

    try {
      const created = addEpisode(patient.id, {
        title: newEpTitle.trim(),
        chiefComplaint: newEpComplaint.trim(),
        affectedBodyPart: newEpBodyPart.trim(),
        totalSessions: Number(newEpSessions) || 10,
        packageFee: Number(newEpFee) || 6000,
        amountPaid: Number(newEpAmountPaid) || 0,
        paymentStatus: newEpPaymentStatus,
        clinicalGoals: newEpGoals.trim() || undefined,
        archivePreviousActive: archivePrevious,
      });

      setSelectedEpisodeId(created.id);
      setIsNewEpisodeModalOpen(false);
      setNewEpTitle('');
      setNewEpComplaint('');
      setNewEpGoals('');
      showFeedback('SUCCESS', `New Treatment Episode "${created.title}" started! Previous history preserved.`);
    } catch (err: any) {
      showFeedback('ERROR', err.message || 'Failed to create new episode.');
    } finally {
      setIsSubmittingEpisode(false);
    }
  };

  // 3. Handle Update Patient Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim() || editFullName.trim().length < 2) {
      showFeedback('ERROR', 'Full name is required (min 2 characters).');
      return;
    }
    const cleanPhone = editPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      showFeedback('ERROR', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsUpdatingProfile(true);

    try {
      updatePatient(patient.id, {
        full_name: editFullName.trim(),
        phone: cleanPhone,
        age: editAge ? Number(editAge) : null,
        gender: editGender,
        occupation: editOccupation.trim() || null,
        address: editAddress.trim() || null,
        emergency_contact: editEmergencyContact.trim() || null,
        comorbidities: editComorbidities,
        medical_history_notes: editMedicalNotes.trim() || null,
      });

      setIsEditProfileModalOpen(false);
      showFeedback('SUCCESS', 'Patient profile updated successfully!');
    } catch (err: any) {
      showFeedback('ERROR', err.message || 'Failed to update patient profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // 4. Handle Episode Status Change (ACTIVE / COMPLETED / PAUSED)
  const handleEpisodeStatusChange = (status: EpisodeStatusType) => {
    updateEpisode(patient.id, activeEpisode.id, { status });
    showFeedback('SUCCESS', `Episode marked as ${status}.`);
  };

  const handleSendWhatsAppReminder = () => {
    const url = generateWhatsAppReminderUrl({
      patientName: patient.full_name,
      patientPhone: patient.phone,
      clinicName: therapist.clinic_name,
      therapistName: 'Sharma',
      appointmentTime: 'Tomorrow at 10:30 AM',
      instructions: 'Please wear comfortable loose clothing for joint mobilization.',
    });
    window.open(url, '_blank');
  };

  const handleSendPackageAlert = () => {
    const url = generatePackageUpdateUrl({
      patientName: patient.full_name,
      patientPhone: patient.phone,
      clinicName: therapist.clinic_name,
      episodeTitle: activeEpisode.title,
      attendedSessions: activeEpisode.attended_sessions,
      remainingSessions: activeEpisode.remaining_sessions,
    });
    window.open(url, '_blank');
  };

  // Appointments for this patient
  const patientAppointments = appointments.filter((a) => a.patient_id === patient.id);
  const filteredAppointments = patientAppointments.filter((apt) => {
    if (aptFilter === 'ALL') return true;
    if (aptFilter === 'ATTENDED') return apt.status === 'ATTENDED' || apt.status === 'COMPLETED';
    return apt.status === aptFilter;
  });

  // Handle Book Appointment
  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const [h, m] = bookTime.split(':');
    const startObj = new Date(`${bookDate}T${h || '10'}:${m || '00'}:00`);
    const endObj = new Date(startObj.getTime() + parseInt(bookDuration || '45') * 60000);

    addAppointment({
      patientId: patient.id,
      episodeId: bookEpisodeId || activeEpisode.id,
      scheduledStart: startObj.toISOString(),
      scheduledEnd: endObj.toISOString(),
      notes: bookNotes,
    });

    setIsBookAptModalOpen(false);
    showFeedback('SUCCESS', `Appointment scheduled for ${bookDate} at ${bookTime}! (Sessions remain untouched until attendance is marked)`);
  };

  // Open Reschedule Modal
  const openRescheduleModal = (apt: FullAppointment) => {
    setActiveAptModal(apt);
    const d = new Date(apt.scheduled_start);
    setRescheduleDate(d.toISOString().split('T')[0]);
    setRescheduleTime(d.toTimeString().slice(0, 5));
    setRescheduleReason('Patient requested different slot');
    setAptModalType('RESCHEDULE');
  };

  // Submit Reschedule
  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAptModal) return;

    const [h, m] = rescheduleTime.split(':');
    const startObj = new Date(`${rescheduleDate}T${h || '10'}:${m || '00'}:00`);
    const endObj = new Date(startObj.getTime() + 45 * 60000);

    rescheduleAppointment(
      activeAptModal.id,
      startObj.toISOString(),
      endObj.toISOString(),
      rescheduleReason
    );

    setAptModalType(null);
    showFeedback('SUCCESS', `Appointment rescheduled to ${rescheduleDate} at ${rescheduleTime}!`);
  };

  // Open Cancel Modal
  const openCancelModal = (apt: FullAppointment) => {
    setActiveAptModal(apt);
    setCancelReason('Patient conflict / unwell');
    setAptModalType('CANCEL');
  };

  // Submit Cancel
  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAptModal) return;

    cancelAppointment(activeAptModal.id, cancelReason);
    setAptModalType(null);
    showFeedback('SUCCESS', `Appointment cancelled. Reason: ${cancelReason}`);
  };

  // Fast Attendance Status Change
  const handleQuickStatusChange = (apt: FullAppointment, targetStatus: AppointmentStatusType) => {
    updateAppointmentStatus(apt.id, targetStatus);
    if (targetStatus === 'ATTENDED' || targetStatus === 'COMPLETED') {
      showFeedback('SUCCESS', `✓ Confirmed ATTENDED! 1 session deducted from package (${Math.max(0, apt.remainingSessions - 1)} left).`);
    } else if (targetStatus === 'NO_SHOW') {
      showFeedback('SUCCESS', `⚠️ Marked as NO-SHOW. Patient did not attend; package sessions preserved.`);
    } else if (targetStatus === 'CANCELLED') {
      showFeedback('SUCCESS', `Appointment marked as CANCELLED.`);
    } else if (targetStatus === 'SCHEDULED') {
      showFeedback('SUCCESS', `Appointment status reset to SCHEDULED.`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-lg animate-in slide-in-from-top-3 ${
          feedbackMessage.type === 'SUCCESS'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-500/10'
            : 'bg-rose-50 border-rose-300 text-rose-900 shadow-rose-500/10'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 px-2 py-0.5 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/patients"
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {patient.full_name}
              </h1>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200">
                {patient.patient_code}
              </span>
              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                title="Edit Patient Demographics"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {patient.age ? `${patient.age} yrs` : 'Age N/A'} • {patient.gender.toLowerCase()} • {patient.occupation || 'Consultation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditProfileModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={handleSendWhatsAppReminder}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-all"
          >
            <Send className="w-3.5 h-3.5 text-teal-600" />
            <span>WhatsApp Reminder</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBookAptModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>+ Book Slot</span>
          </button>

          <button
            type="button"
            onClick={() => setIsLogSessionModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Log Treatment Session</span>
          </button>
        </div>
      </div>

      {/* Patient Bio & Medical History Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: Contact Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-4 h-4 text-teal-600" /> Patient Contact & Bio
            </h3>
            <button
              onClick={() => setIsEditProfileModalOpen(true)}
              className="text-[11px] font-bold text-teal-600 hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Mobile Phone</span>
              <div className="font-mono font-bold text-slate-800 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-teal-600" />
                +91 {patient.phone}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Emergency Contact</span>
              <div className="font-semibold text-slate-800">
                {patient.emergency_contact || 'None registered'}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">Address</span>
              <div className="font-medium text-slate-700">
                {patient.address || 'Local Clinic Walk-in'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Medical History & Contraindications Banner (2 cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> Clinical Alerts & Contraindications
            </h3>
            {patient.comorbidities && patient.comorbidities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {patient.comorbidities.map((item, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200"
                  >
                    ⚠️ {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed font-medium">
            <span className="font-bold text-slate-900 block mb-1">
              Physician & Baseline Assessment Notes:
            </span>
            {patient.medical_history_notes || 'No major surgical history recorded.'}
          </div>
        </div>

      </div>

      {/* Multiple Episodes Management Strip (Core Requirement) */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
              Treatment Episodes ({patient.episodes.length})
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              (Each episode maintains independent attendance and clinical history)
            </span>
          </div>

          <button
            onClick={() => setIsNewEpisodeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 shrink-0 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Start New Treatment Episode</span>
          </button>
        </div>

        {/* Episode Tabs / Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {patient.episodes.map((ep, idx) => {
            const isSelected = ep.id === activeEpisode.id;
            return (
              <button
                key={ep.id}
                onClick={() => setSelectedEpisodeId(ep.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 border text-left ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-700 shadow-md shadow-teal-600/20'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Activity className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-teal-600'}`} />
                <div>
                  <div className="font-extrabold">{ep.title}</div>
                  <div className={`text-[10px] font-normal ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                    {ep.attended_sessions} / {ep.total_package_sessions} sessions • {ep.status}
                  </div>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ml-1 ${
                  ep.status === 'ACTIVE'
                    ? isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                    : isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {ep.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Treatment Episode Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* Episode Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                activeEpisode.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}></span>
              <h2 className="text-xl font-extrabold text-slate-900">
                {activeEpisode.title}
              </h2>
              
              {/* Episode Status Dropdown Switcher */}
              <div className="relative inline-block">
                <select
                  value={activeEpisode.status}
                  onChange={(e) => handleEpisodeStatusChange(e.target.value as EpisodeStatusType)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border focus:outline-none cursor-pointer ${
                    activeEpisode.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : activeEpisode.status === 'COMPLETED'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="PAUSED">PAUSED</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Chief Complaint: <strong>{activeEpisode.chief_complaint}</strong>
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Joint / Region: <strong className="text-slate-700">{activeEpisode.affected_body_part}</strong> • Started: {activeEpisode.start_date}
            </p>
          </div>

          {/* Package Billing Badge */}
          <div className="text-right bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Package Commercials</div>
            <div className="font-extrabold text-sm text-slate-900 font-mono">
              ₹{activeEpisode.package_fee.toLocaleString()}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
              activeEpisode.payment_status === 'PAID'
                ? 'bg-emerald-100 text-emerald-800'
                : activeEpisode.payment_status === 'PARTIAL'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {activeEpisode.payment_status}
            </span>
          </div>
        </div>

        {/* Visual Session Package Counter (Core Value Prop) */}
        <div className={`p-6 rounded-3xl border space-y-3.5 ${
          isLowPackage 
            ? 'bg-amber-50/80 border-amber-200' 
            : 'bg-teal-50/60 border-teal-200/80'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className={`text-xs font-extrabold uppercase tracking-wider ${
                isLowPackage ? 'text-amber-800' : 'text-teal-800'
              }`}>
                Package Sessions Tracker
              </span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {activeEpisode.attended_sessions} of {activeEpisode.total_package_sessions} Sessions Attended
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-sm ${
                isLowPackage 
                  ? 'bg-amber-200 text-amber-950 animate-pulse' 
                  : 'bg-teal-600 text-white'
              }`}>
                {activeEpisode.remaining_sessions} Sessions Remaining
              </span>

              {isLowPackage && (
                <button
                  type="button"
                  onClick={handleSendPackageAlert}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm"
                  title="Notify patient via WhatsApp about low session balance"
                >
                  <Send className="w-3.5 h-3.5 text-teal-400" />
                  <span>Notify Patient</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-white/80 rounded-full overflow-hidden border border-black/5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isLowPackage ? 'bg-amber-500' : 'bg-teal-600'
              }`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium">
            <span className={isLowPackage ? 'text-amber-800' : 'text-teal-800'}>
              {Math.round(progressPercent)}% of package completed
            </span>
            {isLowPackage && (
              <span className="text-amber-900 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Prepare re-assessment or package extension
              </span>
            )}
          </div>
        </div>

        {/* Treatment Sessions History Feed */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Treatment Sessions History ({activeEpisode.sessions.length})
              </h3>
              <p className="text-xs text-slate-500">
                Longitudinal progression of pain score (VAS), modalities applied, and clinical notes for this episode
              </p>
            </div>

            <button
              onClick={() => setIsLogSessionModalOpen(true)}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200"
            >
              <Plus className="w-3.5 h-3.5" /> Log new session
            </button>
          </div>

          {activeEpisode.sessions.length === 0 ? (
            <div className="text-center py-8 p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <CalendarDays className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No sessions logged yet for this episode</p>
              <p className="text-[11px] text-slate-400">Click &ldquo;+ Log Treatment Session&rdquo; above to record the first visit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeEpisode.sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-extrabold text-xs flex items-center justify-center font-mono">
                        #{session.session_number}
                      </span>
                      <div>
                        <span className="font-extrabold text-sm text-slate-900">
                          Session #{session.session_number}
                        </span>
                        <span className="text-xs text-slate-400 ml-2 font-medium">
                          {new Date(session.session_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {session.pain_score !== null && (
                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                          session.pain_score <= 3 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : session.pain_score <= 6 
                            ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          VAS Pain: {session.pain_score} / 10
                        </span>
                      )}

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        session.attendance_status === 'ATTENDED' 
                          ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {session.attendance_status}
                      </span>
                    </div>
                  </div>

                  {/* Modalities Used */}
                  {session.modalities_used && session.modalities_used.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {session.modalities_used.map((mod, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                        >
                          • {mod}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Subjective & Objective Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 font-bold block mb-0.5">Subjective:</span>
                      <p className="text-slate-700">{session.subjective_notes || 'None noted'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block mb-0.5">Objective / ROM:</span>
                      <p className="text-slate-700">{session.objective_findings || 'None noted'}</p>
                    </div>
                  </div>

                  {/* Exercise Prescription */}
                  {session.exercise_prescription && (
                    <div className="text-xs bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2">
                      <Activity className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-emerald-900">Home Exercise Regimen: </span>
                        <span className="text-emerald-800">{session.exercise_prescription}</span>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* Appointment Scheduling & Attendance History Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="w-5 h-5 text-teal-600" />
              <h3 className="text-lg font-extrabold text-slate-900">
                Appointments & Attendance History
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {patientAppointments.length}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Schedule appointments, manage status changes (Attended, No-Show, Cancelled), and reschedule sessions.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsBookAptModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 active:scale-95 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Schedule Appointment</span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All Slots', count: patientAppointments.length },
            { id: 'SCHEDULED', label: 'Scheduled', count: patientAppointments.filter((a) => a.status === 'SCHEDULED').length },
            { id: 'ATTENDED', label: 'Attended', count: patientAppointments.filter((a) => a.status === 'ATTENDED' || a.status === 'COMPLETED').length },
            { id: 'NO_SHOW', label: 'No-Show', count: patientAppointments.filter((a) => a.status === 'NO_SHOW').length },
            { id: 'CANCELLED', label: 'Cancelled', count: patientAppointments.filter((a) => a.status === 'CANCELLED').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAptFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                aptFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                aptFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Attendance Rule Explainer Banner */}
        <div className="text-[11px] text-teal-800 bg-teal-50/80 p-3.5 rounded-2xl border border-teal-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              <strong>Clinical Billing Policy:</strong> Remaining package sessions decrease <strong>ONLY</strong> when an appointment is confirmed as <strong>Attended</strong>. No-shows and cancellations preserve the patient&apos;s package balance.
            </span>
          </div>
        </div>

        {/* Appointment Cards List */}
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No appointments found</p>
            <p className="text-[11px] text-slate-400">
              {aptFilter === 'ALL'
                ? 'No appointments scheduled for this patient yet.'
                : `No appointments with status "${aptFilter}".`}
            </p>
            <button
              type="button"
              onClick={() => setIsBookAptModalOpen(true)}
              className="mt-2 text-xs font-bold text-teal-600 hover:underline inline-block"
            >
              + Schedule an appointment now
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredAppointments.map((apt) => {
              const startDate = new Date(apt.scheduled_start);
              const endDate = new Date(apt.scheduled_end);
              const isAttended = apt.status === 'ATTENDED' || apt.status === 'COMPLETED';
              const isScheduled = apt.status === 'SCHEDULED';
              const isNoShow = apt.status === 'NO_SHOW';
              const isCancelled = apt.status === 'CANCELLED';
              const isRescheduled = apt.status === 'RESCHEDULED';

              return (
                <div
                  key={apt.id}
                  className={`p-5 rounded-2xl border transition-all space-y-3.5 ${
                    isAttended
                      ? 'bg-emerald-50/20 border-emerald-200/80 hover:border-emerald-300'
                      : isNoShow
                      ? 'bg-amber-50/20 border-amber-200/80 hover:border-amber-300'
                      : isCancelled
                      ? 'bg-slate-50/60 border-slate-200 opacity-80'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  {/* Top Bar: Date/Time + Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-800 shrink-0 font-bold border border-slate-200">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold leading-none">
                          {startDate.toLocaleDateString('en-IN', { month: 'short' })}
                        </span>
                        <span className="text-sm font-black leading-none mt-0.5">
                          {startDate.getDate()}
                        </span>
                      </div>

                      <div>
                        <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <span>
                            {startDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-teal-700">
                            {startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          Episode: <strong className="text-slate-700">{apt.episodeTitle}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border flex items-center gap-1 ${
                        isAttended
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isNoShow
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : isCancelled
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : isRescheduled
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-sky-100 text-sky-800 border-sky-300'
                      }`}>
                        {isAttended && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                        {isNoShow && <AlertTriangle className="w-3 h-3 text-amber-700" />}
                        {isCancelled && <XCircle className="w-3 h-3 text-rose-700" />}
                        {isScheduled && <Clock className="w-3 h-3 text-sky-700" />}
                        <span>{isAttended ? 'ATTENDED' : apt.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Notes & Session Balance Impact Indicator */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100 font-medium">
                    <div className="text-slate-700">
                      <span className="font-bold text-slate-500 mr-1.5">Instructions / Notes:</span>
                      {apt.notes || 'Routine follow-up therapy slot.'}
                    </div>

                    <div className="shrink-0 text-[11px]">
                      {isAttended && (
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> 1 session decremented from package
                        </span>
                      )}
                      {isNoShow && (
                        <span className="font-bold text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> No session deducted (retained)
                        </span>
                      )}
                      {isCancelled && (
                        <span className="font-semibold text-slate-500">
                          Cancelled slot (package balance protected)
                        </span>
                      )}
                      {isScheduled && (
                        <span className="font-medium text-slate-500">
                          Package remains intact until attendance marked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    {/* If SCHEDULED or RESCHEDULED: show Mark Attended, Mark No-Show, Reschedule, Cancel */}
                    {(isScheduled || isRescheduled) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(apt, 'ATTENDED')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-all active:scale-95 shadow-sm"
                          title="Confirm attendance: decrements remaining package sessions"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mark Attended</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(apt, 'NO_SHOW')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 hover:bg-amber-100 transition-all active:scale-95 shadow-sm"
                          title="Mark no-show: patient was absent, does NOT deduct session"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Mark No-Show</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openRescheduleModal(apt)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
                          title="Move to new date/time"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Reschedule</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openCancelModal(apt)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all active:scale-95"
                          title="Cancel appointment"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}

                    {/* If ATTENDED: allow changing to No-Show if mistakenly clicked (restores session) */}
                    {isAttended && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Mistakenly marked?</span>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(apt, 'NO_SHOW')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-all"
                          title="Revert attendance and restore 1 session to package"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-600" />
                          <span>Change to No-Show (Restore session)</span>
                        </button>
                      </div>
                    )}

                    {/* If NO_SHOW: allow changing to Attended (if patient arrived late) */}
                    {isNoShow && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Patient showed up late?</span>
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(apt, 'ATTENDED')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-all"
                          title="Mark attended and decrement package session"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mark Attended</span>
                        </button>
                      </div>
                    )}

                    {/* If CANCELLED: allow rescheduling */}
                    {isCancelled && (
                      <button
                        type="button"
                        onClick={() => openRescheduleModal(apt)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                        <span>Re-book Appointment</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL 1: Edit Patient Profile */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Edit Patient Profile
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Patient Code: {patient.patient_code}
                </p>
              </div>
              <button
                onClick={() => setIsEditProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    10-Digit Mobile Number *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-bold text-slate-400 font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      className="w-full pl-11 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={editAge}
                      onChange={(e) => setEditAge(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value as GenderType)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={editOccupation}
                    onChange={(e) => setEditOccupation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Address / Locality
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    value={editEmergencyContact}
                    onChange={(e) => setEditEmergencyContact(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>
              </div>

              {/* Comorbidities */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Medical Comorbidities & Precautions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {commonComorbiditiesList.map((tag) => {
                    const isSelected = editComorbidities.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleEditComorbidity(tag)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                          isSelected
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Baseline Clinical & Surgical History Notes
                </label>
                <textarea
                  rows={3}
                  value={editMedicalNotes}
                  onChange={(e) => setEditMedicalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: Log Treatment Session */}
      {isLogSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Log Treatment Visit (Session #{activeEpisode.sessions.length + 1})
                </h3>
                <p className="text-xs text-slate-500">
                  Episode: {activeEpisode.title}
                </p>
              </div>
              <button
                onClick={() => setIsLogSessionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={sessionAttendance}
                    onChange={(e) => setSessionAttendance(e.target.value as AttendanceType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-800"
                  >
                    <option value="ATTENDED">Attended (Decrements session)</option>
                    <option value="MISSED">Missed / Patient No-Show</option>
                    <option value="CANCELLED">Cancelled with Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Visual Analogue Pain (VAS 0–10): <span className="text-teal-700">{sessionPainScore}/10</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={sessionPainScore}
                    onChange={(e) => setSessionPainScore(parseInt(e.target.value))}
                    className="w-full accent-teal-600 cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>0: No Pain</span>
                    <span>5: Moderate</span>
                    <span>10: Severe</span>
                  </div>
                </div>
              </div>

              {/* Modalities Used */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Electrotherapy Modalities & Manual Interventions
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableModalities.map((mod) => {
                    const isSelected = sessionModalities.includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => toggleSessionModality(mod)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                          isSelected
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subjective Progress */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Subjective Patient Feedback
                </label>
                <textarea
                  rows={2}
                  value={sessionSubjective}
                  onChange={(e) => setSessionSubjective(e.target.value)}
                  placeholder="e.g. Pain reduced from 6 to 3, patient able to walk stairs with handrail..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              {/* Objective Progress */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Objective Findings & Range of Motion (ROM)
                </label>
                <textarea
                  rows={2}
                  value={sessionObjective}
                  onChange={(e) => setSessionObjective(e.target.value)}
                  placeholder="e.g. Active knee flexion reached 115 degrees. Extension lag completely gone..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              {/* Prescribed Exercises */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Prescribed Home Exercises
                </label>
                <input
                  type="text"
                  value={sessionExercises}
                  onChange={(e) => setSessionExercises(e.target.value)}
                  placeholder="e.g. Quad isometric sets, straight leg raises with 1kg, ice pack twice daily"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLogSessionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSession}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmittingSession ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Save Session & Update Package
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: Add New Treatment Episode (Preserves All History) */}
      {isNewEpisodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Start New Treatment Episode
                </h3>
                <p className="text-xs text-slate-500">
                  Patient: {patient.full_name} ({patient.patient_code})
                </p>
              </div>
              <button
                onClick={() => setIsNewEpisodeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-teal-800 bg-teal-50 p-3 rounded-xl border border-teal-200 leading-relaxed font-medium">
              💡 <strong>History Protected</strong>: This will create an independent episode with its own package sessions, clinical notes, and billing. Past episode records remain fully accessible in the episode tabs above.
            </p>

            <form onSubmit={handleCreateEpisode} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Condition / Episode Title *
                </label>
                <input
                  type="text"
                  required
                  value={newEpTitle}
                  onChange={(e) => setNewEpTitle(e.target.value)}
                  placeholder="e.g. Lumbar Spine Disc Rehab (New Episode)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chief Complaint *
                </label>
                <input
                  type="text"
                  required
                  value={newEpComplaint}
                  onChange={(e) => setNewEpComplaint(e.target.value)}
                  placeholder="e.g. Radiating back and calf numbness after lifting weight"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Affected Body Region
                  </label>
                  <select
                    value={newEpBodyPart}
                    onChange={(e) => setNewEpBodyPart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  >
                    {commonBodyParts.map((part) => (
                      <option key={part} value={part}>
                        {part}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Package Sessions *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newEpSessions}
                    onChange={(e) => setNewEpSessions(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Total Package Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newEpFee}
                    onChange={(e) => setNewEpFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Initial Payment Status
                  </label>
                  <select
                    value={newEpPaymentStatus}
                    onChange={(e) => setNewEpPaymentStatus(e.target.value as PaymentStatusType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold"
                  >
                    <option value="PAID">Paid in Full</option>
                    <option value="PARTIAL">Partial Payment</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Clinical Goals / Prescription Notes
                </label>
                <textarea
                  rows={2}
                  value={newEpGoals}
                  onChange={(e) => setNewEpGoals(e.target.value)}
                  placeholder="e.g. Core stabilization, McKenzie extension, restore full trunk mobility..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="archivePrev"
                  checked={archivePrevious}
                  onChange={(e) => setArchivePrevious(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <label htmlFor="archivePrev" className="text-slate-700 font-medium cursor-pointer">
                  Mark current active episode ({activeEpisode.title}) as <strong>Completed</strong>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewEpisodeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEpisode}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmittingEpisode ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Start Episode & Set Active
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 4: Book Appointment */}
      {isBookAptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Schedule Patient Appointment
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {patient.full_name} ({patient.patient_code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBookAptModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-teal-800 bg-teal-50 p-3 rounded-xl border border-teal-200 font-medium leading-relaxed">
              💡 <strong>Session Protection:</strong> Booking this slot does <strong>NOT</strong> deduct package sessions. Sessions decrease only when the appointment attendance is marked as <strong>Attended</strong>.
            </p>

            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Treatment Episode *
                </label>
                <select
                  value={bookEpisodeId}
                  onChange={(e) => setBookEpisodeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold text-slate-800"
                >
                  {patient.episodes.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.title} ({ep.remaining_sessions} sessions left • {ep.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={bookTime}
                    onChange={(e) => setBookTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Session Duration
                </label>
                <select
                  value={bookDuration}
                  onChange={(e) => setBookDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="30">30 minutes (Quick Modality / Follow-up)</option>
                  <option value="45">45 minutes (Standard Treatment Session)</option>
                  <option value="60">60 minutes (Comprehensive / Initial Evaluation)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Preparation & Clinical Notes
                </label>
                <textarea
                  rows={2}
                  value={bookNotes}
                  onChange={(e) => setBookNotes(e.target.value)}
                  placeholder="e.g. Focus on Maitland mobilization, check lumbar flexion ROM..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBookAptModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  <Check className="w-3.5 h-3.5" /> Book Slot (Scheduled)
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 5: Reschedule Appointment */}
      {aptModalType === 'RESCHEDULE' && activeAptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Reschedule Appointment
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {patient.full_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAptModalType(null)}
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
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    New Time Slot *
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Rescheduling
                </label>
                <select
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="Patient requested new time slot">Patient requested new time slot</option>
                  <option value="Patient running late">Patient running late</option>
                  <option value="Therapist emergency/reschedule">Therapist emergency/reschedule</option>
                  <option value="Clinic closed / holiday adjustment">Clinic closed / holiday adjustment</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAptModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Confirm Reschedule
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 6: Cancel Appointment Confirmation */}
      {aptModalType === 'CANCEL' && activeAptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Cancel Appointment?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAptModalType(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel the appointment on{' '}
              <strong>
                {new Date(activeAptModal.scheduled_start).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </strong>?
              The session will NOT be deducted from the patient&apos;s treatment package.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cancellation Reason
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                >
                  <option value="Patient unwell / illness">Patient unwell / illness</option>
                  <option value="Personal / work emergency">Personal / work emergency</option>
                  <option value="Travel / out of station">Travel / out of station</option>
                  <option value="Doctor cancelled / clinic maintenance">Doctor cancelled / clinic maintenance</option>
                  <option value="Duplicate booking">Duplicate booking</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAptModalType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" /> Confirm Cancellation
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
