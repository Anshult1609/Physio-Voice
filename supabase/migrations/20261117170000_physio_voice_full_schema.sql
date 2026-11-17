-- ==============================================================================
-- PHYSIO VOICE — COMPREHENSIVE SUPABASE DATABASE SCHEMA & MIGRATION
-- Migration: 20261117170000_physio_voice_full_schema.sql
-- Covers:
--   1. users (therapists)
--   2. patients
--   3. treatment_episodes
--   4. appointments
--   5. attendance
--   6. clinical_notes
--   7. reminders
--   8. audit_logs
-- Includes: Foreign Keys, Constraints, Indexes, Triggers, and Strict RLS Policies
-- ==============================================================================

-- 1. Optional PostgreSQL Extensions (safe guarded)
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create auth schema mock for local testing environments if not running inside Supabase Cloud
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure standard Supabase roles exist for RLS evaluation
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
END $$;

-- 2. Human-Readable Patient Code Sequence: PV-YY-XXXX (e.g. PV-26-1001)
CREATE SEQUENCE IF NOT EXISTS patient_code_seq START 1001;

CREATE OR REPLACE FUNCTION generate_patient_code()
RETURNS TEXT AS $$
DECLARE
    current_year TEXT;
    seq_val INT;
BEGIN
    current_year := to_char(CURRENT_DATE, 'YY');
    seq_val := nextval('patient_code_seq');
    RETURN 'PV-' || current_year || '-' || lpad(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TABLE 1: USERS (Therapists / Practice Owners)
-- Mirrors Supabase auth.users with clinical practice metadata
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    clinic_name TEXT NOT NULL DEFAULT 'Physio Care Clinic',
    phone TEXT,
    clinic_address TEXT,
    registration_number TEXT, -- e.g. State Physical Therapy Council Registration
    default_package_size INT NOT NULL DEFAULT 10 CHECK (default_package_size > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ==============================================================================
-- TABLE 2: PATIENTS
-- Core patient demographics and medical baseline
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_code TEXT NOT NULL UNIQUE DEFAULT generate_patient_code(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INT CHECK (age >= 0 AND age <= 120),
    gender TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    occupation TEXT,
    address TEXT,
    emergency_contact TEXT,
    medical_history_notes TEXT,
    comorbidities JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["Hypertension", "Diabetes", "Cardiac Pacemaker"]
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup & search indexes
CREATE INDEX IF NOT EXISTS idx_patients_therapist_id ON public.patients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_code ON public.patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_patients_name ON public.patients(full_name);

-- ==============================================================================
-- TABLE 3: TREATMENT_EPISODES
-- Independent clinical conditions/injuries for a patient over time
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.treatment_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g. "Post-Op Right Knee Rehabilitation"
    chief_complaint TEXT NOT NULL,
    affected_body_part TEXT NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_end_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED')),
    total_package_sessions INT NOT NULL DEFAULT 10 CHECK (total_package_sessions > 0),
    attended_sessions INT NOT NULL DEFAULT 0 CHECK (attended_sessions >= 0),
    remaining_sessions INT GENERATED ALWAYS AS (GREATEST(0, total_package_sessions - attended_sessions)) STORED,
    package_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (package_fee >= 0),
    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID')),
    clinical_goals TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_episodes_patient_id ON public.treatment_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_episodes_therapist_id ON public.treatment_episodes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON public.treatment_episodes(status);

-- ==============================================================================
-- TABLE 4: APPOINTMENTS
-- Clinic calendar slots and scheduled visits
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES public.treatment_episodes(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_appointment_times CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date ON public.appointments(therapist_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);

-- ==============================================================================
-- TABLE 5: ATTENDANCE
-- Logs physical session attendance and decrements package sessions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES public.treatment_episodes(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    session_number INT NOT NULL CHECK (session_number > 0),
    attendance_status TEXT NOT NULL DEFAULT 'ATTENDED' CHECK (attendance_status IN ('ATTENDED', 'MISSED', 'CANCELLED')),
    attendance_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_episode_id ON public.attendance(episode_id);
CREATE INDEX IF NOT EXISTS idx_attendance_patient_id ON public.attendance(patient_id);
CREATE INDEX IF NOT EXISTS idx_attendance_therapist_id ON public.attendance(therapist_id);

-- ==============================================================================
-- TRIGGER: Real-time Package Decrement when attendance is logged as ATTENDED
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_episode_package_attendance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.attendance_status = 'ATTENDED') THEN
        UPDATE public.treatment_episodes
        SET attended_sessions = attended_sessions + 1,
            updated_at = NOW()
        WHERE id = NEW.episode_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.attendance_status != 'ATTENDED' AND NEW.attendance_status = 'ATTENDED') THEN
            UPDATE public.treatment_episodes
            SET attended_sessions = attended_sessions + 1,
                updated_at = NOW()
            WHERE id = NEW.episode_id;
        ELSIF (OLD.attendance_status = 'ATTENDED' AND NEW.attendance_status != 'ATTENDED') THEN
            UPDATE public.treatment_episodes
            SET attended_sessions = GREATEST(0, attended_sessions - 1),
                updated_at = NOW()
            WHERE id = NEW.episode_id;
        END IF;
    ELSIF (TG_OP = 'DELETE' AND OLD.attendance_status = 'ATTENDED') THEN
        UPDATE public.treatment_episodes
        SET attended_sessions = GREATEST(0, attended_sessions - 1),
            updated_at = NOW()
        WHERE id = OLD.episode_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_package_attendance ON public.attendance;
CREATE TRIGGER trg_update_package_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION update_episode_package_attendance();

-- ==============================================================================
-- TABLE 6: CLINICAL_NOTES
-- Longitudinal objective findings, modalities used, and exercise prescriptions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES public.treatment_episodes(id) ON DELETE CASCADE,
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
    pain_score INT CHECK (pain_score >= 0 AND pain_score <= 10), -- VAS 0-10
    subjective_notes TEXT,
    objective_findings TEXT,
    modalities_used JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["Ultrasound", "IFT", "Dry Needling"]
    exercise_prescription TEXT,
    therapist_remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient ON public.clinical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_episode ON public.clinical_notes(episode_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_attendance ON public.clinical_notes(attendance_id);

-- ==============================================================================
-- TABLE 7: REMINDERS
-- Tracks WhatsApp/SMS notification status, dispatch timestamps, and message payloads
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK (channel IN ('WHATSAPP', 'SMS', 'EMAIL')),
    reminder_type TEXT NOT NULL DEFAULT 'APPOINTMENT_SCHEDULED' CHECK (reminder_type IN ('APPOINTMENT_SCHEDULED', 'PACKAGE_EXPIRY_ALERT', 'FOLLOWUP')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    recipient_phone TEXT NOT NULL,
    message_payload TEXT NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_therapist_id ON public.reminders(therapist_id);
CREATE INDEX IF NOT EXISTS idx_reminders_patient_id ON public.reminders(patient_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status);

-- ==============================================================================
-- TABLE 8: AUDIT_LOGS
-- Security audit trail for clinical record views, edits, and voice intakes (DPDPA 2023)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    therapist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g. 'PATIENT_CREATE', 'VOICE_INTAKE_PROCESSED', 'RECORD_VIEW'
    entity_type TEXT NOT NULL, -- 'PATIENT', 'EPISODE', 'ATTENDANCE', 'APPOINTMENT'
    entity_id UUID,
    ip_address TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_therapist ON public.audit_logs(therapist_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strictly restricts records so each physiotherapist can only query & modify their own data
-- ==============================================================================

-- Enable & Force RLS on all 8 tables (guarantees isolation even for superusers)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.treatment_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_episodes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY;

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- Helper function to extract auth uid in both Supabase cloud and test environments
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'uid' AND n.nspname = 'auth'
    ) THEN
        CREATE FUNCTION auth.uid()
        RETURNS UUID AS $f$
        BEGIN
            RETURN NULLIF(
                COALESCE(
                    current_setting('request.jwt.claim.sub', true),
                    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')
                ),
                ''
            )::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $f$ LANGUAGE plpgsql STABLE;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION current_therapist_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        auth.uid(),
        NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. USERS: Therapists can only view & update their own profile
DROP POLICY IF EXISTS "Therapists manage own profile" ON public.users;
CREATE POLICY "Therapists manage own profile"
    ON public.users FOR ALL
    USING (id = current_therapist_id())
    WITH CHECK (id = current_therapist_id());

-- 2. PATIENTS: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists access own patients" ON public.patients;
CREATE POLICY "Therapists access own patients"
    ON public.patients FOR ALL
    USING (therapist_id = current_therapist_id())
    WITH CHECK (therapist_id = current_therapist_id());

-- 3. TREATMENT_EPISODES: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists access own episodes" ON public.treatment_episodes;
CREATE POLICY "Therapists access own episodes"
    ON public.treatment_episodes FOR ALL
    USING (therapist_id = current_therapist_id())
    WITH CHECK (therapist_id = current_therapist_id());

-- 4. APPOINTMENTS: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists access own appointments" ON public.appointments;
CREATE POLICY "Therapists access own appointments"
    ON public.appointments FOR ALL
    USING (therapist_id = current_therapist_id())
    WITH CHECK (therapist_id = current_therapist_id());

-- 5. ATTENDANCE: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists access own attendance" ON public.attendance;
CREATE POLICY "Therapists access own attendance"
    ON public.attendance FOR ALL
    USING (therapist_id = current_therapist_id())
    WITH CHECK (therapist_id = current_therapist_id());

-- 6. CLINICAL_NOTES: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists access own clinical notes" ON public.clinical_notes;
CREATE POLICY "Therapists access own clinical notes"
    ON public.clinical_notes FOR ALL
    USING (therapist_id = current_therapist_id())
    WITH CHECK (therapist_id = current_therapist_id());

-- 7. REMINDERS: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists access own reminders" ON public.reminders;
CREATE POLICY "Therapists access own reminders"
    ON public.reminders FOR ALL
    USING (therapist_id = current_therapist_id())
    WITH CHECK (therapist_id = current_therapist_id());

-- 8. AUDIT_LOGS: Strict tenant isolation
DROP POLICY IF EXISTS "Therapists view own audit logs" ON public.audit_logs;
CREATE POLICY "Therapists view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (therapist_id = current_therapist_id());

DROP POLICY IF EXISTS "Therapists insert own audit logs" ON public.audit_logs;
CREATE POLICY "Therapists insert own audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (therapist_id = current_therapist_id());

-- ==============================================================================
-- AUTO-PROVISIONING TRIGGER: Creates public.users row upon auth.users sign-up
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, clinic_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'Physio Care Clinic')
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ==============================================================================
-- ROLE PERMISSIONS (Supabase authenticated & anon roles)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

DO $$ BEGIN
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated;
    GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO authenticated, anon;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

