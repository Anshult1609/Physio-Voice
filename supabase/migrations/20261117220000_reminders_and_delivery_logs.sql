-- ==============================================================================
-- MIGRATION: REMINDERS, DELIVERY LOGS & NOTIFICATION CONSENT
-- Physio Voice Healthcare SaaS (DPDPA 2023 & Clinical Audit Compliance)
-- ==============================================================================

-- 1. Enhance public.reminders table
ALTER TABLE public.reminders 
    DROP CONSTRAINT IF EXISTS reminders_channel_check,
    DROP CONSTRAINT IF EXISTS reminders_status_check;

ALTER TABLE public.reminders
    ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT reminders_channel_check 
        CHECK (channel IN ('IN_APP', 'WHATSAPP', 'SMS', 'EMAIL')),
    ADD CONSTRAINT reminders_status_check 
        CHECK (status IN ('PENDING', 'DISPATCHED', 'DELIVERED', 'PENDING_CONFIRMATION', 'CANCELLED', 'FAILED', 'SKIPPED_NO_CONSENT'));

-- Index on scheduled_for and status for fast scheduler polling
CREATE INDEX IF NOT EXISTS idx_reminders_due_scheduler 
    ON public.reminders(scheduled_for, status) 
    WHERE status = 'PENDING';

-- 2. Create Delivery Logs Table
CREATE TABLE IF NOT EXISTS public.reminder_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reminder_id UUID REFERENCES public.reminders(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'WHATSAPP', 'SMS', 'EMAIL')),
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    delivery_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    provider_message_id TEXT,
    response_payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_therapist_id ON public.reminder_delivery_logs(therapist_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_appointment_id ON public.reminder_delivery_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_reminder_id ON public.reminder_delivery_logs(reminder_id);

-- 3. Patient Notification Consent (DPDPA 2023 Compliance)
CREATE TABLE IF NOT EXISTS public.patient_notification_consents (
    patient_id UUID PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
    therapist_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    consent_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    consent_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
    consent_sms BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_therapist_id ON public.patient_notification_consents(therapist_id);

-- 4. Enable Row Level Security
ALTER TABLE public.reminder_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_delivery_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.patient_notification_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notification_consents FORCE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Therapists access own delivery logs" ON public.reminder_delivery_logs;
CREATE POLICY "Therapists access own delivery logs"
    ON public.reminder_delivery_logs FOR ALL
    USING (therapist_id = auth.uid())
    WITH CHECK (therapist_id = auth.uid());

DROP POLICY IF EXISTS "Therapists access own patient consents" ON public.patient_notification_consents;
CREATE POLICY "Therapists access own patient consents"
    ON public.patient_notification_consents FOR ALL
    USING (therapist_id = auth.uid())
    WITH CHECK (therapist_id = auth.uid());
