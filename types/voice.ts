import { GenderType, AttendanceType, AppointmentStatusType, Patient, TreatmentEpisode } from './database';
import { ExtractedPatientData } from './clinical';

export type VoiceIntentType = 
  | 'PATIENT_REGISTRATION'
  | 'PATIENT_SEARCH'
  | 'HISTORY_RETRIEVAL'
  | 'ATTENDANCE_UPDATE'
  | 'APPOINTMENT_SCHEDULING'
  | 'UNKNOWN';

export interface ExtractedRegistrationPayload extends ExtractedPatientData {
  address?: string | null;
  emergencyContact?: string | null;
}

export interface ExtractedAttendancePayload {
  patientIdentifier: string; // Name, phone, or code mentioned in audio
  status: 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
  date: string; // ISO Date YYYY-MM-DD
  painScore: number | null; // VAS 0-10
  modalities: string[];
  subjectiveNotes?: string;
  objectiveFindings?: string;
  exercisePrescription?: string;
}

export interface ExtractedSchedulingPayload {
  patientIdentifier: string;
  date: string; // ISO Date YYYY-MM-DD
  startTime: string; // HH:mm (24-hour)
  durationMinutes: number;
  notes?: string;
}

export interface ExtractedSearchPayload {
  query: string;
  searchType: 'NAME' | 'PHONE' | 'CODE' | 'GENERAL';
}

export interface ExtractedHistoryPayload {
  patientIdentifier: string;
  focus: 'FULL' | 'REMAINING_SESSIONS' | 'LATEST_VISIT' | 'CLINICAL_GOALS' | 'CLINICAL_NOTES';
}

export interface PatientMatchResult {
  status: 'EXACT_MATCH' | 'AMBIGUOUS' | 'NO_MATCH';
  matchedPatient?: {
    id: string;
    patient_code: string;
    full_name: string;
    phone: string;
    activeEpisode?: {
      id: string;
      title: string;
      remaining_sessions: number;
      total_package_sessions: number;
      attended_sessions: number;
    } | null;
  };
  candidates: Array<{
    id: string;
    patient_code: string;
    full_name: string;
    phone: string;
    activeEpisode?: {
      id: string;
      title: string;
      remaining_sessions: number;
      total_package_sessions: number;
      attended_sessions: number;
    } | null;
  }>;
  ambiguityReason?: string;
}

export interface VoiceValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: string[];
}

export interface VoiceProcessingResult {
  success: boolean;
  transcript: string;
  intent: VoiceIntentType;
  registrationPayload?: ExtractedRegistrationPayload;
  attendancePayload?: ExtractedAttendancePayload;
  schedulingPayload?: ExtractedSchedulingPayload;
  searchPayload?: ExtractedSearchPayload;
  historyPayload?: ExtractedHistoryPayload;
  patientMatch?: PatientMatchResult;
  validation: VoiceValidationResult;
  safety: {
    noHallucinatedData: boolean;
    noMedicalDiagnosis: boolean;
    disclaimer: string;
  };
}
