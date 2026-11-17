import { NextRequest, NextResponse } from 'next/server';
import { getPatients, createPatientRecord } from '@/lib/db/patients';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';

    const patients = await getPatients(query);
    return NextResponse.json({ patients });
  } catch (error: any) {
    console.error('API /api/patients GET error:', error);
    return NextResponse.json({ patients: [], error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      fullName,
      phone,
      age,
      gender,
      occupation,
      address,
      emergencyContact,
      chiefComplaint,
      affectedBodyPart,
      comorbidities = [],
      suggestedPackageSessions = 10,
      packageFee = 0,
      clinicalNotes = '',
      rawTranscript,
    } = body;

    if (!fullName || !phone) {
      return NextResponse.json(
        { error: 'Patient full name and phone number are required.' },
        { status: 400 }
      );
    }

    const { patient, episode } = await createPatientRecord({
      fullName,
      phone,
      age: age ? parseInt(age) : null,
      gender: gender || 'OTHER',
      occupation: occupation || null,
      address: address || null,
      emergencyContact: emergencyContact || null,
      chiefComplaint: chiefComplaint || 'General Physiotherapy',
      affectedBodyPart: affectedBodyPart || 'General',
      comorbidities,
      totalSessions: suggestedPackageSessions || 10,
      packageFee: packageFee || 0,
      clinicalNotes: clinicalNotes || '',
    });

    // If raw transcript was provided, log audit entry for voice intake
    if (rawTranscript) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          therapist_id: user.id,
          patient_id: patient.id,
          action: 'VOICE_INTAKE_PROCESSED',
          entity_type: 'PATIENT',
          entity_id: patient.id,
          details: { raw_transcript: rawTranscript },
        });
      }
    }

    return NextResponse.json({
      success: true,
      patient,
      episode,
    });
  } catch (error: any) {
    console.error('API /api/patients POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create patient.' },
      { status: 500 }
    );
  }
}
