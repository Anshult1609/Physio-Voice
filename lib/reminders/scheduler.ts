import { createClient } from '@/lib/supabase/server';
import { 
  ReminderChannel, 
  ReminderStatus, 
  PatientNotificationConsent, 
  ReminderDeliveryLog,
  InAppNotification
} from '@/types/reminders';
import { 
  providerRegistry, 
  ReminderMessagePayload, 
  ProviderDispatchResult 
} from './providers';
import { 
  calculateReminderTriggerTime, 
  getRelativeDayDescription, 
  formatInClinicTimezone,
  DEFAULT_CLINIC_TIMEZONE
} from './timezone';

export interface ScheduleAppointmentReminderParams {
  therapistId: string;
  patientId: string;
  appointmentId: string;
  scheduledStart: string; // ISO UTC
  recipientPhone: string;
  patientName: string;
  clinicName: string;
  therapistName: string;
  channel?: ReminderChannel;
  hoursBefore?: number;
  instructions?: string;
}

/**
 * Fetch patient notification consent preferences (DPDPA 2023 compliance).
 * Defaults to In-App: TRUE, WhatsApp: TRUE, SMS: FALSE if not recorded yet.
 */
export async function getPatientNotificationConsent(
  patientId: string,
  therapistId: string
): Promise<PatientNotificationConsent> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('patient_notification_consents')
    .select('*')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error || !data) {
    return {
      patient_id: patientId,
      therapist_id: therapistId,
      consent_in_app: true,
      consent_whatsapp: true,
      consent_sms: false,
      updated_at: new Date().toISOString(),
    };
  }

  return data;
}

/**
 * Update patient notification consent preferences.
 */
export async function updatePatientNotificationConsent(
  patientId: string,
  therapistId: string,
  consents: { inApp?: boolean; whatsapp?: boolean; sms?: boolean }
): Promise<PatientNotificationConsent> {
  const supabase = await createClient();

  const updates = {
    patient_id: patientId,
    therapist_id: therapistId,
    ...(consents.inApp !== undefined ? { consent_in_app: consents.inApp } : {}),
    ...(consents.whatsapp !== undefined ? { consent_whatsapp: consents.whatsapp } : {}),
    ...(consents.sms !== undefined ? { consent_sms: consents.sms } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('patient_notification_consents')
    .upsert(updates)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update consent preferences: ${error.message}`);
  }

  return data;
}

/**
 * Schedule an appointment reminder with DUPLICATE PREVENTION & CONSENT VERIFICATION.
 * Returns existing reminder if duplicate is detected.
 */
export async function scheduleAppointmentReminder(
  params: ScheduleAppointmentReminderParams
) {
  const supabase = await createClient();
  const channel: ReminderChannel = params.channel || 'IN_APP';

  // 1. Consent Check
  const consent = await getPatientNotificationConsent(params.patientId, params.therapistId);
  const isConsented = 
    channel === 'IN_APP' ? consent.consent_in_app :
    channel === 'WHATSAPP' ? consent.consent_whatsapp :
    channel === 'SMS' ? consent.consent_sms : true;

  // 2. Duplicate Prevention: Check for existing active reminder for this appointment + channel
  const { data: existingReminders } = await supabase
    .from('reminders')
    .select('*')
    .eq('appointment_id', params.appointmentId)
    .eq('channel', channel)
    .eq('status', 'PENDING');

  if (existingReminders && existingReminders.length > 0) {
    // Return existing reminder to prevent duplicate scheduling
    return {
      reminder: existingReminders[0],
      isDuplicate: true,
      message: `Active ${channel} reminder already exists for appointment ${params.appointmentId}. Duplicate prevented.`,
    };
  }

  // 3. Compute Trigger Time based on Timezone
  const triggerTime = calculateReminderTriggerTime(params.scheduledStart, params.hoursBefore || 2);
  const relativeTiming = getRelativeDayDescription(params.scheduledStart);

  const messagePayload = `Namaste ${params.patientName}, your physiotherapy appointment at ${params.clinicName} with ${params.therapistName} is scheduled for ${relativeTiming}. ${params.instructions || 'Please arrive 5 minutes early.'}`;

  // 4. If consent was revoked, record as SKIPPED_NO_CONSENT
  const initialStatus: ReminderStatus = isConsented ? 'PENDING' : 'SKIPPED_NO_CONSENT';

  const { data: reminder, error: insertError } = await supabase
    .from('reminders')
    .insert({
      therapist_id: params.therapistId,
      patient_id: params.patientId,
      appointment_id: params.appointmentId,
      channel,
      scheduled_for: triggerTime,
      recipient_phone: params.recipientPhone,
      message_payload: messagePayload,
      status: initialStatus,
    })
    .select()
    .single();

  if (insertError || !reminder) {
    throw new Error(`Failed to schedule reminder: ${insertError?.message}`);
  }

  // 5. Audit Log in delivery logs
  await supabase.from('reminder_delivery_logs').insert({
    reminder_id: reminder.id,
    therapist_id: params.therapistId,
    patient_id: params.patientId,
    appointment_id: params.appointmentId,
    channel,
    provider: channel === 'IN_APP' ? 'INTERNAL_IN_APP' : 'UNCONFIGURED_GATEWAY',
    status: initialStatus,
    delivery_confirmed: false,
    error_message: isConsented ? null : `Skipped: Patient opted out of ${channel} notifications.`,
  });

  return {
    reminder,
    isDuplicate: false,
    message: isConsented 
      ? `Scheduled ${channel} reminder for ${formatInClinicTimezone(triggerTime)}.` 
      : `Reminder marked SKIPPED_NO_CONSENT (Patient opted out of ${channel}).`,
  };
}

/**
 * Handle Appointment Rescheduling:
 * Automatically adjust trigger times of all PENDING reminders for this appointment.
 */
export async function handleAppointmentRescheduled(
  appointmentId: string,
  newScheduledStart: string,
  reason?: string
) {
  const supabase = await createClient();

  // Find all pending reminders for this appointment
  const { data: pendingReminders, error: fetchErr } = await supabase
    .from('reminders')
    .select('*')
    .eq('appointment_id', appointmentId)
    .eq('status', 'PENDING');

  if (fetchErr || !pendingReminders || pendingReminders.length === 0) {
    return { updatedCount: 0 };
  }

  const newTriggerTime = calculateReminderTriggerTime(newScheduledStart, 2);
  const relativeTiming = getRelativeDayDescription(newScheduledStart);

  for (const reminder of pendingReminders) {
    const updatedPayload = `[Rescheduled] Your appointment has been moved to ${relativeTiming}.`;

    await supabase
      .from('reminders')
      .update({
        scheduled_for: newTriggerTime,
        message_payload: updatedPayload,
      })
      .eq('id', reminder.id);

    // Delivery log for reschedule event
    await supabase.from('reminder_delivery_logs').insert({
      reminder_id: reminder.id,
      therapist_id: reminder.therapist_id,
      patient_id: reminder.patient_id,
      appointment_id: appointmentId,
      channel: reminder.channel,
      provider: 'INTERNAL_SCHEDULER',
      status: 'PENDING',
      delivery_confirmed: false,
      error_message: `Rescheduled trigger to ${newTriggerTime} (${reason || 'Clinician adjusted slot'}).`,
    });
  }

  return { updatedCount: pendingReminders.length, newTriggerTime };
}

/**
 * Handle Appointment Cancellation:
 * Automatically cancel all PENDING reminders for this appointment.
 */
export async function handleAppointmentCancelled(
  appointmentId: string,
  reason?: string
) {
  const supabase = await createClient();

  const { data: pendingReminders } = await supabase
    .from('reminders')
    .select('*')
    .eq('appointment_id', appointmentId)
    .eq('status', 'PENDING');

  if (!pendingReminders || pendingReminders.length === 0) {
    return { cancelledCount: 0 };
  }

  for (const reminder of pendingReminders) {
    await supabase
      .from('reminders')
      .update({ status: 'CANCELLED' })
      .eq('id', reminder.id);

    await supabase.from('reminder_delivery_logs').insert({
      reminder_id: reminder.id,
      therapist_id: reminder.therapist_id,
      patient_id: reminder.patient_id,
      appointment_id: appointmentId,
      channel: reminder.channel,
      provider: 'INTERNAL_SCHEDULER',
      status: 'CANCELLED',
      delivery_confirmed: false,
      error_message: `Reminder cancelled: Appointment cancelled (${reason || 'No reason provided'}).`,
    });
  }

  return { cancelledCount: pendingReminders.length };
}

/**
 * Server-Side Scheduler Dispatcher:
 * Processes all due PENDING reminders where scheduled_for <= NOW().
 * Dispatches via configured providers, logs delivery status, and guarantees:
 * "Do not claim external messages have been sent unless a configured provider confirms delivery."
 */
export async function processDueReminders(): Promise<{
  processedCount: number;
  results: ProviderDispatchResult[];
}> {
  const supabase = await createClient();
  const nowUtc = new Date().toISOString();

  // 1. Fetch due reminders (with appointment and patient join)
  const { data: dueReminders, error } = await supabase
    .from('reminders')
    .select(`
      *,
      appointments (
        id,
        scheduled_start,
        status
      ),
      patients (
        id,
        full_name,
        phone
      ),
      users (
        id,
        clinic_name,
        full_name
      )
    `)
    .eq('status', 'PENDING')
    .lte('scheduled_for', nowUtc);

  if (error || !dueReminders || dueReminders.length === 0) {
    return { processedCount: 0, results: [] };
  }

  const results: ProviderDispatchResult[] = [];

  for (const reminder of dueReminders) {
    // 2. Validate appointment status: if cancelled or completed, cancel reminder!
    if (reminder.appointments && (reminder.appointments.status === 'CANCELLED' || reminder.appointments.status === 'COMPLETED')) {
      await supabase.from('reminders').update({ status: 'CANCELLED' }).eq('id', reminder.id);
      continue;
    }

    // 3. Select registered provider
    const provider = providerRegistry[reminder.channel as ReminderChannel] || providerRegistry.IN_APP;

    const payload: ReminderMessagePayload = {
      recipientName: reminder.patients?.full_name || 'Patient',
      recipientPhone: reminder.recipient_phone,
      clinicName: reminder.users?.clinic_name || 'Sharma Multispeciality Physio Clinic',
      therapistName: reminder.users?.full_name || 'Dr. Sharma',
      appointmentTimeFormatted: reminder.appointments?.scheduled_start 
        ? getRelativeDayDescription(reminder.appointments.scheduled_start)
        : 'your upcoming slot',
      appointmentId: reminder.appointment_id || '',
      reminderId: reminder.id,
    };

    // 4. Dispatch through provider interface
    const dispatchResult = await provider.send(payload);
    results.push(dispatchResult);

    // 5. Update reminder status in database
    await supabase
      .from('reminders')
      .update({
        status: dispatchResult.status,
        sent_at: dispatchResult.deliveryConfirmed ? new Date().toISOString() : null,
      })
      .eq('id', reminder.id);

    // 6. Record delivery audit log
    await supabase.from('reminder_delivery_logs').insert({
      reminder_id: reminder.id,
      therapist_id: reminder.therapist_id,
      patient_id: reminder.patient_id,
      appointment_id: reminder.appointment_id,
      channel: reminder.channel,
      provider: dispatchResult.provider,
      status: dispatchResult.status,
      delivery_confirmed: dispatchResult.deliveryConfirmed, // Explicit boolean: only TRUE if verified!
      provider_message_id: dispatchResult.providerMessageId || null,
      response_payload: dispatchResult.rawResponse || null,
      error_message: dispatchResult.error || null,
    });
  }

  return {
    processedCount: dueReminders.length,
    results,
  };
}

/**
 * Fetch in-app notifications for the authenticated therapist
 */
export async function getInAppNotifications(therapistId: string): Promise<InAppNotification[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('reminders')
    .select(`
      id,
      therapist_id,
      patient_id,
      appointment_id,
      channel,
      message_payload,
      scheduled_for,
      status,
      is_read,
      created_at,
      patients (
        patient_code,
        full_name
      )
    `)
    .eq('therapist_id', therapistId)
    .eq('channel', 'IN_APP')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((item: any) => ({
    id: item.id,
    therapist_id: item.therapist_id,
    patient_id: item.patient_id,
    patient_name: item.patients?.full_name || 'Patient',
    patient_code: item.patients?.patient_code || 'PV-26-XXXX',
    appointment_id: item.appointment_id,
    channel: 'IN_APP',
    title: 'Upcoming Appointment Reminder',
    message_payload: item.message_payload,
    scheduled_for: item.scheduled_for,
    status: item.status,
    is_read: Boolean(item.is_read),
    created_at: item.created_at,
  }));
}
