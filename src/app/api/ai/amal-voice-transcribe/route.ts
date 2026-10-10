import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI API key is not configured' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'Missing audio file' },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = fileEntry.type || 'audio/webm';

    // Use Gemini Flash with proper inline_data format for audio
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: 'Please transcribe the audio accurately. Return ONLY the spoken words, nothing else. No explanations, no labels, no formatting — just the transcribed text. If the audio is in Arabic, return Arabic text. If English, return English.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini transcription error:', errBody);
      return NextResponse.json(
        { error: `Gemini API error: ${geminiRes.status}`, details: errBody },
        { status: geminiRes.status }
      );
    }

    const geminiData = await geminiRes.json();
    const transcribedText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    return NextResponse.json({ text: transcribedText });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Amal Voice Transcribe Error:', { details });
    return NextResponse.json(
      { error: 'Transcription failed', details },
      { status: 500 }
    );
  }
}
