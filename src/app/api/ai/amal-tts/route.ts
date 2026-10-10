import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Dedicated Amal TTS route using Gemini 2.5 Flash TTS REST API
 * with Aoede voice — warm, melodic, human-quality feminine voice
 */
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

    const body = await request.json();
    const { text, voice = 'Aoede' } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: text' },
        { status: 400 }
      );
    }

    // Gemini Flash TTS — human-quality, expressive voices
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
              },
            },
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Amal TTS Gemini error:', errBody);
      // Fallback to the lite TTS model if the primary is unavailable
      const fallbackRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
            },
          }),
        }
      );

      if (!fallbackRes.ok) {
        return NextResponse.json(
          { error: `Gemini TTS error: ${geminiRes.status}`, details: errBody },
          { status: geminiRes.status }
        );
      }

      const fallbackData = await fallbackRes.json();
      const fallbackAudioData =
        fallbackData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      const fallbackMime =
        fallbackData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

      if (!fallbackAudioData) {
        return NextResponse.json({ error: 'No audio data from fallback' }, { status: 500 });
      }

      const buf = Buffer.from(fallbackAudioData, 'base64');
      return new NextResponse(buf, {
        status: 200,
        headers: { 'Content-Type': fallbackMime },
      });
    }

    const geminiData = await geminiRes.json();
    const audioData =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

    if (!audioData) {
      return NextResponse.json(
        { error: 'No audio data returned from Gemini TTS' },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.from(audioData, 'base64');
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: { 'Content-Type': mimeType },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Amal TTS Error:', { details });
    return NextResponse.json(
      { error: 'TTS generation failed', details },
      { status: 500 }
    );
  }
}
