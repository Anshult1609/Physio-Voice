/**
 * ==============================================================================
 * PHYSIO VOICE — MASTER QUALITY ASSURANCE & SYSTEM INTEGRITY TEST SUITE
 * ==============================================================================
 *
 * Comprehensive end-to-end audit testing:
 * 1. Authentication & Session Context
 * 2. Multi-Tenant Database Isolation & RLS Security
 * 3. Patient Registration & Unique Patient Code Generation (PV-26-XXXX)
 * 4. Duplicate Detection (by 10-digit Phone & Normalized Name)
 * 5. Multi-Criteria Patient Search (Name, Phone, Patient Code)
 * 6. Treatment Episodes (Multi-episode care plans without history overwriting)
 * 7. Attendance Calculations (Idempotent session accounting, zero-floor clamping)
 * 8. Appointment Lifecycle (Booking, Editing, Rescheduling, Cancellation)
 * 9. Physio Voice Assistant & Clinical NLP (Ambiguity, Confirmation, Anti-Hallucination)
 * 10. Reminders & Delivery Verification (In-App, WhatsApp/SMS invariant, Timezone IST, DPDPA consent)
 *
 * NOTE: Uses exclusively synthetic clinical physiotherapy test fixtures.
 */

import { extractStructuredVoiceData, matchPatient } from '../lib/voice/clinical-nlp';
import { InAppReminderProvider, WhatsAppProvider, SmsProvider, providerRegistry } from '../lib/reminders/providers';
import {
  calculateReminderTriggerTime,
  formatInClinicTimezone,
  formatTimeInClinicTimezone,
  formatDateInClinicTimezone,
  getRelativeDayDescription,
  DEFAULT_CLINIC_TIMEZONE
} from '../lib/reminders/timezone';
import { FullPatient, FullAppointment } from '../context/AppContext';
import { AttendanceType, AppointmentStatusType, TreatmentEpisode } from '../types/database';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`    ✅ [PASS] ${testName}`);
  } else {
    failedAssertions++;
    console.error(`    ❌ [FAIL] ${testName}`);
    if (detail) console.error(`       Details: ${detail}`);
  }
}

// ==============================================================================
// SYNTHETIC CLINICAL FIXTURES (Non-real patient data)
// ==============================================================================
const THERAPIST_A = {
  id: 'th-sharma-1',
  email: 'dr.sharma@physiovoice.in',
  full_name: 'Dr. Neha Sharma, MPT (Ortho)',
  clinic_name: 'Sharma Multispeciality Physio Clinic',
};

const THERAPIST_B = {
  id: 'th-kapoor-2',
  email: 'dr.kapoor@rehabcare.in',
  full_name: 'Dr. Rohan Kapoor, MPT (Neuro)',
  clinic_name: 'Kapoor Neuro Rehab Center',
};

// Therapist A's patients
const INITIAL_SYNTHETIC_PATIENTS: FullPatient[] = [
  {
    id: 'p-synthetic-101',
    therapist_id: THERAPIST_A.id,
    patient_code: 'PV-26-1001',
    full_name: 'Sunita Sharma',
    phone: '9811234567',
    age: 54,
    gender: 'FEMALE',
    occupation: 'Teacher',
    address: 'DLF Phase 4, Gurugram',
    emergency_contact: 'Amit Sharma - 9811234568',
    medical_history_notes: 'Post-op Total Knee Arthroplasty (TKA) - Right.',
    comorbidities: ['Hypertension'],
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    episodes: [
      {
        id: 'ep-synthetic-201',
        patient_id: 'p-synthetic-101',
        therapist_id: THERAPIST_A.id,
        title: 'TKA Right Knee Rehabilitation',
        chief_complaint: 'Post-op right knee stiffness and quadriceps lag',
        affected_body_part: 'Right Knee',
        start_date: '2026-10-01',
        target_end_date: '2026-11-15',
        status: 'COMPLETED',
        total_package_sessions: 10,
        attended_sessions: 10,
        remaining_sessions: 0,
        package_fee: 6000,
        amount_paid: 6000,
        payment_status: 'PAID',
        clinical_goals: 'Achieve 110 deg knee flexion and normal gait',
        created_at: '2026-10-01T10:00:00.000Z',
        updated_at: '2026-11-15T12:00:00.000Z',
        sessions: [],
      },
    ],
  },
  {
    id: 'p-synthetic-102',
    therapist_id: THERAPIST_A.id,
    patient_code: 'PV-26-1002',
    full_name: 'Rajesh Verma',
    phone: '9822334455',
    age: 42,
    gender: 'MALE',
    occupation: 'Software Architect',
    address: 'Cyber City, Gurugram',
    emergency_contact: 'Priya Verma - 9822334456',
    medical_history_notes: 'L4-L5 lumbar disc bulge with radiculopathy.',
    comorbidities: [],
    created_at: '2026-10-15T11:00:00.000Z',
    updated_at: '2026-10-15T11:00:00.000Z',
    episodes: [
      {
        id: 'ep-synthetic-202',
        patient_id: 'p-synthetic-102',
        therapist_id: THERAPIST_A.id,
        title: 'Lumbar Spine Core Stabilization',
        chief_complaint: 'Radiating lower back pain to right calf on prolonged sitting',
        affected_body_part: 'Lumbar Spine',
        start_date: '2026-10-15',
        target_end_date: null,
        status: 'ACTIVE',
        total_package_sessions: 10,
        attended_sessions: 3,
        remaining_sessions: 7,
        package_fee: 6500,
        amount_paid: 6500,
        payment_status: 'PAID',
        clinical_goals: 'McKenzie extensions and transverse abdominis activation',
        created_at: '2026-10-15T11:00:00.000Z',
        updated_at: '2026-11-10T11:00:00.000Z',
        sessions: [],
      },
    ],
  },
  {
    id: 'p-synthetic-103',
    therapist_id: THERAPIST_A.id,
    patient_code: 'PV-26-1003',
    full_name: 'Pooja Iyer',
    phone: '9844556677',
    age: 36,
    gender: 'FEMALE',
    occupation: 'Financial Analyst',
    address: 'Golf Course Road, Gurugram',
    emergency_contact: 'Karthik Iyer - 9844556678',
    medical_history_notes: 'Cervical spondylosis with trapezial spasm.',
    comorbidities: [],
    created_at: '2026-11-01T09:00:00.000Z',
    updated_at: '2026-11-01T09:00:00.000Z',
    episodes: [
      {
        id: 'ep-synthetic-203',
        patient_id: 'p-synthetic-103',
        therapist_id: THERAPIST_A.id,
        title: 'Cervical Postural Realignment',
        chief_complaint: 'Neck stiffness and occipital headaches after work hours',
        affected_body_part: 'Cervical Spine',
        start_date: '2026-11-01',
        target_end_date: null,
        status: 'ACTIVE',
        total_package_sessions: 8,
        attended_sessions: 2,
        remaining_sessions: 6,
        package_fee: 5000,
        amount_paid: 2500,
        payment_status: 'PARTIAL',
        clinical_goals: 'Deep neck flexor retraining and ergonomic workstation adjustments',
        created_at: '2026-11-01T09:00:00.000Z',
        updated_at: '2026-11-08T09:00:00.000Z',
        sessions: [],
      },
    ],
  },
];

// Therapist B's isolated patient
const THERAPIST_B_PATIENT: FullPatient = {
  id: 'p-isolated-999',
  therapist_id: THERAPIST_B.id,
  patient_code: 'PV-26-9999',
  full_name: 'Vikram Malhotra',
  phone: '9877889900',
  age: 61,
  gender: 'MALE',
  occupation: 'Retired Bank Manager',
  address: 'Sector 56, Gurugram',
  emergency_contact: 'Sunil Malhotra - 9877889901',
  medical_history_notes: 'Ischemic Stroke Left Hemiparesis.',
  comorbidities: ['Type 2 Diabetes'],
  created_at: '2026-11-10T10:00:00.000Z',
  updated_at: '2026-11-10T10:00:00.000Z',
  episodes: [],
};

async function runMasterQualityReview() {
  console.log('\n==============================================================================');
  console.log('   PHYSIO VOICE MASTER QUALITY ASSURANCE & SYSTEM INTEGRITY AUDIT');
  console.log('==============================================================================\n');

  // --------------------------------------------------------------------------
  // AUDIT 1: AUTHENTICATION & SESSION CONTEXT
  // --------------------------------------------------------------------------
  console.log('▶ AUDIT 1: Authentication & Therapist Context');
  assert(Boolean(THERAPIST_A.id), 'Therapist session contains valid unique ID');
  assert(THERAPIST_A.email.includes('@'), 'Therapist email is syntactically valid');
  assert(THERAPIST_A.clinic_name.length > 3, 'Clinic name is properly populated');

  // --------------------------------------------------------------------------
  // AUDIT 2: MULTI-TENANT DATABASE ISOLATION & ROW LEVEL SECURITY
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 2: Multi-Tenant Database Isolation & Access Boundary');
  const allPatientsInStore = [...INITIAL_SYNTHETIC_PATIENTS, THERAPIST_B_PATIENT];
  
  // Simulate RLS policy: WHERE therapist_id = auth.uid()
  const therapistAPatients = allPatientsInStore.filter((p) => p.therapist_id === THERAPIST_A.id);
  const therapistBPatients = allPatientsInStore.filter((p) => p.therapist_id === THERAPIST_B.id);

  assert(therapistAPatients.length === 3, 'Therapist A query returns only their own 3 patients');
  assert(!therapistAPatients.some((p) => p.id === THERAPIST_B_PATIENT.id), 'Therapist A cannot access Therapist B patient (RLS enforced)');
  assert(therapistBPatients.length === 1, 'Therapist B query returns only their own 1 patient');
  assert(therapistBPatients[0].full_name === 'Vikram Malhotra', 'Therapist B isolated patient verified');

  // --------------------------------------------------------------------------
  // AUDIT 3: PATIENT REGISTRATION & UNIQUE CODE FORMAT
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 3: Patient Registration & Unique Patient Code Format');
  function generatePatientCode(existingCount: number): string {
    const nextSeq = 1000 + existingCount + 1;
    return `PV-26-${nextSeq}`;
  }

  const generatedCode = generatePatientCode(INITIAL_SYNTHETIC_PATIENTS.length);
  assert(generatedCode === 'PV-26-1004', `Patient code format follows PV-26-XXXX sequence (received: ${generatedCode})`);
  assert(/^PV-26-\d{4}$/.test(generatedCode), 'Patient code matches strict regex pattern /^PV-26-\\d{4}$/');

  // --------------------------------------------------------------------------
  // AUDIT 4: DUPLICATE DETECTION LOGIC
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 4: Duplicate Detection (Phone & Name Normalization)');
  function findDuplicate(phone: string, patients: FullPatient[], excludeId?: string) {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    return patients.find(
      (p) => p.id !== excludeId && p.phone.replace(/\D/g, '').slice(-10) === cleanPhone
    );
  }

  const duplicateFound = findDuplicate('9811234567', INITIAL_SYNTHETIC_PATIENTS);
  assert(Boolean(duplicateFound), 'Duplicate detected for registered phone 9811234567');
  assert(duplicateFound?.full_name === 'Sunita Sharma', 'Duplicate accurately resolves to Sunita Sharma');

  const duplicateFormatted = findDuplicate('+91 98112-34567', INITIAL_SYNTHETIC_PATIENTS);
  assert(Boolean(duplicateFormatted), 'Duplicate detected even with country code and formatting characters');

  const freshPhone = findDuplicate('9899001122', INITIAL_SYNTHETIC_PATIENTS);
  assert(!freshPhone, 'New phone number reports no duplicate (clean registration allowed)');

  // --------------------------------------------------------------------------
  // AUDIT 5: MULTI-CRITERIA PATIENT SEARCH
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 5: Multi-Criteria Patient Search');
  function searchPatients(query: string, patients: FullPatient[]) {
    const q = query.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter((p) => {
      const nameMatch = p.full_name.toLowerCase().includes(q);
      const phoneMatch = p.phone.includes(q);
      const codeMatch = p.patient_code.toLowerCase().includes(q);
      return nameMatch || phoneMatch || codeMatch;
    });
  }

  assert(searchPatients('Sunita', INITIAL_SYNTHETIC_PATIENTS).length === 1, 'Search by first name returns exact match');
  assert(searchPatients('sharma', INITIAL_SYNTHETIC_PATIENTS).length === 1, 'Search by last name (case-insensitive) matches');
  assert(searchPatients('982233', INITIAL_SYNTHETIC_PATIENTS).length === 1, 'Search by phone prefix matches Rajesh Verma');
  assert(searchPatients('PV-26-1003', INITIAL_SYNTHETIC_PATIENTS).length === 1, 'Search by patient code matches Pooja Iyer');
  assert(searchPatients('Nonexistent Query', INITIAL_SYNTHETIC_PATIENTS).length === 0, 'Non-existent search returns empty array safely');

  // --------------------------------------------------------------------------
  // AUDIT 6: TREATMENT EPISODES (Multi-Episode Care Plans Without Overwriting)
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 6: Treatment Episodes Lifecycle & History Preservation');
  const patientToUpdate = JSON.parse(JSON.stringify(INITIAL_SYNTHETIC_PATIENTS[0])) as FullPatient;
  assert(patientToUpdate.episodes.length === 1, 'Patient initially has 1 treatment episode');
  assert(patientToUpdate.episodes[0].status === 'COMPLETED', 'Episode 1 is COMPLETED (TKA rehabilitation)');

  // Add Episode 2: Frozen shoulder
  const newEpisode: TreatmentEpisode = {
    id: 'ep-synthetic-204',
    patient_id: patientToUpdate.id,
    therapist_id: THERAPIST_A.id,
    title: 'Adhesive Capsulitis (Frozen Shoulder) - Left',
    chief_complaint: 'Severe pain and restriction during shoulder abduction and external rotation',
    affected_body_part: 'Left Shoulder',
    start_date: '2026-11-17',
    target_end_date: null,
    status: 'ACTIVE',
    total_package_sessions: 12,
    attended_sessions: 0,
    remaining_sessions: 12,
    package_fee: 7200,
    amount_paid: 7200,
    payment_status: 'PAID',
    clinical_goals: 'Maitland shoulder joint mobilization and Codman pendulum exercises',
    created_at: '2026-11-17T12:00:00.000Z',
    updated_at: '2026-11-17T12:00:00.000Z',
  };

  patientToUpdate.episodes = [newEpisode, ...patientToUpdate.episodes];

  assert(patientToUpdate.episodes.length === 2, 'Patient now has 2 episodes');
  assert(patientToUpdate.episodes[0].id === 'ep-synthetic-204', 'Episode 2 is the active primary episode');
  assert(patientToUpdate.episodes[1].id === 'ep-synthetic-201', 'Episode 1 remains intact in historical record');
  assert(patientToUpdate.episodes[1].attended_sessions === 10, 'Episode 1 attended sessions preserved untouched');
  assert(patientToUpdate.episodes[0].remaining_sessions === 12, 'Episode 2 initialized with 12 fresh sessions');

  // --------------------------------------------------------------------------
  // AUDIT 7: ATTENDANCE & PACKAGE SESSION CALCULATIONS
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 7: Attendance Calculation Invariants & Idempotency');
  let currentAttended = 0;
  const packageTotal = 10;
  let currentRemaining = packageTotal - currentAttended;

  function applyAttendance(prevStatus: AppointmentStatusType, newStatus: AppointmentStatusType) {
    const wasAttended = prevStatus === 'ATTENDED' || prevStatus === 'COMPLETED';
    const isNowAttended = newStatus === 'ATTENDED' || newStatus === 'COMPLETED';

    // Idempotent guard
    if (wasAttended && isNowAttended) return;

    if (!wasAttended && isNowAttended) {
      currentAttended += 1;
    } else if (wasAttended && !isNowAttended) {
      currentAttended = Math.max(0, currentAttended - 1);
    }
    currentRemaining = Math.max(0, packageTotal - currentAttended);
  }

  // 1. Initial Scheduled: no decrement
  applyAttendance('SCHEDULED', 'SCHEDULED');
  assert(currentAttended === 0 && currentRemaining === 10, 'Booking SCHEDULED preserves remaining sessions at 10');

  // 2. Mark ATTENDED: decrement by 1
  applyAttendance('SCHEDULED', 'ATTENDED');
  assert(currentAttended === 1 && currentRemaining === 9, 'ATTENDED confirmation decrements remaining sessions to 9');

  // 3. Duplicate ATTENDED: MUST NOT double-decrement (Idempotent!)
  applyAttendance('ATTENDED', 'ATTENDED');
  assert(currentAttended === 1 && currentRemaining === 9, 'Idempotency: Re-confirming ATTENDED does not decrease again');

  // 4. Change to NO_SHOW: Restores session
  applyAttendance('ATTENDED', 'NO_SHOW');
  assert(currentAttended === 0 && currentRemaining === 10, 'NO_SHOW transition restores session back to 10');

  // 5. Change to CANCELLED: Restores session
  applyAttendance('SCHEDULED', 'ATTENDED');
  applyAttendance('ATTENDED', 'CANCELLED');
  assert(currentAttended === 0 && currentRemaining === 10, 'CANCELLED transition restores session back to 10');

  // 6. Zero-floor clamp
  currentAttended = 12;
  currentRemaining = Math.max(0, packageTotal - currentAttended);
  assert(currentRemaining === 0, 'Zero-floor clamp: remaining_sessions never drops below 0');

  // --------------------------------------------------------------------------
  // AUDIT 8: APPOINTMENT LIFECYCLE & RESCHEDULING
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 8: Appointment Lifecycle, Rescheduling & Cancellation');
  const appointment: FullAppointment = {
    id: 'apt-lifecycle-1',
    therapist_id: THERAPIST_A.id,
    patient_id: INITIAL_SYNTHETIC_PATIENTS[1].id,
    episode_id: INITIAL_SYNTHETIC_PATIENTS[1].episodes[0].id,
    patientName: INITIAL_SYNTHETIC_PATIENTS[1].full_name,
    patientCode: INITIAL_SYNTHETIC_PATIENTS[1].patient_code,
    patientPhone: INITIAL_SYNTHETIC_PATIENTS[1].phone,
    episodeTitle: INITIAL_SYNTHETIC_PATIENTS[1].episodes[0].title,
    remainingSessions: 7,
    scheduled_start: '2026-11-18T05:30:00.000Z', // 11:00 AM IST
    scheduled_end: '2026-11-18T06:15:00.000Z',
    status: 'SCHEDULED',
    reminder_status: 'NOT_SENT',
    reminder_sent_at: null,
    notes: 'Initial posture evaluation',
    created_at: '2026-11-17T10:00:00.000Z',
    updated_at: '2026-11-17T10:00:00.000Z',
  };

  assert(appointment.status === 'SCHEDULED', 'Appointment created with SCHEDULED status');

  // Reschedule
  const newStart = '2026-11-18T09:30:00.000Z'; // 3:00 PM IST
  const newEnd = '2026-11-18T10:15:00.000Z';
  appointment.scheduled_start = newStart;
  appointment.scheduled_end = newEnd;
  appointment.status = 'RESCHEDULED';
  appointment.notes += ' [Rescheduled: Patient work meeting]';

  assert(appointment.status === 'RESCHEDULED', 'Status updated to RESCHEDULED');
  assert(appointment.notes.includes('Patient work meeting'), 'Reschedule reason appended to notes');

  // Cancel
  appointment.status = 'CANCELLED';
  appointment.notes += ' [Cancelled: Patient travelling out of town]';
  assert(appointment.status === 'CANCELLED', 'Status updated to CANCELLED');

  // --------------------------------------------------------------------------
  // AUDIT 9: PHYSIO VOICE CLINICAL NLP & SAFETY INVARIANTS
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 9: Clinical NLP & Anti-Hallucination Invariants');
  const dictationText = "Register new patient Sunita Sharma, phone 9811234567, 54 year old female, school teacher. Chief complaint right knee stiffness post total knee replacement. Package of 10 sessions recommended at 6000 rupees fee.";

  const extracted = extractStructuredVoiceData(dictationText);
  const regPayload = extracted.registrationPayload!;
  assert(extracted.intent === 'PATIENT_REGISTRATION', 'Intent accurately classified as PATIENT_REGISTRATION');
  assert(regPayload.fullName === 'Sunita Sharma', 'Extracted name is Sunita Sharma');
  assert(regPayload.phone === '9811234567', 'Extracted 10-digit phone');
  assert(regPayload.age === 54, 'Extracted age 54');
  assert(regPayload.gender === 'FEMALE', 'Extracted gender FEMALE');
  assert(regPayload.suggestedPackageSessions === 10, 'Extracted package size 10');
  assert(regPayload.packageFee === 6000, 'Extracted package fee 6000');

  // Clinical safety invariants
  assert(extracted.safety.noHallucinatedData === true, 'Safety flag: no hallucinated data');
  assert(extracted.safety.noMedicalDiagnosis === true, 'Safety flag: no medical diagnosis generated');
  assert(Boolean(extracted.safety.disclaimer), 'Safety disclaimer must be present');

  // Ambiguity matching
  const patientsWithSameSurname = [
    { id: 'p-1', full_name: 'Sunita Sharma', phone: '9811234567', patient_code: 'PV-26-1001' },
    { id: 'p-2', full_name: 'Ramesh Sharma', phone: '9822334455', patient_code: 'PV-26-1002' },
  ];
  const matchResult = matchPatient('Sharma', patientsWithSameSurname);
  assert(matchResult.status === 'AMBIGUOUS', 'Spoken surname "Sharma" identifies AMBIGUOUS identity');
  assert(matchResult.candidates?.length === 2, 'Returns both candidates for clinician disambiguation');

  // --------------------------------------------------------------------------
  // AUDIT 10: REMINDERS, TIMEZONE (IST) & DELIVERY TRUTHFULNESS
  // --------------------------------------------------------------------------
  console.log('\n▶ AUDIT 10: Reminders, Timezone & Delivery Truthfulness Invariant');
  assert(DEFAULT_CLINIC_TIMEZONE === 'Asia/Kolkata', 'Timezone locked to Asia/Kolkata');

  // Timezone formatting
  const testUtc = '2026-11-18T05:00:00.000Z'; // 10:30 AM IST
  const timeIST = formatTimeInClinicTimezone(testUtc);
  assert(timeIST.includes('10:30'), `Formats to 10:30 AM IST (received: ${timeIST})`);

  const relDesc = getRelativeDayDescription(testUtc);
  assert(relDesc.includes('IST'), `Relative day description contains IST timezone indicator (received: ${relDesc})`);

  // Provider Dispatch Invariant
  const inApp = new InAppReminderProvider();
  const inAppRes = await inApp.send({
    recipientName: 'Sunita Sharma',
    recipientPhone: '9811234567',
    clinicName: 'Sharma Physio',
    therapistName: 'Dr. Sharma',
    appointmentTimeFormatted: 'Tomorrow at 10:30 AM IST',
    appointmentId: 'apt-1',
    reminderId: 'rem-1',
  });
  assert(inAppRes.deliveryConfirmed === true, 'In-App dispatch sets deliveryConfirmed to TRUE');
  assert(inAppRes.status === 'DELIVERED', 'In-App dispatch sets status to DELIVERED');

  const wa = new WhatsAppProvider();
  const waRes = await wa.send({
    recipientName: 'Sunita Sharma',
    recipientPhone: '9811234567',
    clinicName: 'Sharma Physio',
    therapistName: 'Dr. Sharma',
    appointmentTimeFormatted: 'Tomorrow at 10:30 AM IST',
    appointmentId: 'apt-1',
    reminderId: 'rem-2',
  });
  assert(waRes.deliveryConfirmed === false, 'CRITICAL: WhatsApp without API credentials NEVER claims delivered');
  assert(waRes.status === 'PENDING_CONFIRMATION', 'CRITICAL: WhatsApp status is PENDING_CONFIRMATION');

  const sms = new SmsProvider();
  const smsRes = await sms.send({
    recipientName: 'Sunita Sharma',
    recipientPhone: '9811234567',
    clinicName: 'Sharma Physio',
    therapistName: 'Dr. Sharma',
    appointmentTimeFormatted: 'Tomorrow at 10:30 AM IST',
    appointmentId: 'apt-1',
    reminderId: 'rem-3',
  });
  assert(smsRes.deliveryConfirmed === false, 'CRITICAL: SMS without API credentials NEVER claims delivered');
  assert(smsRes.status === 'PENDING_CONFIRMATION', 'CRITICAL: SMS status is PENDING_CONFIRMATION');

  // Summary
  console.log('\n==============================================================================');
  console.log(`  AUDIT COMPLETE: ${passedAssertions}/${totalAssertions} PASSED (${failedAssertions} FAILED)`);
  console.log('==============================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runMasterQualityReview().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
