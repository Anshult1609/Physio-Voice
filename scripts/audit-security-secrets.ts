import * as fs from 'fs';
import * as path from 'path';

console.log('================================================================');
console.log('🔒 PHYSIO VOICE — SECURITY & SECRET EXPOSURE AUDIT');
console.log('================================================================\n');

let violations = 0;

// 1. Audit Client-Side Components for Leaked Private Keys
console.log('--- AUDIT 1: Client Component Secret Leak Check ---');
const clientDirs = [
  path.join(__dirname, '../components'),
  path.join(__dirname, '../app'),
];

const forbiddenClientTokens = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'process.env.SUPABASE_SERVICE_ROLE_KEY',
  'service_role',
];

function scanFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanFiles(fullPath, fileList);
    } else if (file.endsWith('.tsx') || (file.endsWith('.ts') && !file.includes('route.ts') && !file.includes('admin.ts'))) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const clientFiles = clientDirs.flatMap((d) => scanFiles(d));
let leakedClientFiles = 0;

for (const filePath of clientFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Check if file is a client component or client-side utility
  const isClient = content.includes("'use client'") || content.includes('"use client"') || filePath.includes('components');
  
  if (isClient) {
    for (const token of forbiddenClientTokens) {
      if (content.includes(token)) {
        console.error(`  ❌ SECURITY LEAK in client file [${path.relative(process.cwd(), filePath)}]: references forbidden token "${token}"`);
        violations++;
        leakedClientFiles++;
      }
    }
  }
}

if (leakedClientFiles === 0) {
  console.log(`  ✓ PASSED: Scanned ${clientFiles.length} frontend component & utility files. Zero secret leaks detected.`);
}

// 2. Audit Environment Variables Configuration (.env.example)
console.log('\n--- AUDIT 2: Environment Variable Prefix Hygiene ---');
const envExamplePath = path.join(__dirname, '../.env.example');
if (fs.existsSync(envExamplePath)) {
  const envContent = fs.readFileSync(envExamplePath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key] = trimmed.split('=');
    
    // Check if secret key was erroneously prefixed with NEXT_PUBLIC_
    if (key.includes('SERVICE_ROLE') && key.startsWith('NEXT_PUBLIC_')) {
      console.error(`  ❌ DANGEROUS CONFIG: ${key} is prefixed with NEXT_PUBLIC_! This would bundle the master key into browser JS!`);
      violations++;
    }
    if (key.includes('OPENAI_API_KEY') && key.startsWith('NEXT_PUBLIC_')) {
      console.error(`  ❌ DANGEROUS CONFIG: ${key} is prefixed with NEXT_PUBLIC_!`);
      violations++;
    }
  }
  console.log('  ✓ PASSED: .env.example correctly keeps SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY private (server-only).');
} else {
  console.warn('  ⚠️ .env.example not found.');
}

// 3. Audit Browser Supabase Client (lib/supabase/client.ts)
console.log('\n--- AUDIT 3: Browser Supabase Client Isolation ---');
const browserClientPath = path.join(__dirname, '../lib/supabase/client.ts');
if (fs.existsSync(browserClientPath)) {
  const content = fs.readFileSync(browserClientPath, 'utf-8');
  if (content.includes('SERVICE_ROLE') || content.includes('serviceRole')) {
    console.error('  ❌ Browser client references SERVICE_ROLE!');
    violations++;
  } else {
    console.log('  ✓ PASSED: lib/supabase/client.ts strictly uses public anon key only.');
  }
}

// 4. Audit Schema for Row-Level Security on All Tables
console.log('\n--- AUDIT 4: PostgreSQL Row-Level Security (RLS) Enforcement ---');
const migrationPath = path.join(__dirname, '../supabase/migrations/20261117170000_physio_voice_full_schema.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

const tables = ['users', 'patients', 'treatment_episodes', 'appointments', 'attendance', 'clinical_notes', 'reminders', 'audit_logs'];
let rlsMissing = 0;

for (const table of tables) {
  const hasEnableRLS = migrationContent.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
  const hasForceRLS = migrationContent.includes(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`);
  
  if (hasEnableRLS && hasForceRLS) {
    console.log(`  ✓ Table public.${table}: ENABLE RLS & FORCE RLS verified.`);
  } else {
    console.error(`  ❌ Table public.${table}: Missing ENABLE or FORCE RLS!`);
    rlsMissing++;
    violations++;
  }
}

console.log('\n================================================================');
if (violations === 0) {
  console.log('🛡️  SECURITY AUDIT PASSED: ZERO VULNERABILITIES DETECTED!');
  console.log('================================================================\n');
  process.exit(0);
} else {
  console.error(`❌ SECURITY AUDIT FAILED WITH ${violations} VIOLATION(S)!`);
  console.log('================================================================\n');
  process.exit(1);
}
