import { createClient } from '@/lib/supabase/server';
import { Appointment, AppointmentStatusType } from '@/types/database';

export interface ScheduleAppointmentInput {
  patientId: string;
  episodeId?: string;
  scheduledStart: string; // ISO 8601 string
  scheduledEnd: string; // ISO 8601 string
  notes?: string;
  reminderChannel?: 'WHATSAPP' | 'SMS' | 'EMAIL';
}

export interface RescheduleAppointmentInput {
  appointmentId: string;
  newScheduledStart: string;
  newScheduledEnd: string;
  reason?: string;
}

export interface EditAppointmentInput {
  appointmentId: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  notes?: string;
  reminderChannel?: 'WHATSAPP' | 'SMS' | 'EMAIL';
}

/**
 * Fetch appointments for the authenticated physiotherapist.
 * Automatically isolated by Row-Level Security.
 */
export async function getAppointments(startDate?: string, endDate?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('appointments')
    .select(`
      *,
      patients (
        id,
        patient_code,
        full_name,
        phone
      ),
      treatment_episodes (
        id,
        title,
        remaining_sessions,
        total_package_sessions,
        attended_sessions
      )
    `)
    .order('scheduled_start', { ascending: true });

  if (startDate) {
    query = query.gte('scheduled_start', startDate);
  }
  if (endDate) {
    query = query.lte('scheduled_start', endDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

/**
 * Fetch full chronological appointment history for a specific patient.
 */
export async function getPatientAppointmentHistory(patientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      treatment_episodes (
        id,
        title,
        remaining_sessions,
        total_package_sessions,
        attended_sessions
      ),
      attendance (
        id,
        session_number,
        attendance_status,
        attendance_date
      )
    `)
    .eq('patient_id', patientId)
    .order('scheduled_start', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data || [];
}

/**
 * Schedule a new patient appointment and queue automated reminder.
 */
export async function createAppointment(params: ScheduleAppointmentInput) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required: Clinician must be signed in.');
  }

  // 1. Insert appointment
  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .insert({
      therapist_id: user.id,
      patient_id: params.patientId,
      episode_id: params.episodeId || null,
      scheduled_start: params.scheduledStart,
      scheduled_end: params.scheduledEnd,
      status: 'SCHEDULED',
      notes: params.notes,
    })
    .select()
    .single();

  if (apptError) {
    throw new Error(apptError.message);
  }

  // 2. Fetch patient details to queue reminder
  const { data: patient } = await supabase
    .from('patients')
    .select('phone, full_name')
    .eq('id', params.patientId)
    .single();

  if (patient) {
    const scheduledTime = new Date(params.scheduledStart);
    const reminderSendAt = new Date(scheduledTime.getTime() - 2 * 60 * 60 * 1000);

    await supabase.from('reminders').insert({
      therapist_id: user.id,
      patient_id: params.patientId,
      appointment_id: appointment.id,
      channel: params.reminderChannel || 'WHATSAPP',
      recipient_phone: patient.phone,
      scheduled_for: reminderSendAt.toISOString(),
      message_payload: `Namaste ${patient.full_name}, this is a reminder for your physiotherapy appointment scheduled for ${scheduledTime.toLocaleDateString('en-IN')} at ${scheduledTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`,
      status: 'PENDING',
    });
  }

  // 3. Audit Log
  await supabase.from('audit_logs').insert({
    therapist_id: user.id,
    patient_id: params.patientId,
    action: 'APPOINTMENT_SCHEDULED',
    entity_type: 'APPOINTMENT',
    entity_id: appointment.id,
    details: {
      scheduled_start: params.scheduledStart,
      scheduled_end: params.scheduledEnd,
    },
  });

  return appointment;
}

/**
 * Edit appointment details (times, notes, reminder preferences).
 */
export async function editAppointment(params: EditAppointmentInput) {
  const supabase = await createClient();

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (params.scheduledStart) updates.scheduled_start = params.scheduledStart;
  if (params.scheduledEnd) updates.scheduled_end = params.scheduledEnd;
  if (params.notes !== undefined) updates.notes = params.notes;

  const { data, error } = await supabase
    .from('appointments')
    .update(updates)
    .eq('id', params.appointmentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Reschedule an appointment to a new date/time slot.
 */
export async function rescheduleAppointment(params: RescheduleAppointmentInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const noteSuffix = params.reason ? ` [Rescheduled: ${params.reason}]` : ' [Rescheduled]';

  // Fetch current appointment
  const { data: currentApt, error: fetchErr } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', params.appointmentId)
    .single();

  if (fetchErr || !currentApt) {
    throw new Error('Appointment not found');
  }

  const updatedNotes = (currentApt.notes || '') + noteSuffix;

  const { data: updatedApt, error: updateErr } = await supabase
    .from('appointments')
    .update({
      scheduled_start: params.newScheduledStart,
      scheduled_end: params.newScheduledEnd,
      status: 'RESCHEDULED',
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.appointmentId)
    .select()
    .single();

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  // Update pending reminders
  await supabase
    .from('reminders')
    .update({
      scheduled_for: new Date(new Date(params.newScheduledStart).getTime() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'PENDING',
    })
    .eq('appointment_id', params.appointmentId)
    .eq('status', 'PENDING');

  if (user) {
    await supabase.from('audit_logs').insert({
      therapist_id: user.id,
      patient_id: currentApt.patient_id,
      action: 'APPOINTMENT_RESCHEDULED',
      entity_type: 'APPOINTMENT',
      entity_id: params.appointmentId,
      details: {
        from: currentApt.scheduled_start,
        to: params.newScheduledStart,
        reason: params.reason,
      },
    });
  }

  return updatedApt;
}

/**
 * Cancel an appointment with cancellation reason.
 */
export async function cancelAppointment(appointmentId: string, reason?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: currentApt } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (!currentApt) {
    throw new Error('Appointment not found');
  }

  const notes = reason ? `${currentApt.notes || ''} [Cancelled: ${reason}]`.trim() : currentApt.notes;

  // 1. Update appointment to CANCELLED
  const { data: cancelledApt, error } = await supabase
    .from('appointments')
    .update({
      status: 'CANCELLED',
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // 2. If it had attendance recorded as ATTENDED, set to CANCELLED (which triggers package session restoration!)
  await supabase
    .from('attendance')
    .update({ attendance_status: 'CANCELLED' })
    .eq('appointment_id', appointmentId)
    .eq('attendance_status', 'ATTENDED');

  // 3. Cancel pending reminders
  await supabase
    .from('reminders')
    .update({ status: 'CANCELLED' })
    .eq('appointment_id', appointmentId)
    .eq('status', 'PENDING');

  if (user) {
    await supabase.from('audit_logs').insert({
      therapist_id: user.id,
      patient_id: currentApt.patient_id,
      action: 'APPOINTMENT_CANCELLED',
      entity_type: 'APPOINTMENT',
      entity_id: appointmentId,
      details: { reason },
    });
  }

  return cancelledApt;
}

/**
 * Set appointment attendance status and enforce package session rules:
 * - SCHEDULED: No session decrement.
 * - ATTENDED: Confirms attendance -> triggers remaining session decrement.
 *             Idempotent: prevents duplicate decrement if already ATTENDED!
 * - NO_SHOW: Patient did not attend -> No session decrement.
 *            If previously ATTENDED, restores the session!
 * - CANCELLED: Cancelled visit -> No session decrement.
 *            If previously ATTENDED, restores the session!
 */
export async function setAppointmentAttendanceStatus(
  appointmentId: string,
  targetStatus: 'SCHEDULED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED'
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch current appointment
  const { data: appointment, error: aptErr } = await supabase
    .from('appointments')
    .select('*, treatment_episodes(*)')
    .eq('id', appointmentId)
    .single();

  if (aptErr || !appointment) {
    throw new Error(`Appointment not found: ${aptErr?.message}`);
  }

  const previousStatus = appointment.status;

  // 2. If status is already targetStatus, no-op (PREVENT DUPLICATE COUNTING)
  if (previousStatus === targetStatus || (previousStatus === 'COMPLETED' && targetStatus === 'ATTENDED')) {
    return { appointment, updated: false, message: 'Status is already set. No duplicate session decrement.' };
  }

  // 3. Update appointment status in appointments table
  const mappedStatus = targetStatus === 'ATTENDED' ? 'COMPLETED' : targetStatus;
  const { data: updatedApt, error: updateAptErr } = await supabase
    .from('appointments')
    .update({
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (updateAptErr) {
    throw new Error(updateAptErr.message);
  }

  // 4. Handle Attendance Table and Package Decrement Logic
  const episodeId = appointment.episode_id;

  if (episodeId) {
    // Check if an attendance record already exists for this appointment
    const { data: existingAttendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (targetStatus === 'ATTENDED') {
      if (existingAttendance) {
        // If it was not ATTENDED before, update to ATTENDED (Trigger increments attended, decrements remaining)
        if (existingAttendance.attendance_status !== 'ATTENDED') {
          await supabase
            .from('attendance')
            .update({ attendance_status: 'ATTENDED', attendance_date: new Date().toISOString() })
            .eq('id', existingAttendance.id);
        }
      } else {
        // Count existing attended sessions in this episode to set session_number
        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('episode_id', episodeId);

        const nextSessionNum = (count || 0) + 1;

        // Insert new attendance record with ATTENDED (Trigger increments attended, decrements remaining)
        await supabase.from('attendance').insert({
          therapist_id: appointment.therapist_id,
          patient_id: appointment.patient_id,
          episode_id: episodeId,
          appointment_id: appointmentId,
          session_number: nextSessionNum,
          attendance_status: 'ATTENDED',
        });
      }
    } else if (targetStatus === 'NO_SHOW') {
      if (existingAttendance && existingAttendance.attendance_status === 'ATTENDED') {
        // Revert attendance (Trigger decrements attended, restores remaining!)
        await supabase
          .from('attendance')
          .update({ attendance_status: 'MISSED' })
          .eq('id', existingAttendance.id);
      }
    } else if (targetStatus === 'CANCELLED') {
      if (existingAttendance && existingAttendance.attendance_status === 'ATTENDED') {
        // Revert attendance (Trigger decrements attended, restores remaining!)
        await supabase
          .from('attendance')
          .update({ attendance_status: 'CANCELLED' })
          .eq('id', existingAttendance.id);
      }
    } else if (targetStatus === 'SCHEDULED') {
      if (existingAttendance && existingAttendance.attendance_status === 'ATTENDED') {
        // Revert attendance if put back to scheduled
        await supabase
          .from('attendance')
          .update({ attendance_status: 'CANCELLED' })
          .eq('id', existingAttendance.id);
      }
    }
  }

  // 5. Query updated episode to return current package count
  let remainingSessions = null;
  if (episodeId) {
    const { data: ep } = await supabase
      .from('treatment_episodes')
      .select('remaining_sessions, attended_sessions, total_package_sessions')
      .eq('id', episodeId)
      .single();
    remainingSessions = ep?.remaining_sessions;
  }

  // 6. Audit Log
  if (user) {
    await supabase.from('audit_logs').insert({
      therapist_id: user.id,
      patient_id: appointment.patient_id,
      action: `APPOINTMENT_STATUS_${targetStatus}`,
      entity_type: 'APPOINTMENT',
      entity_id: appointmentId,
      details: {
        from_status: previousStatus,
        to_status: targetStatus,
        remaining_sessions: remainingSessions,
      },
    });
  }

  return {
    appointment: updatedApt,
    updated: true,
    previousStatus,
    newStatus: targetStatus,
    remainingSessions,
  };
}
