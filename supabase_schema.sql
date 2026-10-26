-- ==============================================================================
-- Physio Voice: Supabase Database Schema
-- Designed for Vercel Deployment & High-Performance Clinic Record Management
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Physiotherapists / Practitioners Table (Linked with Supabase Auth or Standalone)
CREATE TABLE IF NOT EXISTS public.physiotherapists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    clinic_name TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. UID Sequence Generator Table for Patients (e.g. PV-2026-0001)
CREATE SEQUENCE IF NOT EXISTS patient_uid_seq START 1;

-- 4. Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT UNIQUE NOT NULL, -- e.g., PV-2026-0001
    physiotherapist_id UUID REFERENCES public.physiotherapists(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 130),
    phone TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Unspecified')) DEFAULT 'Unspecified',
    emergency_contact TEXT,
    reminder_consent BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for instant UID search
CREATE INDEX IF NOT EXISTS idx_patients_uid ON public.patients(uid);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_practitioner ON public.patients(physiotherapist_id);

-- Trigger to auto-generate UID upon patient insertion if not provided
CREATE OR REPLACE FUNCTION generate_patient_uid()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.uid IS NULL OR NEW.uid = '' THEN
        NEW.uid := 'PV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('patient_uid_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_generate_patient_uid
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION generate_patient_uid();

-- 5. Treatment Plans / Episodes Table (Allows returning patients with new conditions under same UID)
CREATE TABLE IF NOT EXISTS public.treatment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    chief_complaint TEXT NOT NULL, -- e.g., "Frozen Shoulder", "Lower Back Pain"
    diagnosis_details TEXT,
    planned_sessions INTEGER NOT NULL DEFAULT 1 CHECK (planned_sessions > 0),
    completed_sessions INTEGER NOT NULL DEFAULT 0 CHECK (completed_sessions >= 0),
    status TEXT CHECK (status IN ('ACTIVE', 'COMPLETED', 'DISCONTINUED', 'ON_HOLD')) DEFAULT 'ACTIVE' NOT NULL,
    start_date DATE DEFAULT CURRENT_DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient ON public.treatment_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_status ON public.treatment_plans(status);

-- 6. Appointments & Scheduling Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    treatment_plan_id UUID REFERENCES public.treatment_plans(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 45 NOT NULL,
    status TEXT CHECK (status IN ('SCHEDULED', 'ATTENDED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW')) DEFAULT 'SCHEDULED' NOT NULL,
    reminder_status TEXT CHECK (reminder_status IN ('PENDING', 'SENT', 'FAILED', 'DISMISSED')) DEFAULT 'PENDING' NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_status ON public.appointments(reminder_status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON public.appointments(patient_id);

-- 7. Session Attendance & Clinical Records
CREATE TABLE IF NOT EXISTS public.session_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    treatment_plan_id UUID REFERENCES public.treatment_plans(id) ON DELETE CASCADE NOT NULL,
    session_number INTEGER NOT NULL,
    pain_score_before INTEGER CHECK (pain_score_before BETWEEN 0 AND 10),
    pain_score_after INTEGER CHECK (pain_score_after BETWEEN 0 AND 10),
    modalities_used TEXT[], -- e.g. ['IFT', 'Ultrasound', 'TENS', 'Manual Therapy', 'Strengthening Exercises']
    exercises_prescribed TEXT,
    therapist_notes TEXT,
    attended_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_records_treatment ON public.session_records(treatment_plan_id);

-- 8. Notifications & 1-Day Reminder Logs
CREATE TABLE IF NOT EXISTS public.reminder_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    reminder_for_date DATE NOT NULL,
    channel TEXT CHECK (channel IN ('WHATSAPP', 'IN_APP', 'SMS')) DEFAULT 'WHATSAPP' NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DISMISSED')) DEFAULT 'PENDING' NOT NULL,
    whatsapp_url TEXT, -- Pre-formatted https://wa.me/919876543210?text=... link
    message_content TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_status ON public.reminder_logs(status);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_date ON public.reminder_logs(reminder_for_date);

-- 9. Patient Feedback & Rating Table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    treatment_plan_id UUID REFERENCES public.treatment_plans(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    pain_relief_percentage INTEGER CHECK (pain_relief_percentage BETWEEN 0 AND 100),
    would_recommend BOOLEAN DEFAULT TRUE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_patient ON public.feedback(patient_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);

-- ==============================================================================
-- Row Level Security (RLS) policies for multi-tenant clinic privacy
-- ==============================================================================
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated physiotherapist to access only their registered patients & records
CREATE POLICY "Physiotherapists can manage their own patients"
ON public.patients FOR ALL
TO authenticated
USING (physiotherapist_id = auth.uid())
WITH CHECK (physiotherapist_id = auth.uid());
