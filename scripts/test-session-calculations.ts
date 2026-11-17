import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

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

async function runSessionCalculationTests() {
  const env = loadEnvFile(path.join(__dirname, '../.env.local'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('========================================================================');
  console.log('🧪 PHYSIO VOICE: SESSION CALCULATION & ATTENDANCE TEST SUITE');
  console.log('========================================================================\n');

  // Setup: Create isolated test therapist
  const testEmail = `dr.calc.test.${Date.now()}@physiovoice.in`;
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'DemoPassword2026!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Dr. Neha Sharma, Session Calc Verifier',
      clinic_name: 'Sharma Joint & Spine Care',
    },
  });

  if (authErr || !authUser.user) {
    throw new Error(`Failed to create test user: ${authErr?.message}`);
  }
  const therapistId = authUser.user.id;

  // Setup: Register a test patient
  const { data: patient, error: patientErr } = await supabase
    .from('patients')
    .insert({
      therapist_id: therapistId,
      full_name: 'Aditya Kulkarni',
      phone: '9870001122',
      age: 38,
      gender: 'MALE',
      occupation: 'IT Consultant',
    })
    .select()
    .single();

  if (patientErr || !patient) {
    throw new Error(`Failed to create test patient: ${patientErr?.message}`);
  }

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Initial 10-Session Package Creation
    // -------------------------------------------------------------------------
    console.log('▶ TEST SCENARIO 1: Initial 10-Session Package State');
    const { data: ep1, error: ep1Err } = await supabase
      .from('treatment_episodes')
      .insert({
        therapist_id: therapistId,
        patient_id: patient.id,
        title: 'Lumbar L4-L5 Disc Rehabilitation',
        chief_complaint: 'Lower back stiffness and radicular leg pain',
        affected_body_part: 'Lumbar Spine',
        total_package_sessions: 10,
        attended_sessions: 0,
        package_fee: 6500,
        payment_status: 'PAID',
      })
      .select()
      .single();

    if (ep1Err || !ep1) throw new Error(`Scenario 1 setup failed: ${ep1Err?.message}`);

    assert('Total package sessions should be 10', ep1.total_package_sessions, 10);
    assert('Initial attended sessions should be 0', ep1.attended_sessions, 0);
    assert('Initial remaining sessions should be 10', ep1.remaining_sessions, 10);

    // -------------------------------------------------------------------------
    // SCENARIO 2: Booking appointment with SCHEDULED status (Must NOT decrease sessions)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 2: Booking Appointment with SCHEDULED status');
    const { data: apt1, error: apt1Err } = await supabase
      .from('appointments')
      .insert({
        therapist_id: therapistId,
        patient_id: patient.id,
        episode_id: ep1.id,
        scheduled_start: '2026-11-18T10:00:00Z',
        scheduled_end: '2026-11-18T10:45:00Z',
        status: 'SCHEDULED',
        notes: 'Session 1 - Initial assessment & manual traction',
      })
      .select()
      .single();

    if (apt1Err || !apt1) throw new Error(`Scenario 2 setup failed: ${apt1Err?.message}`);

    // Query episode to verify NO DECREASE
    const { data: epAfterSchedule } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('Appointment status is SCHEDULED', apt1.status, 'SCHEDULED');
    assert('SCHEDULED status must NOT decrease sessions (attended=0)', epAfterSchedule?.attended_sessions, 0);
    assert('SCHEDULED status preserves remaining sessions (remaining=10)', epAfterSchedule?.remaining_sessions, 10);

    // -------------------------------------------------------------------------
    // SCENARIO 3: Confirming Attendance as ATTENDED (Must decrease remaining by 1)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 3: Confirming Attendance as ATTENDED');
    // Insert attendance record as ATTENDED
    const { data: att1, error: att1Err } = await supabase
      .from('attendance')
      .insert({
        therapist_id: therapistId,
        patient_id: patient.id,
        episode_id: ep1.id,
        appointment_id: apt1.id,
        session_number: 1,
        attendance_status: 'ATTENDED',
      })
      .select()
      .single();

    if (att1Err || !att1) throw new Error(`Scenario 3 attendance insertion failed: ${att1Err?.message}`);

    // Update appointment status to COMPLETED/ATTENDED
    await supabase.from('appointments').update({ status: 'COMPLETED' }).eq('id', apt1.id);

    // Query episode to verify DECREMENT
    const { data: epAfterAttended } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('Attendance confirmed: attended_sessions increases to 1', epAfterAttended?.attended_sessions, 1);
    assert('Attendance confirmed: remaining_sessions decreases to 9', epAfterAttended?.remaining_sessions, 9);

    // -------------------------------------------------------------------------
    // SCENARIO 4: Idempotency / Prevent Duplicate Attendance Counting
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 4: Idempotency (Prevent Duplicate Attendance Decrement)');
    // Attempt to update the existing attendance record with ATTENDED again
    await supabase
      .from('attendance')
      .update({ attendance_status: 'ATTENDED', attendance_date: new Date().toISOString() })
      .eq('id', att1.id);

    const { data: epAfterDuplicate } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('Idempotent update: attended_sessions MUST NOT double-increment (still 1)', epAfterDuplicate?.attended_sessions, 1);
    assert('Idempotent update: remaining_sessions MUST NOT decrease again (still 9)', epAfterDuplicate?.remaining_sessions, 9);

    // -------------------------------------------------------------------------
    // SCENARIO 5: Changing Attendance from ATTENDED to NO_SHOW (Must RESTORE 1 session)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 5: Changing Status from ATTENDED to NO_SHOW (Session Restored)');
    // Update attendance record from ATTENDED to MISSED (No-Show)
    await supabase
      .from('attendance')
      .update({ attendance_status: 'MISSED' })
      .eq('id', att1.id);

    await supabase.from('appointments').update({ status: 'NO_SHOW' }).eq('id', apt1.id);

    const { data: epAfterNoShow } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('NO-SHOW transition: attended_sessions restored to 0', epAfterNoShow?.attended_sessions, 0);
    assert('NO-SHOW transition: remaining_sessions restored to 10', epAfterNoShow?.remaining_sessions, 10);

    // -------------------------------------------------------------------------
    // SCENARIO 6: Changing Status from NO_SHOW to CANCELLED (No Session Change)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 6: Changing Status from NO_SHOW to CANCELLED (No Delta)');
    await supabase
      .from('attendance')
      .update({ attendance_status: 'CANCELLED' })
      .eq('id', att1.id);

    await supabase.from('appointments').update({ status: 'CANCELLED' }).eq('id', apt1.id);

    const { data: epAfterCancelled } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('NO_SHOW -> CANCELLED: attended_sessions remains 0', epAfterCancelled?.attended_sessions, 0);
    assert('NO_SHOW -> CANCELLED: remaining_sessions remains 10', epAfterCancelled?.remaining_sessions, 10);

    // -------------------------------------------------------------------------
    // SCENARIO 7: Reactivating CANCELLED appointment to ATTENDED
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 7: Reactivating CANCELLED appointment to ATTENDED');
    await supabase
      .from('attendance')
      .update({ attendance_status: 'ATTENDED' })
      .eq('id', att1.id);

    await supabase.from('appointments').update({ status: 'COMPLETED' }).eq('id', apt1.id);

    const { data: epReactivated } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('CANCELLED -> ATTENDED: attended_sessions increments to 1', epReactivated?.attended_sessions, 1);
    assert('CANCELLED -> ATTENDED: remaining_sessions decrements to 9', epReactivated?.remaining_sessions, 9);

    // -------------------------------------------------------------------------
    // SCENARIO 8: Multiple Appointments & Independent Session Counting
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 8: Multiple Appointments (Apt A, Apt B, Apt C)');
    // Create Appointment 2 (attended)
    const { data: apt2 } = await supabase
      .from('appointments')
      .insert({
        therapist_id: therapistId,
        patient_id: patient.id,
        episode_id: ep1.id,
        scheduled_start: '2026-11-19T10:00:00Z',
        scheduled_end: '2026-11-19T10:45:00Z',
        status: 'COMPLETED',
      })
      .select()
      .single();

    await supabase.from('attendance').insert({
      therapist_id: therapistId,
      patient_id: patient.id,
      episode_id: ep1.id,
      appointment_id: apt2!.id,
      session_number: 2,
      attendance_status: 'ATTENDED',
    });

    // Create Appointment 3 (No-show: must NOT decrement)
    const { data: apt3 } = await supabase
      .from('appointments')
      .insert({
        therapist_id: therapistId,
        patient_id: patient.id,
        episode_id: ep1.id,
        scheduled_start: '2026-11-20T10:00:00Z',
        scheduled_end: '2026-11-20T10:45:00Z',
        status: 'NO_SHOW',
      })
      .select()
      .single();

    await supabase.from('attendance').insert({
      therapist_id: therapistId,
      patient_id: patient.id,
      episode_id: ep1.id,
      appointment_id: apt3!.id,
      session_number: 3,
      attendance_status: 'MISSED',
    });

    const { data: epMultiApts } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('2 attended + 1 no-show: attended_sessions should be exactly 2', epMultiApts?.attended_sessions, 2);
    assert('2 attended + 1 no-show: remaining_sessions should be exactly 8', epMultiApts?.remaining_sessions, 8);

    // -------------------------------------------------------------------------
    // SCENARIO 9: Package Exhaustion and Lower Bound Clamping (Never Negative)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST SCENARIO 9: Package Exhaustion & Zero-Floor Clamping');
    // Add 8 more attended sessions to reach 10 total attended
    for (let i = 3; i <= 10; i++) {
      await supabase.from('attendance').insert({
        therapist_id: therapistId,
        patient_id: patient.id,
        episode_id: ep1.id,
        session_number: i,
        attendance_status: 'ATTENDED',
      });
    }

    const { data: epExhausted } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('10 attended out of 10: attended_sessions = 10', epExhausted?.attended_sessions, 10);
    assert('10 attended out of 10: remaining_sessions = 0', epExhausted?.remaining_sessions, 0);

    // Over-exhaustion test: Insert an 11th attended session
    await supabase.from('attendance').insert({
      therapist_id: therapistId,
      patient_id: patient.id,
      episode_id: ep1.id,
      session_number: 11,
      attendance_status: 'ATTENDED',
    });

    const { data: epOverExhausted } = await supabase
      .from('treatment_episodes')
      .select('attended_sessions, remaining_sessions')
      .eq('id', ep1.id)
      .single();

    assert('11 attended sessions: attended_sessions = 11', epOverExhausted?.attended_sessions, 11);
    assert('Zero-floor clamp: remaining_sessions never drops below 0 (clamped at 0)', epOverExhausted?.remaining_sessions, 0);

  } finally {
    // Cleanup test records
    console.log('\n🧹 Cleaning up test fixtures...');
    await supabase.from('attendance').delete().eq('patient_id', patient.id);
    await supabase.from('appointments').delete().eq('patient_id', patient.id);
    await supabase.from('treatment_episodes').delete().eq('patient_id', patient.id);
    await supabase.from('patients').delete().eq('id', patient.id);
    await supabase.from('users').delete().eq('id', therapistId);
    await supabase.auth.admin.deleteUser(therapistId);
    console.log('✓ Cleanup complete. Zero leftover records.\n');
  }

  // Summary
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;

  console.log('========================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (${testResults.length} TOTAL)`);
  console.log('========================================================================');

  if (failedCount > 0) {
    throw new Error(`${failedCount} test assertions failed.`);
  }
}

runSessionCalculationTests().catch((err) => {
  console.error('\n❌ Test suite failed with exception:', err);
  process.exit(1);
});
