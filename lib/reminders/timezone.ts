/**
 * Timezone & Clinical Localization Utilities
 * Default Healthcare SaaS timezone for India: Asia/Kolkata (IST, UTC+05:30)
 */

export const DEFAULT_CLINIC_TIMEZONE = 'Asia/Kolkata';

/**
 * Format an ISO UTC timestamp into a human-friendly clinic timezone string
 * e.g., "Wednesday, 18 Nov 2026, 10:30 AM IST"
 */
export function formatInClinicTimezone(
  isoDateStr: string,
  timeZone = DEFAULT_CLINIC_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = new Date(isoDateStr);
  const defaultOpts: Intl.DateTimeFormatOptions = {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };

  const formatted = new Intl.DateTimeFormat('en-IN', options || defaultOpts).format(dateObj);
  return `${formatted} (IST)`;
}

/**
 * Format time only in clinic timezone, e.g. "10:30 AM"
 */
export function formatTimeInClinicTimezone(
  isoDateStr: string,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  const dateObj = new Date(isoDateStr);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

/**
 * Format date only in clinic timezone, e.g. "18 Nov 2026"
 */
export function formatDateInClinicTimezone(
  isoDateStr: string,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  const dateObj = new Date(isoDateStr);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Calculate reminder trigger time before appointment start
 * @param scheduledStartIso ISO 8601 string of appointment start
 * @param hoursBefore Number of hours before appointment to send reminder (default: 2)
 */
export function calculateReminderTriggerTime(
  scheduledStartIso: string,
  hoursBefore = 2
): string {
  const apptTime = new Date(scheduledStartIso).getTime();
  const triggerTime = apptTime - hoursBefore * 60 * 60 * 1000;
  return new Date(triggerTime).toISOString();
}

/**
 * Check if the appointment is today, tomorrow, or a future date relative to clinic timezone
 */
export function getRelativeDayDescription(
  scheduledStartIso: string,
  timeZone = DEFAULT_CLINIC_TIMEZONE
): string {
  const apptDate = new Date(scheduledStartIso);
  const now = new Date();

  const apptDayStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(apptDate); // YYYY-MM-DD
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone }).format(tomorrow);

  const timeStr = formatTimeInClinicTimezone(scheduledStartIso, timeZone);

  if (apptDayStr === todayStr) {
    return `Today at ${timeStr} IST`;
  } else if (apptDayStr === tomorrowStr) {
    return `Tomorrow at ${timeStr} IST`;
  } else {
    return `${formatDateInClinicTimezone(scheduledStartIso, timeZone)} at ${timeStr} IST`;
  }
}
