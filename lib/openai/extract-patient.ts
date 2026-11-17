import { openai } from './client';
import { ExtractedPatientData } from '@/types/clinical';

const SYSTEM_PROMPT = `
You are an expert clinical AI assistant for independent physiotherapists in India.
Your task is to analyze dictated voice transcripts from physiotherapists or clinical staff and extract structured patient registration and treatment episode information.

Contextual Guidance:
- The clinician may speak in Indian English, Hinglish, or mixed medical colloquialisms (e.g., "radiating pain to hath", "cervical spondylosis", "IFT ultrasound diya", "10 days package", "diabetic patient").
- Accurately normalize medical terms:
  - Modalities: IFT (Interferential Therapy), US/Ultrasound, TENS, SWD (Short Wave Diathermy), Traction, Dry Needling, Cupping, Theraband Exercises, Manual Mobilization.
  - Body parts: Cervical Spine, Lumbar Spine, Thoracic Spine, Left/Right Shoulder, Left/Right Knee, Hip, Ankle, Wrist, Elbow.
  - Comorbidities: Diabetes, Hypertension, Cardiac Disease, Pacemaker, Osteoporosis, Hypothyroidism, Previous Surgeries.
- If phone number is mentioned with 10 digits, format cleanly as 10 digits (e.g. 9876543210).
- If package session count is not specified, default to 10.
- If age is mentioned in years, extract as integer.
- Determine gender ('MALE', 'FEMALE', or 'OTHER') if explicitly mentioned or strongly indicated; default to 'OTHER' if indeterminate.

Respond strictly in valid JSON matching the following schema:
{
  "fullName": string,
  "phone": string,
  "age": number | null,
  "gender": "MALE" | "FEMALE" | "OTHER",
  "occupation": string | null,
  "chiefComplaint": string,
  "affectedBodyPart": string,
  "comorbidities": string[],
  "suggestedPackageSessions": number,
  "packageFee": number,
  "clinicalNotes": string
}
`;

export async function extractPatientFromTranscript(transcript: string): Promise<ExtractedPatientData> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Transcribe and extract structured clinical fields from this physiotherapy intake note:\n\n"""\n${transcript}\n"""`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response during patient extraction.');
  }

  const parsed = JSON.parse(content) as ExtractedPatientData;

  // Sanitize and guarantee defaults
  return {
    fullName: parsed.fullName || 'Unknown Patient',
    phone: parsed.phone ? parsed.phone.replace(/[^0-9]/g, '').slice(-10) : '',
    age: typeof parsed.age === 'number' ? parsed.age : null,
    gender: ['MALE', 'FEMALE', 'OTHER'].includes(parsed.gender) ? parsed.gender : 'OTHER',
    occupation: parsed.occupation || null,
    chiefComplaint: parsed.chiefComplaint || 'Physiotherapy Consultation',
    affectedBodyPart: parsed.affectedBodyPart || 'General',
    comorbidities: Array.isArray(parsed.comorbidities) ? parsed.comorbidities : [],
    suggestedPackageSessions: parsed.suggestedPackageSessions || 10,
    packageFee: typeof parsed.packageFee === 'number' ? parsed.packageFee : 0,
    clinicalNotes: parsed.clinicalNotes || transcript,
  };
}
