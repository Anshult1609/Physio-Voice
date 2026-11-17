import { createClient } from '@/lib/supabase/server';
import { Attendance, ClinicalNote } from '@/types/database';

export interface RecordSessionInput {
  patientId: string;
  episodeId: string;
  sessionNumber: number;
  attendanceStatus?: 'ATTENDED' | 'MISSED' | 'CANCELLED';
  attendedAt?: string;
  painScore?: number;
  subjectiveNotes?: string;
  objectiveFindings?: string;
  modalitiesUsed?: string[];
  exercisePrescription?: string;
  therapistRemarks?: string;
}

/**
 * Record a clinical treatment session:
 * 1. Inserts attendance record (which fires PostgreSQL trigger to update remaining sessions).
 * 2. Inserts clinical note (VAS pain score, modalities, exercise prescription).
 * 3. Records audit log for compliance.
 */
export async function recordSessionAttendance(params: RecordSessionInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required: Clinician must be signed in.');
  }

  // 1. Insert Attendance record
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .insert({
      therapist_id: user.id,
      patient_id: params.patientId,
      episode_id: params.episodeId,
      session_number: params.sessionNumber,
      attendance_status: params.attendanceStatus || 'ATTENDED',
      attended_at: params.attendedAt || new Date().toISOString(),
    })
    .select()
    .single();

  if (attendanceError) {
    throw new Error(attendanceError.message);
  }

  // 2. Insert Clinical Note tied to this attendance
  const { data: note, error: noteError } = await supabase
    .from('clinical_notes')
    .insert({
      therapist_id: user.id,
      patient_id: params.patientId,
      episode_id: params.episodeId,
      attendance_id: attendance.id,
      pain_score: params.painScore ?? 5,
      subjective_notes: params.subjectiveNotes || '',
      objective_findings: params.objectiveFindings || '',
      modalities_used: params.modalitiesUsed || [],
      exercise_prescription: params.exercisePrescription || '',
      therapist_remarks: params.therapistRemarks || '',
    })
    .select()
    .single();

  if (noteError) {
    throw new Error(noteError.message);
  }

  // 3. Log Audit Trail
  await supabase.from('audit_logs').insert({
    therapist_id: user.id,
    patient_id: params.patientId,
    action: 'SESSION_ATTENDANCE_RECORDED',
    entity_type: 'ATTENDANCE',
    entity_id: attendance.id,
    details: {
      session_number: params.sessionNumber,
      attendance_status: attendance.attendance_status,
      pain_score: note.pain_score,
    },
  });

  return { attendance, note };
}
