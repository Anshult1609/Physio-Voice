import { NextRequest, NextResponse } from 'next/server';
import { 
  editAppointment, 
  rescheduleAppointment, 
  cancelAppointment, 
  setAppointmentAttendanceStatus 
} from '@/lib/db/appointments';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patients (*),
        treatment_episodes (*),
        attendance (*)
      `)
      .eq('id', id)
      .single();

    if (error || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: appointmentId } = await params;
    const body = await req.json();

    // 1. Reschedule action
    if (body.action === 'RESCHEDULE' || (body.newScheduledStart && body.newScheduledEnd)) {
      const updated = await rescheduleAppointment({
        appointmentId,
        newScheduledStart: body.newScheduledStart,
        newScheduledEnd: body.newScheduledEnd,
        reason: body.reason,
      });
      return NextResponse.json({ success: true, appointment: updated });
    }

    // 2. Cancellation action
    if (body.action === 'CANCEL' || body.status === 'CANCELLED') {
      const updated = await cancelAppointment(appointmentId, body.reason);
      return NextResponse.json({ success: true, appointment: updated });
    }

    // 3. Attendance Status action (ATTENDED, NO_SHOW, CANCELLED, SCHEDULED)
    if (body.action === 'ATTENDANCE_STATUS' || ['ATTENDED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'SCHEDULED'].includes(body.status)) {
      const targetStatus = body.status === 'COMPLETED' ? 'ATTENDED' : body.status;
      const result = await setAppointmentAttendanceStatus(appointmentId, targetStatus);
      return NextResponse.json({ success: true, ...result });
    }

    // 4. General Edit
    const updated = await editAppointment({
      appointmentId,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      notes: body.notes,
      reminderChannel: body.reminderChannel,
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error: any) {
    console.error('API /api/appointments/[id] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update appointment.' },
      { status: 500 }
    );
  }
}
