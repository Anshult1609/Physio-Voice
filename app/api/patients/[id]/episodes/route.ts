import { NextRequest, NextResponse } from 'next/server';
import { createTreatmentEpisode } from '@/lib/db/patients';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const supabase = await createClient();

    const { data: episodes, error } = await supabase
      .from('treatment_episodes')
      .select(`
        *,
        attendance (
          *,
          clinical_notes (*)
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ episodes: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ episodes: episodes || [] });
  } catch (error: any) {
    return NextResponse.json({ episodes: [], error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const body = await req.json();

    const {
      title,
      chiefComplaint,
      affectedBodyPart,
      startDate,
      totalPackageSessions = 10,
      packageFee = 6000,
      amountPaid = 0,
      paymentStatus = 'PENDING',
      clinicalGoals,
      archivePreviousActive = false,
    } = body;

    if (!title || !chiefComplaint) {
      return NextResponse.json(
        { error: 'Condition Title and Chief Complaint are required.' },
        { status: 400 }
      );
    }

    const episode = await createTreatmentEpisode(patientId, {
      title,
      chiefComplaint,
      affectedBodyPart: affectedBodyPart || 'General',
      startDate,
      totalPackageSessions: parseInt(totalPackageSessions) || 10,
      packageFee: parseFloat(packageFee) || 0,
      amountPaid: parseFloat(amountPaid) || 0,
      paymentStatus,
      clinicalGoals,
      archivePreviousActive,
    });

    return NextResponse.json({ success: true, episode });
  } catch (error: any) {
    console.error('API /api/patients/[id]/episodes POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create treatment episode.' },
      { status: 500 }
    );
  }
}
