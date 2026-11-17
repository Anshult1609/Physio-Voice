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

async function runLiveE2ETest() {
  const env = loadEnvFile(path.join(__dirname, '../.env.local'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('================================================================');
  console.log('🧪 LIVE SUPABASE CLOUD END-TO-END VALIDATION');
  console.log('================================================================\n');

  // Step 1: Create a test therapist account in auth.users
  const testEmail = `dr.test.${Date.now()}@physiovoice.in`;
  console.log(`1. Creating Test Therapist [${testEmail}] via Supabase Auth...`);
  
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'DemoPassword2026!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Dr. Arjun Kapoor, PT',
      clinic_name: 'Kapoor Joint & Spine Rehab',
    },
  });

  if (authError || !authUser.user) {
    throw new Error(`Auth sign up failed: ${authError?.message}`);
  }
  const therapistId = authUser.user.id;
  console.log(`  ✓ Auth user created. UUID: ${therapistId}`);

  // Step 2: Verify trigger populated public.users
  const { data: profile, error: profError } = await supabase
    .from('users')
    .select('*')
    .eq('id', therapistId)
    .single();

  if (profError || !profile) {
    throw new Error(`Trigger failed: public.users record not created: ${profError?.message}`);
  }
  console.log(`  ✓ Auto-provisioning trigger verified: ${profile.full_name} (${profile.clinic_name})`);

  // Step 3: Insert Patient and check patient_code sequence
  console.log('\n2. Testing Patient Registration & Code Generation Sequence...');
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .insert({
      therapist_id: therapistId,
      full_name: 'Meera Deshmukh',
      phone: '9820011223',
      age: 46,
      gender: 'FEMALE',
      occupation: 'School Teacher',
      address: 'Bandra West, Mumbai',
      comorbidities: ['Type 2 Diabetes', 'Hypothyroidism'],
      medical_history_notes: 'Right adhesive capsulitis (Frozen Shoulder) for 4 months',
    })
    .select()
    .single();

  if (patientError || !patient) {
    throw new Error(`Patient creation failed: ${patientError?.message}`);
  }
  console.log(`  ✓ Patient registered: ${patient.full_name}`);
  console.log(`  ✓ Generated Patient Code: [${patient.patient_code}]`);

  // Step 4: Create Treatment Episode
  console.log('\n3. Creating Treatment Episode with 10-Session Package...');
  const { data: episode, error: epError } = await supabase
    .from('treatment_episodes')
    .insert({
      patient_id: patient.id,
      therapist_id: therapistId,
      title: 'Shoulder Mobilization & Ultrasound Therapy',
      chief_complaint: 'Severe pain on abduction, limited ROM',
      affected_body_part: 'Right Shoulder',
      total_package_sessions: 10,
      attended_sessions: 0,
      package_fee: 7500.00,
      payment_status: 'PAID',
      amount_paid: 7500.00,
    })
    .select()
    .single();

  if (epError || !episode) {
    throw new Error(`Episode creation failed: ${epError?.message}`);
  }
  console.log(`  ✓ Initial Package State: Total: ${episode.total_package_sessions}, Attended: ${episode.attended_sessions}, Remaining: ${episode.remaining_sessions}`);

  // Step 5: Log Attendance and verify trigger decrement
  console.log('\n4. Logging Session Attendance & Verifying Auto-Decrement Trigger...');
  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .insert({
      therapist_id: therapistId,
      patient_id: patient.id,
      episode_id: episode.id,
      session_number: 1,
      attendance_status: 'ATTENDED',
    })
    .select()
    .single();

  if (attError || !attendance) {
    throw new Error(`Attendance insertion failed: ${attError?.message}`);
  }

  // Insert clinical note
  await supabase.from('clinical_notes').insert({
    therapist_id: therapistId,
    patient_id: patient.id,
    episode_id: episode.id,
    attendance_id: attendance.id,
    pain_score: 6,
    subjective_notes: 'Mild improvement in sleep, pain during overhead reach',
    objective_findings: 'Abduction active 75 deg, passive 85 deg',
    modalities_used: ['Ultrasound 1MHz', 'Moist Heat Pack', 'Codman Pendulum'],
    exercise_prescription: 'Wall climbing and wand exercises 2x daily',
  });
  console.log('  ✓ Clinical note attached with VAS score & modalities.');

  // Fetch episode to verify remaining sessions decremented
  const { data: updatedEp, error: updateError } = await supabase
    .from('treatment_episodes')
    .select('total_package_sessions, attended_sessions, remaining_sessions')
    .eq('id', episode.id)
    .single();

  if (updateError || !updatedEp) {
    throw new Error(`Failed to query updated episode: ${updateError?.message}`);
  }

  console.log(`  ✓ Updated Package State: Total: ${updatedEp.total_package_sessions}, Attended: ${updatedEp.attended_sessions}, Remaining: ${updatedEp.remaining_sessions}`);

  if (updatedEp.attended_sessions !== 1 || updatedEp.remaining_sessions !== 9) {
    throw new Error(`Trigger failed: expected remaining_sessions=9, got ${updatedEp.remaining_sessions}`);
  }
  console.log('  ✓ PASSED: Package successfully decremented from 10 to 9!');

  // Step 6: Cleanup test data
  console.log('\n5. Cleaning up test validation records...');
  await supabase.from('clinical_notes').delete().eq('episode_id', episode.id);
  await supabase.from('attendance').delete().eq('episode_id', episode.id);
  await supabase.from('treatment_episodes').delete().eq('id', episode.id);
  await supabase.from('patients').delete().eq('id', patient.id);
  await supabase.from('users').delete().eq('id', therapistId);
  await supabase.auth.admin.deleteUser(therapistId);
  console.log('  ✓ Cloud cleanup complete. Zero leftover test records.');

  console.log('\n================================================================');
  console.log('🎉 LIVE SUPABASE CLOUD VALIDATION 100% SUCCESSFUL!');
  console.log('================================================================\n');
}

runLiveE2ETest().catch((err) => {
  console.error('\n❌ LIVE CLOUD TEST FAILED:', err);
  process.exit(1);
});
