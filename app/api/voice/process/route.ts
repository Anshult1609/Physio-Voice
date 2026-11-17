import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai/client';
import { extractStructuredVoiceData, KnownPatientRecord } from '@/lib/voice/clinical-nlp';
import { VoiceProcessingResult } from '@/types/voice';

export const runtime = 'nodejs';

const SYSTEM_VOICE_PROMPT = `
You are the Physio Voice Clinical Assistant for independent physiotherapists in India.
Your mission is to transcribe and extract structured clinical intent and entities from hands-free dictation.

SUPPORTED INTENTS:
1. 'PATIENT_REGISTRATION': Registering a new patient, demographic details, chief complaint, affected body region, comorbidities, package sessions, and fee.
2. 'ATTENDANCE_UPDATE': Recording session visit attendance ('ATTENDED', 'NO_SHOW', 'CANCELLED'), VAS pain score (0-10), and modalities used.
3. 'APPOINTMENT_SCHEDULING': Scheduling or booking an appointment slot, date, time, and clinical preparation notes.
4. 'PATIENT_SEARCH': Clinician asking to look up or find a patient by name, phone, or patient ID.
5. 'HISTORY_RETRIEVAL': Clinician asking to see previous visits, progress, or remaining package sessions balance.
6. 'UNKNOWN': Dictation unrelated or insufficient information.

STRICT CLINICAL SAFETY RULES:
- NEVER invent patient data or fill in missing fields with imaginary information. If a field was not explicitly spoken, return null or an empty list.
- NEVER generate medical diagnoses or unprescribed treatment advice. Only extract what the clinician dictated.
- Clean Indian mobile phone numbers to exactly 10 digits (e.g. "9811234567").
- For package sessions, if not specified in registration, default to 10.

Respond strictly in valid JSON matching:
{
  "intent": "PATIENT_REGISTRATION" | "ATTENDANCE_UPDATE" | "APPOINTMENT_SCHEDULING" | "PATIENT_SEARCH" | "HISTORY_RETRIEVAL" | "UNKNOWN",
  "patientIdentifier": string,
  "registration": {
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
  } | null,
  "attendance": {
    "patientIdentifier": string,
    "status": "ATTENDED" | "NO_SHOW" | "CANCELLED",
    "date": string,
    "painScore": number | null,
    "modalities": string[],
    "notes": string
  } | null,
  "scheduling": {
    "patientIdentifier": string,
    "date": string,
    "startTime": string,
    "durationMinutes": number,
    "notes": string
  } | null,
  "search": {
    "query": string
  } | null
}
`;

export async function POST(req: NextRequest) {
  try {
    let transcript = '';
    let knownPatients: KnownPatientRecord[] = [];

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const audioFile = formData.get('audio') as Blob | null;
      const rawText = formData.get('text') as string | null;
      const patientsJson = formData.get('knownPatients') as string | null;

      if (patientsJson) {
        try {
          knownPatients = JSON.parse(patientsJson);
        } catch (e) {}
      }

      if (rawText && rawText.trim()) {
        transcript = rawText.trim();
      } else if (audioFile) {
        // Transcribe via Whisper if OpenAI API key is present
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
          try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const file = new File([buffer], 'audio.webm', { type: audioFile.type || 'audio/webm' });

            const transcription = await openai.audio.transcriptions.create({
              file: file,
              model: 'whisper-1',
              prompt: 'Physiotherapy clinical dictation: Sunita Sharma, Rajesh Verma, cervical spine, IFT, ultrasound, TENS, dry needling, package sessions, attended, no-show, appointment.',
            });
            transcript = transcription.text?.trim() || '';
          } catch (whisperErr: any) {
            console.warn('Whisper API call failed, using client transcript or fallback:', whisperErr?.message);
          }
        }
      }
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      transcript = body.transcript || body.text || '';
      knownPatients = body.knownPatients || [];
    }

    if (!transcript) {
      return NextResponse.json(
        { error: 'No transcript or speech detected. Please speak into the microphone or type manual dictation.' },
        { status: 400 }
      );
    }

    // Process via Clinical NLP & Safety extraction engine
    const localResult = extractStructuredVoiceData(transcript, knownPatients);

    // If OpenAI API key is present and valid, optionally enhance with GPT-4o
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_VOICE_PROMPT },
            {
              role: 'user',
              content: `Process this physiotherapy dictation:\n"""${transcript}"""`,
            },
          ],
        });

        const aiText = aiResponse.choices[0]?.message?.content;
        if (aiText) {
          const aiJson = JSON.parse(aiText);
          if (aiJson.intent && aiJson.intent !== 'UNKNOWN') {
            localResult.intent = aiJson.intent;
          }
          if (aiJson.registration && localResult.intent === 'PATIENT_REGISTRATION') {
            localResult.registrationPayload = {
              ...localResult.registrationPayload,
              ...aiJson.registration,
            };
          }
        }
      } catch (aiErr) {
        console.warn('AI enhancement fallback used:', aiErr);
      }
    }

    return NextResponse.json(localResult);
  } catch (error: any) {
    console.error('API /api/voice/process error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing voice dictation.' },
      { status: 500 }
    );
  }
}
