import { NextRequest, NextResponse } from 'next/server';
import { completion } from '@rocketnew/llm-sdk';
import { createClient } from '@/lib/supabase/server';

/**
 * Partner Document Verification API Route — DirectHub Hybrid AI + Manual Review
 *
 * Uses Gemini AI to verify partner documents (commercial registry, tax number, licenses).
 * Returns JSON: { isValid, documentType, extractedData, confidence, issues }
 *
 * HYBRID REVIEW LOGIC:
 * - confidence >= 0.7 AND isValid = true → status: "verified" (instant approval)
 * - confidence < 0.7 OR isValid = false → status: "pending_manual_review" (never rejected outright)
 * - No document provided → status: "pending_manual_review" (warm handling)
 *
 * Stores all partner data in Supabase `partners` table.
 * Inserts admin_notifications for all exception cases.
 */

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/ai/partner-verify',
    method: 'POST',
    description: 'التحقق من الشركاء — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'هذا المسار يعمل في وضع المحاكاة الآمنة.',
  });
}

export async function POST(request: NextRequest) {
  try {
    // ── Authentication check ──────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      imageBase64,
      partnerData,
    }: {
      imageBase64?: string;
      partnerData: {
        full_name: string;
        company_name: string;
        partner_type: string;
        user_id?: string;
      };
    } = body;

    if (!partnerData?.full_name || !partnerData?.company_name) {
      return NextResponse.json({ error: 'Missing required partner data' }, { status: 400 });
    }

    // ── AI Document Verification ──────────────────────────────────────────────
    let verificationResult = {
      isValid: false,
      documentType: 'unknown',
      extractedData: {} as Record<string, string>,
      confidence: 0,
      issues: ['No document provided — pending manual review'],
    };

    let aiVerificationAttempted = false;

    if (imageBase64) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('[Partner Verify] GEMINI_API_KEY not configured');
        verificationResult.issues = ['AI verification service not configured — pending manual review'];
      } else {
        aiVerificationAttempted = true;
        const systemPrompt = `You are an expert AI document verification specialist for DirectHub B2B marketplace — the leading platform in Yemen and the region that connects buyers directly with factories, with zero middlemen.

Analyze the uploaded business document and return ONLY valid JSON with this exact structure:
{
  "isValid": true or false,
  "documentType": "commercial_registry" | "tax_certificate" | "trade_license" | "business_license" | "transport_license" | "export_license" | "unknown",
  "extractedData": {
    "companyName": "extracted company name",
    "registrationNumber": "registration or license number",
    "taxId": "tax identification number if present",
    "issueDate": "YYYY-MM-DD or as shown",
    "expiryDate": "YYYY-MM-DD or as shown",
    "issuingAuthority": "government body that issued it",
    "businessActivity": "described business activities",
    "ownerName": "owner or authorized person name",
    "address": "company address",
    "country": "country of registration"
  },
  "confidence": 0.85,
  "issues": ["list of any issues found, empty array if none"]
}

Verification Rules:
- isValid = true ONLY if: document is authentic, clearly readable, not expired, and appears to be an official government-issued document
- confidence is a decimal between 0 and 1 (e.g. 0.85 = 85% confidence)
- If document is unreadable or blurry: set confidence below 0.4 and isValid to false
- If document appears expired: set isValid to false and note in issues
- If document is a photo of a document (not a scan): reduce confidence by 0.1
- If document is from Yemen, Saudi Arabia, UAE, or GCC: standard commercial registry formats apply
- Return ONLY JSON, no markdown, no explanation, no code blocks`;

        try {
          const response = await completion({
            model: 'gemini/gemini-3.5-flash-lite',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Please verify this business document for a ${partnerData.partner_type} partner registration. Company: ${partnerData.company_name}. Extract all information and assess validity:`,
                  },
                  { type: 'image_url', image_url: { url: imageBase64 } },
                ],
              },
            ],
            stream: false,
            api_key: apiKey,
            temperature: 0.1,
            max_tokens: 1500,
          });

          const content = (response as any)?.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            verificationResult = {
              isValid: parsed.isValid ?? false,
              documentType: parsed.documentType ?? 'unknown',
              extractedData: parsed.extractedData ?? {},
              confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
              issues: Array.isArray(parsed.issues) ? parsed.issues : [],
            };
          } else {
            verificationResult.issues = ['AI could not parse document structure — pending manual review'];
            verificationResult.confidence = 0.3;
          }
        } catch (aiError) {
          console.error('[Partner Verify] AI verification error:', aiError);
          verificationResult = {
            isValid: false,
            documentType: 'unknown',
            extractedData: {},
            confidence: 0,
            issues: ['AI verification service temporarily unavailable — pending manual review'],
          };
        }
      }
    }

    // ── Hybrid Review Decision ────────────────────────────────────────────────
    // RULE: Never reject outright. Low confidence or invalid → pending_manual_review
    const CONFIDENCE_THRESHOLD = 0.7;
    const needsManualReview =
      !verificationResult.isValid ||
      verificationResult.confidence < CONFIDENCE_THRESHOLD ||
      !imageBase64; // No document → always manual review

    const documentStatus = needsManualReview ? 'pending_manual_review' : 'verified';

    // ── Store in Supabase partners table ──────────────────────────────────────
    const partnerInsert: Record<string, any> = {
      full_name: partnerData.full_name,
      company_name: partnerData.company_name,
      partner_type: partnerData.partner_type || 'local_factory',
      commercial_registry: verificationResult.extractedData?.registrationNumber || null,
      tax_number: verificationResult.extractedData?.taxId || null,
      document_status: documentStatus,
      extracted_document_data: {
        verification: verificationResult,
        ai_verification_attempted: aiVerificationAttempted,
        document_provided: !!imageBase64,
        verified_at: new Date().toISOString(),
        platform: 'DirectHub — Direct from Factories, No Middlemen',
      },
    };

    if (partnerData.user_id) {
      partnerInsert.user_id = partnerData.user_id;
    }

    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .insert(partnerInsert)
      .select('id')
      .single();

    if (partnerError) {
      console.error('[Partner Verify] Supabase insert error:', partnerError);
      // Return verification result even if DB insert fails — never block the partner
      return NextResponse.json({
        success: false,
        verificationResult,
        documentStatus,
        needsManualReview,
        error: 'Failed to save partner data — please contact support',
      });
    }

    // ── Insert admin notification for ALL exception cases ─────────────────────
    if (needsManualReview && partner?.id) {
      let notificationReason: string;

      if (!imageBase64) {
        notificationReason = 'No document provided — partner submitted registration without document upload';
      } else if (!verificationResult.isValid && verificationResult.confidence < CONFIDENCE_THRESHOLD) {
        notificationReason = `Document invalid AND low confidence: ${(verificationResult.confidence * 100).toFixed(0)}% — Issues: ${verificationResult.issues?.join('; ') || 'Unknown'}`;
      } else if (!verificationResult.isValid) {
        notificationReason = `Document validation failed — Issues: ${verificationResult.issues?.join('; ') || 'Unknown issue'}`;
      } else {
        notificationReason = `Low confidence score: ${(verificationResult.confidence * 100).toFixed(0)}% (threshold: ${CONFIDENCE_THRESHOLD * 100}%) — Manual review required`;
      }

      const { error: notifError } = await supabase.from('admin_notifications').insert({
        partner_id: partner.id,
        reason: notificationReason,
        document_type: verificationResult.documentType,
        confidence: verificationResult.confidence,
      });

      if (notifError) {
        console.error('[Partner Verify] Admin notification insert error:', notifError);
      }
    }

    return NextResponse.json({
      success: true,
      partnerId: partner?.id,
      verificationResult,
      documentStatus,
      needsManualReview,
      message: needsManualReview
        ? 'Partner application submitted for manual review — team will contact shortly'
        : 'Partner verified and registered successfully',
    });
  } catch (error) {
    console.error('[Partner Verify] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        // Graceful fallback — treat as pending review
        needsManualReview: true,
        documentStatus: 'pending_manual_review',
      },
      { status: 500 }
    );
  }
}
