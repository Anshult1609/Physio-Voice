import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceIntake } from '@/lib/voice-parser';

/**
 * API Route: /api/voice/parse
 * Accepts spoken transcript and converts into structured clinical fields
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid transcript string' },
        { status: 400 }
      );
    }

    const parsedData = parseVoiceIntake(transcript);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
