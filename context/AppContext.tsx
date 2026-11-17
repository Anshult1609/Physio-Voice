'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Patient, 
  TreatmentEpisode, 
  TreatmentSession, 
  Appointment, 
  Therapist,
  AppointmentStatusType,
  AttendanceType,
  PaymentStatusType
} from '@/types/database';
import { ExtractedPatientData } from '@/types/clinical';

export interface FullPatient extends Patient {
  episodes: (TreatmentEpisode & { sessions: TreatmentSession[] })[];
}

export interface FullAppointment extends Appointment {
  patientName: string;
  patientCode: string;
  patientPhone: string;
  episodeTitle: string;
  remainingSessions: number;
}

interface AppContextType {
  isAuthenticated: boolean;
  therapist: Therapist;
  login: (email?: string) => void;
  logout: () => void;
  patients: FullPatient[];
  appointments: FullAppointment[];
  addPatient: (data: ExtractedPatientData & { address?: string | null; emergencyContact?: string | null }) => FullPatient;
  updatePatient: (patientId: string, updatedData: Partial<Patient>) => FullPatient;
  checkDuplicatePatient: (phone: string, excludeId?: string) => FullPatient | undefined;
  addEpisode: (patientId: string, episodeData: { 
    title: string; 
    chiefComplaint: string; 
    affectedBodyPart: string; 
    totalSessions: number; 
    packageFee?: number;
    amountPaid?: number;
    paymentStatus?: PaymentStatusType;
    clinicalGoals?: string;
    archivePreviousActive?: boolean;
  }) => TreatmentEpisode;
  updateEpisode: (patientId: string, episodeId: string, updatedData: Partial<TreatmentEpisode>) => void;
  addSession: (patientId: string, episodeId: string, sessionData: {
    attendanceStatus: AttendanceType;
    painScore: number | null;
    modalitiesUsed: string[];
    subjectiveNotes?: string;
    objectiveFindings?: string;
    exercisePrescription?: string;
    therapistRemarks?: string;
  }) => TreatmentSession;
  addAppointment: (data: {
    patientId: string;
    episodeId?: string;
    scheduledStart: string;
    scheduledEnd: string;
    notes?: string;
  }) => FullAppointment;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatusType) => void;
  rescheduleAppointment: (appointmentId: string, newStart: string, newEnd: string, reason?: string) => void;
  editAppointment: (appointmentId: string, updates: { scheduledStart?: string; scheduledEnd?: string; notes?: string }) => void;
  cancelAppointment: (appointmentId: string, reason?: string) => void;
  updateReminderStatus: (appointmentId: string, status: 'SENT' | 'NOT_SENT') => void;
  isVoiceModalOpen: boolean;
  setIsVoiceModalOpen: (open: boolean) => void;
}

const DEFAULT_THERAPIST: Therapist = {
  id: 'th-1',
  email: 'drsharma@physiovoice.in',
  full_name: 'Dr. Neha Sharma, MPT (Ortho)',
  clinic_name: "Sharma Multispeciality Physio Clinic",
  phone: '9876543210',
  clinic_address: 'SCO 42, Sector 14, Gurugram, Haryana - 122001',
  registration_number: 'DCPT/2018/4892',
  default_package_size: 10,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const INITIAL_PATIENTS: FullPatient[] = [
  {
    id: 'p-1',
    therapist_id: 'th-1',
    patient_code: 'PV-26-1001',
    full_name: 'Sunita Sharma',
    phone: '9811234567',
    age: 54,
    gender: 'FEMALE',
    occupation: 'Senior School Teacher',
    address: 'Flat 402, DLF Phase 4, Gurugram',
    emergency_contact: 'Amit Sharma (Son) - 9811234568',
    medical_history_notes: 'Underwent Total Knee Arthroplasty (TKA) - Right on 15 Oct 2026. Advised quadriceps strengthening and gentle patellar mobilization. No implants in chest.',
    comorbidities: ['Hypertension', 'Mild Osteoporosis'],
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-17T10:00:00Z',
    episodes: [
      {
        id: 'ep-1',
        patient_id: 'p-1',
        therapist_id: 'th-1',
        title: 'Post-Op Right Knee Rehabilitation',
        chief_complaint: 'Post-operative right knee joint stiffness, extension lag 5 deg, flexion limited to 85 deg.',
        affected_body_part: 'Right Knee',
        start_date: '2026-11-01',
        target_end_date: '2026-11-25',
        status: 'ACTIVE',
        total_package_sessions: 10,
        attended_sessions: 8,
        remaining_sessions: 2,
        package_fee: 6500,
        amount_paid: 6500,
        payment_status: 'PAID',
        clinical_goals: 'Achieve 120 degree knee flexion, eliminate extensor lag, restore unassisted stair climbing.',
        created_at: '2026-11-01T10:00:00Z',
        updated_at: '2026-11-17T10:00:00Z',
        sessions: [
          {
            id: 's-8',
            episode_id: 'ep-1',
            patient_id: 'p-1',
            therapist_id: 'th-1',
            session_number: 8,
            session_date: '2026-11-16T10:30:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 2,
            modalities_used: ['Ultrasound 1MHz', 'Theraband Quad Extension', 'Cryotherapy'],
            subjective_notes: 'Patient feels significantly better, able to climb 1 flight of stairs with handrail without sharp pain.',
            objective_findings: 'Active knee flexion reached 115 degrees. Extension lag completely resolved.',
            exercise_prescription: 'Isometric quads, straight leg raise with 1kg weight, heel slides 15 reps x 3 sets.',
            therapist_remarks: 'Superb adherence to home exercise routine.',
            created_at: '2026-11-16T10:30:00Z',
          },
          {
            id: 's-7',
            episode_id: 'ep-1',
            patient_id: 'p-1',
            therapist_id: 'th-1',
            session_number: 7,
            session_date: '2026-11-14T11:00:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 3,
            modalities_used: ['IFT 4-pole Vector', 'Patellar Mobilization', 'Static Hamstring Stretches'],
            subjective_notes: 'Mild dull soreness after walking 1.5 km in society park.',
            objective_findings: 'Flexion 110 degrees, slight tenderness over medial joint line.',
            exercise_prescription: 'Prone hangs for extension, ankle pumps, stationary cycling 10 mins.',
            therapist_remarks: 'Advised not to exceed 1 km walking per day this week.',
            created_at: '2026-11-14T11:00:00Z',
          },
          {
            id: 's-6',
            episode_id: 'ep-1',
            patient_id: 'p-1',
            therapist_id: 'th-1',
            session_number: 6,
            session_date: '2026-11-11T10:00:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 4,
            modalities_used: ['Ultrasound', 'Passive ROM Mobilization'],
            subjective_notes: 'Morning stiffness lasts 15-20 minutes, eases after warm shower.',
            objective_findings: 'Flexion 102 degrees.',
            exercise_prescription: 'Terminal knee extension with theraband.',
            therapist_remarks: 'Tolerating progressive resistance well.',
            created_at: '2026-11-11T10:00:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'p-2',
    therapist_id: 'th-1',
    patient_code: 'PV-26-1002',
    full_name: 'Rajesh Verma',
    phone: '9822345678',
    age: 42,
    gender: 'MALE',
    occupation: 'Lead Software Architect',
    address: 'B-12, Nirvana Country, Sector 50, Gurugram',
    emergency_contact: 'Pooja Verma (Wife) - 9822345679',
    medical_history_notes: 'Desk worker with 10-12 hours laptop screen time daily. Severe forward head posture, cervical radiculopathy radiating to right forearm and index finger.',
    comorbidities: ['Type 2 Diabetes'],
    created_at: '2026-11-05T11:00:00Z',
    updated_at: '2026-11-16T12:00:00Z',
    episodes: [
      {
        id: 'ep-2',
        patient_id: 'p-2',
        therapist_id: 'th-1',
        title: 'Cervical Radiculopathy & Neck Spasm',
        chief_complaint: 'Neck stiffness and radiating numbness to right hand, aggravated by looking down at mobile screen.',
        affected_body_part: 'Cervical Spine',
        start_date: '2026-11-05',
        target_end_date: '2026-11-30',
        status: 'ACTIVE',
        total_package_sessions: 10,
        attended_sessions: 4,
        remaining_sessions: 6,
        package_fee: 5500,
        amount_paid: 5500,
        payment_status: 'PAID',
        clinical_goals: 'Centralize radiating numbness, reduce trapezius trigger points, correct ergonomic setup.',
        created_at: '2026-11-05T11:00:00Z',
        updated_at: '2026-11-16T12:00:00Z',
        sessions: [
          {
            id: 's-2-4',
            episode_id: 'ep-2',
            patient_id: 'p-2',
            therapist_id: 'th-1',
            session_number: 4,
            session_date: '2026-11-15T11:30:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 3,
            modalities_used: ['Cervical Traction', 'IFT', 'Dry Needling', 'Postural Retraining'],
            subjective_notes: 'Numbness in index finger is 70% reduced. Upper trap tightness persists in evening.',
            objective_findings: 'Spurling test negative today. Cervical rotation right 65 deg (was 45 deg).',
            exercise_prescription: 'Chin tucks 10 reps hourly, levator scapulae stretch, doorway pectoral stretch.',
            therapist_remarks: 'Advised laptop stand and external keyboard.',
            created_at: '2026-11-15T11:30:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'p-3',
    therapist_id: 'th-1',
    patient_code: 'PV-26-1003',
    full_name: 'Ananya Deshmukh',
    phone: '9833456789',
    age: 31,
    gender: 'FEMALE',
    occupation: 'Badminton Athlete / Coach',
    address: 'House 18, Block C, Sushant Lok 1, Gurugram',
    emergency_contact: 'Karan Deshmukh (Husband) - 9833456790',
    medical_history_notes: 'Right shoulder adhesive capsulitis (frozen shoulder) following a minor rotator cuff strain during tournament 3 months ago.',
    comorbidities: [],
    created_at: '2026-11-02T14:00:00Z',
    updated_at: '2026-11-16T15:00:00Z',
    episodes: [
      {
        id: 'ep-3',
        patient_id: 'p-3',
        therapist_id: 'th-1',
        title: 'Right Frozen Shoulder - Phase 2 Thawing',
        chief_complaint: 'Severe restriction in external rotation and overhead abduction, night pain when sleeping on right side.',
        affected_body_part: 'Right Shoulder',
        start_date: '2026-11-02',
        target_end_date: '2026-11-20',
        status: 'ACTIVE',
        total_package_sessions: 10,
        attended_sessions: 9,
        remaining_sessions: 1,
        package_fee: 7000,
        amount_paid: 5000,
        payment_status: 'PARTIAL',
        clinical_goals: 'Restore overhead reach to 160 deg abduction, external rotation to 60 deg, resume racket swings.',
        created_at: '2026-11-02T14:00:00Z',
        updated_at: '2026-11-16T15:00:00Z',
        sessions: [
          {
            id: 's-3-9',
            episode_id: 'ep-3',
            patient_id: 'p-3',
            therapist_id: 'th-1',
            session_number: 9,
            session_date: '2026-11-16T14:00:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 2,
            modalities_used: ['Maitland Glenohumeral Mobilization', 'Ultrasound', 'Theraband Rotator Cuff'],
            subjective_notes: 'Night pain completely gone! Able to tie hair behind head comfortably.',
            objective_findings: 'Abduction 150 deg, external rotation 50 deg. Excellent capsular stretch response.',
            exercise_prescription: 'Pulleys overhead, sleeper stretch, light theraband rows.',
            therapist_remarks: 'Only 1 session left in package. Needs 5 more sessions for sports re-conditioning.',
            created_at: '2026-11-16T14:00:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'p-4',
    therapist_id: 'th-1',
    patient_code: 'PV-26-1004',
    full_name: 'Vikram Malhotra',
    phone: '9844567890',
    age: 62,
    gender: 'MALE',
    occupation: 'Retired Banker',
    address: 'Villa 108, Palm Drive, Golf Course Ext Road, Gurugram',
    emergency_contact: 'Rohit Malhotra - 9844567891',
    medical_history_notes: 'Cardiac stent placed in 2021 (AVOID ELECTROTHERAPY/SWD/IFT around trunk). MRI confirmed L4-L5 disc protrusion with right S1 nerve root irritation.',
    comorbidities: ['Hypertension', 'Cardiac Stent (No SWD/IFT on Trunk)', 'Dyslipidemia'],
    created_at: '2026-11-10T16:00:00Z',
    updated_at: '2026-11-16T17:00:00Z',
    episodes: [
      {
        id: 'ep-4',
        patient_id: 'p-4',
        therapist_id: 'th-1',
        title: 'Lumbar Disc Herniation (L4-L5)',
        chief_complaint: 'Lower back pain with radiating sciatica pain to right calf and heel when sitting for more than 20 mins.',
        affected_body_part: 'Lumbar Spine',
        start_date: '2026-11-10',
        target_end_date: '2026-12-05',
        status: 'ACTIVE',
        total_package_sessions: 10,
        attended_sessions: 3,
        remaining_sessions: 7,
        package_fee: 6500,
        amount_paid: 6500,
        payment_status: 'PAID',
        clinical_goals: 'Relieve radicular calf pain, strengthen core musculature via McKenzie extension exercises.',
        created_at: '2026-11-10T16:00:00Z',
        updated_at: '2026-11-16T17:00:00Z',
        sessions: [
          {
            id: 's-4-3',
            episode_id: 'ep-4',
            patient_id: 'p-4',
            therapist_id: 'th-1',
            session_number: 3,
            session_date: '2026-11-14T16:30:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 5,
            modalities_used: ['McKenzie Extension', 'Moist Heat Pack', 'Pelvic Bridging', 'Neurodynamic Flossing'],
            subjective_notes: 'Calf pain has receded upwards to buttock (centralization effect).',
            objective_findings: 'SLR right side improved from 40 deg to 60 deg before reproduction of pain.',
            exercise_prescription: 'Prone press-ups 10 reps every 2 hours, avoid sitting slumped, brisk walking 15 mins.',
            therapist_remarks: 'Strictly adhered to mechanical traction and manual therapy due to cardiac pacemaker/stent precautions.',
            created_at: '2026-11-14T16:30:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 'p-5',
    therapist_id: 'th-1',
    patient_code: 'PV-26-1005',
    full_name: 'Pooja Iyer',
    phone: '9855678901',
    age: 28,
    gender: 'FEMALE',
    occupation: 'Corporate Lawyer',
    address: 'Tower 3, Central Park 2, Sector 48, Gurugram',
    emergency_contact: 'Raghav Iyer - 9855678902',
    medical_history_notes: 'Sudden onset Left Bell&apos;s Palsy diagnosed by Neurologist 4 weeks ago. Prednisolone course completed.',
    comorbidities: ['Asthma'],
    created_at: '2026-11-08T09:00:00Z',
    updated_at: '2026-11-16T18:00:00Z',
    episodes: [
      {
        id: 'ep-5',
        patient_id: 'p-5',
        therapist_id: 'th-1',
        title: "Bell's Palsy (Left Facial Nerve Rehab)",
        chief_complaint: 'Inability to fully close left eye, loss of left forehead wrinkling, slight speech lisp.',
        affected_body_part: 'Face (Left Facial Nerve)',
        start_date: '2026-11-08',
        target_end_date: '2026-12-10',
        status: 'ACTIVE',
        total_package_sessions: 15,
        attended_sessions: 12,
        remaining_sessions: 3,
        package_fee: 9000,
        amount_paid: 9000,
        payment_status: 'PAID',
        clinical_goals: 'Achieve complete eye closure, symmetric smile without synkinesis.',
        created_at: '2026-11-08T09:00:00Z',
        updated_at: '2026-11-16T18:00:00Z',
        sessions: [
          {
            id: 's-5-12',
            episode_id: 'ep-5',
            patient_id: 'p-5',
            therapist_id: 'th-1',
            session_number: 12,
            session_date: '2026-11-16T17:00:00Z',
            attendance_status: 'ATTENDED',
            pain_score: 0,
            modalities_used: ['Galvanic Facial Muscle Stimulation', 'Facial PNF Mirror Biofeedback', 'Gentle Tapping'],
            subjective_notes: 'Able to drink water from a glass without liquid spilling from left corner of mouth!',
            objective_findings: 'House-Brackmann score improved from Grade IV to Grade II. Left eye now closes 95%.',
            exercise_prescription: 'Mirror exercises: gentle blowing, forehead raising with finger assistance, straw phonation.',
            therapist_remarks: 'Remarkable neuromuscular re-education.',
            created_at: '2026-11-16T17:00:00Z',
          },
        ],
      },
    ],
  },
];

const INITIAL_APPOINTMENTS: FullAppointment[] = [
  {
    id: 'apt-1',
    therapist_id: 'th-1',
    patient_id: 'p-1',
    episode_id: 'ep-1',
    patientName: 'Sunita Sharma',
    patientCode: 'PV-26-1001',
    patientPhone: '9811234567',
    episodeTitle: 'Post-Op Right Knee Rehabilitation',
    remainingSessions: 2,
    scheduled_start: '2026-11-17T10:00:00Z',
    scheduled_end: '2026-11-17T10:45:00Z',
    status: 'SCHEDULED',
    reminder_status: 'NOT_SENT',
    reminder_sent_at: null,
    notes: 'Focus on terminal knee extension with theraband resistance.',
    created_at: '2026-11-15T10:00:00Z',
    updated_at: '2026-11-15T10:00:00Z',
  },
  {
    id: 'apt-2',
    therapist_id: 'th-1',
    patient_id: 'p-2',
    episode_id: 'ep-2',
    patientName: 'Rajesh Verma',
    patientCode: 'PV-26-1002',
    patientPhone: '9822345678',
    episodeTitle: 'Cervical Radiculopathy & Neck Spasm',
    remainingSessions: 6,
    scheduled_start: '2026-11-17T11:30:00Z',
    scheduled_end: '2026-11-17T12:15:00Z',
    status: 'SCHEDULED',
    reminder_status: 'SENT',
    reminder_sent_at: '2026-11-16T18:00:00Z',
    notes: 'Check ergonomics update and perform cervical traction.',
    created_at: '2026-11-15T11:00:00Z',
    updated_at: '2026-11-15T11:00:00Z',
  },
  {
    id: 'apt-3',
    therapist_id: 'th-1',
    patient_id: 'p-3',
    episode_id: 'ep-3',
    patientName: 'Ananya Deshmukh',
    patientCode: 'PV-26-1003',
    patientPhone: '9833456789',
    episodeTitle: 'Right Frozen Shoulder - Phase 2 Thawing',
    remainingSessions: 1,
    scheduled_start: '2026-11-17T14:00:00Z',
    scheduled_end: '2026-11-17T14:45:00Z',
    status: 'SCHEDULED',
    reminder_status: 'NOT_SENT',
    reminder_sent_at: null,
    notes: 'Final package session! Discuss 5-session sports conditioning extension.',
    created_at: '2026-11-15T14:00:00Z',
    updated_at: '2026-11-15T14:00:00Z',
  },
  {
    id: 'apt-4',
    therapist_id: 'th-1',
    patient_id: 'p-4',
    episode_id: 'ep-4',
    patientName: 'Vikram Malhotra',
    patientCode: 'PV-26-1004',
    patientPhone: '9844567890',
    episodeTitle: 'Lumbar Disc Herniation (L4-L5)',
    remainingSessions: 7,
    scheduled_start: '2026-11-17T16:30:00Z',
    scheduled_end: '2026-11-17T17:15:00Z',
    status: 'SCHEDULED',
    reminder_status: 'NOT_SENT',
    reminder_sent_at: null,
    notes: 'REMINDER: NO electrotherapy/IFT due to cardiac stent. Focus on McKenzie extensions.',
    created_at: '2026-11-15T16:00:00Z',
    updated_at: '2026-11-15T16:00:00Z',
  },
  {
    id: 'apt-5',
    therapist_id: 'th-1',
    patient_id: 'p-5',
    episode_id: 'ep-5',
    patientName: 'Pooja Iyer',
    patientCode: 'PV-26-1005',
    patientPhone: '9855678901',
    episodeTitle: "Bell's Palsy (Left Facial Nerve Rehab)",
    remainingSessions: 3,
    scheduled_start: '2026-11-18T10:00:00Z',
    scheduled_end: '2026-11-18T10:45:00Z',
    status: 'SCHEDULED',
    reminder_status: 'NOT_SENT',
    reminder_sent_at: null,
    notes: 'Facial mirror feedback and eye closure measurement.',
    created_at: '2026-11-16T09:00:00Z',
    updated_at: '2026-11-16T09:00:00Z',
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [therapist, setTherapist] = useState<Therapist>(DEFAULT_THERAPIST);
  const [patients, setPatients] = useState<FullPatient[]>(INITIAL_PATIENTS);
  const [appointments, setAppointments] = useState<FullAppointment[]>(INITIAL_APPOINTMENTS);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Load persisted state from localStorage on client mount if available
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('pv_auth');
      if (savedAuth !== null) setIsAuthenticated(savedAuth === 'true');

      const savedPatients = localStorage.getItem('pv_patients');
      if (savedPatients) setPatients(JSON.parse(savedPatients));

      const savedApts = localStorage.getItem('pv_appointments');
      if (savedApts) setAppointments(JSON.parse(savedApts));
    } catch (e) {
      console.warn('LocalStorage not available in SSR or failed to parse');
    }
  }, []);

  // Sync state to localStorage
  const persistPatients = (newPatients: FullPatient[]) => {
    setPatients(newPatients);
    try {
      localStorage.setItem('pv_patients', JSON.stringify(newPatients));
    } catch (e) {}
  };

  const persistAppointments = (newApts: FullAppointment[]) => {
    setAppointments(newApts);
    try {
      localStorage.setItem('pv_appointments', JSON.stringify(newApts));
    } catch (e) {}
  };

  const login = (email?: string) => {
    setIsAuthenticated(true);
    try {
      localStorage.setItem('pv_auth', 'true');
    } catch (e) {}
  };

  const logout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.setItem('pv_auth', 'false');
    } catch (e) {}
  };

  const addPatient = (data: ExtractedPatientData & { address?: string | null; emergencyContact?: string | null }): FullPatient => {
    const nextSeq = 1000 + patients.length + 1;
    const patientCode = `PV-26-${nextSeq}`;
    const patientId = `p-${Date.now()}`;
    const episodeId = `ep-${Date.now()}`;

    const newEpisode: TreatmentEpisode & { sessions: TreatmentSession[] } = {
      id: episodeId,
      patient_id: patientId,
      therapist_id: therapist.id,
      title: data.chiefComplaint.length > 50 ? `${data.affectedBodyPart} Rehabilitation` : data.chiefComplaint,
      chief_complaint: data.chiefComplaint,
      affected_body_part: data.affectedBodyPart || 'General',
      start_date: new Date().toISOString().split('T')[0],
      target_end_date: null,
      status: 'ACTIVE',
      total_package_sessions: data.suggestedPackageSessions || 10,
      attended_sessions: 0,
      remaining_sessions: data.suggestedPackageSessions || 10,
      package_fee: data.packageFee || 6000,
      amount_paid: 0,
      payment_status: 'PENDING',
      clinical_goals: data.clinicalNotes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sessions: [],
    };

    const newPatient: FullPatient = {
      id: patientId,
      therapist_id: therapist.id,
      patient_code: patientCode,
      full_name: data.fullName,
      phone: data.phone,
      age: data.age,
      gender: data.gender,
      occupation: data.occupation || 'Self-employed',
      address: data.address || 'Local Clinic Walk-in, Gurugram',
      emergency_contact: data.emergencyContact || 'Family Contact',
      medical_history_notes: data.clinicalNotes,
      comorbidities: data.comorbidities || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      episodes: [newEpisode],
    };

    const updated = [newPatient, ...patients];
    persistPatients(updated);

    // Asynchronously sync to backend API if live Supabase is connected
    fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: data.fullName,
        phone: data.phone,
        age: data.age,
        gender: data.gender,
        occupation: data.occupation,
        address: data.address,
        emergencyContact: data.emergencyContact,
        chiefComplaint: data.chiefComplaint,
        affectedBodyPart: data.affectedBodyPart,
        comorbidities: data.comorbidities,
        suggestedPackageSessions: data.suggestedPackageSessions,
        packageFee: data.packageFee,
        clinicalNotes: data.clinicalNotes,
      }),
    }).catch((err) => console.warn('Background sync error creating patient:', err));

    return newPatient;
  };

  const checkDuplicatePatient = (phone: string, excludeId?: string): FullPatient | undefined => {
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) return undefined;
    return patients.find((p) => {
      if (excludeId && p.id === excludeId) return false;
      return p.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone;
    });
  };

  const updatePatient = (patientId: string, updatedData: Partial<Patient>): FullPatient => {
    let updatedPatient!: FullPatient;
    const updated = patients.map((p) => {
      if (p.id === patientId) {
        updatedPatient = {
          ...p,
          ...updatedData,
          updated_at: new Date().toISOString(),
        };
        return updatedPatient;
      }
      return p;
    });
    persistPatients(updated);

    // Asynchronously sync to backend API
    fetch(`/api/patients/${patientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    }).catch((err) => console.warn('Background sync error updating patient:', err));

    return updatedPatient;
  };

  const addEpisode = (
    patientId: string, 
    data: { 
      title: string; 
      chiefComplaint: string; 
      affectedBodyPart: string; 
      totalSessions: number; 
      packageFee?: number;
      amountPaid?: number;
      paymentStatus?: PaymentStatusType;
      clinicalGoals?: string;
      archivePreviousActive?: boolean;
    }
  ): TreatmentEpisode => {
    const episodeId = `ep-${Date.now()}`;
    const newEpisode: TreatmentEpisode & { sessions: TreatmentSession[] } = {
      id: episodeId,
      patient_id: patientId,
      therapist_id: therapist.id,
      title: data.title,
      chief_complaint: data.chiefComplaint,
      affected_body_part: data.affectedBodyPart,
      start_date: new Date().toISOString().split('T')[0],
      target_end_date: null,
      status: 'ACTIVE',
      total_package_sessions: data.totalSessions || 10,
      attended_sessions: 0,
      remaining_sessions: data.totalSessions || 10,
      package_fee: data.packageFee ?? 6000,
      amount_paid: data.amountPaid ?? 0,
      payment_status: data.paymentStatus || 'PENDING',
      clinical_goals: data.clinicalGoals || 'Rehabilitation and functional restoration',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sessions: [],
    };

    const updated = patients.map((p) => {
      if (p.id === patientId) {
        const episodes = data.archivePreviousActive
          ? p.episodes.map((ep) => ep.status === 'ACTIVE' ? { ...ep, status: 'COMPLETED' as const, updated_at: new Date().toISOString() } : ep)
          : p.episodes;

        return {
          ...p,
          episodes: [newEpisode, ...episodes],
        };
      }
      return p;
    });

    persistPatients(updated);

    // Asynchronously sync to backend API
    fetch(`/api/patients/${patientId}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        chiefComplaint: data.chiefComplaint,
        affectedBodyPart: data.affectedBodyPart,
        totalPackageSessions: data.totalSessions,
        packageFee: data.packageFee,
        amountPaid: data.amountPaid,
        paymentStatus: data.paymentStatus,
        clinicalGoals: data.clinicalGoals,
        archivePreviousActive: data.archivePreviousActive,
      }),
    }).catch((err) => console.warn('Background sync error creating episode:', err));

    return newEpisode;
  };

  const updateEpisode = (patientId: string, episodeId: string, updatedData: Partial<TreatmentEpisode>) => {
    const updated = patients.map((p) => {
      if (p.id === patientId) {
        return {
          ...p,
          episodes: p.episodes.map((ep) => {
            if (ep.id === episodeId) {
              return { ...ep, ...updatedData, updated_at: new Date().toISOString() };
            }
            return ep;
          }),
        };
      }
      return p;
    });
    persistPatients(updated);
  };

  const addSession = (
    patientId: string, 
    episodeId: string, 
    sessionData: {
      attendanceStatus: AttendanceType;
      painScore: number | null;
      modalitiesUsed: string[];
      subjectiveNotes?: string;
      objectiveFindings?: string;
      exercisePrescription?: string;
      therapistRemarks?: string;
    }
  ): TreatmentSession => {
    let createdSession!: TreatmentSession;

    const updated = patients.map((p) => {
      if (p.id === patientId) {
        const updatedEpisodes = p.episodes.map((ep) => {
          if (ep.id === episodeId) {
            const nextSessionNumber = ep.sessions.length + 1;
            const newAttended = sessionData.attendanceStatus === 'ATTENDED' 
              ? ep.attended_sessions + 1 
              : ep.attended_sessions;

            createdSession = {
              id: `s-${Date.now()}`,
              episode_id: episodeId,
              patient_id: patientId,
              therapist_id: therapist.id,
              session_number: nextSessionNumber,
              session_date: new Date().toISOString(),
              attendance_status: sessionData.attendanceStatus,
              pain_score: sessionData.painScore,
              modalities_used: sessionData.modalitiesUsed,
              subjective_notes: sessionData.subjectiveNotes || null,
              objective_findings: sessionData.objectiveFindings || null,
              exercise_prescription: sessionData.exercisePrescription || null,
              therapist_remarks: sessionData.therapistRemarks || null,
              created_at: new Date().toISOString(),
            };

            return {
              ...ep,
              attended_sessions: newAttended,
              remaining_sessions: Math.max(0, ep.total_package_sessions - newAttended),
              sessions: [createdSession, ...ep.sessions],
            };
          }
          return ep;
        });

        return { ...p, episodes: updatedEpisodes };
      }
      return p;
    });

    persistPatients(updated);

    // Also update remaining sessions on any related appointment
    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.patient_id === patientId && apt.episode_id === episodeId) {
          const patient = updated.find((p) => p.id === patientId);
          const ep = patient?.episodes.find((e) => e.id === episodeId);
          return {
            ...apt,
            remainingSessions: ep ? ep.remaining_sessions : apt.remainingSessions,
          };
        }
        return apt;
      })
    );

    return createdSession;
  };

  const addAppointment = (data: {
    patientId: string;
    episodeId?: string;
    scheduledStart: string;
    scheduledEnd: string;
    notes?: string;
  }): FullAppointment => {
    const targetPatient = patients.find((p) => p.id === data.patientId);
    const targetEpisode = data.episodeId 
      ? targetPatient?.episodes.find((e) => e.id === data.episodeId)
      : targetPatient?.episodes[0];

    const newApt: FullAppointment = {
      id: `apt-${Date.now()}`,
      therapist_id: therapist.id,
      patient_id: data.patientId,
      episode_id: data.episodeId || targetEpisode?.id || null,
      patientName: targetPatient?.full_name || 'Patient',
      patientCode: targetPatient?.patient_code || 'PV-26-XXXX',
      patientPhone: targetPatient?.phone || '',
      episodeTitle: targetEpisode?.title || 'Physiotherapy Consultation',
      remainingSessions: targetEpisode?.remaining_sessions ?? 10,
      scheduled_start: data.scheduledStart,
      scheduled_end: data.scheduledEnd,
      status: 'SCHEDULED',
      reminder_status: 'NOT_SENT',
      reminder_sent_at: null,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [newApt, ...appointments];
    persistAppointments(updated);
    return newApt;
  };

  const updateAppointmentStatus = (appointmentId: string, status: AppointmentStatusType) => {
    const targetApt = appointments.find((a) => a.id === appointmentId);
    if (!targetApt) return;

    const prevStatus = targetApt.status;
    const isNowAttended = status === 'COMPLETED' || status === 'ATTENDED';
    const wasAttended = prevStatus === 'COMPLETED' || prevStatus === 'ATTENDED';

    // 1. Prevent duplicate attendance counting (Idempotent!)
    if (wasAttended && isNowAttended) {
      return; // Already accounted for, do not decrease again
    }

    let deltaAttended = 0;
    if (!wasAttended && isNowAttended) {
      // Transitioning to ATTENDED: decrease remaining sessions by 1
      deltaAttended = 1;
    } else if (wasAttended && !isNowAttended) {
      // Transitioning away from ATTENDED to NO_SHOW, CANCELLED, or SCHEDULED: restore 1 session
      deltaAttended = -1;
    }

    let newRemainingSessions = targetApt.remainingSessions;

    // 2. Adjust patient episode sessions if attendance delta changed
    if (deltaAttended !== 0 && targetApt.patient_id && targetApt.episode_id) {
      const updatedPatients = patients.map((p) => {
        if (p.id === targetApt.patient_id) {
          return {
            ...p,
            episodes: p.episodes.map((ep) => {
              if (ep.id === targetApt.episode_id) {
                const newAttended = Math.max(0, ep.attended_sessions + deltaAttended);
                const newRemaining = Math.max(0, ep.total_package_sessions - newAttended);
                newRemainingSessions = newRemaining;
                return {
                  ...ep,
                  attended_sessions: newAttended,
                  remaining_sessions: newRemaining,
                  updated_at: new Date().toISOString(),
                };
              }
              return ep;
            }),
          };
        }
        return p;
      });
      persistPatients(updatedPatients);
    }

    // 3. Update appointments state
    const updatedApts = appointments.map((apt) => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          status,
          remainingSessions: newRemainingSessions,
          updated_at: new Date().toISOString(),
        };
      }
      if (apt.episode_id === targetApt.episode_id) {
        return {
          ...apt,
          remainingSessions: newRemainingSessions,
        };
      }
      return apt;
    });
    persistAppointments(updatedApts);

    // 4. Asynchronously sync to backend API
    fetch(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ATTENDANCE_STATUS', status }),
    }).catch((err) => console.warn('Background sync error updating appointment status:', err));
  };

  const rescheduleAppointment = (
    appointmentId: string, 
    newStart: string, 
    newEnd: string, 
    reason?: string
  ) => {
    const updatedApts = appointments.map((apt) => {
      if (apt.id === appointmentId) {
        const noteAdd = reason ? ` [Rescheduled: ${reason}]` : ' [Rescheduled]';
        return {
          ...apt,
          scheduled_start: newStart,
          scheduled_end: newEnd,
          status: 'RESCHEDULED' as const,
          notes: (apt.notes || '') + noteAdd,
          updated_at: new Date().toISOString(),
        };
      }
      return apt;
    });
    persistAppointments(updatedApts);

    // Sync to backend
    fetch(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESCHEDULE',
        newScheduledStart: newStart,
        newScheduledEnd: newEnd,
        reason,
      }),
    }).catch((err) => console.warn('Background sync error rescheduling appointment:', err));
  };

  const editAppointment = (
    appointmentId: string, 
    updates: { scheduledStart?: string; scheduledEnd?: string; notes?: string }
  ) => {
    const updatedApts = appointments.map((apt) => {
      if (apt.id === appointmentId) {
        return {
          ...apt,
          ...(updates.scheduledStart ? { scheduled_start: updates.scheduledStart } : {}),
          ...(updates.scheduledEnd ? { scheduled_end: updates.scheduledEnd } : {}),
          ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
          updated_at: new Date().toISOString(),
        };
      }
      return apt;
    });
    persistAppointments(updatedApts);

    fetch(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch((err) => console.warn('Background sync error editing appointment:', err));
  };

  const cancelAppointment = (appointmentId: string, reason?: string) => {
    updateAppointmentStatus(appointmentId, 'CANCELLED');
    if (reason) {
      editAppointment(appointmentId, {
        notes: `[Cancelled: ${reason}]`,
      });
    }
  };

  const updateReminderStatus = (appointmentId: string, status: 'SENT' | 'NOT_SENT') => {
    const updated = appointments.map((apt) =>
      apt.id === appointmentId
        ? {
            ...apt,
            reminder_status: status,
            reminder_sent_at: status === 'SENT' ? new Date().toISOString() : null,
          }
        : apt
    );
    persistAppointments(updated);
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        therapist,
        login,
        logout,
        patients,
        appointments,
        addPatient,
        updatePatient,
        checkDuplicatePatient,
        addEpisode,
        updateEpisode,
        addSession,
        addAppointment,
        updateAppointmentStatus,
        rescheduleAppointment,
        editAppointment,
        cancelAppointment,
        updateReminderStatus,
        isVoiceModalOpen,
        setIsVoiceModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
