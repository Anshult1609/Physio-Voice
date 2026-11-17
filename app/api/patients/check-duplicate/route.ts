import { NextRequest, NextResponse } from 'next/server';
import { checkPatientDuplicateByPhone } from '@/lib/db/patients';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone') || '';
    const excludeId = searchParams.get('excludeId') || undefined;

    if (!phone || phone.replace(/[^0-9]/g, '').length < 10) {
      return NextResponse.json({ duplicate: null });
    }

    const duplicate = await checkPatientDuplicateByPhone(phone, excludeId);
    return NextResponse.json({ duplicate });
  } catch (error: any) {
    console.error('API /api/patients/check-duplicate error:', error);
    return NextResponse.json({ duplicate: null, error: error.message }, { status: 500 });
  }
}
