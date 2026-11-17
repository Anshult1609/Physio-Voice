import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPatientById } from '@/lib/db/patients';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const patient = await getPatientById(patientId);

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({ patient });
  } catch (error: any) {
    console.error('API /api/patients/[id] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const supabase = await createClient();
    const body = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Therapist must be logged in' }, { status: 401 });
    }

    const {
      fullName,
      phone,
      age,
      gender,
      occupation,
      address,
      emergencyContact,
      medicalHistoryNotes,
      comorbidities,
    } = body;

    const { data: updatedPatient, error } = await supabase
      .from('patients')
      .update({
        full_name: fullName,
        phone,
        age: age ? parseInt(age) : null,
        gender,
        occupation,
        address,
        emergency_contact: emergencyContact,
        medical_history_notes: medicalHistoryNotes,
        comorbidities: comorbidities || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', patientId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      therapist_id: user.id,
      patient_id: patientId,
      action: 'PATIENT_UPDATE',
      entity_type: 'PATIENT',
      entity_id: patientId,
      details: { updated_fields: Object.keys(body) },
    });

    return NextResponse.json({ success: true, patient: updatedPatient });
  } catch (error: any) {
    console.error('API /api/patients/[id] PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Therapist must be logged in' }, { status: 401 });
    }

    // Soft delete patient
    const { data: deletedPatient, error } = await supabase
      .from('patients')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', patientId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      therapist_id: user.id,
      patient_id: patientId,
      action: 'PATIENT_DEACTIVATE',
      entity_type: 'PATIENT',
      entity_id: patientId,
    });

    return NextResponse.json({ success: true, patient: deletedPatient });
  } catch (error: any) {
    console.error('API /api/patients/[id] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
