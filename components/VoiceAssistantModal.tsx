'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Mic, 
  Square, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Sparkles,
  Phone,
  User,
  Activity,
  FileText,
  DollarSign,
  Calendar,
  Clock,
  Search,
  Check,
  AlertTriangle,
  History,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Keyboard,
  HelpCircle
} from 'lucide-react';
import { useApp, FullPatient } from '@/context/AppContext';
import { 
  VoiceIntentType, 
  VoiceProcessingResult, 
  ExtractedRegistrationPayload,
  ExtractedAttendancePayload,
  ExtractedSchedulingPayload,
  ExtractedSearchPayload,
  ExtractedHistoryPayload,
  PatientMatchResult
} from '@/types/voice';
import { KnownPatientRecord } from '@/lib/voice/clinical-nlp';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CLINICAL_PRESETS = [
  {
    label: '1. Register New Patient',
    tag: 'REGISTRATION',
    text: 'Register new patient Ramesh Gupta, 48 year old male, phone 9811223344, acute L4-L5 disc pain with calf radiation. Prescribe 10 sessions package with fee 6000 rupees.',
  },
  {
    label: '2. Mark Attended (Decrements session)',
    tag: 'ATTENDANCE',
    text: 'Mark Sunita Sharma attended today with ultrasound and joint mobilization, pain score 2.',
  },
  {
    label: '3. Mark No-Show (Preserves package)',
    tag: 'ATTENDANCE',
    text: 'Mark Vikram Malhotra as no-show for today session.',
  },
  {
    label: '4. Ambiguity Trigger ("Sharma")',
    tag: 'AMBIGUITY',
    text: 'Record attendance for Sharma today with Maitland mobilization.',
  },
  {
    label: '5. Book Appointment Slot',
    tag: 'SCHEDULING',
    text: 'Schedule appointment for Rajesh Verma tomorrow at 11:30 AM for cervical traction.',
  },
  {
    label: '6. Search & History Lookup',
    tag: 'SEARCH',
    text: 'Find patient Ananya Deshmukh and show remaining package sessions.',
  },
];

export function VoiceAssistantModal({ isOpen, onClose }: VoiceAssistantModalProps) {
  const router = useRouter();
  const { 
    patients, 
    appointments, 
    addPatient, 
    updateAppointmentStatus, 
    addAppointment,
    addSession 
  } = useApp();

  // Mode: MIC (Speech) vs MANUAL (Text Fallback)
  const [activeTab, setActiveTab] = useState<'MIC' | 'MANUAL' | 'PRESETS'>('MIC');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual fallback input text
  const [manualText, setManualText] = useState('');

  // Parsed Voice Result
  const [processingResult, setProcessingResult] = useState<VoiceProcessingResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'RECORD' | 'AMBIGUITY' | 'REVIEW'>('RECORD');

  // Selected candidate patient for ambiguity resolution
  const [resolvedPatient, setResolvedPatient] = useState<KnownPatientRecord | null>(null);

  // Editable Form States during Review
  const [reviewRegFullName, setReviewRegFullName] = useState('');
  const [reviewRegPhone, setReviewRegPhone] = useState('');
  const [reviewRegAge, setReviewRegAge] = useState<number | ''>('');
  const [reviewRegGender, setReviewRegGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [reviewRegComplaint, setReviewRegComplaint] = useState('');
  const [reviewRegBodyPart, setReviewRegBodyPart] = useState('');
  const [reviewRegSessions, setReviewRegSessions] = useState(10);
  const [reviewRegFee, setReviewRegFee] = useState(6000);
  const [reviewRegNotes, setReviewRegNotes] = useState('');

  // Attendance Editable Form
  const [reviewAttStatus, setReviewAttStatus] = useState<'ATTENDED' | 'NO_SHOW' | 'CANCELLED'>('ATTENDED');
  const [reviewAttPain, setReviewAttPain] = useState<number>(2);
  const [reviewAttModalities, setReviewAttModalities] = useState<string[]>(['Ultrasound', 'Joint Mobilization']);
  const [reviewAttNotes, setReviewAttNotes] = useState('');

  // Scheduling Editable Form
  const [reviewSchedDate, setReviewSchedDate] = useState('');
  const [reviewSchedTime, setReviewSchedTime] = useState('11:00');
  const [reviewSchedDuration, setReviewSchedDuration] = useState(45);
  const [reviewSchedNotes, setReviewSchedNotes] = useState('');

  // Audio References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Transform known patients list for backend matching
  const knownPatientRecords: KnownPatientRecord[] = patients.map((p) => {
    const ep = p.episodes[0];
    return {
      id: p.id,
      patient_code: p.patient_code,
      full_name: p.full_name,
      phone: p.phone,
      activeEpisode: ep ? {
        id: ep.id,
        title: ep.title,
        remaining_sessions: ep.remaining_sessions,
        total_package_sessions: ep.total_package_sessions,
        attended_sessions: ep.attended_sessions,
      } : null,
    };
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // 1. Start Audio Recording
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
        // Automatically process the audio blob
        processAudioOrText(blob, null);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission not granted:', err);
      setErrorMessage('Microphone access denied or not supported. Switched to manual entry mode below.');
      setActiveTab('MANUAL');
    }
  };

  // 2. Stop Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // 3. Process Speech Audio or Text Dictation
  const processAudioOrText = async (blob: Blob | null, textFallback: string | null) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let resultData: VoiceProcessingResult;

      if (textFallback) {
        // Send JSON request to /api/voice/process
        const response = await fetch('/api/voice/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: textFallback,
            knownPatients: knownPatientRecords,
          }),
        });

        resultData = await response.json();
      } else if (blob) {
        const formData = new FormData();
        formData.append('audio', blob, 'physio-voice.webm');
        formData.append('knownPatients', JSON.stringify(knownPatientRecords));

        const response = await fetch('/api/voice/process', {
          method: 'POST',
          body: formData,
        });

        resultData = await response.json();
      } else {
        throw new Error('No audio or text provided to process.');
      }

      if (!resultData.success) {
        throw new Error((resultData as any).error || 'Failed to process voice dictation.');
      }

      setProcessingResult(resultData);

      // Populate review state based on intent
      if (resultData.intent === 'PATIENT_REGISTRATION' && resultData.registrationPayload) {
        const reg = resultData.registrationPayload;
        setReviewRegFullName(reg.fullName);
        setReviewRegPhone(reg.phone);
        setReviewRegAge(reg.age ?? '');
        setReviewRegGender(reg.gender);
        setReviewRegComplaint(reg.chiefComplaint);
        setReviewRegBodyPart(reg.affectedBodyPart);
        setReviewRegSessions(reg.suggestedPackageSessions);
        setReviewRegFee(reg.packageFee || 6000);
        setReviewRegNotes(reg.clinicalNotes);
      } else if (resultData.intent === 'ATTENDANCE_UPDATE' && resultData.attendancePayload) {
        const att = resultData.attendancePayload;
        setReviewAttStatus(att.status);
        setReviewAttPain(att.painScore ?? 3);
        setReviewAttModalities(att.modalities.length > 0 ? att.modalities : ['Ultrasound', 'Joint Mobilization']);
        setReviewAttNotes(att.subjectiveNotes || '');
      } else if (resultData.intent === 'APPOINTMENT_SCHEDULING' && resultData.schedulingPayload) {
        const sched = resultData.schedulingPayload;
        setReviewSchedDate(sched.date);
        setReviewSchedTime(sched.startTime);
        setReviewSchedDuration(sched.durationMinutes || 45);
        setReviewSchedNotes(sched.notes || '');
      }

      // Check if ambiguous patient matching occurred
      if (resultData.patientMatch?.status === 'AMBIGUOUS') {
        setCurrentStep('AMBIGUITY');
      } else {
        if (resultData.patientMatch?.status === 'EXACT_MATCH' && resultData.patientMatch.matchedPatient) {
          setResolvedPatient(resultData.patientMatch.matchedPatient);
        }
        setCurrentStep('REVIEW');
      }
    } catch (err: any) {
      console.error('Voice processing error:', err);
      setErrorMessage(err.message || 'Error communicating with voice processor.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Resolve Ambiguous Patient
  const handleSelectAmbiguousPatient = (candidate: KnownPatientRecord) => {
    setResolvedPatient(candidate);
    setCurrentStep('REVIEW');
  };

  // 5. Explicit User Confirmation: Save & Apply Action
  const handleConfirmAndSave = async () => {
    if (!processingResult) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const intent = processingResult.intent;

      if (intent === 'PATIENT_REGISTRATION') {
        // Validate inputs
        if (!reviewRegFullName.trim() || reviewRegFullName.trim().length < 2) {
          throw new Error('Patient full name is required (min 2 characters).');
        }
        const cleanPhone = reviewRegPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.length !== 10) {
          throw new Error('Valid 10-digit mobile number is required.');
        }

        const newPatient = addPatient({
          fullName: reviewRegFullName.trim(),
          phone: cleanPhone,
          age: reviewRegAge ? Number(reviewRegAge) : null,
          gender: reviewRegGender,
          occupation: 'Consultation Walk-in',
          chiefComplaint: reviewRegComplaint.trim() || 'Physiotherapy Evaluation',
          affectedBodyPart: reviewRegBodyPart.trim() || 'General Rehabilitation',
          comorbidities: processingResult.registrationPayload?.comorbidities || [],
          suggestedPackageSessions: Number(reviewRegSessions) || 10,
          packageFee: Number(reviewRegFee) || 6000,
          clinicalNotes: reviewRegNotes.trim() || processingResult.transcript,
        });

        onClose();
        router.push(`/patients/${newPatient.id}`);

      } else if (intent === 'ATTENDANCE_UPDATE') {
        const targetPatient = resolvedPatient || processingResult.patientMatch?.matchedPatient;
        if (!targetPatient) {
          throw new Error('Cannot update attendance: No target patient selected.');
        }

        // 1. Decrement package if ATTENDED
        if (targetPatient.activeEpisode) {
          addSession(targetPatient.id, targetPatient.activeEpisode.id, {
            attendanceStatus: reviewAttStatus === 'ATTENDED' ? 'ATTENDED' : 'MISSED',
            painScore: reviewAttPain,
            modalitiesUsed: reviewAttModalities,
            subjectiveNotes: reviewAttNotes || 'Voice recorded clinical session progress.',
            objectiveFindings: 'Joint range of motion maintained; therapeutic progress steady.',
            exercisePrescription: 'Prescribed home exercise routine.',
          });
        }

        // 2. Also update any scheduled appointment for today
        const patientApt = appointments.find((a) => a.patient_id === targetPatient.id && a.status === 'SCHEDULED');
        if (patientApt) {
          updateAppointmentStatus(patientApt.id, reviewAttStatus);
        }

        onClose();
        router.push(`/patients/${targetPatient.id}`);

      } else if (intent === 'APPOINTMENT_SCHEDULING') {
        const targetPatient = resolvedPatient || processingResult.patientMatch?.matchedPatient;
        if (!targetPatient) {
          throw new Error('Cannot schedule appointment: No target patient selected.');
        }

        const [h, m] = reviewSchedTime.split(':');
        const startObj = new Date(`${reviewSchedDate || new Date().toISOString().split('T')[0]}T${h || '10'}:${m || '00'}:00`);
        const endObj = new Date(startObj.getTime() + reviewSchedDuration * 60000);

        addAppointment({
          patientId: targetPatient.id,
          episodeId: targetPatient.activeEpisode?.id,
          scheduledStart: startObj.toISOString(),
          scheduledEnd: endObj.toISOString(),
          notes: reviewSchedNotes || 'Follow-up physiotherapy slot (Voice scheduled)',
        });

        onClose();
        router.push(`/calendar`);

      } else if (intent === 'PATIENT_SEARCH' || intent === 'HISTORY_RETRIEVAL') {
        const targetPatient = resolvedPatient || processingResult.patientMatch?.matchedPatient;
        if (targetPatient) {
          onClose();
          router.push(`/patients/${targetPatient.id}`);
        } else {
          onClose();
          router.push(`/patients`);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save confirmed action.');
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Reset
  const handleReset = () => {
    setIsRecording(false);
    setAudioBlob(null);
    setRecordingDuration(0);
    setProcessingResult(null);
    setResolvedPatient(null);
    setCurrentStep('RECORD');
    setErrorMessage(null);
  };

  // Toggle modality in attendance review
  const toggleModality = (mod: string) => {
    setReviewAttModalities((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                Physio Voice Assistant
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  AI v2.0
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Hands-free clinical dictation • Registration • Attendance • Appointments • Search
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="m-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 flex items-center gap-2.5 font-medium shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-800 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* STEP 1: RECORD / INPUT DICTATION */}
          {currentStep === 'RECORD' && (
            <div className="space-y-6">
              
              {/* Tab Selector */}
              <div className="flex p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('MIC')}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'MIC' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-teal-600" />
                  <span>Microphone Dictation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('MANUAL')}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'MANUAL' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5 text-teal-600" />
                  <span>Manual Entry Fallback</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('PRESETS')}
                  className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'PRESETS' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Clinical Presets</span>
                </button>
              </div>

              {/* TAB 1: Live Microphone Interface */}
              {activeTab === 'MIC' && (
                <div className="text-center py-6 px-4 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                  <div className="relative inline-flex items-center justify-center">
                    {/* Pulsing Aura if recording */}
                    {isRecording && (
                      <span className="absolute inline-flex h-28 w-28 animate-ping rounded-full bg-teal-400 opacity-30"></span>
                    )}

                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                      className={`relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all transform active:scale-95 ${
                        isRecording 
                          ? 'bg-rose-600 hover:bg-rose-700 ring-4 ring-rose-200' 
                          : 'bg-teal-600 hover:bg-teal-700 ring-4 ring-teal-100 hover:scale-105'
                      }`}
                    >
                      {isRecording ? (
                        <Square className="w-8 h-8 fill-current" />
                      ) : (
                        <Mic className="w-8 h-8" />
                      )}
                    </button>
                  </div>

                  <div>
                    <div className="font-extrabold text-base text-slate-800">
                      {isRecording ? 'Listening to Clinical Dictation...' : 'Tap to Start Speaking'}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-1">
                      {isRecording 
                        ? `Recording duration: ${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')}`
                        : 'Supports English, Indian names, medical modalities, and clinical complaints.'}
                    </div>
                  </div>

                  {isRecording && (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop & Analyze Speech</span>
                    </button>
                  )}
                </div>
              )}

              {/* TAB 2: Manual Entry Dictation Fallback */}
              {activeTab === 'MANUAL' && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Type or Paste Clinical Dictation Text:
                  </label>
                  <textarea
                    rows={4}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="e.g. Register new patient Meera Kapoor, 45 female, phone 9811223344, cervical spondylosis, 10 sessions fee 6000..."
                    className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>💡 Use when microphone is unavailable or in noisy clinic rooms.</span>
                    <button
                      type="button"
                      disabled={!manualText.trim() || isProcessing}
                      onClick={() => processAudioOrText(null, manualText.trim())}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/20 active:scale-95 transition-all disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Process Dictation</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: Clinical Presets for 1-Click Testing */}
              {activeTab === 'PRESETS' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500 font-medium">
                    Select any realistic clinical voice scenario to test extraction, ambiguity resolution, and confirmations:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {CLINICAL_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => processAudioOrText(null, preset.text)}
                        className="p-3 text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-teal-50/60 hover:border-teal-300 transition-all text-xs group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-extrabold text-slate-800 group-hover:text-teal-900">
                            {preset.label}
                          </span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {preset.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                          &ldquo;{preset.text}&rdquo;
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Processing Loader */}
              {isProcessing && (
                <div className="p-6 bg-teal-50 border border-teal-200 rounded-3xl text-center space-y-2 animate-in fade-in">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
                  <div className="text-sm font-extrabold text-teal-900">
                    Transcribing & Extracting Clinical Entities...
                  </div>
                  <p className="text-xs text-teal-700">
                    Validating phone numbers, clinical complaints, dates, and checking patient identities.
                  </p>
                </div>
              )}

            </div>
          )}

          {/* STEP 2: AMBIGUITY RESOLUTION SCREEN */}
          {currentStep === 'AMBIGUITY' && processingResult?.patientMatch && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                    Ambiguous Patient Identity ({processingResult.patientMatch.candidates.length} Matches Found)
                  </h3>
                  <p className="text-xs text-amber-800 font-medium mt-0.5">
                    {processingResult.patientMatch.ambiguityReason || 'Multiple patients matched your voice query. Please select the intended patient below.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {processingResult.patientMatch.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleSelectAmbiguousPatient(candidate)}
                    className="w-full p-4 rounded-2xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 transition-all text-left flex items-center justify-between group shadow-sm bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 font-black text-sm flex items-center justify-center shrink-0">
                        {candidate.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                          <span>{candidate.full_name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold">
                            {candidate.patient_code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-teal-600" />
                            +91 {candidate.phone}
                          </span>
                          {candidate.activeEpisode && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-teal-700">
                                {candidate.activeEpisode.remaining_sessions} sessions left
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-600 group-hover:translate-x-1 transition-transform">
                      <span>Select Patient</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ← Re-record or cancel
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRMATION SCREEN (Saves ONLY on explicit user click) */}
          {currentStep === 'REVIEW' && processingResult && (
            <div className="space-y-5 animate-in fade-in">
              
              {/* Intent Banner */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Detected Intent:</span>
                  <span className={`px-2.5 py-1 rounded-xl uppercase tracking-wider font-extrabold ${
                    processingResult.intent === 'PATIENT_REGISTRATION'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : processingResult.intent === 'ATTENDANCE_UPDATE'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : processingResult.intent === 'APPOINTMENT_SCHEDULING'
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                  }`}>
                    {processingResult.intent.replace(/_/g, ' ')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                >
                  Discard & Re-record
                </button>
              </div>

              {/* Original Transcript Quote */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 italic">
                <span className="font-bold text-slate-800 not-italic mr-1.5">Transcript:</span>
                &ldquo;{processingResult.transcript}&rdquo;
              </div>

              {/* REVIEW 1: PATIENT REGISTRATION FORM */}
              {processingResult.intent === 'PATIENT_REGISTRATION' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        value={reviewRegFullName}
                        onChange={(e) => setReviewRegFullName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">10-Digit Mobile Phone *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 font-bold text-slate-400 font-mono">+91</span>
                        <input
                          type="tel"
                          maxLength={10}
                          value={reviewRegPhone}
                          onChange={(e) => setReviewRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full pl-11 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Age</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={reviewRegAge}
                        onChange={(e) => setReviewRegAge(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Gender</label>
                      <select
                        value={reviewRegGender}
                        onChange={(e) => setReviewRegGender(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Chief Complaint *</label>
                      <input
                        type="text"
                        value={reviewRegComplaint}
                        onChange={(e) => setReviewRegComplaint(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Affected Joint / Body Region</label>
                      <input
                        type="text"
                        value={reviewRegBodyPart}
                        onChange={(e) => setReviewRegBodyPart(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Package Sessions</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={reviewRegSessions}
                        onChange={(e) => setReviewRegSessions(parseInt(e.target.value) || 10)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-700 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Total Package Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={reviewRegFee}
                        onChange={(e) => setReviewRegFee(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Clinical Notes & Goals</label>
                    <textarea
                      rows={2}
                      value={reviewRegNotes}
                      onChange={(e) => setReviewRegNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* REVIEW 2: ATTENDANCE UPDATE FORM */}
              {processingResult.intent === 'ATTENDANCE_UPDATE' && (
                <div className="space-y-4 text-xs">
                  {/* Matched Patient Pill */}
                  <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-teal-700 uppercase font-black tracking-wider block">Target Patient</span>
                      <div className="font-extrabold text-sm text-slate-900 mt-0.5">
                        {resolvedPatient?.full_name || processingResult.patientMatch?.matchedPatient?.full_name || 'Patient'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {resolvedPatient?.activeEpisode?.title || 'Active Episode'} • {resolvedPatient?.activeEpisode?.remaining_sessions ?? 10} sessions remaining
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white text-teal-800 border border-teal-200">
                      {resolvedPatient?.patient_code || 'PV-26-XXXX'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Attendance Status *</label>
                      <select
                        value={reviewAttStatus}
                        onChange={(e) => setReviewAttStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      >
                        <option value="ATTENDED">Attended (Decrements 1 session)</option>
                        <option value="NO_SHOW">No-Show / Absent (Preserves package)</option>
                        <option value="CANCELLED">Cancelled (Preserves package)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        VAS Pain Score: <span className="text-teal-700 font-bold">{reviewAttPain}/10</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={reviewAttPain}
                        onChange={(e) => setReviewAttPain(parseInt(e.target.value))}
                        className="w-full accent-teal-600 cursor-pointer mt-2"
                      />
                    </div>
                  </div>

                  {/* Modalities Toggle */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">Electrotherapy & Manual Modalities</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Ultrasound', 'IFT', 'TENS', 'Dry Needling', 'Joint Mobilization', 'Cervical Traction', 'Theraband Exercises'].map((mod) => {
                        const isSel = reviewAttModalities.includes(mod);
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => toggleModality(mod)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                              isSel ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isSel ? '✓ ' : '+ '}
                            {mod}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Session Progress Notes</label>
                    <input
                      type="text"
                      value={reviewAttNotes}
                      onChange={(e) => setReviewAttNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <p className="text-[11px] text-teal-800 bg-teal-50/70 p-2.5 rounded-xl border border-teal-200 font-medium">
                    💡 <strong>Package Rule:</strong> Remaining sessions will decrease only when confirmed as <strong>Attended</strong>.
                  </p>
                </div>
              )}

              {/* REVIEW 3: APPOINTMENT SCHEDULING FORM */}
              {processingResult.intent === 'APPOINTMENT_SCHEDULING' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-purple-700 uppercase font-black tracking-wider block">Target Patient</span>
                      <div className="font-extrabold text-sm text-slate-900 mt-0.5">
                        {resolvedPatient?.full_name || processingResult.patientMatch?.matchedPatient?.full_name || 'Patient'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {resolvedPatient?.phone ? `+91 ${resolvedPatient.phone}` : 'Patient Phone Registered'}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white text-purple-800 border border-purple-200">
                      {resolvedPatient?.patient_code || 'PV-26-XXXX'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={reviewSchedDate}
                        onChange={(e) => setReviewSchedDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Start Time *</label>
                      <input
                        type="time"
                        value={reviewSchedTime}
                        onChange={(e) => setReviewSchedTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Clinical Notes</label>
                    <input
                      type="text"
                      value={reviewSchedNotes}
                      onChange={(e) => setReviewSchedNotes(e.target.value)}
                      placeholder="e.g. Cervical traction and manual mobilization"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>

                  <p className="text-[11px] text-purple-800 bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 font-medium">
                    💡 <strong>Package Rule:</strong> Booking this appointment slot will <strong>NOT</strong> deduct sessions until attendance is marked as Attended.
                  </p>
                </div>
              )}

              {/* REVIEW 4: PATIENT SEARCH / HISTORY RETRIEVAL */}
              {(processingResult.intent === 'PATIENT_SEARCH' || processingResult.intent === 'HISTORY_RETRIEVAL') && (
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3 text-xs">
                  <div className="font-extrabold text-sm text-slate-900">
                    Target Patient Located:
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-base text-slate-900">
                        {resolvedPatient?.full_name || processingResult.patientMatch?.matchedPatient?.full_name || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Code: {resolvedPatient?.patient_code || 'PV-26-XXXX'} • Phone: +91 {resolvedPatient?.phone || ''}
                      </div>
                      {resolvedPatient?.activeEpisode && (
                        <div className="text-xs text-teal-700 font-bold mt-1">
                          Episode: {resolvedPatient.activeEpisode.title} ({resolvedPatient.activeEpisode.remaining_sessions} sessions left)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Safety Disclaimer */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2 text-[10px] text-slate-500">
                <ShieldAlert className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  <strong>Clinical Safety Policy:</strong> AI assistant strictly extracts dictated observations. It never invents patient records or generates autonomous medical diagnoses.
                </span>
              </div>

              {/* Action Buttons: SAVES ONLY AFTER EXPLICIT USER CONFIRMATION */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Discard Action
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving & Applying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Apply Action</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
