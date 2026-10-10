import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Auto-Generate Product Description using Gemini AI ───────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // ── Authentication check ──────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { productId?: string; productName?: string; alertId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { productId, productName, alertId } = body;

  if (!productId && !productName) {
    return NextResponse.json({ error: 'productId or productName required' }, { status: 400 });
  }

  // Fetch product details if productId provided
  let product: Record<string, any> | null = null;
  if (productId) {
    const { data } = await supabase
      .from('manufacturer_products')
      .select('id, name, name_ar, category, unit_price, currency, origin_country, manufacturer_id, user_profiles!manufacturer_products_manufacturer_id_fkey(company_name)')
      .eq('id', productId)
      .single();
    product = data;

    // ── Ownership or admin check ────────────────────────────────────────────
    const isAdmin = user.app_metadata?.role === 'admin';
    const isOwner = product?.manufacturer_id === user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const pName = product?.name || product?.name_ar || productName || 'منتج';
  const category = product?.category || '';
  const price = product?.unit_price ? `${product.currency || 'USD'} ${product.unit_price}` : '';
  const origin = product?.origin_country || '';
  const company = (product as any)?.user_profiles?.company_name || '';

  // Build prompt for Gemini
  const prompt = `أنت خبير تسويق متخصص في المنتجات الصناعية والتجارية. اكتب وصفاً تجارياً احترافياً وتسويقياً للمنتج التالي باللغة العربية:

اسم المنتج: ${pName}
${category ? `الفئة: ${category}` : ''}
${price ? `السعر: ${price}` : ''}
${origin ? `بلد المنشأ: ${origin}` : ''}
${company ? `الشركة المصنّعة: ${company}` : ''}

المتطلبات:
- وصف تجاري احترافي من 3-4 جمل
- يبرز مميزات المنتج وفوائده للمشتري
- أسلوب تسويقي مقنع ومحترف
- مناسب لمنصة B2B/B2C للتجارة الإلكترونية
- لا تذكر أسعاراً محددة في الوصف
- أجب بالوصف فقط بدون مقدمات أو تعليقات`;

  try {
    // Call Gemini via the existing AI route
    const aiRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://directhub3220.builtwithrocket.new'}/api/ai/chat-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'gemini-3.5-flash-lite',
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    let description = '';

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      description = aiData.content || aiData.message || aiData.text || '';
    }

    // Fallback description if AI fails
    if (!description || description.length < 20) {
      description = `${pName} — منتج عالي الجودة مُصنَّع وفق أعلى المعايير الصناعية. يتميز بمواصفات تقنية متقدمة تلبي احتياجات السوق المحلي والدولي. مناسب للشركات والمؤسسات التجارية الباحثة عن موثوقية وكفاءة في التوريد.${origin ? ` منتج ${origin} بجودة مضمونة.` : ''}`;
    }

    // Save description to product if productId provided
    if (productId && description) {
      await supabase
        .from('manufacturer_products')
        .update({ description: description.trim() })
        .eq('id', productId);

      // If there's an alert for this product, check if description was the only missing field
      if (alertId) {
        const { data: alert } = await supabase
          .from('supplier_alerts')
          .select('missing_fields')
          .eq('id', alertId)
          .single();

        if (alert) {
          const remaining = (alert.missing_fields as string[] || []).filter((f: string) => f !== 'description');
          if (remaining.length === 0) {
            // All fields fixed — resolve alert
            await supabase
              .from('supplier_alerts')
              .update({ status: 'resolved', resolved_at: new Date().toISOString(), admin_note: 'تم توليد الوصف تلقائياً بخدمات المنصة' })
              .eq('id', alertId);
          } else {
            // Update missing fields
            await supabase
              .from('supplier_alerts')
              .update({ missing_fields: remaining })
              .eq('id', alertId);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      description: description.trim(),
      productId,
      savedToProduct: !!productId,
    });
  } catch (err: any) {
    console.error('[AutoGenerateDescription] Error:', err.message);

    // Return fallback description
    const fallback = `${pName} — منتج متميز يجمع بين الجودة العالية والكفاءة التشغيلية. يُعدّ خياراً مثالياً للشركات والمؤسسات التجارية نظراً لمواصفاته التقنية المتقدمة وموثوقيته في الأداء.`;

    if (productId) {
      await supabase
        .from('manufacturer_products')
        .update({ description: fallback })
        .eq('id', productId)
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      description: fallback,
      productId,
      savedToProduct: !!productId,
      fallback: true,
    });
  }
}
