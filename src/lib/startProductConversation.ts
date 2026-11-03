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
  /** Resolved seller (supplier / factory) user id for the product, when known */
  sellerId?: string | null;
  /** True when the current user owns this product (cannot message themselves) */
  isOwner?: boolean;
}

export const PRODUCT_INQUIRY_TYPE = 'product_inquiry';

export interface ProductInquiryCardPayload {
  productId: string;
  name: string;
  image: string | null;
  priceText: string;
  moqText: string;
  sku?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmtPrice(price: number, currency: string, isAr: boolean): string {
  if (!price || price <= 0) return isAr ? 'تواصل لمعرفة السعر' : 'Contact for price';
  const num = price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const c = String(currency || 'YER_SANAA').toUpperCase();
  
  if (c === 'USD') return `$${num}`;
  if (c === 'SAR') return `${num} ${isAr ? 'ر.س' : 'SAR'}`;
  if (c === 'YER_ADEN') return `${num} ${isAr ? 'ر.ي (عدن)' : 'YER (Aden)'}`;
  return `${num} ${isAr ? 'ر.ي (صنعاء)' : 'YER (Sanaa)'}`;
}

function firstImage(row: any): string | null {
  const arr = Array.isArray(row?.images) && row.images.length > 0
    ? row.images
    : Array.isArray(row?.product_images) && row.product_images.length > 0
      ? row.product_images
      : [];
  const first = arr[0];
  const src = typeof first === 'string' ? first : first?.src || first?.url;
  return src || row?.image_url || null;
}

/**
 * Get-or-create the buyer ↔ factory unified conversation thread and return its id.
 * Consolidates all inquiries between the same buyer and factory into ONE single chat.
 */
export async function getOrCreateProductConversation(args: StartConversationArgs): Promise<StartConversationResult> {
  const { supabase, buyerId, productRef, supplierId, isAr } = args;
  let resolvedProductId = productRef;
  let manufacturerId: string | null = supplierId || null;
  let productName = isAr ? 'استفسار عن منتج' : 'Product Inquiry';
  let supplierName = 'DirectHub Supplier';
  let supplierCountry = 'اليمن';
  let supplierFlag = '🏭';
  let priceText = '';
  let moqText = '';
  let sku: string | null = null;
  let isSupplierListing = false;
  let cardImage: string | null = null;
  let productCurrency = 'YER_SANAA';

  try {
    // 1. Fetch supplier product details if applicable
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
        productCurrency = sp.currency || 'YER_SANAA';
        const moqVal = sp.moq ?? sp.min_order_qty;
        priceText = fmtPrice(Number(sp.wholesale_price || 0), productCurrency, isAr);
        moqText = moqVal ? `${moqVal} ${sp.unit || ''}`.trim() : isAr ? 'حسب الاتفاق' : 'Negotiable';
        cardImage = sp.image_url || null;
      }
    } catch { /* not a supplier listing */ }

    // 2. Fetch manufacturer product details if not supplier listing
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
          sku = mp.sku || null;
          productCurrency = mp.currency || 'YER_SANAA';

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
          priceText = fmtPrice(unitPrice, productCurrency, isAr);
          moqText = `${moqNum} ${mp.unit || (isAr ? 'وحدة' : 'units')}`;
          cardImage = firstImage(mp);
        }
      } catch { /* fall through */ }
    }

    // Owner check: cannot message self
    if (manufacturerId && manufacturerId === buyerId) {
      return { conversationId: null, productId: productRef, sellerId: manufacturerId, isOwner: true };
    }

    const cardPayload: ProductInquiryCardPayload = {
      productId: productRef,
      name: productName,
      image: cardImage,
      priceText: priceText || (isAr ? 'تواصل لمعرفة السعر' : 'Contact for price'),
      moqText: moqText || (isAr ? 'حسب الاتفاق' : 'Negotiable'),
      sku: sku || undefined,
    };

    const details = priceText ? ` — ${isAr ? 'السعر' : 'Price'}: ${priceText} — ${isAr ? 'الحد الأدنى' : 'MOQ'}: ${moqText}` : '';
    const skuText = sku ? ` (SKU: ${sku})` : '';
    const inquiryText = isAr
      ? `مرحباً، أرغب في الاستفسار عن المنتج: ${productName}${details}${skuText}. هل هو متوفر وما هي شروط التوريد والتوصيل؟`
      : `Hello, I'm inquiring about: ${productName}${details}${skuText}. Is it available, and what are the delivery terms?`;

    // ── 3. Find UNIFIED conversation between this buyer and manufacturer ──
    let existingConvId: string | null = null;

    if (manufacturerId) {
      const { data: convWithSeller } = await supabase
        .from('chat_conversations')
        .select('id, last_message_at')
        .eq('buyer_id', buyerId)
        .eq('manufacturer_id', manufacturerId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convWithSeller?.id) {
        existingConvId = convWithSeller.id;
      }
    }

    // Fallback: search by product_id if manufacturer was not resolved
    if (!existingConvId) {
      const { data: convByProduct } = await supabase
        .from('chat_conversations')
        .select('id, last_message_at')
        .eq('buyer_id', buyerId)
        .in('product_id', Array.from(new Set([resolvedProductId, productRef])))
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (convByProduct?.id) {
        existingConvId = convByProduct.id;
      }
    }

    // If unified conversation ALREADY exists: append the new product card & message directly
    if (existingConvId) {
      try {
        // Send Product Card into the unified chat
        await supabase.from('chat_messages').insert({
          conversation_id: existingConvId,
          sender_id: buyerId,
          sender_role: 'buyer',
          message: isAr ? `استفسار بخصوص: ${productName}` : `Inquiry: ${productName}`,
          attachment_type: PRODUCT_INQUIRY_TYPE,
          attachment_name: JSON.stringify(cardPayload),
          is_read: false,
        });

        // Send Inquiry Text
        await supabase.from('chat_messages').insert({
          conversation_id: existingConvId,
          sender_id: buyerId,
          sender_role: 'buyer',
          message: inquiryText,
          is_read: false,
        });

        // Update thread header to latest activity & product
        await supabase
          .from('chat_conversations')
          .update({
            product_id: resolvedProductId,
            product_name: productName,
            last_message: inquiryText,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', existingConvId);

      } catch (postErr) {
        console.error('Failed to append product inquiry to unified conversation:', postErr);
      }

      return { conversationId: existingConvId, productId: productRef, sellerId: manufacturerId, isOwner: false };
    }

    // ── 4. No previous conversation: create new unified conversation thread ──
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
        last_message: inquiryText,
        deal_status: 'open',
      })
      .select('id')
      .single();

    if (error || !created?.id) {
      return { conversationId: null, productId: productRef, sellerId: manufacturerId };
    }

    // 1) Post Product Card
    await supabase.from('chat_messages').insert({
      conversation_id: created.id,
      sender_id: buyerId,
      sender_role: 'buyer',
      message: isAr ? `استفسار بخصوص: ${productName}` : `Inquiry: ${productName}`,
      attachment_type: PRODUCT_INQUIRY_TYPE,
      attachment_name: JSON.stringify(cardPayload),
      is_read: false,
    });

    // 2) Post Inquiry Text
    await supabase.from('chat_messages').insert({
      conversation_id: created.id,
      sender_id: buyerId,
      sender_role: 'buyer',
      message: inquiryText,
      is_read: false,
    });

    if (isSupplierListing) {
      try {
        await supabase.rpc('notify_supplier_product_inquiry', { p_conversation_id: created.id });
      } catch { /* non-blocking */ }
    }

    return { conversationId: created.id, productId: productRef, sellerId: manufacturerId, isOwner: false };
  } catch (err) {
    console.error('getOrCreateProductConversation failed:', err);
    return { conversationId: null, productId: productRef };
  }
}
