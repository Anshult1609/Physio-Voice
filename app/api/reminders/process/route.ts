import { NextRequest, NextResponse } from 'next/server';
import { processDueReminders } from '@/lib/reminders/scheduler';

export const runtime = 'nodejs';

/**
 * POST /api/reminders/process
 * Server-side cron/scheduler worker endpoint to process all due reminders
 */
export async function POST(req: NextRequest) {
  try {
    const result = await processDueReminders();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('Error processing reminders scheduler:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process due reminders' },
      { status: 500 }
    );
  }
}
