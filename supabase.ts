import { createClient } from '@supabase/supabase-js';
import { Patient, TreatmentPlan, Appointment, Feedback, ReminderLog } from './types';
import { generateWhatsAppReminder } from './whatsapp';

function getCleanSupabaseUrl(): string {
  let url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!url) return 'https://udqfzqdnrrktpjqvabwd.supabase.co';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}.supabase.co`;
  }
  return url;
}

const supabaseUrl = getCleanSupabaseUrl();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Register a new patient and initial treatment plan
 */
export async function registerPatientWithPlan(data: {
  fullName: string;
  age: number;
  phone: string;
  gender?: 'Male' | 'Female' | 'Other' | 'Unspecified';
  chiefComplaint: string;
  plannedSessions: number;
  firstAppointmentAt?: string;
  physiotherapistId?: string;
  reminderConsent?: boolean;
}) {
  // 1. Insert Patient (UID will auto-generate via trigger in Postgres)
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert([
      {
        full_name: data.fullName,
        age: data.age,
        phone: data.phone,
        gender: data.gender || 'Unspecified',
        physiotherapist_id: data.physiotherapistId,
        reminder_consent: data.reminderConsent ?? true,
      },
    ])
    .select()
    .single();

  if (patientError) throw patientError;

  // 2. Create Initial Treatment Plan
  const { data: plan, error: planError } = await supabase
    .from('treatment_plans')
    .insert([
      {
        patient_id: patient.id,
        chief_complaint: data.chiefComplaint,
        planned_sessions: data.plannedSessions,
        completed_sessions: 0,
        status: 'ACTIVE',
      },
    ])
    .select()
    .single();

  if (planError) throw planError;

  // 3. Optional initial appointment scheduling
  let appointment = null;
  if (data.firstAppointmentAt) {
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .insert([
        {
          patient_id: patient.id,
          treatment_plan_id: plan.id,
          scheduled_at: data.firstAppointmentAt,
          status: 'SCHEDULED',
          reminder_status: 'PENDING',
        },
      ])
      .select()
      .single();

    if (!apptError) {
      appointment = appt;
    }
  }

  return { patient, plan, appointment };
}

/**
 * Lookup patient by Unique Identification Number (UID)
 * Returns demographics, current plan, remaining sessions, and complete history
 */
export async function getPatientByUID(uid: string) {
  const cleanUID = uid.trim().toUpperCase();

  const { data: patient, error } = await supabase
    .from('patients')
    .select(`
      *,
      treatment_plans (
        *,
        appointments (*),
        session_records (*)
      ),
      feedback (*)
    `)
    .ilike('uid', `%${cleanUID}%`)
    .single();

  if (error) return null;
  return patient;
}

/**
 * Record session attendance and update remaining sessions
 */
export async function recordSessionAttendance(params: {
  treatmentPlanId: string;
  appointmentId?: string;
  sessionNumber: number;
  painBefore?: number;
  painAfter?: number;
  notes?: string;
}) {
  // 1. Insert session record
  const { data: session, error: sessionError } = await supabase
    .from('session_records')
    .insert([
      {
        treatment_plan_id: params.treatmentPlanId,
        appointment_id: params.appointmentId,
        session_number: params.sessionNumber,
        pain_score_before: params.painBefore,
        pain_score_after: params.painAfter,
        therapist_notes: params.notes,
      },
    ])
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 2. Mark appointment as attended
  if (params.appointmentId) {
    await supabase
      .from('appointments')
      .update({ status: 'ATTENDED' })
      .eq('id', params.appointmentId);
  }

  // 3. Increment completed sessions count on treatment plan
  const { data: plan } = await supabase
    .from('treatment_plans')
    .select('completed_sessions, planned_sessions')
    .eq('id', params.treatmentPlanId)
    .single();

  if (plan) {
    const newCompleted = (plan.completed_sessions || 0) + 1;
    const isFinished = newCompleted >= plan.planned_sessions;

    await supabase
      .from('treatment_plans')
      .update({
        completed_sessions: newCompleted,
        status: isFinished ? 'COMPLETED' : 'ACTIVE',
      })
      .eq('id', params.treatmentPlanId);
  }

  return session;
}

/**
 * Query upcoming appointments within 24-48 hours for 1-day reminder dispatch
 */
export async function getUpcomingAppointmentsForReminders() {
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      *,
      patient:patients (*),
      treatment_plan:treatment_plans (*)
    `)
    .eq('status', 'SCHEDULED')
    .eq('reminder_status', 'PENDING')
    .gte('scheduled_at', tomorrowStart.toISOString())
    .lte('scheduled_at', tomorrowEnd.toISOString());

  if (error) throw error;
  return appointments;
}

/**
 * Submit clinic & treatment feedback (1 to 5 stars)
 */
export async function submitPatientFeedback(data: {
  patientId: string;
  treatmentPlanId?: string;
  rating: number; // 1 - 5
  comment?: string;
  painReliefPercentage?: number;
  wouldRecommend?: boolean;
}) {
  const { data: feedback, error } = await supabase
    .from('feedback')
    .insert([
      {
        patient_id: data.patientId,
        treatment_plan_id: data.treatmentPlanId,
        rating: Math.max(1, Math.min(5, data.rating)),
        comment: data.comment,
        pain_relief_percentage: data.painReliefPercentage,
        would_recommend: data.wouldRecommend ?? true,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return feedback;
}
