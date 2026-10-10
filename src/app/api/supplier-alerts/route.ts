import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWhatsAppInstantAlert } from '@/lib/whatsapp';

// ─── Deadline: 48 hours for supplier to fix ───────────────────────────────────
const DEADLINE_HOURS = 48;

// ─── Fields that are considered "required" ───────────────────────────────────
function detectMissingFields(product: Record<string, any>): string[] {
  const missing: string[] = [];
  if (!product.unit_price || Number(product.unit_price) <= 0) missing.push('price');
  if (!product.product_images || (Array.isArray(product.product_images) && product.product_images.length === 0)) missing.push('image');
  if (!product.stock_quantity && product.stock_quantity !== 0) missing.push('quantity');
  if (!product.name?.trim()) missing.push('name');
  if (!product.description?.trim()) missing.push('description');
  if (!product.category) missing.push('category');
  return missing;
}

const FIELD_LABELS_AR: Record<string, string> = {
  price: 'السعر',
  image: 'صورة المنتج',
  quantity: 'الكمية',
  name: 'اسم المنتج',
  description: 'وصف المنتج',
  category: 'الفئة',
  sku: 'كود المنتج',
  origin_country: 'بلد المنشأ',
};

// ─── GET: Fetch all alerts (for control-room panel) ───────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'all';
  const action = searchParams.get('action');

  // ── Auto-escalate overdue alerts ──────────────────────────────────────────
  if (action === 'escalate') {
    const now = new Date().toISOString();
    const { data: overdue } = await supabase
      .from('supplier_alerts')
      .select('id')
      .eq('status', 'notified')
      .lt('deadline_at', now);

    if (overdue && overdue.length > 0) {
      const ids = overdue.map((a: any) => a.id);
      await supabase
        .from('supplier_alerts')
        .update({ status: 'escalated', escalated_at: now })
        .in('id', ids);
    }

    return NextResponse.json({ escalated: overdue?.length || 0 });
  }

  let query = supabase
    .from('supplier_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alerts: data || [] });
}

// ─── POST: Scan a product and create/resolve alerts ───────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { action, productId, alertId, adminNote } = body;

  // ── ACTION: Scan product for missing fields ───────────────────────────────
  if (action === 'scan' && productId) {
    const { data: product, error: pErr } = await supabase
      .from('manufacturer_products')
      .select('*, user_profiles!manufacturer_products_manufacturer_id_fkey(full_name, phone, company_name)')
      .eq('id', productId)
      .single();

    if (pErr || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const missingFields = detectMissingFields(product);

    if (missingFields.length === 0) {
      // No issues — resolve any open alert for this product
      await supabase
        .from('supplier_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('product_id', productId)
        .in('status', ['open', 'notified']);

      return NextResponse.json({ status: 'clean', missingFields: [] });
    }

    // Check if an open/notified alert already exists
    const { data: existing } = await supabase
      .from('supplier_alerts')
      .select('id, status')
      .eq('product_id', productId)
      .in('status', ['open', 'notified'])
      .maybeSingle();

    const manufacturer = (product as any).user_profiles;
    const deadline = new Date(Date.now() + DEADLINE_HOURS * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    let alertId: string;

    if (existing) {
      // Update existing alert's missing fields
      await supabase
        .from('supplier_alerts')
        .update({ missing_fields: missingFields, updated_at: now })
        .eq('id', existing.id);
      alertId = existing.id;
    } else {
      // Create new alert
      const { data: newAlert, error: insertErr } = await supabase
        .from('supplier_alerts')
        .insert({
          product_id: productId,
          manufacturer_id: product.manufacturer_id,
          missing_fields: missingFields,
          status: 'open',
          deadline_at: deadline,
          product_name: product.name || product.name_ar || 'منتج بدون اسم',
          manufacturer_name: manufacturer?.company_name || manufacturer?.full_name || 'مورد',
          manufacturer_phone: manufacturer?.phone || null,
        })
        .select('id')
        .single();

      if (insertErr || !newAlert) {
        return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
      }
      alertId = newAlert.id;
    }

    // ── Send WhatsApp notification to manufacturer ────────────────────────
    let whatsappSent = false;
    const phone = manufacturer?.phone;
    if (phone) {
      const fieldList = missingFields.map((f) => FIELD_LABELS_AR[f] || f).join('، ');
      const result = await sendWhatsAppInstantAlert(phone, {
        fullName: manufacturer?.full_name || 'المورد',
        eventType: 'security_alert',
        referenceNumber: product.name || productId,
        details: `يرجى إكمال بيانات المنتج الناقصة: ${fieldList}. لديك ${DEADLINE_HOURS} ساعة للتصحيح.`,
      });
      whatsappSent = result.success;
    }

    // Update alert to notified
    await supabase
      .from('supplier_alerts')
      .update({
        status: 'notified',
        notified_at: now,
        whatsapp_sent: whatsappSent,
      })
      .eq('id', alertId);

    // Also create an in-platform notification for the manufacturer
    await supabase.from('notifications').insert({
      user_id: product.manufacturer_id,
      type: 'system',
      title: '⚠️ منتجك يحتاج إلى تحديث',
      body: `المنتج "${product.name || product.name_ar}" يحتوي على حقول ناقصة: ${missingFields.map((f) => FIELD_LABELS_AR[f] || f).join('، ')}. يرجى التصحيح خلال ${DEADLINE_HOURS} ساعة.`,
      is_read: false,
    });

    return NextResponse.json({
      status: 'alert_created',
      alertId,
      missingFields,
      whatsappSent,
      deadline,
    });
  }

  // ── ACTION: Dismiss alert (admin) ─────────────────────────────────────────
  if (action === 'dismiss' && alertId) {
    await supabase
      .from('supplier_alerts')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString(), admin_note: adminNote || null })
      .eq('id', alertId);
    return NextResponse.json({ success: true });
  }

  // ── ACTION: Mark resolved (admin override) ────────────────────────────────
  if (action === 'resolve' && alertId) {
    await supabase
      .from('supplier_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), admin_note: adminNote || null })
      .eq('id', alertId);
    return NextResponse.json({ success: true });
  }

  // ── ACTION: Re-notify supplier ────────────────────────────────────────────
  if (action === 'renotify' && alertId) {
    const { data: alert } = await supabase
      .from('supplier_alerts')
      .select('*')
      .eq('id', alertId)
      .single();

    if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

    let whatsappSent = false;
    if (alert.manufacturer_phone) {
      const fieldList = (alert.missing_fields as string[]).map((f) => FIELD_LABELS_AR[f] || f).join('، ');
      const result = await sendWhatsAppInstantAlert(alert.manufacturer_phone, {
        fullName: alert.manufacturer_name || 'المورد',
        eventType: 'security_alert',
        referenceNumber: alert.product_name || alertId,
        details: `تذكير: يرجى إكمال بيانات المنتج الناقصة: ${fieldList}. الموعد النهائي قريب.`,
      });
      whatsappSent = result.success;
    }

    const newDeadline = new Date(Date.now() + DEADLINE_HOURS * 60 * 60 * 1000).toISOString();
    await supabase
      .from('supplier_alerts')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        deadline_at: newDeadline,
        whatsapp_sent: whatsappSent,
      })
      .eq('id', alertId);

    return NextResponse.json({ success: true, whatsappSent, newDeadline });
  }

  // ── ACTION: Scan ALL products for a manufacturer ──────────────────────────
  if (action === 'scan_all') {
    const { data: products } = await supabase
      .from('manufacturer_products')
      .select('id')
      .eq('is_active', true);

    if (!products) return NextResponse.json({ scanned: 0 });

    let alertsCreated = 0;
    let alertsResolved = 0;

    for (const p of products) {
      const { data: product } = await supabase
        .from('manufacturer_products')
        .select('*')
        .eq('id', p.id)
        .single();

      if (!product) continue;
      const missing = detectMissingFields(product);

      if (missing.length === 0) {
        const { data: existing } = await supabase
          .from('supplier_alerts')
          .select('id')
          .eq('product_id', p.id)
          .in('status', ['open', 'notified'])
          .maybeSingle();

        if (existing) {
          await supabase
            .from('supplier_alerts')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', existing.id);
          alertsResolved++;
        }
      } else {
        const { data: existing } = await supabase
          .from('supplier_alerts')
          .select('id')
          .eq('product_id', p.id)
          .in('status', ['open', 'notified'])
          .maybeSingle();

        if (!existing) {
          const { data: prof } = await supabase
            .from('user_profiles')
            .select('full_name, phone, company_name')
            .eq('id', product.manufacturer_id)
            .single();

          await supabase.from('supplier_alerts').insert({
            product_id: p.id,
            manufacturer_id: product.manufacturer_id,
            missing_fields: missing,
            status: 'open',
            deadline_at: new Date(Date.now() + DEADLINE_HOURS * 60 * 60 * 1000).toISOString(),
            product_name: product.name || product.name_ar || 'منتج',
            manufacturer_name: (prof as any)?.company_name || (prof as any)?.full_name || 'مورد',
            manufacturer_phone: (prof as any)?.phone || null,
          });
          alertsCreated++;
        }
      }
    }

    // Auto-escalate overdue
    const { data: overdue } = await supabase
      .from('supplier_alerts')
      .select('id')
      .eq('status', 'notified')
      .lt('deadline_at', new Date().toISOString());

    if (overdue && overdue.length > 0) {
      await supabase
        .from('supplier_alerts')
        .update({ status: 'escalated', escalated_at: new Date().toISOString() })
        .in('id', overdue.map((a: any) => a.id));
    }

    return NextResponse.json({
      scanned: products.length,
      alertsCreated,
      alertsResolved,
      escalated: overdue?.length || 0,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
