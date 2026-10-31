import { NextRequest, NextResponse } from 'next/server';
import { imageEdit } from '@rocketnew/llm-sdk';

const API_KEYS: Record<string, string | undefined> = {
  OPEN_AI: process.env.OPENAI_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
};

function formatErrorResponse(error: unknown, provider?: string) {
  const statusCode = (error as any)?.statusCode || (error as any)?.status || 500;
  const providerName = (error as any)?.llmProvider || provider || 'Unknown';

  return {
    error: `${providerName.toUpperCase()} API error: ${statusCode}`,
    details: error instanceof Error ? error.message : String(error),
    statusCode,
  };
}

export async function POST(request: NextRequest) {
  let body: any = {};

  try {
    body = await request.json();
    const { provider, model, image, prompt, parameters = {} } = body;

    if (!provider || !model || !image || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, model, image, prompt', details: 'Request validation failed' },
        { status: 400 }
      );
    }

    const apiKey = API_KEYS[provider];
    if (!apiKey) {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} API key is not configured`, details: 'The API key for this provider is missing in environment variables' },
        { status: 400 }
      );
    }

    // imageEdit() expects binary input for multipart uploads, not base64 strings.
    const toBuffer = (input: string): Buffer => {
      const base64 = input.startsWith('data:') ? input.split(',')[1] : input;
      return Buffer.from(base64, 'base64');
    };

    const processedImage = toBuffer(image);
    const processedMask = parameters.mask ? toBuffer(parameters.mask) : undefined;

    const response = await imageEdit({
      model,
      prompt,
      image: processedImage,
      api_key: apiKey,
      ...parameters,
      ...(processedMask && { mask: processedMask }),
    });

    return NextResponse.json(response);
  } catch (error) {
    const formatted = formatErrorResponse(error, body?.provider);
    console.error('API Route Error:', { error: formatted.error, details: formatted.details });
    return NextResponse.json(
      { error: formatted.error, details: formatted.details },
      { status: formatted.statusCode }
    );
  }
}
