import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordSessionAttendance } from '@/lib/db/sessions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const supabase = await createClient();

    // Fetch attendance joined with clinical notes
    const { data: attendanceRecords, error } = await supabase
      .from('attendance')
      .select(`
        *,
        clinical_notes (*)
      `)
      .eq('patient_id', patientId)
      .order('session_number', { ascending: false });

    if (error) {
      return NextResponse.json({ sessions: [], error: error.message }, { status: 500 });
    }

    // Flatten to format expected by UI
    const sessions = (attendanceRecords || []).map((att: any) => {
      const note = att.clinical_notes?.[0] || {};
      return {
        id: att.id,
        episode_id: att.episode_id,
        patient_id: att.patient_id,
        session_number: att.session_number,
        session_date: att.attended_at,
        attendance_status: att.attendance_status,
        pain_score: note.pain_score,
        subjective_notes: note.subjective_notes,
        objective_findings: note.objective_findings,
        modalities_used: note.modalities_used || [],
        exercise_prescription: note.exercise_prescription,
        therapist_remarks: note.therapist_remarks,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ sessions: [], error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const supabase = await createClient();
    const body = await req.json();

    const {
      episodeId,
      attendanceStatus = 'ATTENDED',
      painScore,
      subjectiveNotes,
      objectiveFindings,
      modalitiesUsed = [],
      exercisePrescription,
      therapistRemarks,
    } = body;

    if (!episodeId) {
      return NextResponse.json(
        { error: 'Episode ID is required to log a session.' },
        { status: 400 }
      );
    }

    // Count existing sessions in this episode to set session_number
    const { count } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('episode_id', episodeId);

    const nextSessionNumber = (count || 0) + 1;

    // Use db helper which handles attendance, clinical notes, trigger auto-decrement, and audit logs
    const result = await recordSessionAttendance({
      patientId,
      episodeId,
      sessionNumber: nextSessionNumber,
      attendanceStatus,
      painScore: painScore !== undefined && painScore !== null ? parseInt(painScore) : undefined,
      subjectiveNotes,
      objectiveFindings,
      modalitiesUsed,
      exercisePrescription,
      therapistRemarks,
    });

    // Fetch updated episode to return new remaining_sessions count
    const { data: updatedEpisode } = await supabase
      .from('treatment_episodes')
      .select('*')
      .eq('id', episodeId)
      .single();

    return NextResponse.json({
      success: true,
      attendance: result.attendance,
      clinicalNote: result.note,
      episode: updatedEpisode,
    });
  } catch (error: any) {
    console.error('API /api/patients/[id]/sessions POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log treatment session.' },
      { status: 500 }
    );
  }
}
