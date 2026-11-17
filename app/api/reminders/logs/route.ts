import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * GET /api/reminders/logs
 * Retrieve delivery audit logs for compliance, troubleshooting, and delivery verification
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const appointmentId = searchParams.get('appointmentId');
    const reminderId = searchParams.get('reminderId');

    let query = supabase
      .from('reminder_delivery_logs')
      .select('*, patients(full_name, phone, patient_code)')
      .eq('therapist_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (appointmentId) query = query.eq('appointment_id', appointmentId);
    if (reminderId) query = query.eq('reminder_id', reminderId);

    const { data: logs, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch delivery logs' },
      { status: 500 }
    );
  }
}
