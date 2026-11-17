'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  UserPlus, 
  Mic, 
  ArrowLeft, 
  Sparkles, 
  User, 
  Phone, 
  Activity, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Play,
  Copy,
  ChevronRight
} from 'lucide-react';
import { useApp, FullPatient } from '@/context/AppContext';
import { GenderType, PaymentStatusType } from '@/types/database';

export default function PatientRegistrationPage() {
  const router = useRouter();
  const { addPatient, checkDuplicatePatient } = useApp();

  const [activeTab, setActiveTab] = useState<'MANUAL' | 'VOICE'>('MANUAL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<GenderType>('MALE');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  
  // Episode & Clinical State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [affectedBodyPart, setAffectedBodyPart] = useState('Right Knee');
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Package State
  const [packageSessions, setPackageSessions] = useState<number>(10);
  const [packageFee, setPackageFee] = useState<number>(6000);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusType>('PAID');

  // Duplicate Detection State
  const [duplicatePatient, setDuplicatePatient] = useState<FullPatient | null>(null);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Success State
  const [registeredPatient, setRegisteredPatient] = useState<FullPatient | null>(null);

  // Quick Comorbidity chips
  const commonComorbidities = [
    'Hypertension',
    'Type 2 Diabetes',
    'Cardiac Pacemaker (NO Electrotherapy)',
    'Osteoporosis',
    'Hypothyroidism',
    'Previous Spinal Surgery',
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

  const toggleComorbidity = (tag: string) => {
    setComorbidities((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Real-time duplicate phone checking
  const handlePhoneChange = (val: string) => {
    const rawDigits = val.replace(/[^0-9]/g, '').slice(0, 10);
    setPhone(rawDigits);
    setIgnoreDuplicateWarning(false);

    if (rawDigits.length === 10) {
      const match = checkDuplicatePatient(rawDigits);
      if (match) {
        setDuplicatePatient(match);
      } else {
        setDuplicatePatient(null);
      }
    } else {
      setDuplicatePatient(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation 1: Required Name
    if (!fullName.trim() || fullName.trim().length < 2) {
      setFormError('Please enter a valid patient full name (minimum 2 characters).');
      return;
    }

    // Validation 2: Indian 10-Digit Mobile Pattern
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    // Validation 3: Age Bounds
    if (age !== '' && (Number(age) < 0 || Number(age) > 120)) {
      setFormError('Patient age must be between 0 and 120 years.');
      return;
    }

    // Validation 4: Chief Complaint
    if (!chiefComplaint.trim() || chiefComplaint.trim().length < 3) {
      setFormError('Please describe the primary clinical condition or chief complaint.');
      return;
    }

    // Validation 5: Package Sessions
    if (!packageSessions || packageSessions < 1 || packageSessions > 100) {
      setFormError('Package sessions must be a positive number between 1 and 100.');
      return;
    }

    // Duplicate Check Interception
    if (duplicatePatient && !ignoreDuplicateWarning) {
      setShowDuplicateModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const created = addPatient({
        fullName: fullName.trim(),
        phone: cleanPhone,
        age: age ? Number(age) : null,
        gender: gender,
        occupation: occupation.trim() || null,
        address: address.trim() || null,
        emergencyContact: emergencyContact.trim() || null,
        chiefComplaint: chiefComplaint.trim(),
        affectedBodyPart: affectedBodyPart.trim(),
        comorbidities: comorbidities,
        suggestedPackageSessions: packageSessions,
        packageFee: packageFee,
        clinicalNotes: clinicalNotes.trim(),
      });

      setRegisteredPatient(created);
    } catch (err: any) {
      setFormError(err.message || 'Failed to register patient in database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyVoicePreset = (preset: {
    fullName: string;
    phone: string;
    age: number;
    gender: GenderType;
    occupation: string;
    chiefComplaint: string;
    affectedBodyPart: string;
    comorbidities: string[];
    suggestedPackageSessions: number;
    packageFee: number;
    clinicalNotes: string;
  }) => {
    setFullName(preset.fullName);
    handlePhoneChange(preset.phone);
    setAge(preset.age);
    setGender(preset.gender);
    setOccupation(preset.occupation);
    setChiefComplaint(preset.chiefComplaint);
    setAffectedBodyPart(preset.affectedBodyPart);
    setComorbidities(preset.comorbidities);
    setPackageSessions(preset.suggestedPackageSessions);
    setPackageFee(preset.packageFee);
    setClinicalNotes(preset.clinicalNotes);
    setActiveTab('MANUAL');
  };

  const resetForm = () => {
    setRegisteredPatient(null);
    setFullName('');
    setPhone('');
    setAge('');
    setGender('MALE');
    setOccupation('');
    setAddress('');
    setEmergencyContact('');
    setChiefComplaint('');
    setAffectedBodyPart('Right Knee');
    setComorbidities([]);
    setClinicalNotes('');
    setPackageSessions(10);
    setPackageFee(6000);
    setDuplicatePatient(null);
    setIgnoreDuplicateWarning(false);
    setFormError(null);
  };

  // If patient was successfully registered, display confirmation screen
  if (registeredPatient) {
    const primaryEpisode = registeredPatient.episodes[0];
    return (
      <div className="max-w-2xl mx-auto py-8 animate-in zoom-in-95 duration-300">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-8 sm:p-10 space-y-6 text-center">
          
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Registration Complete
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Patient Successfully Registered!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Unique medical record generated and initial treatment episode initialized.
            </p>
          </div>

          {/* Unique ID Highlight Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-teal-100 uppercase tracking-widest">
                Unique Patient ID (Hospital / Clinic Code)
              </span>
              <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                Auto-Generated
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black tracking-wider font-mono">
                {registeredPatient.patient_code}
              </span>
              <span className="text-sm font-semibold opacity-90">
                {registeredPatient.full_name}
              </span>
            </div>
          </div>

          {/* Registration Details Summary */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-left grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Contact Phone</span>
              <span className="font-bold text-slate-800 font-mono">+91 {registeredPatient.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Demographics</span>
              <span className="font-bold text-slate-800">
                {registeredPatient.age ? `${registeredPatient.age} yrs` : 'Age N/A'} • {registeredPatient.gender}
              </span>
            </div>
            <div className="col-span-2 border-t border-slate-200/60 pt-2">
              <span className="text-slate-400 block font-medium">Active Treatment Episode</span>
              <span className="font-bold text-slate-800">{primaryEpisode?.title}</span>
              <span className="text-[11px] text-teal-700 block font-semibold mt-0.5">
                {primaryEpisode?.total_package_sessions} Sessions Package (₹{primaryEpisode?.package_fee}) • {primaryEpisode?.remaining_sessions} Remaining
              </span>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              href={`/patients/${registeredPatient.id}`}
              className="w-full sm:flex-1 py-3 px-5 rounded-xl font-bold text-xs text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <span>Open Patient Profile & Start Session</span>
              <ChevronRight className="w-4 h-4" />
            </Link>

            <button
              onClick={resetForm}
              className="w-full sm:w-auto py-3 px-5 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Register Another</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/patients"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              New Patient Intake
            </h1>
            <p className="text-xs text-slate-500">
              Register patient demographics, initial treatment episode, and therapy package
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('MANUAL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'MANUAL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual Form Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('VOICE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'VOICE'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice Presets</span>
          </button>
        </div>
      </div>

      {/* Global Form Error Alert */}
      {formError && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
          <button
            onClick={() => setFormError(null)}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Duplicate Phone Warning Inline Banner */}
      {duplicatePatient && !ignoreDuplicateWarning && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950 block">
                Duplicate Mobile Number Detected ({duplicatePatient.phone})
              </span>
              <p className="text-amber-800 mt-0.5">
                A patient record already exists for <strong>{duplicatePatient.full_name}</strong> (Code: <strong>{duplicatePatient.patient_code}</strong>).
                Existing episode: <em>&ldquo;{duplicatePatient.episodes[0]?.title}&rdquo;</em>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Link
              href={`/patients/${duplicatePatient.id}`}
              className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold text-xs hover:bg-amber-800 flex items-center gap-1 shadow-sm"
            >
              <span>View Profile</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <button
              type="button"
              onClick={() => setIgnoreDuplicateWarning(true)}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 font-semibold text-xs hover:bg-amber-100"
            >
              Different Person
            </button>
          </div>
        </div>
      )}

      {/* Voice Presets Tab */}
      {activeTab === 'VOICE' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              Speech Dictation Intake Presets
            </h2>
            <p className="text-xs text-slate-500">
              Click any of the pre-transcribed patient intakes below to auto-populate the registration chart instantly:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:border-teal-500 hover:bg-teal-50/40 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  Ortho Rehab
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-2">
                  Total Knee Replacement (Right)
                </h3>
                <p className="text-xs text-slate-600 italic mt-1 line-clamp-3">
                  &ldquo;Sunita Sharma, 54 female, 9811234567. 3 weeks post-op right knee replacement. Flexion 85 deg, hypertensive, 10 session package fee 6500.&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleApplyVoicePreset({
                    fullName: 'Sunita Sharma',
                    phone: '9811234567',
                    age: 54,
                    gender: 'FEMALE',
                    occupation: 'Senior School Teacher',
                    chiefComplaint: 'Post-operative right knee joint stiffness and extension lag',
                    affectedBodyPart: 'Right Knee',
                    comorbidities: ['Hypertension', 'Mild Osteoporosis'],
                    suggestedPackageSessions: 10,
                    packageFee: 6500,
                    clinicalNotes: 'Underwent Total Knee Arthroplasty (TKA) - Right on 15 Oct 2026. Advised gentle patellar mobilization.',
                  })
                }
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Auto-Fill Chart</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:border-teal-500 hover:bg-teal-50/40 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Spine Care
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-2">
                  Cervical Radiculopathy & Spasm
                </h3>
                <p className="text-xs text-slate-600 italic mt-1 line-clamp-3">
                  &ldquo;Rajesh Verma, 42 male, 9822345678. Software engineer, radiating neck pain to right hand. Diabetic, 10 session package with traction and IFT, fee 5500.&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleApplyVoicePreset({
                    fullName: 'Rajesh Verma',
                    phone: '9822345678',
                    age: 42,
                    gender: 'MALE',
                    occupation: 'Software Architect',
                    chiefComplaint: 'Cervical Radiculopathy & Neck Spasm',
                    affectedBodyPart: 'Cervical Spine',
                    comorbidities: ['Type 2 Diabetes'],
                    suggestedPackageSessions: 10,
                    packageFee: 5500,
                    clinicalNotes: 'Severe forward head posture. Radicular numbness in right index finger.',
                  })
                }
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Auto-Fill Chart</span>
              </button>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:border-teal-500 hover:bg-teal-50/40 transition-all space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Sports Injury
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-2">
                  Right Frozen Shoulder (Thawing)
                </h3>
                <p className="text-xs text-slate-600 italic mt-1 line-clamp-3">
                  &ldquo;Ananya Deshmukh, 31 female, 9833456789. Badminton player, severe overhead abduction pain and night stiffness, 10 sessions package with mobilization, fee 7000.&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleApplyVoicePreset({
                    fullName: 'Ananya Deshmukh',
                    phone: '9833456789',
                    age: 31,
                    gender: 'FEMALE',
                    occupation: 'Badminton Coach',
                    chiefComplaint: 'Right Frozen Shoulder - Phase 2 Thawing',
                    affectedBodyPart: 'Right Shoulder',
                    comorbidities: [],
                    suggestedPackageSessions: 10,
                    packageFee: 7000,
                    clinicalNotes: 'Adhesive capsulitis right shoulder. Restricted external rotation and abduction.',
                  })
                }
                className="w-full py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-sm flex items-center justify-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Auto-Fill Chart</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Manual Form Entry */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Card 1: Demographics */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">
              1. Patient Demographics & Contact
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Meera Deshmukh"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  10-Digit Mobile Number *
                </label>
                {duplicatePatient && (
                  <span className="text-[10px] text-amber-600 font-bold">
                    ⚠️ Duplicate Detected
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 font-bold text-slate-400 font-mono text-xs">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="9820011223"
                  className={`w-full pl-12 pr-3.5 py-2.5 bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 font-mono font-medium ${
                    duplicatePatient && !ignoreDuplicateWarning
                      ? 'border-amber-400 ring-1 ring-amber-300'
                      : 'border-slate-200 focus:ring-teal-500'
                  }`}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Primary contact for automated WhatsApp appointment reminders.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="e.g. 46"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Gender *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Occupation / Physical Demand
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="e.g. Desk Ergonomics / Badminton Athlete"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Residential Address / Locality
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Flat 301, Palm Grove, Andheri West"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Emergency Contact (Name & Phone)
              </label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="e.g. Rohit (Spouse) - 9820011224"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

          </div>
        </div>

        {/* Card 2: Initial Clinical Episode */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Activity className="w-4 h-4 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                2. Initial Treatment Episode
              </h2>
              <p className="text-[11px] text-slate-500">
                You can add multiple treatment episodes for this patient in the future without overwriting history.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Primary Condition / Chief Complaint *
                </label>
                <input
                  type="text"
                  required
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Frozen shoulder with restricted abduction and night pain"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Affected Body Region *
                </label>
                <select
                  value={affectedBodyPart}
                  onChange={(e) => setAffectedBodyPart(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                >
                  {commonBodyParts.map((part) => (
                    <option key={part} value={part}>
                      {part}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comorbidities */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Medical Comorbidities & Precautions
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {commonComorbidities.map((item) => {
                  const isSelected = comorbidities.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleComorbidity(item)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                        isSelected
                          ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Clinical Baseline & Assessment Notes
              </label>
              <textarea
                rows={3}
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Include ROM limitations, manual muscle testing (MMT) scores, prior imaging findings, or contraindications..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

          </div>
        </div>

        {/* Card 3: Therapy Package & Commercials */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <DollarSign className="w-4 h-4 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                3. Treatment Package & Fees
              </h2>
              <p className="text-[11px] text-slate-500">
                Sessions will be automatically tracked and decremented as attendance is logged.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Total Package Sessions *
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={packageSessions}
                onChange={(e) => setPackageSessions(parseInt(e.target.value) || 10)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-teal-700 text-sm"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Standard packages in India are 7, 10, or 15 sessions.
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Total Package Fee (₹ INR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  value={packageFee}
                  onChange={(e) => setPackageFee(parseFloat(e.target.value) || 0)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as PaymentStatusType)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold text-slate-800"
              >
                <option value="PAID">Paid in Full</option>
                <option value="PARTIAL">Partial Advance Paid</option>
                <option value="PENDING">Payment Pending</option>
              </select>
            </div>

          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/patients"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/25 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                <span>Generating Patient Code & Registering...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Register Patient & Start Episode</span>
              </>
            )}
          </button>
        </div>

      </form>

      {/* Duplicate Patient Warning Modal */}
      {showDuplicateModal && duplicatePatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-100 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Duplicate Patient Detected!
                </h3>
                <p className="text-xs text-slate-500">
                  Mobile number +91 {duplicatePatient.phone} is already registered.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Existing Patient:</span>
                <span className="font-bold text-slate-800">{duplicatePatient.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Patient Code:</span>
                <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {duplicatePatient.patient_code}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Active Condition:</span>
                <span className="font-bold text-slate-700">{duplicatePatient.episodes[0]?.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Sessions Remaining:</span>
                <span className="font-bold text-teal-700">
                  {duplicatePatient.episodes[0]?.remaining_sessions} / {duplicatePatient.episodes[0]?.total_package_sessions}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If this patient is returning with a <strong>new injury or condition</strong>, you should add a <strong>New Treatment Episode</strong> directly to their profile instead of creating a duplicate patient.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={`/patients/${duplicatePatient.id}`}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
              >
                <span>Open Profile & Add New Episode</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIgnoreDuplicateWarning(true);
                  setShowDuplicateModal(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Proceed with Registration (Different Family Member)
              </button>

              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
