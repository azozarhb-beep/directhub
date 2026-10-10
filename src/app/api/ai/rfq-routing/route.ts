import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { completion } from '@rocketnew/llm-sdk';

/**
 * Smart RFQ Routing & Supplier Matching API
 *
 * Uses Gemini to:
 * 1. Classify the RFQ (sector, product line, keywords, language)
 * 2. Translate non-Arabic/English RFQs to English for matching
 * 3. Fetch registered suppliers/factories from Supabase
 * 4. Score and rank suppliers by specialization match
 * 5. Route the RFQ only to top-matched suppliers (prevents irrelevant broadcasts)
 *
 * SECURITY: Admin-only endpoint.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface SupplierProfile {
  id: string;
  company_name: string;
  industry: string;
  country: string;
  seller_category: string;
  product_lines?: string[];
}

interface MatchResult {
  supplier_id: string;
  company_name: string;
  match_score: number;
  match_reason: string;
  sector_match: boolean;
  keyword_matches: string[];
}

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/ai/rfq-routing',
    method: 'POST',
    description: 'التوجيه الذكي لطلبات الأسعار — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'هذا المسار يعمل في وضع المحاكاة الآمنة.',
  });
}

export async function POST(request: NextRequest) {
  try {
    // ── Admin auth check ──────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdminMeta =
      user.user_metadata?.role === 'admin' ||
      user.app_metadata?.role === 'admin';

    let isAdmin = isAdminMeta;
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      isAdmin = profile?.role === 'admin';
    }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { rfq_id, rfq_text, product_name, specifications, sector, quantity, unit, destination_country } = body;

    if (!rfq_id && !rfq_text && !product_name) {
      return NextResponse.json({ error: 'Missing required fields: rfq_id or rfq_text/product_name' }, { status: 400 });
    }

    // ── Step 1: Fetch RFQ details if rfq_id provided ──────────────────────────
    let rfqData: any = { product_name, specifications, sector, quantity, unit, destination_country };

    if (rfq_id) {
      const { data: rfq } = await supabase
        .from('rfq_requests')
        .select('*')
        .eq('id', rfq_id)
        .single();

      if (rfq) {
        rfqData = {
          ...rfqData,
          product_name: rfq.product_name || product_name,
          specifications: rfq.specifications || specifications,
          quantity: rfq.quantity || quantity,
          unit: rfq.unit || unit,
          destination_country: rfq.destination_country || destination_country,
          target_price: rfq.target_price,
          currency: rfq.currency,
        };
      }
    }

    // ── Step 2: Fetch all active suppliers/factories ──────────────────────────
    const { data: factories } = await supabase
      .from('factory_registrations')
      .select('id, user_id, company_name, industry, country, seller_category, registration_status')
      .eq('registration_status', 'approved')
      .eq('is_active', true)
      .limit(100);

    const { data: supplierProfiles } = await supabase
      .from('user_profiles')
      .select('id, company_name, country, role')
      .eq('role', 'manufacturer')
      .limit(100);

    // Build combined supplier list
    const supplierList: SupplierProfile[] = [];

    if (factories && factories.length > 0) {
      factories.forEach((f: any) => {
        supplierList.push({
          id: f.user_id || f.id,
          company_name: f.company_name || 'Unknown Factory',
          industry: f.industry || 'General',
          country: f.country || 'Unknown',
          seller_category: f.seller_category || 'local_factory',
        });
      });
    }

    // Add any manufacturer profiles not already in list
    if (supplierProfiles && supplierProfiles.length > 0) {
      supplierProfiles.forEach((sp: any) => {
        const alreadyAdded = supplierList.some(s => s.id === sp.id);
        if (!alreadyAdded) {
          supplierList.push({
            id: sp.id,
            company_name: sp.company_name || 'Supplier',
            industry: 'General',
            country: sp.country || 'Unknown',
            seller_category: 'local_supplier',
          });
        }
      });
    }

    // ── Step 3: AI Classification & Matching ──────────────────────────────────
    const rfqDescription = [
      rfqData.product_name && `Product: ${rfqData.product_name}`,
      rfqData.specifications && `Specifications: ${rfqData.specifications}`,
      rfqData.quantity && `Quantity: ${rfqData.quantity} ${rfqData.unit || ''}`,
      rfqData.destination_country && `Destination: ${rfqData.destination_country}`,
      rfqData.target_price && `Target Price: ${rfqData.currency || 'USD'} ${rfqData.target_price}`,
      rfq_text && `Additional Details: ${rfq_text}`,
    ].filter(Boolean).join('\n');

    const supplierListText = supplierList.length > 0
      ? supplierList.map((s, i) =>
          `${i + 1}. ID: ${s.id} | Company: ${s.company_name} | Industry: ${s.industry} | Country: ${s.country} | Type: ${s.seller_category}`
        ).join('\n')
      : 'No registered suppliers found in database.';

    const systemPrompt = `You are an expert B2B procurement AI for DirectHub marketplace.
Your task is to:
1. Classify the RFQ (detect sector, product category, keywords, language)
2. Translate the RFQ to English if it is in Arabic or another language
3. Score each supplier/factory based on how well they match the RFQ
4. Return ONLY suppliers with a match score >= 40 (prevent irrelevant broadcasts)

Scoring criteria:
- Industry/sector alignment: 40 points
- Product line match: 30 points  
- Geographic proximity to destination: 15 points
- Supplier type appropriateness: 15 points

RESPOND ONLY with valid JSON in this exact structure:
{
  "classification": {
    "sector": "string (e.g. textiles, metals, chemicals, food, electronics, construction, general)",
    "product_category": "string (specific product category)",
    "keywords": ["array", "of", "key", "terms"],
    "detected_language": "string (ar/en/zh/tr/other)",
    "english_translation": "string (English translation of the full RFQ, or null if already English)"
  },
  "matches": [
    {
      "supplier_id": "exact UUID from the list",
      "company_name": "exact company name from list",
      "match_score": 85,
      "match_reason": "Brief explanation of why this supplier matches",
      "sector_match": true,
      "keyword_matches": ["keyword1", "keyword2"]
    }
  ],
  "routing_summary": "Brief summary of routing decision in Arabic and English"
}`;

    const userMessage = `RFQ Details:
${rfqDescription}

Registered Suppliers/Factories:
${supplierListText}

Classify this RFQ and match it with the most relevant suppliers. Only include suppliers with score >= 40.`;

    const aiResponse = await completion({
      model: 'gemini/gemini-3.5-flash-lite',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: false,
      api_key: GEMINI_API_KEY,
      parameters: { temperature: 0.3, max_tokens: 3000 },
    });

    const rawContent = (aiResponse as any)?.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    let parsedResult: any = null;
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsedResult = JSON.parse(jsonMatch[0]);
      } catch {
        parsedResult = null;
      }
    }

    if (!parsedResult) {
      return NextResponse.json({
        error: 'AI failed to return valid classification',
        raw: rawContent,
      }, { status: 500 });
    }

    const { classification, matches, routing_summary } = parsedResult;
    const validMatches: MatchResult[] = (matches || []).filter((m: MatchResult) => m.match_score >= 40);

    // ── Step 4: Save routing result to database ───────────────────────────────
    let routingResultId: string | null = null;

    if (rfq_id) {
      const { data: routingResult } = await supabase
        .from('rfq_routing_results')
        .insert({
          rfq_id,
          ai_classification: classification?.product_category || null,
          ai_sector: classification?.sector || null,
          ai_keywords: classification?.keywords || [],
          ai_language: classification?.detected_language || 'ar',
          ai_translated_text: classification?.english_translation || null,
          routing_status: validMatches.length > 0 ? 'routed' : 'failed',
          matched_supplier_ids: validMatches.map((m: MatchResult) => m.supplier_id),
          match_scores: validMatches,
          total_matched: validMatches.length,
          routed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (routingResult) {
        routingResultId = routingResult.id;

        // Update rfq_requests with routing info
        await supabase
          .from('rfq_requests')
          .update({
            ai_routed: true,
            ai_sector: classification?.sector || null,
            ai_classification: classification?.product_category || null,
            routing_id: routingResultId,
          })
          .eq('id', rfq_id);

        // Insert routing notifications for matched suppliers
        if (validMatches.length > 0) {
          const notifications = validMatches.map((m: MatchResult) => ({
            rfq_id,
            routing_id: routingResultId,
            supplier_id: m.supplier_id,
            match_score: m.match_score,
            match_reason: m.match_reason,
          }));

          await supabase.from('rfq_routing_notifications').insert(notifications);

          // Also insert platform notifications for each matched supplier
          const platformNotifications = validMatches.map((m: MatchResult) => ({
            user_id: m.supplier_id,
            type: 'rfq_matched',
            title: `طلب عرض سعر مطابق لتخصصك 🎯`,
            body: `وصل طلب جديد لـ "${rfqData.product_name}" يطابق تخصصك. اطلع عليه الآن.`,
            link: '/rfq-board',
            metadata: {
              rfq_id,
              routing_id: routingResultId,
              match_score: m.match_score,
              sector: classification?.sector,
            },
          }));

          await supabase.from('notifications').insert(platformNotifications).then(() => {}).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      routing_id: routingResultId,
      classification,
      matches: validMatches,
      total_matched: validMatches.length,
      routing_summary,
      suppliers_evaluated: supplierList.length,
    });

  } catch (err: any) {
    const message = err?.message || String(err);
    if (message.includes('429') || message.toLowerCase().includes('quota')) {
      return NextResponse.json({
        error: 'AI quota temporarily exhausted. Please try again shortly.',
        error_ar: 'تم استنفاد حصة الذكاء الاصطناعي مؤقتاً. يرجى المحاولة لاحقاً.',
      }, { status: 429 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
