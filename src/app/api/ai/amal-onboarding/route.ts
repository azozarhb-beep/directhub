import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use service role if available, otherwise anon (RLS must allow insert for anon in that case)
function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// ── Action: Register Factory ──────────────────────────────────────────────────
async function registerFactory(data: {
  company_name: string;
  contact_name?: string;
  contact_phone?: string;
  industry?: string;
  user_id?: string;
}) {
  const supabase = getSupabaseAdmin();

  const insertData: Record<string, unknown> = {
    company_name: data.company_name,
    contact_name: data.contact_name || '',
    contact_phone: data.contact_phone || '',
    industry: data.industry || '',
    registration_status: 'approved',
    approval_type: 'fast_track_initial',
    is_approved: true,
    is_active: true,
    is_activated: true,
    product_listing_unlocked: true,
    fast_track_approved_at: new Date().toISOString(),
    approval_note: 'تم التسجيل عبر مساعد أمل الذكي — قبول سريع لملء الكتالوج',
  };

  if (data.user_id) {
    insertData.user_id = data.user_id;
  }

  const { data: factory, error } = await supabase
    .from('factory_registrations')
    .insert(insertData)
    .select('id, company_name, registration_status, approval_type')
    .single();

  if (error) {
    console.error('[Amal Onboarding] Factory registration error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, factory };
}

// ── Action: Save Product ──────────────────────────────────────────────────────
async function saveProduct(data: {
  factory_id?: string;
  manufacturer_id?: string;
  name: string;
  name_ar?: string;
  description?: string;
  unit_price?: number;
  b2c_price?: number;
  b2c_moq?: number;
  minimum_order_qty?: number;
  category?: string;
  unit?: string;
  listing_mode?: string;
  b2b_tiered_pricing?: { min_qty: number; max_qty: number | null; price: number }[];
}) {
  const supabase = getSupabaseAdmin();

  // Map category string to valid enum value
  const categoryMap: Record<string, string> = {
    'بلاستيك': 'plastics',
    'مواد بناء': 'raw_materials',
    'كيماويات': 'chemicals',
    'منسوجات': 'textiles',
    'معادن': 'metals',
    'إلكترونيات': 'electronics',
    'مواد غذائية': 'food_ingredients',
    'تغليف': 'packaging',
    'آلات': 'machinery_parts',
    'plastics': 'plastics',
    'chemicals': 'chemicals',
    'textiles': 'textiles',
    'metals': 'metals',
    'electronics': 'electronics',
    'food': 'food_ingredients',
    'food_ingredients': 'food_ingredients',
    'packaging': 'packaging',
    'machinery': 'machinery_parts',
    'machinery_parts': 'machinery_parts',
    'raw_materials': 'raw_materials',
  };

  const categoryEnum = (data.category && categoryMap[data.category.toLowerCase()])
    || categoryMap[data.category || '']
    || 'other';

  const manufacturerId = data.manufacturer_id || data.factory_id;

  if (!manufacturerId) {
    return { success: false, error: 'No manufacturer_id or factory_id provided' };
  }

  // Determine listing mode
  const listingMode = data.listing_mode || 'hybrid';
  const validModes = ['b2b_only', 'b2c_only', 'hybrid'];
  const mode = validModes.includes(listingMode) ? listingMode : 'hybrid';

  // Build product payload with dual pricing support
  const productPayload: Record<string, unknown> = {
    manufacturer_id: manufacturerId,
    name: data.name,
    name_ar: data.name_ar || data.name,
    description: data.description || '',
    category: categoryEnum,
    unit: data.unit || 'kg',
    is_active: true,
    is_published: false, // pending review
    inventory_status: 'in_stock',
    listing_mode: mode,
    order_model: mode,
  };

  // B2C pricing
  if (mode === 'b2c_only' || mode === 'hybrid') {
    if (data.b2c_price && data.b2c_price > 0) {
      productPayload.b2c_price = data.b2c_price;
      productPayload.b2c_moq = data.b2c_moq || 1;
      productPayload.allow_single_unit = true;
      productPayload.min_order_quantity = data.b2c_moq || 1;
    }
  }

  // B2B pricing
  if (mode === 'b2b_only' || mode === 'hybrid') {
    const b2bPrice = data.unit_price || data.b2c_price || 0;
    productPayload.unit_price = b2bPrice;
    productPayload.minimum_order_qty = data.minimum_order_qty || 1;
    productPayload.b2b_min_quantity = data.minimum_order_qty || 1;
  }

  // If only B2C, set unit_price for backward compat
  if (mode === 'b2c_only') {
    productPayload.unit_price = data.b2c_price || 0;
    productPayload.minimum_order_qty = data.b2c_moq || 1;
  }

  // B2B tiered pricing
  if (data.b2b_tiered_pricing && Array.isArray(data.b2b_tiered_pricing) && data.b2b_tiered_pricing.length > 0) {
    productPayload.tiered_pricing = data.b2b_tiered_pricing;
    productPayload.b2b_tiered_pricing = data.b2b_tiered_pricing;
  }

  const { data: product, error } = await supabase
    .from('manufacturer_products')
    .insert(productPayload)
    .select('id, name, unit_price, b2c_price, category, listing_mode')
    .single();

  if (error) {
    console.error('[Amal Onboarding] Product save error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, product };
}

// ── Action: Update Product (price / inventory) ────────────────────────────────
async function updateProduct(data: {
  manufacturer_id: string;
  product_id?: string;
  product_name?: string;
  new_price?: number;
  inventory_status?: string;
  stock_quantity?: number;
}) {
  const supabase = getSupabaseAdmin();

  if (!data.manufacturer_id) {
    return { success: false, error: 'manufacturer_id is required' };
  }

  // Build update payload
  const updatePayload: Record<string, unknown> = {};
  if (data.new_price !== undefined && data.new_price > 0) {
    updatePayload.unit_price = data.new_price;
  }
  if (data.inventory_status) {
    const validStatuses = ['in_stock', 'out_of_stock', 'low_stock', 'discontinued'];
    const normalized = data.inventory_status.toLowerCase().replace(/\s+/g, '_');
    updatePayload.inventory_status = validStatuses.includes(normalized) ? normalized : 'in_stock';
  }
  if (data.stock_quantity !== undefined) {
    updatePayload.stock_quantity = data.stock_quantity;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { success: false, error: 'No update fields provided (new_price, inventory_status, or stock_quantity required)' };
  }

  // Find the product — by ID or by name search
  let query = supabase
    .from('manufacturer_products')
    .update(updatePayload)
    .eq('manufacturer_id', data.manufacturer_id);

  if (data.product_id) {
    query = query.eq('id', data.product_id);
  } else if (data.product_name) {
    query = query.ilike('name', `%${data.product_name}%`);
  } else {
    return { success: false, error: 'Either product_id or product_name is required' };
  }

  const { data: updated, error } = await query.select('id, name, name_ar, unit_price, inventory_status').limit(5);

  if (error) {
    console.error('[Amal Update Product] Error:', error);
    return { success: false, error: error.message };
  }

  if (!updated || updated.length === 0) {
    return { success: false, error: 'No matching product found for this supplier' };
  }

  return { success: true, updated_products: updated, count: updated.length };
}

// ── Action: Send RFQ Quote ────────────────────────────────────────────────────
async function sendRfqQuote(data: {
  manufacturer_id: string;
  rfq_id: string;
  quoted_price: number;
  currency?: string;
  delivery_days?: number;
  notes?: string;
  incoterms?: string;
}) {
  const supabase = getSupabaseAdmin();

  if (!data.manufacturer_id || !data.rfq_id || !data.quoted_price) {
    return { success: false, error: 'manufacturer_id, rfq_id, and quoted_price are required' };
  }

  // Check if RFQ exists and is open
  const { data: rfq, error: rfqError } = await supabase
    .from('rfq_requests')
    .select('id, title, title_ar, status, buyer_id, quantity, unit')
    .eq('id', data.rfq_id)
    .single();

  if (rfqError || !rfq) {
    return { success: false, error: 'RFQ not found or access denied' };
  }

  if (rfq.status === 'closed' || rfq.status === 'cancelled') {
    return { success: false, error: `RFQ is already ${rfq.status}` };
  }

  // Insert quote into rfq_quotes (or quotes table)
  const quotePayload: Record<string, unknown> = {
    rfq_id: data.rfq_id,
    supplier_id: data.manufacturer_id,
    quoted_price: data.quoted_price,
    currency: data.currency || 'USD',
    delivery_days: data.delivery_days || 14,
    notes: data.notes || '',
    incoterms: data.incoterms || 'EXW',
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const { data: quote, error: quoteError } = await supabase
    .from('rfq_quotes')
    .insert(quotePayload)
    .select('id, quoted_price, currency, delivery_days, status')
    .single();

  if (quoteError) {
    // Try alternative table name
    const { data: quote2, error: quoteError2 } = await supabase
      .from('quotes')
      .insert({ ...quotePayload, rfq_request_id: data.rfq_id })
      .select('id, quoted_price, currency, delivery_days, status')
      .single();

    if (quoteError2) {
      console.error('[Amal RFQ Quote] Error:', quoteError, quoteError2);
      return { success: false, error: quoteError.message };
    }

    return {
      success: true,
      quote: quote2,
      rfq_title: rfq.title_ar || rfq.title,
    };
  }

  return {
    success: true,
    quote,
    rfq_title: rfq.title_ar || rfq.title,
  };
}

// ── Action: Get Orders Summary ────────────────────────────────────────────────
async function getOrdersSummary(data: {
  manufacturer_id: string;
  factory_id?: string;
}) {
  const supabase = getSupabaseAdmin();

  const supplierId = data.manufacturer_id || data.factory_id;
  if (!supplierId) {
    return { success: false, error: 'manufacturer_id is required' };
  }

  // Fetch orders for this supplier
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total_amount, currency, created_at, buyer_id, product_name, quantity')
    .eq('seller_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Try manufacturer_id column
    const { data: orders2, error: error2 } = await supabase
      .from('orders')
      .select('id, status, total_amount, currency, created_at, buyer_id, product_name, quantity')
      .eq('manufacturer_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error2) {
      console.error('[Amal Orders Summary] Error:', error, error2);
      return { success: false, error: error.message };
    }

    return buildOrdersSummary(orders2 || []);
  }

  return buildOrdersSummary(orders || []);
}

function buildOrdersSummary(orders: any[]) {
  const statusGroups: Record<string, number> = {};
  let totalRevenue = 0;
  const newOrders: any[] = [];
  const activeOrders: any[] = [];

  for (const order of orders) {
    const status = order.status || 'unknown';
    statusGroups[status] = (statusGroups[status] || 0) + 1;
    if (order.total_amount) totalRevenue += Number(order.total_amount);

    const isNew = ['pending', 'pending_payment', 'new'].includes(status);
    const isActive = ['confirmed', 'processing', 'in_production', 'shipped', 'in_transit'].includes(status);

    if (isNew) newOrders.push(order);
    if (isActive) activeOrders.push(order);
  }

  return {
    success: true,
    summary: {
      total_orders: orders.length,
      new_orders: newOrders.length,
      active_orders: activeOrders.length,
      total_revenue: totalRevenue,
      status_breakdown: statusGroups,
      recent_new: newOrders.slice(0, 5).map(o => ({
        id: o.id,
        product: o.product_name || 'منتج',
        amount: o.total_amount,
        currency: o.currency || 'USD',
        date: o.created_at,
        status: o.status,
      })),
      recent_active: activeOrders.slice(0, 5).map(o => ({
        id: o.id,
        product: o.product_name || 'منتج',
        amount: o.total_amount,
        currency: o.currency || 'USD',
        date: o.created_at,
        status: o.status,
      })),
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (!action || !data) {
      return NextResponse.json({ error: 'Missing action or data' }, { status: 400 });
    }

    if (action === 'register_factory') {
      const result = await registerFactory(data);
      return NextResponse.json(result);
    }

    if (action === 'save_product') {
      const result = await saveProduct(data);
      return NextResponse.json(result);
    }

    if (action === 'update_product') {
      const result = await updateProduct(data);
      return NextResponse.json(result);
    }

    if (action === 'send_rfq_quote') {
      const result = await sendRfqQuote(data);
      return NextResponse.json(result);
    }

    if (action === 'get_orders_summary') {
      const result = await getOrdersSummary(data);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[Amal Onboarding] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
