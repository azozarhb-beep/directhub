import { createClient } from '@/lib/supabase/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;


export type EmailType =
  | 'otp' |'order_confirmation' |'rfq_response' |'shipping_notification' |'escrow_status_update' |'commercial_invoice' |'escrow_buyer_funded' |'escrow_factory_funded' |'welcome';

interface SendEmailOptions {
  type: EmailType;
  to: string;
  data: Record<string, any>;
}

/**
 * Sends a transactional email via the Supabase send-email Edge Function (Resend).
 */
export async function sendTransactionalEmail({ type, to, data }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: { type, to, data },
    });

    if (error) {
      console.error('[Email] Edge function error:', error.message);
      return { success: false, error: error.message };
    }

    if (result?.error) {
      console.error('[Email] Resend error:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Email] Unexpected error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send OTP verification email
 */
export async function sendOtpEmail(to: string, otpCode: string, fullName?: string) {
  return sendTransactionalEmail({
    type: 'otp',
    to,
    data: { otp_code: otpCode, full_name: fullName || '' },
  });
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
  to: string,
  orderData: {
    order_number: string;
    full_name?: string;
    items: any[];
    subtotal: number;
    shipping_cost: number;
    total: number;
    shipping_address: any;
    payment_method: string;
  }
) {
  return sendTransactionalEmail({
    type: 'order_confirmation',
    to,
    data: orderData,
  });
}

/**
 * Send RFQ response notification email
 */
export async function sendRfqResponseEmail(
  to: string,
  rfqData: {
    full_name?: string;
    product_name: string;
    supplier_name: string;
    quoted_price: number;
    currency?: string;
    message?: string;
    rfq_id?: string;
  }
) {
  return sendTransactionalEmail({
    type: 'rfq_response',
    to,
    data: rfqData,
  });
}

/**
 * Send shipping / order status notification email
 */
export async function sendShippingNotificationEmail(
  to: string,
  shippingData: {
    full_name?: string;
    order_number: string;
    status: string;
    tracking_number?: string;
    carrier?: string;
    estimated_delivery?: string;
    note?: string;
  }
) {
  return sendTransactionalEmail({
    type: 'shipping_notification',
    to,
    data: shippingData,
  });
}

/**
 * Send escrow order status update email
 */
export async function sendEscrowStatusEmail(
  to: string,
  escrowData: {
    full_name?: string;
    order_number: string;
    escrow_status: string;
    message: string;
    note?: string;
  }
) {
  return sendTransactionalEmail({
    type: 'escrow_status_update',
    to,
    data: escrowData,
  });
}

/**
 * Send buyer escrow-funded email: professional invoice + Delivery PIN (secure).
 * Fired automatically when escrow_status transitions to 'funds_secured'.
 */
export async function sendEscrowBuyerFundedEmail(
  to: string,
  data: {
    buyer_name: string;
    buyer_company?: string;
    buyer_address?: string;
    buyer_country?: string;
    order_number: string;
    invoice_number: string;
    issue_date: string;
    due_date?: string;
    payment_terms?: string;
    incoterms?: string;
    items: any[];
    subtotal: number;
    shipping_cost: number;
    tax_amount?: number;
    total: number;
    currency?: string;
    delivery_pin: string;
    notes?: string;
  }
) {
  return sendTransactionalEmail({ type: 'escrow_buyer_funded', to, data });
}

/**
 * Send factory escrow-funded email: funding confirmation + order summary + fund release instructions.
 * Fired automatically when escrow_status transitions to 'funds_secured'.
 */
export async function sendEscrowFactoryFundedEmail(
  to: string,
  data: {
    factory_name: string;
    factory_company?: string;
    order_number: string;
    invoice_number: string;
    buyer_name: string;
    buyer_company?: string;
    items: any[];
    subtotal: number;
    shipping_cost: number;
    total: number;
    currency?: string;
    issue_date: string;
    notes?: string;
    site_url?: string;
  }
) {
  return sendTransactionalEmail({ type: 'escrow_factory_funded', to, data });
}

/**
 * Trigger the event-driven billing engine for an order.
 * Call this whenever escrow_status is set to 'funds_secured'.
 * The engine will:
 *  1. Generate (or retrieve) the professional invoice
 *  2. Generate (or retrieve) the Delivery PIN
 *  3. Send buyer email: invoice + PIN
 *  4. Send factory email: funding confirmation + instructions
 *  5. Create in-app notifications for both parties
 */
export async function triggerEscrowBillingEngine(
  orderId: string
): Promise<{
  success: boolean;
  invoice?: { id: string; invoice_number: string; status: string };
  delivery_pin_generated?: boolean;
  buyer_email_sent?: boolean;
  factory_email_sent?: boolean;
  order_number?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/escrow/billing-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });
    const result = await res.json();
    if (!res.ok) return { success: false, error: result.error || 'Billing engine failed' };
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Auto-generate and email a commercial invoice tied to an escrow order.
 * Calls the Next.js API route which handles DB insert + Resend delivery.
 */
export async function generateAndSendEscrowInvoice(
  orderId: string,
  recipientEmail?: string
): Promise<{ success: boolean; invoice?: { id: string; invoice_number: string }; emailSent?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/invoices/generate-from-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, recipientEmail }),
    });
    const result = await res.json();
    if (!res.ok) return { success: false, error: result.error || 'Failed to generate invoice' };
    return { success: true, invoice: result.invoice, emailSent: result.emailSent };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Send welcome email to a newly registered user.
 * Called immediately after successful registration.
 * Uses the internal endpoint which does not require an authenticated session.
 */
export async function sendWelcomeEmail(
  to: string,
  fullName?: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/email/welcome-internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: to, full_name: fullName || '', user_id: userId || '' }),
    });
    const result = await res.json();
    if (!res.ok) return { success: false, error: result.error || 'Failed to send welcome email' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
