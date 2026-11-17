import { openai } from './client';
import { ExtractedSessionData } from '@/types/clinical';

const SESSION_PROMPT = `
You are an expert clinical AI assistant for independent physiotherapists in India.
Your task is to analyze dictated voice session notes and extract structured treatment attendance, pain scores, modalities used, and exercise prescriptions.

Contextual Guidance:
- Pain score: Numeric score on Visual Analogue Scale (VAS) from 0 (no pain) to 10 (worst pain). If a range or change is mentioned (e.g. "reduced to 3"), extract the current pain level (3).
- Attendance: Default to 'ATTENDED'. If patient did not show up or cancelled, mark 'MISSED' or 'CANCELLED'.
- Modalities: Normalize terms like IFT, TENS, Ultrasound, SWD, Hot Pack, Ice Pack, Traction, Cupping, Dry Needling, Mobilization, Theraband, Manual Therapy.
- Exercises: Specific exercises prescribed for clinic or home practice.

Respond strictly in valid JSON matching this schema:
{
  "painScore": number | null,
  "attendanceStatus": "ATTENDED" | "MISSED" | "CANCELLED",
  "modalitiesUsed": string[],
  "subjectiveFeedback": string,
  "objectiveProgress": string,
  "exercisesGiven": string,
  "therapistNotes": string
}
`;

export async function extractSessionFromTranscript(transcript: string): Promise<ExtractedSessionData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SESSION_PROMPT },
      {
        role: 'user',
        content: `Extract structured session notes from this clinical dictation:\n\n"""\n${transcript}\n"""`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response during session note extraction.');
  }

  const parsed = JSON.parse(content) as ExtractedSessionData;

  return {
    painScore: typeof parsed.painScore === 'number' && parsed.painScore >= 0 && parsed.painScore <= 10 ? parsed.painScore : null,
    attendanceStatus: ['ATTENDED', 'MISSED', 'CANCELLED'].includes(parsed.attendanceStatus) ? parsed.attendanceStatus : 'ATTENDED',
    modalitiesUsed: Array.isArray(parsed.modalitiesUsed) ? parsed.modalitiesUsed : [],
    subjectiveFeedback: parsed.subjectiveFeedback || '',
    objectiveProgress: parsed.objectiveProgress || '',
    exercisesGiven: parsed.exercisesGiven || '',
    therapistNotes: parsed.therapistNotes || transcript,
  };
}
