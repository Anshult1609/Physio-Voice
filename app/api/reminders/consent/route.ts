import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  getPatientNotificationConsent, 
  updatePatientNotificationConsent 
} from '@/lib/reminders/scheduler';

export const runtime = 'nodejs';

/**
 * GET /api/reminders/consent?patientId=...
 * Fetch patient notification consent preferences
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const consent = await getPatientNotificationConsent(patientId, user.id);

    return NextResponse.json({
      success: true,
      consent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch consent preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reminders/consent
 * Update patient notification consent preferences
 */
export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { patientId, inApp, whatsapp, sms } = body;

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const updated = await updatePatientNotificationConsent(patientId, user.id, {
      inApp,
      whatsapp,
      sms,
    });

    return NextResponse.json({
      success: true,
      consent: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update consent preferences' },
      { status: 500 }
    );
  }
}
