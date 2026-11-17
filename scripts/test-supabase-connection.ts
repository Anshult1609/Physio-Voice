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

async function verifyCloudDatabase() {
  const env = loadEnvFile(path.join(__dirname, '../.env.local'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('================================================================');
  console.log(`📡 CHECKING SUPABASE CLOUD TABLES: ${url}`);
  console.log('================================================================\n');

  const tables = [
    'users',
    'patients',
    'treatment_episodes',
    'appointments',
    'attendance',
    'clinical_notes',
    'reminders',
    'audit_logs'
  ];

  let readyCount = 0;

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table public.${table}: PENDING (not yet found in schema cache: ${error.message})`);
    } else {
      console.log(`✓ Table public.${table}: READY & LIVE`);
      readyCount++;
    }
  }

  console.log('\n----------------------------------------------------------------');
  if (readyCount === tables.length) {
    console.log(`🎉 ALL ${readyCount}/${tables.length} TABLES VERIFIED ON SUPABASE CLOUD!`);
  } else {
    console.log(`⏳ Status: ${readyCount}/${tables.length} tables found.`);
    console.log(`👉 Please run the migration script in your Supabase SQL Editor:`);
    console.log(`   supabase/migrations/20261117170000_physio_voice_full_schema.sql`);
  }
  console.log('================================================================\n');
}

verifyCloudDatabase().catch(console.error);
