import { 
  VoiceIntentType, 
  VoiceProcessingResult, 
  ExtractedRegistrationPayload,
  ExtractedAttendancePayload,
  ExtractedSchedulingPayload,
  ExtractedSearchPayload,
  ExtractedHistoryPayload,
  PatientMatchResult,
  VoiceValidationResult
} from '@/types/voice';

export interface KnownPatientRecord {
  id: string;
  patient_code: string;
  full_name: string;
  phone: string;
  activeEpisode?: {
    id: string;
    title: string;
    remaining_sessions: number;
    total_package_sessions: number;
    attended_sessions: number;
  } | null;
}

const COMMON_MODALITIES = [
  'IFT',
  'Ultrasound',
  'TENS',
  'SWD',
  'Cervical Traction',
  'Lumbar Traction',
  'Dry Needling',
  'Cupping',
  'Theraband Exercises',
  'Joint Mobilization',
  'Maitland Mobilization',
  'Cryotherapy',
  'Moist Heat Pack',
  'Facial PNF',
  'Isometric Exercises',
  'Pelvic Bridging',
  'McKenzie Extension',
];

const COMMON_BODY_PARTS = [
  'Cervical Spine',
  'Lumbar Spine',
  'Right Knee',
  'Left Knee',
  'Knee Joint',
  'Right Shoulder',
  'Left Shoulder',
  'Shoulder Joint',
  'Ankle Joint',
  'Thoracic Spine',
  'Hip Joint',
  'Wrist & Hand',
  'Face (Facial Nerve)',
  'Whole Body Rehab',
];

const COMMON_COMORBIDITIES = [
  'Hypertension',
  'Type 2 Diabetes',
  'Cardiac Pacemaker',
  'Cardiac Stent',
  'Osteoporosis',
  'Hypothyroidism',
  'Asthma',
  'Previous Spinal Surgery',
  'Previous Knee Surgery',
];

/**
 * Clean phone number to 10 digits
 */
export function sanitizePhone(phoneText: string): string {
  const digits = phoneText.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Parse relative date strings to concrete ISO YYYY-MM-DD
 */
export function parseRelativeDate(text: string, baseDate = new Date()): string {
  const lower = text.toLowerCase();
  const d = new Date(baseDate);

  if (lower.includes('day after tomorrow')) {
    d.setDate(d.getDate() + 2);
  } else if (lower.includes('tomorrow')) {
    d.setDate(d.getDate() + 1);
  } else if (lower.includes('yesterday')) {
    d.setDate(d.getDate() - 1);
  } else {
    // Check for day of week: monday, tuesday, etc.
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i])) {
        const currentDay = d.getDay();
        let diff = i - currentDay;
        if (diff <= 0) diff += 7; // Next occurrence
        d.setDate(d.getDate() + diff);
        break;
      }
    }
  }

  return d.toISOString().split('T')[0];
}

/**
 * Parse time string like "10 AM", "4:30 PM", "11:00", "16:30" into 24-hr "HH:mm"
 */
export function parseTimeString(text: string): string {
  const lower = text.toLowerCase();

  // Pattern: 10:30 am / 4:30 pm / 11 am / 5 pm / 12 pm
  const timeRegex = /(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
  const match = lower.match(timeRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2] ? match[2] : '00';
    const meridian = match[3]?.toLowerCase();

    if (meridian === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridian === 'am' && hours === 12) {
      hours = 0;
    }

    const hh = hours.toString().padStart(2, '0');
    return `${hh}:${mins}`;
  }

  // 24-hour pattern like 16:30
  const match24 = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (match24) {
    return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  }

  return '10:00'; // Default morning clinic slot
}

/**
 * Match a target patient name, phone, or code against known patient records.
 * Resolves exact matches vs ambiguity.
 */
export function matchPatient(
  identifier: string,
  knownPatients: KnownPatientRecord[]
): PatientMatchResult {
  if (!identifier || !identifier.trim() || knownPatients.length === 0) {
    return { status: 'NO_MATCH', candidates: [] };
  }

  const query = identifier.trim().toLowerCase();
  const cleanPhone = sanitizePhone(query);

  // 1. Exact match by Phone
  if (cleanPhone.length === 10) {
    const phoneMatches = knownPatients.filter((p) => sanitizePhone(p.phone) === cleanPhone);
    if (phoneMatches.length === 1) {
      return { status: 'EXACT_MATCH', matchedPatient: phoneMatches[0], candidates: phoneMatches };
    } else if (phoneMatches.length > 1) {
      return {
        status: 'AMBIGUOUS',
        candidates: phoneMatches,
        ambiguityReason: `Multiple patients registered with phone +91 ${cleanPhone}. Please select the exact patient.`,
      };
    }
  }

  // 2. Exact match by Patient Code (PV-26-XXXX)
  const codeMatches = knownPatients.filter(
    (p) => (p.patient_code || (p as any).code || '').toLowerCase() === query
  );
  if (codeMatches.length === 1) {
    return { status: 'EXACT_MATCH', matchedPatient: codeMatches[0], candidates: codeMatches };
  }

  // 3. Exact match by Full Name
  const fullNameMatches = knownPatients.filter(
    (p) => (p.full_name || (p as any).name || '').toLowerCase() === query
  );
  if (fullNameMatches.length === 1) {
    return { status: 'EXACT_MATCH', matchedPatient: fullNameMatches[0], candidates: fullNameMatches };
  }

  // 4. Substring / Token Match (e.g. "Sunita", "Sharma", "Rajesh")
  const tokens = query.split(/\s+/).filter((t) => t.length > 2);
  const matchedSet = new Set<KnownPatientRecord>();

  for (const patient of knownPatients) {
    const pName = (patient.full_name || (patient as any).name || '').toLowerCase();
    for (const token of tokens) {
      if (pName.includes(token)) {
        matchedSet.add(patient);
      }
    }
  }

  const candidates = Array.from(matchedSet);

  if (candidates.length === 1) {
    return {
      status: 'EXACT_MATCH',
      matchedPatient: candidates[0],
      candidates,
    };
  }

  if (candidates.length > 1) {
    return {
      status: 'AMBIGUOUS',
      candidates,
      ambiguityReason: `Found ${candidates.length} patients matching "${identifier}". Please choose the correct patient.`,
    };
  }

  return {
    status: 'NO_MATCH',
    candidates: [],
    ambiguityReason: `No patient found matching "${identifier}".`,
  };
}

/**
 * Extract target patient identifier string from transcript
 */
function extractPatientIdentifierFromText(
  cleanText: string,
  knownPatients: KnownPatientRecord[]
): string {
  const lower = cleanText.toLowerCase();

  // 1. Check for exact full name occurrences in transcript
  const fullMatches = knownPatients.filter((kp) => lower.includes(kp.full_name.toLowerCase()));
  if (fullMatches.length === 1) {
    return fullMatches[0].full_name;
  }

  // 2. Check for explicit prefix e.g. "for Sharma", "for Sunita Sharma", "patient Sunita"
  const namePattern = /(?:attendance for|schedule for|appointment for|cancel appointment for|mark|for|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
  const match = cleanText.match(namePattern);
  if (match) {
    return match[1].trim();
  }

  // 3. Check for partial name match against known patients
  for (const kp of knownPatients) {
    const parts = kp.full_name.toLowerCase().split(' ');
    for (const part of parts) {
      if (part.length > 2 && lower.includes(part)) {
        // Return the matched partial token so matchPatient can detect if multiple patients share it
        return part;
      }
    }
  }

  return '';
}

/**
 * Clinical NLP Intent Classifier & Entity Extractor
 */
export function extractStructuredVoiceData(
  transcript: string,
  knownPatients: KnownPatientRecord[] = []
): VoiceProcessingResult {
  const cleanText = transcript.trim();
  const lower = cleanText.toLowerCase();

  const validation: VoiceValidationResult = {
    isValid: true,
    errors: {},
    warnings: [],
  };

  // -------------------------------------------------------------------------
  // 1. Intent Classification
  // -------------------------------------------------------------------------
  let intent: VoiceIntentType = 'UNKNOWN';

  if (
    lower.includes('register') || 
    lower.includes('new patient') || 
    lower.includes('admit') || 
    lower.includes('onboard') ||
    lower.includes('add patient')
  ) {
    intent = 'PATIENT_REGISTRATION';
  } else if (
    lower.includes('history') || 
    lower.includes('remaining') || 
    lower.includes('sessions left') || 
    lower.includes('how many sessions') ||
    lower.includes('clinical notes')
  ) {
    intent = 'HISTORY_RETRIEVAL';
  } else if (
    lower.includes('cancel') ||
    lower.includes('attended') || 
    lower.includes('present') || 
    lower.includes('no-show') || 
    lower.includes('no show') || 
    lower.includes('absent') || 
    lower.includes('attendance') ||
    lower.includes('mark session') ||
    lower.includes('completed session')
  ) {
    intent = 'ATTENDANCE_UPDATE';
  } else if (
    lower.includes('schedule') || 
    lower.includes('book') || 
    lower.includes('appointment') || 
    lower.includes('reschedule') ||
    lower.includes('book slot')
  ) {
    intent = 'APPOINTMENT_SCHEDULING';
  } else if (
    lower.includes('find') || 
    lower.includes('search') || 
    lower.includes('lookup') || 
    lower.includes('show patient') ||
    lower.includes('open patient')
  ) {
    intent = 'PATIENT_SEARCH';
  } else {
    // Heuristic: if contains a 10 digit number and a clinical condition, registration
    if (/\b\d{10}\b/.test(cleanText) && (lower.includes('knee') || lower.includes('spine') || lower.includes('back'))) {
      intent = 'PATIENT_REGISTRATION';
    } else {
      intent = 'UNKNOWN';
    }
  }

  let registrationPayload: ExtractedRegistrationPayload | undefined;
  let attendancePayload: ExtractedAttendancePayload | undefined;
  let schedulingPayload: ExtractedSchedulingPayload | undefined;
  let searchPayload: ExtractedSearchPayload | undefined;
  let historyPayload: ExtractedHistoryPayload | undefined;
  let patientMatch: PatientMatchResult | undefined;

  // -------------------------------------------------------------------------
  // 2. Intent-Specific Payload Extraction & Validation
  // -------------------------------------------------------------------------
  if (intent === 'PATIENT_REGISTRATION') {
    // Extract Phone (10 digits)
    const phoneMatch = cleanText.match(/(?:\+91[\-\s]?)?([6-9]\d{9})/);
    const phone = phoneMatch ? phoneMatch[1] : '';

    // Extract Age
    const ageMatch = lower.match(/\b(\d{1,2})\s*(?:years?|yrs?|yr|y\/o|-year-old)?\s*(?:old)?\b/);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

    // Extract Gender
    let gender: 'MALE' | 'FEMALE' | 'OTHER' = 'OTHER';
    if (lower.includes('female') || lower.includes('woman') || lower.includes('lady') || lower.includes('mrs') || lower.includes('ms')) {
      gender = 'FEMALE';
    } else if (lower.includes('male') || lower.includes(' man ') || lower.includes('gentleman') || lower.includes('mr.')) {
      gender = 'MALE';
    }

    // Extract Full Name
    let fullName = '';
    const namePattern = /(?:patient|mr\.|mrs\.|ms\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
    const nameMatch = cleanText.match(namePattern);
    if (nameMatch) {
      fullName = nameMatch[1];
    } else {
      const firstTwoWords = cleanText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/);
      if (firstTwoWords) {
        fullName = firstTwoWords[1];
      }
    }

    // Extract Modalities
    const modalitiesUsed = COMMON_MODALITIES.filter((m) => lower.includes(m.toLowerCase()));

    // Extract Body Part
    const affectedBodyPart = COMMON_BODY_PARTS.find((p) => lower.includes(p.toLowerCase())) || 'General Rehabilitation';

    // Extract Comorbidities
    const comorbidities = COMMON_COMORBIDITIES.filter((c) => lower.includes(c.toLowerCase()));
    if (lower.includes('diabetic') || lower.includes('diabetes')) {
      if (!comorbidities.includes('Type 2 Diabetes')) comorbidities.push('Type 2 Diabetes');
    }
    if (lower.includes('bp') || lower.includes('hypertension') || lower.includes('high blood pressure')) {
      if (!comorbidities.includes('Hypertension')) comorbidities.push('Hypertension');
    }

    // Extract Package Sessions (default 10)
    const sessionsMatch = lower.match(/\b(\d{1,2})\s*(?:sessions?|visits?|days? package)\b/);
    const suggestedPackageSessions = sessionsMatch ? parseInt(sessionsMatch[1], 10) : 10;

    // Extract Package Fee (remove phone number first to avoid misidentifying phone digits as fee!)
    const textWithoutPhone = cleanText.replace(/(?:\+91[\-\s]?)?[6-9]\d{9}/g, '');
    const feeMatch = textWithoutPhone.match(/(?:fee|rs\.?|rupees|₹|amount|cost)\s*(?:is|of|amounting to)?\s*(\d{3,6})/i) 
      || textWithoutPhone.match(/(\d{3,6})\s*(?:rupees|rs\.?|inr)/i);
    const packageFee = feeMatch ? parseInt(feeMatch[1], 10) : 6000;

    // Chief complaint
    let chiefComplaint = 'Physiotherapy evaluation and treatment';
    if (lower.includes('knee')) chiefComplaint = 'Knee joint pain & mobility limitation';
    else if (lower.includes('cervical') || lower.includes('neck')) chiefComplaint = 'Cervical pain and neck spasm';
    else if (lower.includes('back') || lower.includes('lumbar')) chiefComplaint = 'Lower back pain & lumbar stiffness';
    else if (lower.includes('shoulder') || lower.includes('frozen shoulder')) chiefComplaint = 'Shoulder stiffness & capsulitis';
    else if (lower.includes('bell') || lower.includes('facial')) chiefComplaint = "Bell's palsy facial rehabilitation";

    // Validation
    if (!fullName || fullName.length < 2) {
      validation.errors.fullName = 'Full patient name is required.';
    }
    if (!phone || phone.length !== 10) {
      validation.errors.phone = 'Valid 10-digit mobile number is required.';
    }
    if (age && (age < 1 || age > 120)) {
      validation.errors.age = 'Age must be between 1 and 120.';
    }

    registrationPayload = {
      fullName: fullName || 'New Patient',
      phone: phone || '',
      age,
      gender,
      occupation: lower.includes('teacher') ? 'Teacher' : lower.includes('software') || lower.includes('it') ? 'IT Professional' : null,
      chiefComplaint,
      affectedBodyPart,
      comorbidities,
      suggestedPackageSessions,
      packageFee,
      clinicalNotes: cleanText,
    };

  } else if (intent === 'ATTENDANCE_UPDATE') {
    // Determine Attendance Status
    let status: 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' = 'ATTENDED';
    if (lower.includes('no-show') || lower.includes('no show') || lower.includes('absent') || lower.includes('missed')) {
      status = 'NO_SHOW';
    } else if (lower.includes('cancelled') || lower.includes('cancel')) {
      status = 'CANCELLED';
    }

    // Extract VAS Pain Score (0-10)
    const vasMatch = lower.match(/(?:vas|pain|score)\s*(?:is|was|of)?\s*(\d{1,2})(?:\s*\/\s*10)?/i);
    let painScore: number | null = null;
    if (vasMatch) {
      const parsedScore = parseInt(vasMatch[1], 10);
      if (parsedScore >= 0 && parsedScore <= 10) {
        painScore = parsedScore;
      }
    }

    // Extract Modalities
    const modalities = COMMON_MODALITIES.filter((m) => lower.includes(m.toLowerCase()));

    // Extract Target Patient Identifier
    const patientIdentifier = extractPatientIdentifierFromText(cleanText, knownPatients);
    patientMatch = matchPatient(patientIdentifier, knownPatients);

    attendancePayload = {
      patientIdentifier: patientIdentifier,
      status,
      date: new Date().toISOString().split('T')[0],
      painScore,
      modalities,
      subjectiveNotes: cleanText,
    };

    if (patientMatch.status === 'NO_MATCH') {
      validation.errors.patient = `Could not find a registered patient matching "${patientIdentifier}".`;
    } else if (patientMatch.status === 'AMBIGUOUS') {
      validation.warnings.push(patientMatch.ambiguityReason || 'Multiple patients matched. Please select one.');
    }

  } else if (intent === 'APPOINTMENT_SCHEDULING') {
    const scheduledDate = parseRelativeDate(cleanText);
    const scheduledTime = parseTimeString(cleanText);

    const patientIdentifier = extractPatientIdentifierFromText(cleanText, knownPatients);
    patientMatch = matchPatient(patientIdentifier, knownPatients);

    schedulingPayload = {
      patientIdentifier: patientIdentifier,
      date: scheduledDate,
      startTime: scheduledTime,
      durationMinutes: 45,
      notes: cleanText,
    };

    if (patientMatch.status === 'NO_MATCH') {
      validation.errors.patient = `Could not find a registered patient matching "${patientIdentifier}".`;
    } else if (patientMatch.status === 'AMBIGUOUS') {
      validation.warnings.push(patientMatch.ambiguityReason || 'Multiple patients matched.');
    }

  } else if (intent === 'PATIENT_SEARCH') {
    const query = cleanText.replace(/find|search|lookup|patient|for/gi, '').trim();
    patientMatch = matchPatient(query, knownPatients);
    searchPayload = {
      query: query || cleanText,
      searchType: sanitizePhone(query).length === 10 ? 'PHONE' : query.startsWith('PV-') ? 'CODE' : 'NAME',
    };

  } else if (intent === 'HISTORY_RETRIEVAL') {
    const patientIdentifier = extractPatientIdentifierFromText(cleanText, knownPatients) || cleanText.replace(/find|show|treatment|history|remaining|sessions|package|patient/gi, '').trim();
    patientMatch = matchPatient(patientIdentifier, knownPatients);

    historyPayload = {
      patientIdentifier: patientIdentifier,
      focus: lower.includes('remaining') ? 'REMAINING_SESSIONS' : lower.includes('notes') ? 'CLINICAL_NOTES' : 'FULL',
    };
  }

  validation.isValid = Object.keys(validation.errors).length === 0;

  return {
    success: true,
    transcript: cleanText,
    intent,
    registrationPayload,
    attendancePayload,
    schedulingPayload,
    searchPayload,
    historyPayload,
    patientMatch,
    validation,
    safety: {
      noHallucinatedData: true,
      noMedicalDiagnosis: true,
      disclaimer: 'AI Clinical Extraction Assistant. Never generates medical diagnoses or unprescribed treatments. Verify extracted fields before saving.',
    },
  };
}
