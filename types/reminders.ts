export type ReminderChannel = 'IN_APP' | 'WHATSAPP' | 'SMS' | 'EMAIL';

export type ReminderStatus = 
  | 'PENDING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'PENDING_CONFIRMATION'
  | 'CANCELLED'
  | 'FAILED'
  | 'SKIPPED_NO_CONSENT';

export type ReminderType = 
  | 'APPOINTMENT_SCHEDULED' 
  | 'APPOINTMENT_UPCOMING'
  | 'PACKAGE_EXPIRY_ALERT' 
  | 'FOLLOWUP';

export interface PatientNotificationConsent {
  patient_id: string;
  therapist_id: string;
  consent_in_app: boolean;
  consent_whatsapp: boolean;
  consent_sms: boolean;
  updated_at: string;
}

export interface ReminderDeliveryLog {
  id: string;
  reminder_id: string;
  therapist_id: string;
  patient_id: string;
  appointment_id?: string | null;
  channel: ReminderChannel;
  provider: string;
  status: ReminderStatus;
  delivery_confirmed: boolean;
  provider_message_id?: string | null;
  response_payload?: any;
  error_message?: string | null;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  therapist_id: string;
  patient_id: string;
  patient_name: string;
  patient_code: string;
  appointment_id?: string | null;
  channel: 'IN_APP';
  title: string;
  message_payload: string;
  scheduled_for: string;
  status: ReminderStatus;
  is_read: boolean;
  created_at: string;
}

export interface ScheduleReminderInput {
  therapistId: string;
  patientId: string;
  appointmentId?: string;
  channel: ReminderChannel;
  reminderType?: ReminderType;
  scheduledFor: string; // ISO 8601 UTC
  recipientPhone: string;
  messagePayload: string;
}
