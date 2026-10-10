import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeGenerateAIContent } from '@/lib/aiResilienceEngine';
import { generatePlatformIdeas, FALLBACK_IDEAS } from '@/lib/ideaGeneratorEngine';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Strict admin authentication ───────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Gather platform analytics in parallel
    const [
      productResult,
      pendingAlertResult,
      escalatedAlertResult,
      pendingRegResult,
      orderResult,
      escrowResult,
      rfqResult,
      pendingRfqResult,
      supplierResult,
      activeOrderResult,
    ] = await Promise.all([
      supabase.from('manufacturer_products').select('*', { count: 'exact', head: true }),
      supabase.from('supplier_alerts').select('*', { count: 'exact', head: true }).eq('status', 'notified'),
      supabase.from('supplier_alerts').select('*', { count: 'exact', head: true }).eq('status', 'escalated'),
      supabase.from('factory_registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('escrow_status', 'held'),
      supabase.from('rfq_requests').select('*', { count: 'exact', head: true }),
      supabase.from('rfq_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'supplier'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['processing', 'shipped']),
    ]);

    // Get products with missing fields
    const { data: incompleteProducts } = await supabase
      .from('manufacturer_products')
      .select('id, name, category, unit_price, description, images')
      .limit(100);

    const missingDescCount = (incompleteProducts || []).filter(p => !p.description || p.description.trim() === '').length;
    const missingImageCount = (incompleteProducts || []).filter(p => !p.images || (Array.isArray(p.images) && p.images.length === 0)).length;
    const missingPriceCount = (incompleteProducts || []).filter(p => !p.unit_price || p.unit_price === 0).length;

    const platformContext = {
      totalProducts: productResult.count || 0,
      pendingAlerts: pendingAlertResult.count || 0,
      escalatedAlerts: escalatedAlertResult.count || 0,
      pendingRegistrations: pendingRegResult.count || 0,
      totalOrders: orderResult.count || 0,
      heldEscrow: escrowResult.count || 0,
      totalRFQs: rfqResult.count || 0,
      pendingRFQs: pendingRfqResult.count || 0,
      totalSuppliers: supplierResult.count || 0,
      activeOrders: activeOrderResult.count || 0,
      missingDescCount,
      missingImageCount,
      missingPriceCount,
    };

    const systemPrompt = `أنت مستشار استراتيجي لمنصة DirectHub B2B. حلل البيانات وأنتج 6 أفكار تحسينية. أعد JSON فقط بدون أي نص خارجه.`;

    const userPrompt = `بيانات المنصة:
- المنتجات: ${platformContext.totalProducts} | الموردون: ${platformContext.totalSuppliers}
- بدون وصف: ${platformContext.missingDescCount} | بدون صور: ${platformContext.missingImageCount} | بدون سعر: ${platformContext.missingPriceCount}
- تنبيهات معلقة: ${platformContext.pendingAlerts} | مُصعَّدة: ${platformContext.escalatedAlerts}
- تسجيلات معلقة: ${platformContext.pendingRegistrations}
- الطلبات: ${platformContext.totalOrders} | نشطة: ${platformContext.activeOrders} | Escrow: ${platformContext.heldEscrow}
- RFQ الكلية: ${platformContext.totalRFQs} | معلقة: ${platformContext.pendingRFQs}

أنتج بالضبط 6 أفكار بصيغة JSON:
{"ideas":[{"id":"idea_1","title":"عنوان","category":"feature","priority":"high","description":"وصف","feasibility":"جدوى","estimated_impact":"high","data_basis":"البيانات","implementation_steps":["خطوة 1","خطوة 2"]}]}`;

    // Use resilience engine — automatically handles rate limits, fallback models, and retries
    const responseText = await safeGenerateAIContent(userPrompt, {
      model: 'gemini/gemini-3.5-flash-lite',
      fallbackModel: 'gemini/gemini-3.5-flash',
      temperature: 0.7,
      maxOutputTokens: 2048,
      systemPrompt,
    });

    // Check if resilience engine returned an error message (Arabic error string)
    const isErrorResponse = responseText.startsWith('عذراً') || responseText.includes('يرجى المحاولة');
    if (isErrorResponse) {
      console.warn('[IdeaGenerator] AI returned error response, using fallback ideas');
      return NextResponse.json({
        success: true,
        ideas: FALLBACK_IDEAS,
        platformContext,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
      });
    }

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      jsonStr = jsonStr.slice(startIdx, endIdx + 1);
    }

    let parsed: any = { ideas: [] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.warn('[IdeaGenerator] JSON parse error, using fallback ideas');
      parsed = { ideas: [] };
    }

    // If no ideas parsed, use fallback engine
    if (!parsed.ideas || parsed.ideas.length === 0) {
      console.warn('[IdeaGenerator] Empty ideas from AI, activating ideaGeneratorEngine...');
      const fallbackIdeas = await generatePlatformIdeas({
        totalOrders: platformContext.totalOrders,
        totalRevenue: platformContext.heldEscrow,
        totalUsers: platformContext.totalSuppliers,
        activeFactories: platformContext.pendingRegistrations,
        disputedOrders: platformContext.escalatedAlerts,
      });
      return NextResponse.json({
        success: true,
        ideas: fallbackIdeas,
        platformContext,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
      });
    }

    return NextResponse.json({
      success: true,
      ideas: parsed.ideas || [],
      platformContext,
      generatedAt: new Date().toISOString(),
      source: 'ai',
    });
  } catch (error: any) {
    console.error('[IdeaGenerator] Critical error:', error);

    // Emergency fallback — always return ideas, never crash
    return NextResponse.json({
      success: true,
      ideas: FALLBACK_IDEAS,
      platformContext: null,
      generatedAt: new Date().toISOString(),
      source: 'emergency_fallback',
    });
  }
}
