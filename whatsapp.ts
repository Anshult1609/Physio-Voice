/**
 * WhatsApp Reminder Link Generator for Physio Voice
 * Zero cost, instant delivery direct to patient's WhatsApp
 */

export interface ReminderMessageOptions {
  patientName: string;
  patientPhone: string;
  clinicName: string;
  doctorName?: string;
  sessionTimeFormatted: string; // e.g. "Tomorrow at 11:00 AM"
  sessionNumber?: number;
  totalSessions?: number;
}

/**
 * Clean and format phone number for WhatsApp wa.me links
 * Strips symbols, removes leading 0, defaults to standard country code (e.g. 91)
 */
export function sanitizeWhatsAppPhone(phone: string, defaultCountryCode = '91'): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 10) {
    // Standard 10-digit mobile number, prepend country code
    cleaned = defaultCountryCode + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Creates the WhatsApp 1-Day Reminder Text and Direct Click URL
 */
export function generateWhatsAppReminder(options: ReminderMessageOptions): {
  message: string;
  url: string;
  phone: string;
} {
  const {
    patientName,
    patientPhone,
    clinicName,
    doctorName = 'your physiotherapist',
    sessionTimeFormatted,
    sessionNumber,
    totalSessions,
  } = options;

  let sessionProgressNote = '';
  if (sessionNumber && totalSessions) {
    sessionProgressNote = ` (Session ${sessionNumber} of ${totalSessions})`;
  }

  const message = 
`Hello ${patientName}! 👋

This is a friendly reminder for your upcoming physiotherapy session${sessionProgressNote}:
🗓️ Time: *${sessionTimeFormatted}*
🏥 Clinic: *${clinicName}*
🩺 Practitioner: *${doctorName}*

Please arrive 5 minutes early in comfortable clothing. If you need to reschedule or have any questions, kindly reply directly to this message.

Wishing you a speedy recovery! ✨`;

  const cleanPhone = sanitizeWhatsAppPhone(patientPhone);
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;

  return {
    message,
    url,
    phone: cleanPhone,
  };
}

/**
 * Reschedule notification template
 */
export function generateWhatsAppRescheduleNotice(
  patientName: string,
  patientPhone: string,
  clinicName: string,
  newTimeFormatted: string
): { message: string; url: string } {
  const message =
`Hello ${patientName}! 

Your physiotherapy appointment at *${clinicName}* has been updated to:
🗓️ New Schedule: *${newTimeFormatted}*

See you then! Reply to this message if you have any questions.`;

  const cleanPhone = sanitizeWhatsAppPhone(patientPhone);
  return {
    message,
    url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
  };
}
