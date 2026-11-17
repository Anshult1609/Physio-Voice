import { NextRequest, NextResponse } from 'next/server';
import { getAppointments, createAppointment } from '@/lib/db/appointments';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || searchParams.get('date') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const appointments = await getAppointments(startDate, endDate);
    return NextResponse.json({ appointments });
  } catch (error: any) {
    console.error('API /api/appointments GET error:', error);
    return NextResponse.json({ appointments: [], error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, episodeId, scheduledStart, scheduledEnd, notes, reminderChannel } = body;

    if (!patientId || !scheduledStart || !scheduledEnd) {
      return NextResponse.json(
        { error: 'patientId, scheduledStart, and scheduledEnd are required.' },
        { status: 400 }
      );
    }

    const appointment = await createAppointment({
      patientId,
      episodeId,
      scheduledStart,
      scheduledEnd,
      notes,
      reminderChannel,
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error: any) {
    console.error('API /api/appointments POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule appointment.' },
      { status: 500 }
    );
  }
}
