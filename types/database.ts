// Database entity types mirroring Supabase PostgreSQL schema

export type GenderType = 'MALE' | 'FEMALE' | 'OTHER';
export type EpisodeStatusType = 'ACTIVE' | 'COMPLETED' | 'PAUSED';
export type AttendanceType = 'ATTENDED' | 'MISSED' | 'CANCELLED';
export type AppointmentStatusType = 'SCHEDULED' | 'ATTENDED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatusType = 'PENDING' | 'PARTIAL' | 'PAID';

export interface Therapist {
  id: string;
  email: string;
  full_name: string;
  clinic_name: string;
  phone: string | null;
  clinic_address: string | null;
  registration_number: string | null;
  default_package_size: number;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  therapist_id: string;
  patient_code: string;
  full_name: string;
  phone: string;
  age: number | null;
  gender: GenderType;
  occupation: string | null;
  address: string | null;
  emergency_contact: string | null;
  medical_history_notes: string | null;
  comorbidities: string[];
  created_at: string;
  updated_at: string;
}

export interface TreatmentEpisode {
  id: string;
  patient_id: string;
  therapist_id: string;
  title: string;
  chief_complaint: string;
  affected_body_part: string;
  start_date: string;
  target_end_date: string | null;
  status: EpisodeStatusType;
  total_package_sessions: number;
  attended_sessions: number;
  remaining_sessions: number;
  package_fee: number;
  amount_paid: number;
  payment_status: PaymentStatusType;
  clinical_goals: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreatmentSession {
  id: string;
  episode_id: string;
  patient_id: string;
  therapist_id: string;
  session_number: number;
  session_date: string;
  attendance_status: AttendanceType;
  pain_score: number | null; // VAS 0-10
  subjective_notes: string | null;
  objective_findings: string | null;
  modalities_used: string[]; // e.g., ["IFT", "Ultrasound", "Dry Needling"]
  exercise_prescription: string | null;
  therapist_remarks: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  therapist_id: string;
  patient_id: string;
  episode_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatusType;
  reminder_status: 'NOT_SENT' | 'SENT' | 'FAILED';
  reminder_sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  patient?: Patient;
  episode?: TreatmentEpisode;
}

export interface Attendance {
  id: string;
  therapist_id: string;
  patient_id: string;
  episode_id: string;
  appointment_id?: string | null;
  session_number: number;
  attendance_status: AttendanceType;
  attended_at: string;
  created_at: string;
}

export interface ClinicalNote {
  id: string;
  therapist_id: string;
  patient_id: string;
  episode_id: string;
  attendance_id?: string | null;
  pain_score: number | null; // VAS 0-10
  subjective_notes: string | null;
  objective_findings: string | null;
  modalities_used: string[];
  exercise_prescription: string | null;
  therapist_remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  therapist_id: string;
  patient_id: string;
  appointment_id?: string | null;
  channel: 'IN_APP' | 'WHATSAPP' | 'SMS' | 'EMAIL';
  recipient_phone: string;
  scheduled_for: string;
  message_payload: string;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'PENDING_CONFIRMATION' | 'CANCELLED' | 'FAILED' | 'SKIPPED_NO_CONSENT';
  is_read?: boolean;
  sent_at?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  therapist_id: string | null;
  patient_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  ip_address?: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface VoiceIntakeLog {
  id: string;
  therapist_id: string;
  patient_id: string | null;
  raw_transcript: string;
  extracted_data: Record<string, any>;
  intake_type: 'PATIENT_REGISTRATION' | 'SESSION_NOTE';
  created_at: string;
}
