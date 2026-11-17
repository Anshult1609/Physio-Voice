-- ==============================================================================
-- PHYSIO VOICE — PRODUCTION DATABASE SCHEMA
-- Migration: 20261117000000_init_physio_voice.sql
-- Supports: Independent Physiotherapists in India
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Custom Enumerated Types
DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE episode_status_type AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_type AS ENUM ('ATTENDED', 'MISSED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status_type AS ENUM ('SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('PENDING', 'PARTIAL', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Human-readable Patient Code Sequence
CREATE SEQUENCE IF NOT EXISTS patient_code_seq START 1001;

-- Function to format Patient Code: PV-YY-XXXX (e.g. PV-26-1001)
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

-- 4. Therapists Profile Table (mirrors Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.therapists (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    clinic_name TEXT NOT NULL DEFAULT 'Physio Clinic',
    phone TEXT,
    clinic_address TEXT,
    registration_number TEXT,
    default_package_size INT DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Patients Table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    patient_code TEXT NOT NULL UNIQUE DEFAULT generate_patient_code(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INT CHECK (age >= 0 AND age <= 120),
    gender gender_type NOT NULL,
    occupation TEXT,
    address TEXT,
    emergency_contact TEXT,
    medical_history_notes TEXT,
    comorbidities JSONB DEFAULT '[]'::jsonb, -- e.g. ["Diabetes", "Hypertension", "Cardiac Pacemaker"]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast search indexes for Patients
CREATE INDEX IF NOT EXISTS idx_patients_therapist_id ON public.patients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_code ON public.patients(patient_code);
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON public.patients USING gin (full_name gin_trgm_ops);

-- 6. Treatment Episodes Table
CREATE TABLE IF NOT EXISTS public.treatment_episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g. "Frozen Shoulder - Right", "Lumbar Radiculopathy"
    chief_complaint TEXT NOT NULL,
    affected_body_part TEXT NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_end_date DATE,
    status episode_status_type NOT NULL DEFAULT 'ACTIVE',
    total_package_sessions INT NOT NULL DEFAULT 10 CHECK (total_package_sessions > 0),
    attended_sessions INT NOT NULL DEFAULT 0 CHECK (attended_sessions >= 0),
    remaining_sessions INT GENERATED ALWAYS AS (GREATEST(0, total_package_sessions - attended_sessions)) STORED,
    package_fee NUMERIC(10, 2) DEFAULT 0.00,
    amount_paid NUMERIC(10, 2) DEFAULT 0.00,
    payment_status payment_status_type NOT NULL DEFAULT 'PENDING',
    clinical_goals TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_episodes_patient_id ON public.treatment_episodes(patient_id);
CREATE INDEX IF NOT EXISTS idx_episodes_therapist_id ON public.treatment_episodes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON public.treatment_episodes(status);

-- 7. Treatment Sessions Table
CREATE TABLE IF NOT EXISTS public.treatment_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    episode_id UUID NOT NULL REFERENCES public.treatment_episodes(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    session_number INT NOT NULL,
    session_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attendance_status attendance_type NOT NULL DEFAULT 'ATTENDED',
    pain_score INT CHECK (pain_score >= 0 AND pain_score <= 10), -- VAS 0-10
    subjective_notes TEXT,
    objective_findings TEXT,
    modalities_used JSONB DEFAULT '[]'::jsonb, -- e.g. ["IFT", "Ultrasound", "Dry Needling", "Theraband"]
    exercise_prescription TEXT,
    therapist_remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_episode_id ON public.treatment_sessions(episode_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON public.treatment_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_id ON public.treatment_sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.treatment_sessions(session_date);

-- Trigger: Automatically update attended_sessions on treatment_episodes
CREATE OR REPLACE FUNCTION update_episode_attendance_count()
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_attendance_count ON public.treatment_sessions;
CREATE TRIGGER trg_update_attendance_count
AFTER INSERT OR UPDATE OR DELETE ON public.treatment_sessions
FOR EACH ROW EXECUTE FUNCTION update_episode_attendance_count();

-- 8. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    episode_id UUID REFERENCES public.treatment_episodes(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    status appointment_status_type NOT NULL DEFAULT 'SCHEDULED',
    reminder_status TEXT DEFAULT 'NOT_SENT',
    reminder_sent_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_time_order CHECK (scheduled_end > scheduled_start)
);

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date ON public.appointments(therapist_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);

-- 9. Voice Intake Audit Logs Table
CREATE TABLE IF NOT EXISTS public.voice_intake_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    raw_transcript TEXT NOT NULL,
    extracted_data JSONB NOT NULL,
    intake_type TEXT NOT NULL DEFAULT 'PATIENT_REGISTRATION',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_logs_therapist ON public.voice_intake_logs(therapist_id);

-- 10. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_intake_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Therapists manage own profile" ON public.therapists;
DROP POLICY IF EXISTS "Therapists access own patients" ON public.patients;
DROP POLICY IF EXISTS "Therapists access own episodes" ON public.treatment_episodes;
DROP POLICY IF EXISTS "Therapists access own sessions" ON public.treatment_sessions;
DROP POLICY IF EXISTS "Therapists access own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Therapists access own voice logs" ON public.voice_intake_logs;

CREATE POLICY "Therapists manage own profile"
    ON public.therapists FOR ALL
    USING (auth.uid() = id);

CREATE POLICY "Therapists access own patients"
    ON public.patients FOR ALL
    USING (auth.uid() = therapist_id);

CREATE POLICY "Therapists access own episodes"
    ON public.treatment_episodes FOR ALL
    USING (auth.uid() = therapist_id);

CREATE POLICY "Therapists access own sessions"
    ON public.treatment_sessions FOR ALL
    USING (auth.uid() = therapist_id);

CREATE POLICY "Therapists access own appointments"
    ON public.appointments FOR ALL
    USING (auth.uid() = therapist_id);

CREATE POLICY "Therapists access own voice logs"
    ON public.voice_intake_logs FOR ALL
    USING (auth.uid() = therapist_id);

-- 11. Profile Auto-Creation Trigger on Auth Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.therapists (id, email, full_name, clinic_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'Physio Care Clinic')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
