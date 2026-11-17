import { WhatsAppReminderPayload } from '@/types/clinical';

/**
 * Generates a standard WhatsApp click-to-chat URL with pre-filled message text.
 * Works seamlessly across WhatsApp Web and Mobile Apps without any API account setup.
 *
 * @param payload Reminder details including patient contact, clinic name, and time
 * @returns Formatted https://wa.me/91XXXXXXXXXX?text=... URL
 */
export function generateWhatsAppReminderUrl(payload: WhatsAppReminderPayload): string {
  // Normalize Indian mobile number (remove +91, 0 prefix, spaces, dashes)
  let cleanPhone = payload.patientPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  } else if (cleanPhone.length > 10 && !cleanPhone.startsWith('91')) {
    cleanPhone = `91${cleanPhone.slice(-10)}`;
  }

  const defaultInstructions = payload.instructions || 'Please arrive 5-10 minutes early and wear comfortable loose clothing.';

  const message = [
    `*Appointment Reminder - ${payload.clinicName}* 🩺`,
    `----------------------------------------`,
    `Dear *${payload.patientName}*,`,
    ``,
    `Your upcoming physiotherapy session with *Dr. ${payload.therapistName}* is scheduled for:`,
    `🗓️ *${payload.appointmentTime}*`,
    ``,
    `📌 *Instructions:* ${defaultInstructions}`,
    ``,
    `If you need to reschedule, kindly inform us in advance.`,
    `We look forward to helping you recover! 💪`
  ].join('\n');

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generates an automated package status update reminder for WhatsApp.
 * E.g., when a patient has completed 8 out of 10 sessions.
 */
export function generatePackageUpdateUrl(params: {
  patientName: string;
  patientPhone: string;
  clinicName: string;
  episodeTitle: string;
  attendedSessions: number;
  remainingSessions: number;
}): string {
  let cleanPhone = params.patientPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const message = [
    `*Session Progress Update - ${params.clinicName}* 📈`,
    `----------------------------------------`,
    `Dear *${params.patientName}*,`,
    ``,
    `Here is your therapy progress for *${params.episodeTitle}*:`,
    `✅ *Sessions Attended:* ${params.attendedSessions}`,
    `⏳ *Sessions Remaining:* ${params.remainingSessions}`,
    ``,
    params.remainingSessions <= 2 && params.remainingSessions > 0
      ? `⚠️ *Notice:* You have only *${params.remainingSessions}* sessions left in your current package. Please consult your physiotherapist to renew your rehabilitation plan if needed.`
      : `Keep up the great consistency with your rehabilitation exercises!`,
    ``,
    `Warm regards,`,
    `${params.clinicName}`
  ].join('\n');

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
