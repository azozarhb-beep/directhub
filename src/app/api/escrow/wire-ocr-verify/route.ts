import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';

/**
 * Wire Transfer / SWIFT Receipt OCR Verification
 * Uses Gemini Vision to extract and verify wire transfer details
 * before freezing funds in escrow.
 */

const WIRE_OCR_SYSTEM_PROMPT = `أنتَ محلل مالي متخصص في التحقق من إيصالات التحويل البنكي الدولي (SWIFT / Wire Transfer).

مهمتك: استخراج وتحليل المعلومات من صورة إيصال التحويل البنكي بدقة عالية.

استخرج المعلومات التالية من الإيصال:
1. المبلغ المحوّل (amount) والعملة (currency)
2. اسم المُرسِل (sender_name)
3. اسم البنك المُرسِل (bank_name)
4. رمز SWIFT/BIC (swift_code)
5. رقم المرجع / رقم التحويل (reference_number)
6. تاريخ التحويل (transfer_date)
7. اسم المستفيد (beneficiary_name)
8. رقم حساب المستفيد أو IBAN (beneficiary_account)
9. مستوى الثقة في صحة الإيصال (confidence: 0-100)
10. هل الإيصال أصلي أم مشكوك فيه (is_authentic: true/false)
11. ملاحظات أو تحذيرات (notes)

أجب بصيغة JSON فقط بدون أي نص إضافي:
{
  "amount": number | null,
  "currency": string | null,
  "sender_name": string | null,
  "bank_name": string | null,
  "swift_code": string | null,
  "reference_number": string | null,
  "transfer_date": string | null,
  "beneficiary_name": string | null,
  "beneficiary_account": string | null,
  "confidence": number,
  "is_authentic": boolean,
  "notes": string
}`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { imageBase64, orderId, mimeType = 'image/jpeg' } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Build base64 data URI
    const dataUri = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 400 });
    }

    // Call Gemini Vision via llm-sdk
    // NOTE: `provider` / `parameters` are NOT valid for Gemini — temperature and
    // max_tokens must be top-level, and dropParams silently discards unsupported keys.
    const response = await completion({
      model: 'gemini/gemini-3.5-flash-lite',
      messages: [
        {
          role: 'system',
          content: WIRE_OCR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'قم بتحليل إيصال التحويل البنكي هذا واستخرج جميع المعلومات المالية المطلوبة.',
            },
            {
              type: 'image_url',
              image_url: { url: dataUri },
            },
          ],
        },
      ],
      stream: false,
      api_key: apiKey,
      temperature: 0.1,
      max_tokens: 1000,
      dropParams: true,
    } as any);

    const rawContent = (response as any)?.choices?.[0]?.message?.content || '{}';

    // Parse JSON from Gemini response
    let ocrResult: Record<string, any> = {};
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      ocrResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      ocrResult = { notes: rawContent, confidence: 0, is_authentic: false };
    }

    // Save receipt record to DB if orderId provided
    if (orderId) {
      const { data: receiptRecord, error: insertError } = await supabase
        .from('wire_transfer_receipts')
        .insert({
          order_id: orderId,
          uploaded_by: user.id,
          receipt_url: '',
          amount_detected: ocrResult.amount || null,
          currency_detected: ocrResult.currency || null,
          sender_name_detected: ocrResult.sender_name || null,
          swift_code_detected: ocrResult.swift_code || null,
          reference_detected: ocrResult.reference_number || null,
          bank_name_detected: ocrResult.bank_name || null,
          ocr_raw_result: ocrResult,
          ocr_confidence: ocrResult.confidence || 0,
          verification_status: ocrResult.confidence >= 70 ? 'verified' : 'manual_review',
        })
        .select('id')
        .single();

      if (!insertError && receiptRecord) {
        // Update order wire_transfer_verified if confidence is high
        if (ocrResult.confidence >= 70 && ocrResult.is_authentic) {
          await supabase
            .from('orders')
            .update({
              wire_transfer_verified: true,
              wire_transfer_verified_at: new Date().toISOString(),
              wire_transfer_ocr_result: ocrResult,
            })
            .eq('id', orderId)
            .eq('user_id', user.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ocrResult,
      verified: (ocrResult.confidence || 0) >= 70 && ocrResult.is_authentic,
      confidence: ocrResult.confidence || 0,
    });
  } catch (err: any) {
    console.error('[Wire OCR Verify]', err);
    return NextResponse.json(
      { error: err.message || 'OCR verification failed' },
      { status: 500 }
    );
  }
}
