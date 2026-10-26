import { ParsedVoiceIntake } from './types';

/**
 * Intelligent Rule-Based + Pattern Voice Parser for Physio Voice Intake
 * Parses spoken registration strings into structured clinical fields.
 */
export function parseVoiceIntake(transcript: string): ParsedVoiceIntake {
  const cleanText = transcript.trim();
  let fullName = '';
  let age: number | null = null;
  let phone = '';
  let chiefComplaint = '';
  let plannedSessions = 5; // sensible clinical default
  let appointmentDate: string | undefined;
  let appointmentTime: string | undefined;

  // 1. Extract Phone Number (10 digits, optional country code or spaces)
  // Handles "98765 43210", "9876543210", "+919876543210", "phone 9876543210"
  const phoneMatch = cleanText.match(/(?:phone|mobile|contact)?\s*:?\s*(\+?\d{1,3}[-\s]?)?(\d{5}[-\s]?\d{5}|\d{10})/i);
  if (phoneMatch) {
    phone = (phoneMatch[1] || '') + phoneMatch[2].replace(/[-\s]/g, '');
  }

  // 2. Extract Age (e.g. "age 45", "45 years old", "age is 32")
  const ageMatch = cleanText.match(/(?:age\s*(?:is|of)?\s*|aged\s*)(\d{1,3})|(\d{1,3})\s*(?:years?\s*old|yo)/i);
  if (ageMatch) {
    const matchedAge = parseInt(ageMatch[1] || ageMatch[2], 10);
    if (!isNaN(matchedAge) && matchedAge >= 0 && matchedAge <= 120) {
      age = matchedAge;
    }
  }

  // 3. Extract Planned Sessions (e.g. "10 sessions", "planned 8 sessions", "sessions: 12")
  const sessionMatch = cleanText.match(/(?:plan(?:ned)?\s*)?(\d{1,2})\s*sessions?|(?:sessions?\s*(?:count|planned)?\s*:?\s*)(\d{1,2})/i);
  if (sessionMatch) {
    const matchedSessions = parseInt(sessionMatch[1] || sessionMatch[2], 10);
    if (!isNaN(matchedSessions) && matchedSessions > 0) {
      plannedSessions = matchedSessions;
    }
  }

  // 4. Extract Chief Complaint / Health Problem
  // Looks for phrases like: "problem ...", "complaint ...", "suffering from ...", "diagnosis ...", "diagnosed with ...", "for lower back pain"
  const problemMatch = cleanText.match(/(?:problem|complaint|condition|diagnosis|suffering from|diagnosed with|treatment for|for)\s*:?\s*([^,.\n]+?)(?=\s*(?:,|and|with|\d+\s*sessions?|age|phone|schedule|tomorrow|next|$))/i);
  if (problemMatch && problemMatch[1]) {
    chiefComplaint = problemMatch[1].trim();
    // Capitalize first letter
    chiefComplaint = chiefComplaint.charAt(0).toUpperCase() + chiefComplaint.slice(1);
  }

  // 5. Extract Patient Full Name
  // Common prefixes: "register patient [Name]", "new patient [Name]", "patient [Name]", "name is [Name]"
  const nameMatch = cleanText.match(/(?:register\s+(?:new\s+)?patient|new\s+patient|patient\s+name\s+is|patient\s+named|patient|name\s+is|name)\s*:?\s*([A-Za-z]+(?:\s+[A-Za-z]+){1,3})/i);
  if (nameMatch && nameMatch[1]) {
    const candidateName = nameMatch[1].trim();
    // Exclude reserved trigger keywords
    const lower = candidateName.toLowerCase();
    if (!lower.startsWith('age') && !lower.startsWith('phone') && !lower.startsWith('problem')) {
      fullName = candidateName
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // 6. Extract Appointment Date & Time
  // Examples: "schedule tomorrow at 11 AM", "appointment on Monday at 4:30 PM"
  const appointmentMatch = cleanText.match(/(?:schedule|appointment|session)\s*(?:on|at|for)?\s*(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (appointmentMatch) {
    appointmentDate = appointmentMatch[1]?.toLowerCase();
    appointmentTime = appointmentMatch[2]?.toUpperCase();
  }

  // Calculate extraction confidence score
  let score = 0;
  if (fullName) score += 30;
  if (age) score += 20;
  if (phone) score += 25;
  if (chiefComplaint) score += 20;
  if (plannedSessions) score += 5;

  return {
    fullName,
    age,
    phone,
    chiefComplaint,
    plannedSessions,
    appointmentDate,
    appointmentTime,
    rawTranscript: transcript,
    confidenceScore: Math.min(score, 100),
  };
}
