# 🎙️ Physio Voice — Voice-Command Patient Record Management

> A voice-first patient record, attendance, and session scheduling web application built specifically for independent physiotherapists. Eliminates paper registers, updates attendance hands-free, tracks remaining treatment sessions, and reduces missed appointments with automated 1-day reminders.

---

## 🚀 Recommended Tech Stack (Optimized for Vercel & Supabase)

| Layer | Technology | Why This Choice? |
| :--- | :--- | :--- |
| **Framework** | **Next.js 15 (App Router, TypeScript, React 19)** | Built by Vercel for zero-config deployment, Edge/Serverless APIs, high performance, and rapid mobile responsiveness. |
| **Database** | **Supabase (PostgreSQL)** | Persistent cloud database with connection pooling, built-in Auth (Email + Phone), real-time updates, and an active free tier. |
| **Styling** | **Tailwind CSS + Lucide Icons + shadcn/ui** | Clean, accessible clinical UI with high contrast, optimized for desktop, iPad/tablet, and mobile phones. |
| **Voice Engine** | **Web Speech API (`webkitSpeechRecognition`) + Intent Extractor** | Zero-latency, zero external audio streaming cost. Operates directly in Chrome/Edge/Safari on desktop and mobile. |
| **Automated Reminders**| **Vercel Cron (`0 8 * * *`) + WhatsApp Direct API** | Daily morning scan of upcoming $T+1$ appointments, generating in-app alerts and 1-click WhatsApp reminder links without SMS carrier fees. |
| **Hosting** | **Vercel** | Single-command deployment (`vercel`) or instant CI/CD via GitHub. |

---

## 📋 Features Overview

### 1. 🔐 Login & Authentication
- Secure login for physiotherapists via **Email** or **Phone Number**.
- Session persistence across clinic devices.

### 2. 🗣️ Voice-Based & Manual Patient Intake
- **Voice Intake**: Tap the microphone and speak naturally:
  > *"Register new patient Sunita Sharma, age 42, phone 9811223344, problem lower back pain and sciatica, 10 sessions recommended, schedule first session tomorrow at 11 AM."*
- **Real-Time Entity Parser**: Converts spoken speech into structured fields (`Name`, `Age`, `Phone`, `Chief Complaint`, `Planned Sessions`, `Appointment`).
- **Review & Edit Modal**: Shows parsed data for rapid verification or manual correction before persisting to the database.
- **Manual Form Alternative**: Complete manual form for noisy clinic environments.

### 3. 🆔 Digital Record & Unique Identification (UID) Dashboard
- **Auto-Generated UID**: Every registered patient receives a sequential identifier (e.g., `PV-2026-0001`).
- **Instant Search**: Search by UID, patient name, or phone number from any screen.
- **Multi-Episode History**: Returning patients with a new clinical condition keep their original UID while starting a new treatment plan.
- **Visual Progress Bar**:
  - Total Planned Sessions (e.g., 10)
  - Completed Sessions / Attendance (e.g., 6)
  - Remaining Sessions (e.g., 4)

### 4. 📅 Appointment & Session Scheduling
- Book sessions during intake or from the patient dashboard.
- Voice scheduling support (*"Schedule session for PV-1042 on Thursday at 4 PM"*).
- Visual **Calendar View** and **List View** with status filters (`Scheduled`, `Attended`, `Rescheduled`, `Cancelled`).
- **1-Click Attendance Check-in**: Automatically increments completed sessions and decrements remaining counter.

### 5. ⏰ One-Day Appointment Reminders & In-App Notifications
- **Vercel Cron Engine**: Checks for appointments scheduled for tomorrow every morning at 08:00 AM.
- **Physiotherapist Notification Center**: In-app badge count and drawer displaying tomorrow's schedule and notification statuses (`Pending`, `Sent`, `Dismissed`).
- **Patient WhatsApp Direct Reminder**: 1-click WhatsApp message generated with pre-filled reminder template:
  > *"Hi Sunita, this is a reminder for your physiotherapy session tomorrow at 11:00 AM with Dr. Sharma at Physio Voice Clinic. Reply to confirm or reschedule."*
- **Consent Tracking**: Respects patient reminder preferences.

### 6. ⭐ Feedback & Rating Section
- 1 to 5 star rating interface.
- Pain relief assessment (0-100%) and comments.
- Clinic outcome analytics.

---

## 🗄️ Database Schema (`supabase_schema.sql`)

The complete database schema is pre-configured in [`supabase_schema.sql`](./supabase_schema.sql):

- `physiotherapists`: Clinic practitioner accounts
- `patients`: Demographics, contact info, reminder consent, auto-generated `PV-YYYY-XXXX` UID
- `treatment_plans`: Chief complaint, planned sessions, completed sessions, active/completed status
- `appointments`: Scheduled date & time, duration, status, reminder status
- `session_records`: Clinical notes, pain score before & after, modalities used
- `reminder_logs`: Track reminders sent via WhatsApp / In-App
- `feedback`: 1-5 star ratings, patient comments, pain relief metrics

---

## 🛠️ Step-by-Step Setup Guide

### 1. Set Up Supabase (Persistent Database)
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Create a new project (e.g., `physio-voice`).
3. Open the **SQL Editor** in the Supabase Dashboard.
4. Copy and paste the contents of [`supabase_schema.sql`](./supabase_schema.sql) and click **Run**.
5. Go to **Project Settings -> API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` secret

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your_secret_cron_token
```

### 3. Deploy to Vercel
1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your `physio-voice` repository.
4. Add the environment variables from `.env.local` into the Vercel Project Settings.
5. Click **Deploy**!
   - Vercel will automatically detect `vercel.json` and configure the daily cron reminder job at `0 8 * * *`.
