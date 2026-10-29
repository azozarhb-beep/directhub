import type { SupabaseClient } from '@supabase/supabase-js';

export interface StartConversationArgs {
  supabase: SupabaseClient;
  buyerId: string;
  productRef: string;
  supplierId?: string | null;
  isAr: boolean;
}

export interface StartConversationResult {
  conversationId: string | null;
  productId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmtPrice(price: number, currency: string, isAr: boolean): string {
  if (!price || price <= 0) return isAr ? 'تواصل لمعرفة السعر' : 'Contact for price';
  const num = price.toFixed(2).replace(/\.00$/, '');
  return String(currency).toUpperCase() === 'USD' ? `$${num}` : `${num} ${isAr ? 'ر.ي' : 'YER'}`;
}

/**
 * Get-or-create the buyer ↔ supplier ↔ product conversation thread and return its id.
 * Never throws: on failure returns conversationId = null so callers can fall back.
 */
export async function getOrCreateProductConversation(args: StartConversationArgs): Promise<StartConversationResult> {
  const { supabase, buyerId, productRef, supplierId, isAr } = args;
  let resolvedProductId = productRef;
  let manufacturerId: string | null = supplierId || null;
  let productName = isAr ? 'استفسار عن منتج' : 'Product Inquiry';
  let supplierName = 'DirectHub Supplier';
  let supplierCountry = 'Global';
  let supplierFlag = '🏭';
  let priceText = '';
  let moqText = '';
  let sku: string | null = null;
  let isSupplierListing = false;

  try {
    try {
      const { data: spData } = await supabase.rpc('get_supplier_product_for_inquiry', { p_ref: productRef });
      const sp = Array.isArray(spData) ? spData[0] : spData;
      if (sp?.id) {
        isSupplierListing = true;
        resolvedProductId = sp.id;
        manufacturerId = sp.supplier_id || manufacturerId;
        productName = sp.name_ar || sp.name || productName;
        supplierName = sp.supplier_name || supplierName;
        supplierCountry = 'اليمن';
        supplierFlag = '🏪';
        sku = sp.sku || null;
        const moqVal = sp.moq ?? sp.min_order_qty;
        priceText = fmtPrice(Number(sp.wholesale_price || 0), sp.currency || 'YER', isAr);
        moqText = moqVal ? `${moqVal} ${sp.unit || ''}`.trim() : isAr ? 'حسب الاتفاق' : 'Negotiable';
      }
    } catch { /* not a supplier listing */ }

    if (!isSupplierListing) {
      try {
        const safeRef = productRef.replace(/[^A-Za-z0-9_-]/g, '');
        const q = supabase.from('manufacturer_products').select('*');
        const { data: mp } = UUID_RE.test(productRef)
          ? await q.or(`id.eq.${productRef},agent_product_id.eq.${productRef}`).limit(1).maybeSingle()
          : await q.or(`short_id.eq.${safeRef},slug.ilike.${safeRef.toLowerCase()},sku.ilike.${safeRef}`).limit(1).maybeSingle();
        if (mp?.id) {
          resolvedProductId = mp.id;
          const sellerRef: string | null = mp.registered_factory_id || mp.facility_id || mp.manufacturer_id || null;
          manufacturerId = supplierId || sellerRef;
          productName = (isAr ? mp.name_ar : null) || mp.name || mp.name_ar || productName;
          if (sellerRef) {
            try {
              const { data: fp } = await supabase.rpc('get_public_factory_profile', { p_ref: sellerRef });
              const f = Array.isArray(fp) ? fp[0] : fp;
              if (f?.company_name) supplierName = f.company_name;
              if (f?.country_code === 'YE') supplierCountry = 'اليمن';
            } catch { /* optional */ }
          }
          const tiers = Array.isArray(mp.tiered_pricing) ? mp.tiered_pricing : [];
          const tierMin = tiers.length > 0 ? Number(tiers[0]?.min_qty ?? tiers[0]?.minQty ?? 0) : 0;
          const moqNum = tierMin || parseInt(String(mp.minimum_order_qty || mp.min_order_quantity || mp.moq || 1)) || 1;
          const tierPrice = tiers.length > 0 ? Number(tiers[0]?.unit_price ?? tiers[0]?.unitPrice ?? tiers[0]?.price ?? 0) : 0;
          const unitPrice = tierPrice || parseFloat(String(mp.unit_price || mp.price || 0)) || 0;
          const origin = String(mp.origin_type || '').toLowerCase();
          const cur = origin === 'international' ? 'USD' : origin === 'local' ? 'YER' : String(mp.currency || 'YER');
          priceText = fmtPrice(unitPrice, cur, isAr);
          moqText = `${moqNum} ${mp.unit || (isAr ? 'وحدة' : 'units')}`;
        }
      } catch { /* fall through */ }
    }

    // Existing thread for (buyer, supplier, product)?
    const { data: mine } = await supabase
      .from('chat_conversations')
      .select('id, product_id, manufacturer_id, buyer_id')
      .eq('buyer_id', buyerId)
      .in('product_id', Array.from(new Set([resolvedProductId, productRef])))
      .order('last_message_at', { ascending: false });
    const existing = (mine || []).find(
      (c: { manufacturer_id: string | null }) => !manufacturerId || !c.manufacturer_id || c.manufacturer_id === manufacturerId
    );
    if (existing?.id) return { conversationId: existing.id, productId: productRef };

    // Create new negotiation thread + opening inquiry message
    const { data: created, error } = await supabase
      .from('chat_conversations')
      .insert({
        buyer_id: buyerId,
        manufacturer_id: manufacturerId,
        product_id: resolvedProductId,
        product_name: productName,
        supplier_name: supplierName,
        supplier_country: supplierCountry,
        supplier_flag: supplierFlag,
        supplier_avatar: '',
        last_message: '',
        deal_status: 'open',
      })
      .select('id')
      .single();
    if (error || !created?.id) return { conversationId: null, productId: productRef };

    const details = priceText ? ` — ${isAr ? 'سعر الوحدة' : 'Unit price'}: ${priceText} — ${isAr ? 'الحد الأدنى للطلب' : 'MOQ'}: ${moqText}` : '';
    const skuText = sku ? ` (SKU: ${sku})` : '';
    const inquiryText = isAr
      ? `مرحباً، أرغب في الاستفسار عن المنتج: ${productName}${details}${skuText}. هل يمكنكم تزويدي بالتفاصيل وأفضل عرض سعر؟`
      : `Hello, I'm interested in: ${productName}${details}${skuText}. Could you share details and your best quote?`;
    await supabase.from('chat_messages').insert({
      conversation_id: created.id,
      sender_id: buyerId,
      sender_role: 'buyer',
      message: inquiryText,
      is_read: false,
    });
    await supabase
      .from('chat_conversations')
      .update({ last_message: inquiryText, last_message_at: new Date().toISOString() })
      .eq('id', created.id);
    if (isSupplierListing) {
      try { await supabase.rpc('notify_supplier_product_inquiry', { p_conversation_id: created.id }); } catch { /* non-blocking */ }
    }
    return { conversationId: created.id, productId: productRef };
  } catch (err) {
    console.error('getOrCreateProductConversation failed:', err);
    return { conversationId: null, productId: productRef };
  }
}
