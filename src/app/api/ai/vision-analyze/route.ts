import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing imageBase64' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 });
    }

    const base64DataUri = `data:${mimeType};base64,${imageBase64}`;

    const systemPrompt = `أنت مساعد تقني متخصص في تحليل لقطات الشاشة والصور التقنية لمنصة DirectHub للتجارة الصناعية B2B.
عند تحليل الصورة، قدّم:
1. وصفاً موجزاً لما تراه في الصورة
2. تحديد أي مشاكل تقنية أو أخطاء أو نقاط تحسين
3. توصيات تقنية محددة وقابلة للتنفيذ
4. الأولوية المقترحة لكل توصية (عالية/متوسطة/منخفضة)

أجب باللغة العربية بشكل واضح ومنظم.`;

    const userPrompt = prompt || 'حلّل هذه الصورة وقدّم توصيات تقنية مفصّلة.';

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: base64DataUri } },
        ],
      },
    ];

    // gemini-3.7-flash is deliberately excluded: it returns 503 ("high demand")
    // under normal load. Both models below were verified to accept image parts.
    const models = ['gemini/gemini-3.5-flash-lite', 'gemini/gemini-3.5-flash'];
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const response = await completion({
          model,
          messages,
          stream: false,
          api_key: apiKey,
          temperature: 0.4,
          max_tokens: 1500,
        } as any);

        const analysis = (response as any)?.choices?.[0]?.message?.content;
        if (analysis) {
          return NextResponse.json({ analysis, model });
        }
        lastError = new Error(`Empty completion from ${model}`);
      } catch (error) {
        lastError = error;
        console.error(`Vision analyze failed on ${model}:`, error);
      }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    const overloaded = /503|ServiceUnavailable|high demand|UNAVAILABLE/i.test(message);

    return NextResponse.json(
      {
        error: overloaded
          ? 'خدمة تحليل الصور مشغولة حالياً. يرجى المحاولة لاحقاً.' :'فشل تحليل الصورة',
        details: message,
      },
      { status: overloaded ? 503 : 500 }
    );
  } catch (error) {
    console.error('Vision analyze error:', error);
    return NextResponse.json(
      { error: 'فشل تحليل الصورة', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
