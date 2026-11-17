# Physio Voice 🩺🎙️

> **Production Clinical Operating System & Voice Copilot for Independent Physiotherapists in India.**  
> Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase (PostgreSQL with Row Level Security in AWS Mumbai ap-south-1)**, **OpenAI (Whisper + GPT-4o)**, and **Multi-Channel Reminder Architecture (In-App, WhatsApp, SMS)**.

---

## 🎯 Clinical Focus & Problem Statement

Independent physiotherapists in India manage private clinics or conduct specialized home visits, treating 10–30 patients daily with conditions ranging from post-operative joint arthroplasty (TKA/THR) and sports ligament reconstructions (ACL) to chronic spinal disorders (cervical and lumbar radiculopathy).

Most practices still rely on paper registers or ad-hoc spreadsheets, resulting in:
1. **Broken Clinical Continuity:** Clinicians cannot review previous episode histories, range-of-motion (ROM) trajectories, or surgical contraindications between back-to-back appointments.
2. **Untracked Package Sessions & Revenue Leakage:** Patients purchase upfront rehabilitation packages (e.g. 5, 10, or 12 sessions). Manual counting leads to billing disputes and lost clinic revenue.
3. **High Documentation Friction:** Typing clinical notes between 30–45 minute manual therapy sessions is impractical.
4. **Follow-Up and Reminder Gaps:** Missed appointments disrupt therapeutic recovery schedules.

**Physio Voice** resolves this with natural voice intake, automatic `PV-26-XXXX` patient identification, multi-episode care plans that never overwrite past history, idempotent package session accounting, in-app clinical alerts, and a transparent external reminder delivery architecture.

---

## ✨ Core System Capabilities

### 1. 🎙️ Physio Voice AI Assistant & Structured Intake
- **Multi-Intent Voice Navigation:** Supports natural clinical dictation in Indian English and Hinglish for:
  - *Patient Registration* (Demographics, chief complaints, affected joints, package terms, fees).
  - *Attendance & Session Notes* (Status `ATTENDED`/`NO_SHOW`, VAS pain score 0–10, modalities e.g. ultrasound/IFT/TENS/traction, exercise prescriptions).
  - *Appointment Scheduling & Rescheduling* (Relative date and time slot parsing).
  - *Patient Search & History Retrieval* (Remaining sessions, past episodes, clinical timeline).
- **Ambiguity Detection & Disambiguation:** When spoken input matches multiple patients (e.g. "Record session for Sharma"), the assistant displays disambiguation cards rather than guessing.
- **Review & Explicit Confirmation Modal:** All voice extractions require explicit clinician review and manual editing before persisting to the database.
- **Medical Safety Invariants:** Strictly non-diagnostic; never invents clinical findings, hallucinations are blocked, and fallback to manual entry is always available.

### 2. 🆔 Automated Unique Patient Code & Search
- **Standardized Identification:** Auto-generates human-readable patient codes `PV-{YY}-{SEQUENCE}` (e.g., `PV-26-1001`) via sequence generation.
- **Duplicate Prevention:** Normalizes 10-digit mobile numbers (handling `+91`, spaces, hyphens) and flags existing records during registration.
- **Multi-Field Instant Search:** Real-time search across patient name, 10-digit phone, and patient code.

### 3. 📁 Multi-Episode Care Management
- **Multiple Episodes per Patient:** An existing patient can start a new treatment episode (e.g. Episode 1: *Post-Op Knee Replacement* completed $\to$ Episode 2: *Frozen Shoulder* active) without overwriting past clinical records.
- **Clinical Goals & Session Packages:** Each episode tracks chief complaints, affected body parts, package sizes, package fees, payment status (`PAID`, `PARTIAL`, `PENDING`), and session logs.

### 4. ⚡ Attendance Calculation & Idempotency Rules
- **Appointment Statuses:** `SCHEDULED`, `ATTENDED`, `NO_SHOW`, `CANCELLED`.
- **Session Decrement Rule:** Remaining package sessions decrease *only* when attendance is confirmed as `ATTENDED`.
- **Idempotency Guard:** Repeatedly toggling or confirming `ATTENDED` prevents double-decrementing.
- **Session Restoration:** Transitioning from `ATTENDED` to `NO_SHOW` or `CANCELLED` restores the package session credit.
- **Zero-Floor Clamping:** Remaining sessions are bounded at 0 (`Math.max(0, total - attended)`).

### 5. 🔔 Appointment Reminders & Delivery Architecture
- **In-App Notification Center:** Native bell popover in the top header with unread badge counters, instant delivery confirmation, and one-click "Process Due Reminders" dispatcher.
- **Delivery Truthfulness Invariant:** *Physio Voice never claims external messages (WhatsApp/SMS) have been sent or delivered unless a configured provider confirms delivery via API response.* Unconfigured gateways or client deep links remain transparently flagged as `PENDING_CONFIRMATION` or unverified.
- **Timezone Handling:** All scheduling calculations use Indian Standard Time (`Asia/Kolkata`, UTC+05:30), storing UTC in the database and triggering reminders 2 hours prior to appointment slots.
- **Cancellation & Reschedule Sync:** Moving an appointment recalculates pending reminder trigger times; cancelling an appointment marks pending reminders as `CANCELLED`.
- **DPDPA 2023 Consent Compliance:** Honors patient notification preferences (`patient_notification_consents`), marking revoked channels as `SKIPPED_NO_CONSENT`.
- **Audit Logs:** Every reminder attempt, status transition, and provider response payload is recorded in `reminder_delivery_logs`.

---

## 🏗️ Architecture & Technology Stack

```
Physio Voice Architecture
│
├── Frontend Client (Next.js 15 App Router + React 19 + Tailwind CSS)
│   ├── AppShell & Responsive Sidebar (Desktop sticky header + Mobile drawer)
│   ├── NotificationPopover (In-App alerts, delivery logs, queue trigger)
│   ├── VoiceAssistantModal (Web Audio API recorder + Clinical NLP review)
│   └── Appointment Calendar (Timezone-aware day/week views & modals)
│
├── Server-Side Logic & API Routes (Next.js Node.js Runtime)
│   ├── /api/voice/process (Whisper-1 audio transcription & GPT-4o entity extraction)
│   ├── /api/patients & /api/patients/[id]/episodes (Multi-episode clinical management)
│   ├── /api/appointments/[id] (Idempotent session transitions & reschedule sync)
│   ├── /api/reminders/process (Due reminders cron worker & provider dispatcher)
│   └── /api/reminders/consent (DPDPA 2023 patient consent preferences)
│
├── Database & Security (Supabase Cloud — AWS Mumbai ap-south-1)
│   ├── PostgreSQL with Row Level Security (RLS) on all tables
│   ├── Secure multi-tenancy: each physiotherapist accesses only their own records
│   └── Server-only Service Role keys (Never exposed to browser bundles)
│
└── Provider Abstraction Layer (lib/reminders/providers.ts)
    ├── InAppReminderProvider (Internal instant delivery)
    ├── WhatsAppProvider (Meta Cloud API / Gupshup interface)
    └── SmsProvider (Transactional SMS / Fast2SMS / Twilio India)
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js** (v20.x or v22.x LTS recommended)
- **npm** (v10+)
- **Git**

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/your-username/physio-voice.git
cd "physio-voice"
npm install
```

### 3. Environment Variables Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your project credentials:
```ini
# Supabase Cloud Project Configuration (AWS Mumbai ap-south-1)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenAI API Key (Whisper audio transcription & GPT-4o clinical NLP)
OPENAI_API_KEY=sk-proj-your-openai-key

# Clinic Timezone (Indian Standard Time)
DEFAULT_CLINIC_TIMEZONE=Asia/Kolkata

# Application Public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Verified External Messaging Providers
# WHATSAPP_API_TOKEN=your-meta-access-token
# WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-id
# SMS_API_KEY=your-fast2sms-or-twilio-key
```

### 4. Apply Database Migrations
In your Supabase project dashboard, open the **SQL Editor** and execute the migrations in order:
1. `supabase/migrations/20261117000000_init_physio_voice.sql` (Core schema, RLS, functions, triggers)
2. `supabase/migrations/20261117220000_reminders_and_delivery_logs.sql` (Reminders, delivery logs, DPDPA consents)

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Quality Assurance

Physio Voice includes comprehensive automated test suites covering all clinical scenarios and edge cases. Run them locally:

```bash
# 1. Master System Quality Review (56/56 passing assertions)
npx tsx scripts/test-master-quality-review.ts

# 2. Reminders & Provider Delivery Invariant Suite (37/37 passing assertions)
npx tsx scripts/test-reminders.ts

# 3. Session Calculations & Idempotency Suite (22/22 passing assertions)
npx tsx scripts/test-session-calculations.ts

# 4. Voice Clinical NLP & Anti-Hallucination Suite (36/36 passing assertions)
npx tsx scripts/test-voice-assistant.ts

# 5. TypeScript Strict Typecheck
npx tsc --noEmit

# 6. ESLint
npm run lint

# 7. Next.js Production Build
npm run build
```

---

## 🚢 Vercel Deployment Instructions

Follow these step-by-step instructions to deploy Physio Voice to Vercel:

### Step 1: Push Code to GitHub
Ensure all code and migrations are committed and pushed to your remote repository:
```bash
git add .
git commit -m "feat: complete production release of Physio Voice"
git push origin main
```

### Step 2: Import into Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** $\to$ **Project**.
3. Select your Git provider (GitHub) and import `physio-voice`.
4. Framework Preset: **Next.js** (automatically detected).
5. Root Directory: `./` (leave default).

### Step 3: Configure Environment Variables
In the Vercel **Environment Variables** panel, add the following variables for `Production` and `Preview`:

| Variable Name | Environment | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Supabase Project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Secret service role key for privileged server API routes (Never prefixed with `NEXT_PUBLIC_`) |
| `OPENAI_API_KEY` | Production only | OpenAI API key for Whisper transcription and clinical NLP |
| `DEFAULT_CLINIC_TIMEZONE` | Production, Preview | `Asia/Kolkata` |
| `NEXT_PUBLIC_APP_URL` | Production | Your Vercel production domain (e.g., `https://physio-voice.vercel.app`) |

### Step 4: Deploy & Verify
1. Click **Deploy**. Vercel will run `npm run build` and output an optimized production build.
2. Once deployment completes, navigate to your production URL.
3. Verify authentication, patient search, episode creation, attendance logging, and reminders.

---

## 🔒 Security & Privacy Compliance

- **Multi-Tenant Row Level Security (RLS):** Every database query is scoped to `auth.uid() = therapist_id`. Physiotherapists can never query or view other practitioners' patients or notes.
- **Zero-Storage Audio:** Voice recordings are transcribed in server memory via ephemeral streams and discarded immediately; no raw audio is stored on disk.
- **DPDPA 2023 Compliance:** Indian Digital Personal Data Protection Act compliance with explicit patient notification opt-in/opt-out preferences and delivery audit logs.
- **Delivery Truthfulness Invariant:** Unconfigured external messaging channels are prevented from claiming delivery status.

---

## 📄 License
MIT License. Built for independent healthcare professionals in India.
