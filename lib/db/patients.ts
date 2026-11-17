import { createClient } from '@/lib/supabase/server';
import { Patient, TreatmentEpisode } from '@/types/database';

export interface PatientWithEpisode extends Patient {
  episodes: TreatmentEpisode[];
}

/**
 * Fetch patients for the authenticated physiotherapist.
 * Row-Level Security automatically ensures only the therapist's own patients are returned.
 */
export async function getPatients(searchQuery?: string): Promise<PatientWithEpisode[]> {
  const supabase = await createClient();

  let query = supabase
    .from('patients')
    .select(`
      *,
      treatment_episodes (
        id,
        title,
        chief_complaint,
        affected_body_part,
        start_date,
        target_end_date,
        status,
        total_package_sessions,
        attended_sessions,
        remaining_sessions,
        package_fee,
        amount_paid,
        payment_status
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.trim();
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,patient_code.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error in getPatients:', error.message);
    throw new Error(error.message);
  }

  return (data as any) || [];
}

/**
 * Fetch a single patient by ID with full treatment episodes, attendance, and clinical notes.
 */
export async function getPatientById(patientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      treatment_episodes (
        *,
        attendance (
          *,
          clinical_notes (*)
        )
      )
    `)
    .eq('id', patientId)
    .single();

  if (error) {
    console.error('Error in getPatientById:', error.message);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new patient and initial treatment episode in Supabase.
 * Enforces RLS with the authenticated user ID.
 */
export async function createPatientRecord(params: {
  fullName: string;
  phone: string;
  age?: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  occupation?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  chiefComplaint: string;
  affectedBodyPart: string;
  comorbidities?: string[];
  totalSessions?: number;
  packageFee?: number;
  clinicalNotes?: string;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required: Clinician must be signed in to create patients.');
  }

  // 1. Insert Patient
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert({
      therapist_id: user.id,
      full_name: params.fullName,
      phone: params.phone,
      age: params.age,
      gender: params.gender,
      occupation: params.occupation,
      address: params.address,
      emergency_contact: params.emergencyContact,
      medical_history_notes: params.clinicalNotes,
      comorbidities: params.comorbidities || [],
    })
    .select()
    .single();

  if (patientError) {
    throw new Error(patientError.message);
  }

  // 2. Insert Initial Treatment Episode
  const { data: episode, error: episodeError } = await supabase
    .from('treatment_episodes')
    .insert({
      patient_id: patient.id,
      therapist_id: user.id,
      title: params.chiefComplaint.length > 50 ? `${params.affectedBodyPart} Rehabilitation` : params.chiefComplaint,
      chief_complaint: params.chiefComplaint,
      affected_body_part: params.affectedBodyPart,
      total_package_sessions: params.totalSessions || 10,
      attended_sessions: 0,
      package_fee: params.packageFee || 6000,
      payment_status: 'PENDING',
      clinical_goals: params.clinicalNotes,
    })
    .select()
    .single();

  if (episodeError) {
    throw new Error(episodeError.message);
  }

  // 3. Log Audit Trail
  await supabase.from('audit_logs').insert({
    therapist_id: user.id,
    patient_id: patient.id,
    action: 'PATIENT_CREATE',
    entity_type: 'PATIENT',
    entity_id: patient.id,
    details: { patient_code: patient.patient_code, full_name: patient.full_name },
  });

  return { patient, episode };
}

/**
 * Check if a patient with the given phone number already exists for this therapist.
 * Facilitates real-time duplicate detection during registration.
 */
export async function checkPatientDuplicateByPhone(phone: string, excludeId?: string) {
  const supabase = await createClient();
  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length < 10) return null;

  let query = supabase
    .from('patients')
    .select('id, patient_code, full_name, phone, created_at')
    .eq('phone', cleanPhone)
    .eq('is_active', true);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error checking duplicate:', error.message);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Add a new independent treatment episode to an existing patient without overwriting history.
 */
export async function createTreatmentEpisode(patientId: string, params: {
  title: string;
  chiefComplaint: string;
  affectedBodyPart: string;
  startDate?: string;
  totalPackageSessions?: number;
  packageFee?: number;
  amountPaid?: number;
  paymentStatus?: 'PENDING' | 'PARTIAL' | 'PAID';
  clinicalGoals?: string;
  archivePreviousActive?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (params.archivePreviousActive) {
    await supabase
      .from('treatment_episodes')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('patient_id', patientId)
      .eq('status', 'ACTIVE');
  }

  const { data: episode, error } = await supabase
    .from('treatment_episodes')
    .insert({
      patient_id: patientId,
      therapist_id: user?.id,
      title: params.title,
      chief_complaint: params.chiefComplaint,
      affected_body_part: params.affectedBodyPart,
      start_date: params.startDate || new Date().toISOString().split('T')[0],
      total_package_sessions: params.totalPackageSessions || 10,
      attended_sessions: 0,
      package_fee: params.packageFee || 6000,
      amount_paid: params.amountPaid || 0,
      payment_status: params.paymentStatus || 'PENDING',
      clinical_goals: params.clinicalGoals || null,
      status: 'ACTIVE',
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (user) {
    await supabase.from('audit_logs').insert({
      therapist_id: user.id,
      patient_id: patientId,
      action: 'EPISODE_CREATED',
      entity_type: 'EPISODE',
      entity_id: episode.id,
      details: { title: params.title, total_sessions: episode.total_package_sessions },
    });
  }

  return episode;
}
