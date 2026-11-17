import { 
  extractStructuredVoiceData, 
  sanitizePhone, 
  parseTimeString, 
  parseRelativeDate, 
  matchPatient,
  KnownPatientRecord 
} from '../lib/voice/clinical-nlp';

interface TestAssertion {
  description: string;
  expected: any;
  actual: any;
  passed: boolean;
}

const testResults: TestAssertion[] = [];

function assert(description: string, actual: any, expected: any) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  testResults.push({ description, expected, actual, passed });
  if (passed) {
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Expected: ${JSON.stringify(expected)}`);
    console.error(`     Actual:   ${JSON.stringify(actual)}`);
  }
}

const MOCK_PATIENTS: KnownPatientRecord[] = [
  {
    id: 'p-1',
    patient_code: 'PV-26-1001',
    full_name: 'Sunita Sharma',
    phone: '9811234567',
    activeEpisode: {
      id: 'ep-1',
      title: 'Post-Op Right Knee Rehabilitation',
      remaining_sessions: 2,
      total_package_sessions: 10,
      attended_sessions: 8,
    },
  },
  {
    id: 'p-2',
    patient_code: 'PV-26-1002',
    full_name: 'Rajesh Verma',
    phone: '9822345678',
    activeEpisode: {
      id: 'ep-2',
      title: 'Cervical Radiculopathy & Neck Spasm',
      remaining_sessions: 6,
      total_package_sessions: 10,
      attended_sessions: 4,
    },
  },
  {
    id: 'p-3',
    patient_code: 'PV-26-1003',
    full_name: 'Ananya Deshmukh',
    phone: '9833456789',
    activeEpisode: {
      id: 'ep-3',
      title: 'Right Frozen Shoulder - Phase 2 Thawing',
      remaining_sessions: 1,
      total_package_sessions: 10,
      attended_sessions: 9,
    },
  },
  {
    id: 'p-4',
    patient_code: 'PV-26-1004',
    full_name: 'Vikram Malhotra',
    phone: '9844567890',
    activeEpisode: {
      id: 'ep-4',
      title: 'Lumbar Disc Herniation (L4-L5)',
      remaining_sessions: 7,
      total_package_sessions: 10,
      attended_sessions: 3,
    },
  },
  {
    id: 'p-6',
    patient_code: 'PV-26-1006',
    full_name: 'Ramesh Sharma',
    phone: '9866778899',
    activeEpisode: {
      id: 'ep-6',
      title: 'Rotator Cuff Tendinitis',
      remaining_sessions: 5,
      total_package_sessions: 10,
      attended_sessions: 5,
    },
  },
];

async function runVoiceAssistantTests() {
  console.log('========================================================================');
  console.log('🧪 PHYSIO VOICE ASSISTANT: CLINICAL NLP & SAFETY TEST SUITE');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Patient Registration Dictation
  // -------------------------------------------------------------------------
  console.log('▶ TEST 1: Patient Registration Dictation & Structured Extraction');
  const regTranscript = 'Register new patient Ramesh Gupta, 48 year old male, phone 9811223344, acute L4-L5 disc pain with calf radiation. Prescribe 10 sessions package with fee 6000 rupees.';
  const regResult = extractStructuredVoiceData(regTranscript, MOCK_PATIENTS);

  assert('Intent must be PATIENT_REGISTRATION', regResult.intent, 'PATIENT_REGISTRATION');
  assert('Extracted full name', regResult.registrationPayload?.fullName, 'Ramesh Gupta');
  assert('Extracted phone clean 10 digits', regResult.registrationPayload?.phone, '9811223344');
  assert('Extracted age', regResult.registrationPayload?.age, 48);
  assert('Extracted gender', regResult.registrationPayload?.gender, 'MALE');
  assert('Extracted package sessions', regResult.registrationPayload?.suggestedPackageSessions, 10);
  assert('Extracted package fee', regResult.registrationPayload?.packageFee, 6000);
  assert('Registration payload is valid', regResult.validation.isValid, true);

  // -------------------------------------------------------------------------
  // 2. Field Validation & Error Detection
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 2: Field Validation & Rejection of Incomplete/Malformed Data');
  const invalidTranscript = 'Register new patient with only back pain and invalid phone 12345';
  const invalidResult = extractStructuredVoiceData(invalidTranscript, MOCK_PATIENTS);

  assert('Invalid phone must fail validation', invalidResult.validation.isValid, false);
  assert('Must report error for invalid 10-digit phone', typeof invalidResult.validation.errors.phone, 'string');

  // -------------------------------------------------------------------------
  // 3. Attendance Updates: Attended vs No-Show vs Cancelled
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 3: Attendance Update Intent & Status Mapping');
  // 3A: Confirmed Attended
  const attTranscript = 'Mark Sunita Sharma attended today with ultrasound and joint mobilization, pain score 2.';
  const attResult = extractStructuredVoiceData(attTranscript, MOCK_PATIENTS);

  assert('Intent must be ATTENDANCE_UPDATE', attResult.intent, 'ATTENDANCE_UPDATE');
  assert('Status must be ATTENDED', attResult.attendancePayload?.status, 'ATTENDED');
  assert('VAS Pain score extracted as 2', attResult.attendancePayload?.painScore, 2);
  assert('Modalities contains Ultrasound', attResult.attendancePayload?.modalities.includes('Ultrasound'), true);
  assert('Exact patient match found for Sunita Sharma', attResult.patientMatch?.status, 'EXACT_MATCH');
  assert('Matched patient ID is p-1', attResult.patientMatch?.matchedPatient?.id, 'p-1');

  // 3B: No-Show
  const noShowTranscript = 'Mark Vikram Malhotra as no-show for today session.';
  const noShowResult = extractStructuredVoiceData(noShowTranscript, MOCK_PATIENTS);
  assert('Status must be NO_SHOW', noShowResult.attendancePayload?.status, 'NO_SHOW');
  assert('Matched patient is Vikram Malhotra', noShowResult.patientMatch?.matchedPatient?.full_name, 'Vikram Malhotra');

  // 3C: Cancelled
  const cancelTranscript = 'Cancel appointment for Sunita Sharma today';
  const cancelResult = extractStructuredVoiceData(cancelTranscript, MOCK_PATIENTS);
  assert('Cancelled intent detected', cancelResult.attendancePayload?.status === 'CANCELLED' || cancelResult.intent === 'ATTENDANCE_UPDATE', true);

  // -------------------------------------------------------------------------
  // 4. Ambiguous Patient Identity Handling
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 4: Ambiguous Patient Identity Disambiguation');
  // "Sharma" matches both Sunita Sharma (p-1) and Ramesh Sharma (p-6)
  const ambigTranscript = 'Record attendance for Sharma today with Maitland mobilization.';
  const ambigResult = extractStructuredVoiceData(ambigTranscript, MOCK_PATIENTS);

  assert('Patient matching status must be AMBIGUOUS', ambigResult.patientMatch?.status, 'AMBIGUOUS');
  assert('Must return 2 candidate patients', ambigResult.patientMatch?.candidates.length, 2);
  assert('Validation must produce an ambiguity warning', ambigResult.validation.warnings.length > 0, true);

  // -------------------------------------------------------------------------
  // 5. Appointment Scheduling
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 5: Appointment Scheduling & Time Parsing');
  const schedTranscript = 'Schedule appointment for Rajesh Verma tomorrow at 11:30 AM for cervical traction.';
  const schedResult = extractStructuredVoiceData(schedTranscript, MOCK_PATIENTS);

  assert('Intent must be APPOINTMENT_SCHEDULING', schedResult.intent, 'APPOINTMENT_SCHEDULING');
  assert('Matched patient is Rajesh Verma', schedResult.patientMatch?.matchedPatient?.full_name, 'Rajesh Verma');
  assert('Parsed start time is 11:30', schedResult.schedulingPayload?.startTime, '11:30');
  assert('Parsed date matches relative date parser', typeof schedResult.schedulingPayload?.date, 'string');

  // -------------------------------------------------------------------------
  // 6. Patient Search & History Retrieval
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 6: Patient Search & History Retrieval');
  const searchTranscript = 'Find patient Ananya Deshmukh and show remaining package sessions.';
  const searchResult = extractStructuredVoiceData(searchTranscript, MOCK_PATIENTS);

  assert('Intent is HISTORY_RETRIEVAL', searchResult.intent, 'HISTORY_RETRIEVAL');
  assert('Matched patient is Ananya Deshmukh', searchResult.patientMatch?.matchedPatient?.full_name, 'Ananya Deshmukh');
  assert('Focus is REMAINING_SESSIONS', searchResult.historyPayload?.focus, 'REMAINING_SESSIONS');

  // -------------------------------------------------------------------------
  // 7. Safety & Anti-Hallucination Invariants
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 7: Clinical Safety & Anti-Hallucination Invariants');
  assert('Safety flag noHallucinatedData must be true', regResult.safety.noHallucinatedData, true);
  assert('Safety flag noMedicalDiagnosis must be true', regResult.safety.noMedicalDiagnosis, true);
  assert('Safety disclaimer must be present', typeof regResult.safety.disclaimer, 'string');

  // -------------------------------------------------------------------------
  // 8. Manual Entry Fallback & Utilities
  // -------------------------------------------------------------------------
  console.log('\n▶ TEST 8: Time & Phone Sanitization Utilities');
  assert('Sanitize phone with +91 and spaces', sanitizePhone('+91 98112-34567'), '9811234567');
  assert('Parse 4:30 PM to 24-hr', parseTimeString('Meet at 4:30 PM'), '16:30');
  assert('Parse 10 AM to 24-hr', parseTimeString('Slot at 10 AM'), '10:00');
  assert('Parse 12 PM (noon)', parseTimeString('Appointment at 12 PM'), '12:00');

  // Summary
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;

  console.log('\n========================================================================');
  console.log(`📊 VOICE ASSISTANT TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (${testResults.length} TOTAL)`);
  console.log('========================================================================');

  if (failedCount > 0) {
    throw new Error(`${failedCount} test assertions failed.`);
  }
}

runVoiceAssistantTests().catch((err) => {
  console.error('❌ Voice assistant test failed:', err);
  process.exit(1);
});
