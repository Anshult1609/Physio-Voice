import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  scheduleAppointmentReminder, 
  getInAppNotifications 
} from '@/lib/reminders/scheduler';
import { ReminderChannel } from '@/types/reminders';

export const runtime = 'nodejs';

/**
 * GET /api/reminders
 * Retrieve reminders and in-app notifications for authenticated clinician
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channel = searchParams.get('channel') as ReminderChannel | null;
    const type = searchParams.get('type'); // 'IN_APP_NOTIFICATIONS' | 'ALL'

    if (type === 'IN_APP_NOTIFICATIONS' || channel === 'IN_APP') {
      const inAppList = await getInAppNotifications(user.id);
      return NextResponse.json({ success: true, notifications: inAppList });
    }

    let query = supabase
      .from('reminders')
      .select('*, patients(id, full_name, phone, patient_code), appointments(id, scheduled_start, status)')
      .eq('therapist_id', user.id)
      .order('scheduled_for', { ascending: false });

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data: reminders, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      reminders: reminders || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reminders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders
 * Schedule a new reminder with duplicate prevention & consent checks
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();

    const {
      patientId,
      appointmentId,
      scheduledStart,
      recipientPhone,
      patientName,
      clinicName,
      therapistName,
      channel,
      hoursBefore,
      instructions,
    } = body;

    if (!patientId || !appointmentId || !scheduledStart) {
      return NextResponse.json(
        { error: 'patientId, appointmentId, and scheduledStart are required.' },
        { status: 400 }
      );
    }

    const result = await scheduleAppointmentReminder({
      therapistId: user.id,
      patientId,
      appointmentId,
      scheduledStart,
      recipientPhone: recipientPhone || '',
      patientName: patientName || 'Patient',
      clinicName: clinicName || 'Physio Voice Clinic',
      therapistName: therapistName || 'Clinician',
      channel: channel || 'IN_APP',
      hoursBefore: hoursBefore || 2,
      instructions,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to schedule reminder' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reminders
 * Mark reminder as read or update status
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { reminderId, isRead, markAllAsRead } = body;

    if (markAllAsRead) {
      await supabase
        .from('reminders')
        .update({ is_read: true })
        .eq('therapist_id', user.id);

      return NextResponse.json({ success: true, message: 'All reminders marked as read' });
    }

    if (!reminderId) {
      return NextResponse.json({ error: 'reminderId is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reminders')
      .update({ is_read: isRead !== undefined ? isRead : true })
      .eq('id', reminderId)
      .eq('therapist_id', user.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, reminder: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update reminder' },
      { status: 500 }
    );
  }
}
