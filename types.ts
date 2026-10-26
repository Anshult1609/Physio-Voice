// Types definition for Physio Voice

export interface Physiotherapist {
  id: string;
  email: string;
  fullName: string;
  clinicName: string;
  phone?: string;
  createdAt: string;
}

export interface Patient {
  id: string;
  uid: string; // e.g. PV-2026-0001
  physiotherapistId: string;
  fullName: string;
  age: number;
  phone: string;
  gender: 'Male' | 'Female' | 'Other' | 'Unspecified';
  emergencyContact?: string;
  reminderConsent: boolean;
  createdAt: string;
  updatedAt: string;
  treatmentPlans?: TreatmentPlan[];
}

export type TreatmentStatus = 'ACTIVE' | 'COMPLETED' | 'DISCONTINUED' | 'ON_HOLD';

export interface TreatmentPlan {
  id: string;
  patientId: string;
  chiefComplaint: string;
  diagnosisDetails?: string;
  plannedSessions: number;
  completedSessions: number;
  status: TreatmentStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
  appointments?: Appointment[];
  sessionRecords?: SessionRecord[];
}

export type AppointmentStatus = 'SCHEDULED' | 'ATTENDED' | 'RESCHEDULED' | 'CANCELLED' | 'NO_SHOW';
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DISMISSED';

export interface Appointment {
  id: string;
  patientId: string;
  treatmentPlanId?: string;
  scheduledAt: string; // ISO datetime
  durationMinutes: number;
  status: AppointmentStatus;
  reminderStatus: ReminderStatus;
  notes?: string;
  patient?: Patient;
}

export interface SessionRecord {
  id: string;
  appointmentId?: string;
  treatmentPlanId: string;
  sessionNumber: number;
  painScoreBefore?: number; // 0 - 10
  painScoreAfter?: number;  // 0 - 10
  modalitiesUsed: string[];
  exercisesPrescribed?: string;
  therapistNotes?: string;
  attendedAt: string;
}

export interface ReminderLog {
  id: string;
  appointmentId: string;
  patientId: string;
  reminderForDate: string;
  channel: 'WHATSAPP' | 'IN_APP' | 'SMS';
  status: ReminderStatus;
  whatsappUrl?: string;
  messageContent: string;
  sentAt?: string;
  errorMessage?: string;
  patientName?: string;
  patientPhone?: string;
  scheduledAt?: string;
}

export interface Feedback {
  id: string;
  patientId: string;
  treatmentPlanId?: string;
  rating: number; // 1 to 5
  comment?: string;
  painReliefPercentage?: number; // 0 to 100
  wouldRecommend: boolean;
  submittedAt: string;
  patientName?: string;
}

export interface ParsedVoiceIntake {
  fullName: string;
  age: number | null;
  phone: string;
  chiefComplaint: string;
  plannedSessions: number;
  appointmentDate?: string;
  appointmentTime?: string;
  rawTranscript: string;
  confidenceScore: number;
}
