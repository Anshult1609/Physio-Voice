import { GenderType } from './database';

export interface ExtractedPatientData {
  fullName: string;
  phone: string;
  age: number | null;
  gender: GenderType;
  occupation: string | null;
  address?: string | null;
  chiefComplaint: string;
  affectedBodyPart: string;
  comorbidities: string[];
  suggestedPackageSessions: number;
  packageFee?: number;
  clinicalNotes: string;
}

export interface ExtractedSessionData {
  painScore: number | null; // 0-10
  attendanceStatus: 'ATTENDED' | 'MISSED' | 'CANCELLED';
  modalitiesUsed: string[];
  subjectiveFeedback: string;
  objectiveProgress: string;
  exercisesGiven: string;
  therapistNotes: string;
}

export interface AppointmentSlot {
  patientId: string;
  episodeId?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number; // 30, 45, 60
  notes?: string;
}

export interface WhatsAppReminderPayload {
  patientName: string;
  patientPhone: string;
  clinicName: string;
  therapistName: string;
  appointmentTime: string; // e.g. "Tomorrow at 4:30 PM"
  instructions?: string;
}
