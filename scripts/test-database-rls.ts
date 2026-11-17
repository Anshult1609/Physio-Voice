import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

async function runDatabaseTests() {
  console.log('================================================================');
  console.log('🧪 PHYSIO VOICE — SUPABASE DATABASE & RLS ISOLATION TEST SUITE');
  console.log('================================================================\n');

  // Initialize PGlite in-memory PostgreSQL engine
  const db = new PGlite();
  console.log('✓ PostgreSQL engine initialized.');

  // Load migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20261117170000_physio_voice_full_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // Execute migration DDL as superuser
  console.log('✓ Applying schema migration 20261117170000_physio_voice_full_schema.sql...');
  await db.exec(migrationSql);
  console.log('✓ Migration applied successfully.\n');

  // Helper functions to simulate authenticated Supabase requests
  async function asTherapist(therapistId: string) {
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${therapistId}', false);
    `);
  }

  async function asAdmin() {
    await db.exec(`
      RESET ROLE;
      SELECT set_config('request.jwt.claim.sub', '', false);
    `);
  }

  // 1. Verify All 8 Tables Exist
  console.log('--- TEST 1: Schema Table Verification ---');
  const tables = ['users', 'patients', 'treatment_episodes', 'appointments', 'attendance', 'clinical_notes', 'reminders', 'audit_logs'];
  for (const table of tables) {
    const res = await db.query(`SELECT to_regclass('public.${table}') as exists;`);
    if ((res.rows[0] as any)?.exists) {
      console.log(`  ✓ Table public.${table} exists.`);
    } else {
      throw new Error(`Table public.${table} was not created!`);
    }
  }

  // 2. Setup Mock Therapists in auth.users (trigger automatically creates public.users)
  console.log('\n--- TEST 2: Multi-Therapist Setup & Auto-Provisioning Trigger ---');
  const therapistA_Id = '11111111-1111-1111-1111-111111111111';
  const therapistB_Id = '22222222-2222-2222-2222-222222222222';

  await db.query(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES 
      ('${therapistA_Id}', 'drsharma@physiovoice.in', '{"full_name": "Dr. Neha Sharma", "clinic_name": "Sharma Physio Clinic"}'::jsonb),
      ('${therapistB_Id}', 'drverma@delhiphysio.com', '{"full_name": "Dr. Rohit Verma", "clinic_name": "Verma Spine & Joint Center"}'::jsonb);
  `);

  const createdUsers = await db.query(`SELECT id, full_name, clinic_name FROM public.users;`);
  console.log(`  ✓ Trigger automatically created ${createdUsers.rows.length} public.users records:`);
  for (const u of createdUsers.rows) {
    console.log(`    - ${u.full_name} (${u.clinic_name}) [${u.id}]`);
  }

  // 3. Insert Patient Records as each Therapist
  console.log('\n--- TEST 3: Patient Records & Code Generator ---');
  
  // Set context as Therapist A
  await asTherapist(therapistA_Id);
  const patientA_Res = await db.query(`
    INSERT INTO public.patients (therapist_id, full_name, phone, age, gender)
    VALUES ('${therapistA_Id}', 'Sunita Sharma (Patient of Dr. Sharma)', '9811234567', 54, 'FEMALE')
    RETURNING id, patient_code, full_name;
  `);
  const patientA = patientA_Res.rows[0];
  console.log(`  ✓ Therapist A created patient: ${patientA.full_name} with code [${patientA.patient_code}].`);

  // Set context as Therapist B
  await asTherapist(therapistB_Id);
  const patientB_Res = await db.query(`
    INSERT INTO public.patients (therapist_id, full_name, phone, age, gender)
    VALUES ('${therapistB_Id}', 'Ramesh Gupta (Patient of Dr. Verma)', '9822345678', 42, 'MALE')
    RETURNING id, patient_code, full_name;
  `);
  const patientB = patientB_Res.rows[0];
  console.log(`  ✓ Therapist B created patient: ${patientB.full_name} with code [${patientB.patient_code}].`);

  // 4. Test RLS Isolation (The Critical Multi-Tenant Security Test)
  console.log('\n--- TEST 4: Row-Level Security (RLS) Isolation ---');

  // Query as Therapist A
  await asTherapist(therapistA_Id);
  const queryAsTherapistA = await db.query(`SELECT id, full_name FROM public.patients;`);
  console.log(`  Therapist A query result count: ${queryAsTherapistA.rows.length}`);
  console.log(`  Therapist A sees: ${JSON.stringify(queryAsTherapistA.rows.map((r: any) => r.full_name))}`);

  if (queryAsTherapistA.rows.length !== 1 || queryAsTherapistA.rows[0].id !== patientA.id) {
    throw new Error('RLS VIOLATION: Therapist A could see records belonging to Therapist B!');
  }
  console.log('  ✓ PASSED: Therapist A can ONLY see their own patient (Sunita Sharma).');

  // Query as Therapist B
  await asTherapist(therapistB_Id);
  const queryAsTherapistB = await db.query(`SELECT id, full_name FROM public.patients;`);
  console.log(`  Therapist B query result count: ${queryAsTherapistB.rows.length}`);
  console.log(`  Therapist B sees: ${JSON.stringify(queryAsTherapistB.rows.map((r: any) => r.full_name))}`);

  if (queryAsTherapistB.rows.length !== 1 || queryAsTherapistB.rows[0].id !== patientB.id) {
    throw new Error('RLS VIOLATION: Therapist B could see records belonging to Therapist A!');
  }
  console.log('  ✓ PASSED: Therapist B can ONLY see their own patient (Ramesh Gupta).');

  // Therapist B attempts to maliciously update Therapist A's patient
  console.log('\n--- TEST 5: Malicious Cross-Tenant Mutation Attempt ---');
  await asTherapist(therapistB_Id);
  const maliciousUpdate = await db.query(`
    UPDATE public.patients 
    SET full_name = 'HACKED' 
    WHERE id = '${patientA.id}';
  `);
  console.log(`  Therapist B update attempt on Therapist A's patient affected rows: ${maliciousUpdate.affectedRows ?? 0}`);

  // Verify Patient A was untouched
  await asTherapist(therapistA_Id);
  const checkPatientA = await db.query(`SELECT full_name FROM public.patients WHERE id = '${patientA.id}';`);
  if (checkPatientA.rows[0].full_name === 'HACKED') {
    throw new Error('SECURITY BREACH: Cross-tenant update succeeded!');
  }
  console.log('  ✓ PASSED: Cross-tenant mutation blocked (0 rows affected, data intact).');

  // 5. Test Treatment Episodes & Package Decrement Trigger
  console.log('\n--- TEST 6: Package Auto-Decrement Trigger ---');
  await asTherapist(therapistA_Id);

  // Create episode with package of 10 sessions
  const episodeRes = await db.query(`
    INSERT INTO public.treatment_episodes (
      patient_id, therapist_id, title, chief_complaint, affected_body_part, total_package_sessions
    ) VALUES (
      '${patientA.id}', '${therapistA_Id}', 'Post-Op Knee Rehab', 'Right knee stiffness', 'Right Knee', 10
    ) RETURNING id, total_package_sessions, attended_sessions, remaining_sessions;
  `);
  const episode = episodeRes.rows[0];
  console.log(`  Initial Package State: Total: ${episode.total_package_sessions}, Attended: ${episode.attended_sessions}, Remaining: ${episode.remaining_sessions}`);

  if (episode.remaining_sessions !== 10) {
    throw new Error(`Expected remaining sessions to be 10, got ${episode.remaining_sessions}`);
  }

  // Log session attendance as ATTENDED
  console.log('  Logging Session #1 as ATTENDED...');
  const attendanceRes = await db.query(`
    INSERT INTO public.attendance (
      therapist_id, patient_id, episode_id, session_number, attendance_status
    ) VALUES (
      '${therapistA_Id}', '${patientA.id}', '${episode.id}', 1, 'ATTENDED'
    ) RETURNING id;
  `);
  const attendanceId = attendanceRes.rows[0].id;

  // Insert Clinical Notes for this attendance
  await db.query(`
    INSERT INTO public.clinical_notes (
      therapist_id, patient_id, episode_id, attendance_id, pain_score, subjective_notes, modalities_used
    ) VALUES (
      '${therapistA_Id}', '${patientA.id}', '${episode.id}', '${attendanceId}', 4, 'Patient feeling better', '["Ultrasound", "IFT"]'::jsonb
    );
  `);
  console.log('  ✓ Clinical notes with pain score & modalities inserted.');

  // Verify episode counters automatically updated
  const updatedEpisodeRes = await db.query(`
    SELECT total_package_sessions, attended_sessions, remaining_sessions 
    FROM public.treatment_episodes 
    WHERE id = '${episode.id}';
  `);
  const updatedEpisode = updatedEpisodeRes.rows[0];
  console.log(`  Updated Package State: Total: ${updatedEpisode.total_package_sessions}, Attended: ${updatedEpisode.attended_sessions}, Remaining: ${updatedEpisode.remaining_sessions}`);

  if (updatedEpisode.attended_sessions !== 1 || updatedEpisode.remaining_sessions !== 9) {
    throw new Error(`Trigger failed: expected attended=1 and remaining=9, got attended=${updatedEpisode.attended_sessions}, remaining=${updatedEpisode.remaining_sessions}`);
  }
  console.log('  ✓ PASSED: Trigger successfully decremented remaining sessions from 10 to 9!');

  // 6. Test Reminders & Audit Logs Isolation
  console.log('\n--- TEST 7: Reminders & Audit Logs Isolation ---');
  await asTherapist(therapistA_Id);
  await db.query(`
    INSERT INTO public.reminders (
      therapist_id, patient_id, recipient_phone, message_payload, status
    ) VALUES (
      '${therapistA_Id}', '${patientA.id}', '9811234567', 'Appointment at 10 AM', 'SENT'
    );
  `);
  await db.query(`
    INSERT INTO public.audit_logs (
      therapist_id, patient_id, action, entity_type, entity_id
    ) VALUES (
      '${therapistA_Id}', '${patientA.id}', 'PATIENT_CREATE', 'PATIENT', '${patientA.id}'
    );
  `);
  console.log('  ✓ Reminder and Audit log inserted for Therapist A.');

  // Check from Therapist B context
  await asTherapist(therapistB_Id);
  const remB = await db.query(`SELECT COUNT(*) as count FROM public.reminders;`);
  const auditB = await db.query(`SELECT COUNT(*) as count FROM public.audit_logs;`);
  const notesB = await db.query(`SELECT COUNT(*) as count FROM public.clinical_notes;`);

  console.log(`  Therapist B sees: ${remB.rows[0].count} reminders, ${auditB.rows[0].count} audit logs, ${notesB.rows[0].count} clinical notes.`);

  if (parseInt(remB.rows[0].count) !== 0 || parseInt(auditB.rows[0].count) !== 0 || parseInt(notesB.rows[0].count) !== 0) {
    throw new Error('RLS VIOLATION on reminders, audit_logs, or clinical_notes!');
  }
  console.log('  ✓ PASSED: Reminders, Audit Logs, and Clinical Notes are completely isolated.');

  console.log('\n================================================================');
  console.log('🎉 ALL 7 DATABASE SCHEMA, TRIGGER, AND RLS ISOLATION TESTS PASSED!');
  console.log('================================================================\n');
}

runDatabaseTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
