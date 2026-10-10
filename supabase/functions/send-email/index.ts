import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = "onboarding@resend.dev";
const APP_NAME = "DirectHub";
const SALES_RFQ_EMAIL = Deno.env.get("GLOBAL_SALES_RFQ_EMAIL") || "admin@direct-hub.net";

function escapeHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

interface EmailPayload {
  type: "otp" | "order_confirmation" | "rfq_response" | "shipping_notification" | "escrow_status_update" | "commercial_invoice" | "admin_payout_review" | "pin_security_alert" | "escrow_buyer_funded" | "escrow_factory_funded" | "welcome" | "admin_notification";
  to: string;
  data: Record<string, any>;
}

function buildOtpEmail(data: Record<string, any>): { subject: string; html: string } {
  const { otp_code, full_name } = data;
  return {
    subject: `Your DirectHub Verification Code: ${otp_code}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr><td style="background:#1a56db;padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                </td></tr>
                <tr><td style="padding:40px;">
                  <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">Verify Your Order</h2>
                  <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                    Hello ${full_name || "there"},<br>
                    Use the verification code below to confirm your order. This code expires in <strong>10 minutes</strong>.
                  </p>
                  <div style="background:#f0f4ff;border:2px dashed #1a56db;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                    <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#1a56db;font-family:monospace;">${otp_code}</span>
                  </div>
                  <p style="margin:0;color:#9ca3af;font-size:13px;">If you did not request this code, please ignore this email.</p>
                </td></tr>
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildOrderConfirmationEmail(data: Record<string, any>): { subject: string; html: string } {
  const { order_number, full_name, items = [], subtotal, shipping_cost, total, shipping_address, payment_method, escrow_pin } = data;
  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;">${item.name}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px;text-align:right;">${Number(item.price * item.quantity).toLocaleString()} USD</td>
    </tr>
  `).join("");

  return {
    subject: `رمز الأمان وتأكيد الطلب - دايركت هب | ${order_number}`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr><td style="background:linear-gradient(135deg,#1a56db,#1e40af);padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">دايركت هب</h1>
                  <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">DirectHub — منصة التجارة المباشرة</p>
                </td></tr>

                <!-- Success Banner -->
                <tr><td style="background:#d1fae5;border-bottom:2px solid #6ee7b7;padding:16px 40px;text-align:center;">
                  <p style="margin:0;color:#065f46;font-size:16px;font-weight:700;">✅ تم تأكيد طلبك بنجاح</p>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:36px 40px;">

                  <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.8;">
                    مرحباً ${full_name || "عزيزي العميل"}،
                  </p>
                  <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.8;">
                    تم تأكيد طلبك بنجاح. هذا هو <strong style="color:#1a56db;">رمز الأمان السري الخاص بطلبك</strong>.
                  </p>

                  ${escrow_pin ? `
                  <!-- Escrow PIN Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:#fef3c7;border:2px solid #f59e0b;border-radius:14px;padding:28px 24px;text-align:center;">
                        <p style="margin:0 0 8px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">🔐 رمز الأمان السري</p>
                        <p style="margin:0 0 20px;color:#78350f;font-size:13px;line-height:1.7;">
                          يرجى الاحتفاظ بهذا الكود وعدم إدخاله في المنصة أو إعطائه للمصنع
                          <strong> إلا بعد وصول بضاعتك ومعاينتها بنجاح</strong>،
                          لكي تتمكن المنصة من تحرير الأموال وإرسالها للمورد.
                        </p>
                        <div style="background:#ffffff;border:2px dashed #f59e0b;border-radius:10px;padding:20px;display:inline-block;min-width:200px;">
                          <span style="font-size:42px;font-weight:900;letter-spacing:14px;color:#92400e;font-family:monospace;">${escrow_pin}</span>
                        </div>
                        <p style="margin:16px 0 0;color:#92400e;font-size:12px;font-weight:600;">
                          ⚠️ لا تشارك هذا الرمز مع أي شخص قبل استلام بضاعتك ومعاينتها
                        </p>
                      </td>
                    </tr>
                  </table>
                  ` : ""}

                  <!-- Order Info -->
                  <div style="background:#eff6ff;border-radius:10px;padding:20px;margin-bottom:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;color:#6b7280;font-size:13px;">رقم الطلب</td>
                        <td style="padding:5px 0;color:#1e3a8a;font-size:14px;font-weight:700;text-align:left;font-family:monospace;">${order_number}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- Items Table -->
                  <h3 style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:600;">ملخص الطلب</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                    <tr>
                      <th style="padding:8px 0;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:right;text-transform:uppercase;">المنتج</th>
                      <th style="padding:8px 0;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center;text-transform:uppercase;">الكمية</th>
                      <th style="padding:8px 0;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:left;text-transform:uppercase;">المبلغ</th>
                    </tr>
                    ${itemsHtml}
                  </table>

                  <!-- Totals -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="padding:4px 0;color:#6b7280;font-size:14px;">المجموع الفرعي</td>
                      <td style="padding:4px 0;color:#374151;font-size:14px;text-align:left;">${Number(subtotal).toLocaleString()} USD</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#6b7280;font-size:14px;">الشحن</td>
                      <td style="padding:4px 0;color:#374151;font-size:14px;text-align:left;">${Number(shipping_cost).toLocaleString()} USD</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#111827;font-size:15px;font-weight:700;border-top:2px solid #e5e7eb;">الإجمالي</td>
                      <td style="padding:8px 0;color:#1a56db;font-size:15px;font-weight:700;text-align:left;border-top:2px solid #e5e7eb;">${Number(total).toLocaleString()} USD</td>
                    </tr>
                  </table>

                  <!-- Shipping Address -->
                  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:16px;">
                    <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:600;">عنوان الشحن</p>
                    <p style="margin:0;color:#374151;font-size:14px;">${shipping_address?.fullName || ""}, ${shipping_address?.company || ""}<br>${shipping_address?.address || ""}, ${shipping_address?.city || ""}, ${shipping_address?.country || ""}</p>
                  </div>

                  <!-- Important Notice -->
                  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin-bottom:16px;">
                    <p style="margin:0 0 6px;color:#991b1b;font-size:13px;font-weight:700;">⚠️ تنبيه مهم</p>
                    <p style="margin:0;color:#7f1d1d;font-size:13px;line-height:1.7;">
                      إذا لم تقم بطلب هذا الكود، يرجى تجاهل هذه الرسالة والتواصل مع فريق الدعم فوراً.
                    </p>
                  </div>

                </td></tr>

                <!-- Footer -->
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} دايركت هب — DirectHub. جميع الحقوق محفوظة | direct-hub.net</p>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildRfqResponseEmail(data: Record<string, any>): { subject: string; html: string } {
  const { full_name, product_name, supplier_name, quoted_price, currency = "USD", message, rfq_id } = data;
  return {
    subject: `RFQ Response Received for "${product_name}" — ${APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr><td style="background:#1a56db;padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                </td></tr>
                <tr><td style="padding:40px;">
                  <h2 style="margin:0 0 12px;color:#111827;font-size:20px;">New RFQ Response</h2>
                  <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                    Hello ${full_name || "there"},<br>
                    You have received a quote from <strong>${supplier_name}</strong> for your RFQ.
                  </p>
                  <div style="background:#f0f4ff;border-left:4px solid #1a56db;border-radius:6px;padding:20px;margin-bottom:24px;">
                    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;font-weight:600;">Product</p>
                    <p style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;">${product_name}</p>
                    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;font-weight:600;">Quoted Price</p>
                    <p style="margin:0 0 16px;color:#1a56db;font-size:24px;font-weight:800;">$${Number(quoted_price).toLocaleString()} ${currency}</p>
                    <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;font-weight:600;">Supplier</p>
                    <p style="margin:0;color:#374151;font-size:15px;">${supplier_name}</p>
                  </div>
                  ${message ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;"><p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:600;">Supplier Message</p><p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${message}</p></div>` : ""}
                  ${rfq_id ? `<p style="margin:0;color:#9ca3af;font-size:12px;">RFQ Reference: <span style="font-family:monospace;">${rfq_id}</span></p>` : ""}
                </td></tr>
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildShippingNotificationEmail(data: Record<string, any>): { subject: string; html: string } {
  const { full_name, order_number, status, tracking_number, carrier, estimated_delivery, note } = data;
  const statusLabels: Record<string, { label: string; color: string; emoji: string }> = {
    processing: { label: "Processing", color: "#2563eb", emoji: "⚙️" },
    shipped: { label: "Shipped", color: "#7c3aed", emoji: "🚚" },
    delivered: { label: "Delivered", color: "#059669", emoji: "✅" },
    cancelled: { label: "Cancelled", color: "#dc2626", emoji: "❌" },
  };
  const cfg = statusLabels[status] || { label: status, color: "#374151", emoji: "📦" };

  return {
    subject: `Order ${order_number} — ${cfg.label} ${cfg.emoji}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr><td style="background:#1a56db;padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                </td></tr>
                <tr><td style="padding:40px;">
                  <div style="text-align:center;margin-bottom:28px;">
                    <span style="font-size:48px;">${cfg.emoji}</span>
                    <h2 style="margin:12px 0 6px;color:#111827;font-size:20px;">Order ${cfg.label}</h2>
                    <p style="margin:0;color:#6b7280;font-size:14px;">Order <strong style="color:#1a56db;font-family:monospace;">${order_number}</strong></p>
                  </div>
                  <p style="margin:0 0 24px;color:#374151;font-size:15px;">Hello ${full_name || "there"}, here's an update on your order.</p>
                  
                  <div style="background:#f0f4ff;border-radius:8px;padding:20px;margin-bottom:20px;">
                    <div style="display:inline-block;background:${cfg.color};color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;margin-bottom:16px;">${cfg.label}</div>
                    ${tracking_number ? `
                    <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:600;">Tracking Number</p>
                    <p style="margin:0 0 12px;color:#111827;font-size:16px;font-weight:700;font-family:monospace;">${tracking_number}</p>
                    ` : ""}
                    ${carrier ? `
                    <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:600;">Carrier</p>
                    <p style="margin:0 0 12px;color:#374151;font-size:14px;">${carrier}</p>
                    ` : ""}
                    ${estimated_delivery ? `
                    <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:600;">Estimated Delivery</p>
                    <p style="margin:0;color:#374151;font-size:14px;">${estimated_delivery}</p>
                    ` : ""}
                  </div>
                  ${note ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;"><p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;font-weight:600;">Note</p><p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${note}</p></div>` : ""}
                </td></tr>
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildEscrowStatusEmail(data: Record<string, any>): { subject: string; html: string } {
  const { full_name, order_number, escrow_status, message, note } = data;

  const statusConfig: Record<string, { label: string; color: string; emoji: string; bg: string }> = {
    funds_secured: { label: "Funds Secured in Escrow", color: "#1a56db", emoji: "🔒", bg: "#eff6ff" },
    shipped: { label: "Order Shipped", color: "#7c3aed", emoji: "🚚", bg: "#f5f3ff" },
    pending_otp_confirmation: { label: "Confirm Your Receipt", color: "#d97706", emoji: "📧", bg: "#fffbeb" },
    funds_released: { label: "Transaction Complete — Funds Released", color: "#059669", emoji: "✅", bg: "#ecfdf5" },
    payment_pending: { label: "Payment Verification Pending", color: "#6b7280", emoji: "⏳", bg: "#f9fafb" },
  };

  const cfg = statusConfig[escrow_status] || { label: escrow_status, color: "#374151", emoji: "📦", bg: "#f9fafb" };

  return {
    subject: `DirectHub Order ${order_number} — ${cfg.label} ${cfg.emoji}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <tr><td style="background:#1a56db;padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                  <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">Escrow Order Update</p>
                </td></tr>
                <tr><td style="padding:40px;">
                  <div style="text-align:center;margin-bottom:28px;">
                    <div style="width:64px;height:64px;background:${cfg.bg};border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:32px;">${cfg.emoji}</div>
                    <h2 style="margin:0 0 6px;color:#111827;font-size:20px;">${cfg.label}</h2>
                    <p style="margin:0;color:#6b7280;font-size:14px;">Order <strong style="color:${cfg.color};font-family:monospace;">${order_number}</strong></p>
                  </div>
                  <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">Hello ${full_name || "there"},</p>
                  <div style="background:${cfg.bg};border-left:4px solid ${cfg.color};border-radius:6px;padding:18px 20px;margin-bottom:24px;">
                    <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${message || "Your escrow order status has been updated."}</p>
                  </div>
                  ${note ? `<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;"><p style="margin:0 0 4px;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Admin Note</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">${note}</p></div>` : ""}
                  <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">Log in to your DirectHub dashboard to view the full order details and take any required action.</p>
                </td></tr>
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildCommercialInvoiceEmail(data: Record<string, any>): { subject: string; html: string } {
  const {
    invoice_number, order_number, buyer_name, buyer_company, buyer_address, buyer_country,
    seller_name, seller_address, items = [], subtotal, shipping_cost, tax_amount, total,
    currency = "USD", payment_terms, incoterms, issue_date, due_date, escrow_status, notes,
  } = data;

  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;vertical-align:top;">
        <strong>${item.description || item.name || "Product"}</strong>
        ${item.hs_code ? `<br><span style="color:#9ca3af;font-size:11px;">HS: ${item.hs_code}</span>` : ""}
        ${item.moq ? `<br><span style="color:#6b7280;font-size:11px;">MOQ: ${item.moq}</span>` : ""}
        ${item.supplier_name ? `<br><span style="color:#6b7280;font-size:11px;">Supplier: ${item.supplier_name}</span>` : ""}
        ${item.country_of_origin ? `<br><span style="color:#6b7280;font-size:11px;">Origin: ${item.country_of_origin}</span>` : ""}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:center;vertical-align:top;">${item.quantity} ${item.unit || ""}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:right;vertical-align:top;">${currency} ${Number(item.unit_price).toFixed(2)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:right;vertical-align:top;font-weight:600;">${currency} ${Number(item.total || (item.quantity * item.unit_price)).toFixed(2)}</td>
    </tr>
  `).join("");

  const escrowBadge = escrow_status === "funds_released"
    ? `<div style="display:inline-block;background:#d1fae5;color:#065f46;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px;">✅ Escrow Funds Released</div>`
    : escrow_status === "funds_secured"
    ? `<div style="display:inline-block;background:#dbeafe;color:#1e40af;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px;">🔒 Escrow Funds Secured</div>` :"";

  return {
    subject: `Commercial Invoice ${invoice_number} — Order ${order_number} | ${APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr><td style="background:#1a56db;padding:28px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                        <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Official Commercial Invoice</p>
                      </td>
                      <td style="text-align:right;">
                        <p style="margin:0;color:#ffffff;font-size:18px;font-weight:800;font-family:monospace;">${invoice_number}</p>
                        <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">Order: ${order_number}</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:32px 40px;">

                  ${escrowBadge}

                  <!-- Parties -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td width="48%" style="vertical-align:top;background:#f9fafb;border-radius:8px;padding:16px;">
                        <p style="margin:0 0 6px;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Seller / Supplier</p>
                        <p style="margin:0 0 4px;color:#111827;font-size:14px;font-weight:700;">${seller_name || APP_NAME}</p>
                        ${seller_address ? `<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">${seller_address}</p>` : ""}
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="vertical-align:top;background:#f9fafb;border-radius:8px;padding:16px;">
                        <p style="margin:0 0 6px;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Buyer</p>
                        <p style="margin:0 0 4px;color:#111827;font-size:14px;font-weight:700;">${buyer_name}</p>
                        ${buyer_company ? `<p style="margin:0 0 2px;color:#374151;font-size:13px;">${buyer_company}</p>` : ""}
                        ${buyer_address ? `<p style="margin:0 0 2px;color:#6b7280;font-size:12px;line-height:1.5;">${buyer_address}</p>` : ""}
                        ${buyer_country ? `<p style="margin:0;color:#6b7280;font-size:12px;">${buyer_country}</p>` : ""}
                      </td>
                    </tr>
                  </table>

                  <!-- Invoice Meta -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#eff6ff;border-radius:8px;padding:16px;">
                    <tr>
                      <td style="padding:4px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="color:#6b7280;font-size:12px;padding:3px 0;">Issue Date</td>
                            <td style="color:#111827;font-size:12px;font-weight:600;text-align:right;padding:3px 0;">${issue_date || new Date().toISOString().split("T")[0]}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:12px;padding:3px 0;">Due Date</td>
                            <td style="color:#111827;font-size:12px;font-weight:600;text-align:right;padding:3px 0;">${due_date || ""}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:12px;padding:3px 0;">Payment Terms</td>
                            <td style="color:#111827;font-size:12px;font-weight:600;text-align:right;padding:3px 0;">${payment_terms || "T/T Advance"}</td>
                          </tr>
                          <tr>
                            <td style="color:#6b7280;font-size:12px;padding:3px 0;">Incoterms</td>
                            <td style="color:#111827;font-size:12px;font-weight:600;text-align:right;padding:3px 0;">${incoterms || "FOB"}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Items Table -->
                  <h3 style="margin:0 0 12px;color:#111827;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Itemized Products</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    <thead>
                      <tr style="background:#f3f4f6;">
                        <th style="padding:10px 8px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Product / Description</th>
                        <th style="padding:10px 8px;text-align:center;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Qty / MOQ</th>
                        <th style="padding:10px 8px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Unit Price</th>
                        <th style="padding:10px 8px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">No items</td></tr>`}
                    </tbody>
                  </table>

                  <!-- Totals -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td width="55%"></td>
                      <td width="45%">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;">
                          <tr>
                            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Subtotal</td>
                            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${currency} ${Number(subtotal).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Shipping</td>
                            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${currency} ${Number(shipping_cost).toFixed(2)}</td>
                          </tr>
                          ${Number(tax_amount) > 0 ? `
                          <tr>
                            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Tax</td>
                            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${currency} ${Number(tax_amount).toFixed(2)}</td>
                          </tr>` : ""}
                          <tr>
                            <td style="padding:10px 0 4px;color:#111827;font-size:15px;font-weight:800;border-top:2px solid #e5e7eb;">TOTAL</td>
                            <td style="padding:10px 0 4px;color:#1a56db;font-size:15px;font-weight:800;text-align:right;border-top:2px solid #e5e7eb;">${currency} ${Number(total).toFixed(2)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  ${notes ? `
                  <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
                    <p style="margin:0 0 4px;color:#92400e;font-size:11px;text-transform:uppercase;font-weight:700;">Notes</p>
                    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">${notes}</p>
                  </div>` : ""}

                  <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;border-top:1px solid #f3f4f6;padding-top:16px;">
                    This is an official commercial invoice generated by the DirectHub Tripartite Escrow System. 
                    Please retain this document for your records. For disputes or queries, log in to your DirectHub account.
                  </p>
                </td></tr>

                <!-- Footer -->
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved. | direct-hub.net</p>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildAdminPayoutReviewEmail(data: Record<string, any>): { subject: string; html: string } {
  const { admin_name, order_number, order_id, buyer_confirmed_at, admin_panel_url } = data;
  const confirmedDate = buyer_confirmed_at
    ? new Date(buyer_confirmed_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
    : "—";

  return {
    subject: `🔔 إجراء مطلوب: الطلب #${order_number} جاهز لصرف المستحقات — DirectHub`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr><td style="background:linear-gradient(135deg,#1a56db,#1e40af);padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                  <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">لوحة تحكم الإدارة</p>
                </td></tr>

                <!-- Alert Banner -->
                <tr><td style="background:#fef3c7;border-bottom:2px solid #f59e0b;padding:16px 40px;text-align:center;">
                  <p style="margin:0;color:#92400e;font-size:15px;font-weight:700;">⚠️ إجراء مطلوب من الإدارة</p>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:36px 40px;">
                  <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
                    مرحباً ${admin_name || "مدير النظام"},
                  </p>
                  <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
                    قام المشتري بتأكيد <strong>استلام وفحص</strong> الطلب التالي بنجاح. يرجى مراجعة الطلب والضغط على زر <strong>"صرف المستحقات"</strong> في لوحة التحكم لإتمام العملية.
                  </p>

                  <!-- Order Details Box -->
                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:24px;margin-bottom:28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;width:50%;">رقم الطلب</td>
                        <td style="padding:6px 0;color:#1e3a8a;font-size:15px;font-weight:800;font-family:monospace;text-align:left;">#${order_number}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;">تاريخ تأكيد الاستلام</td>
                        <td style="padding:6px 0;color:#374151;font-size:13px;text-align:left;">${confirmedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;">الحالة الحالية</td>
                        <td style="padding:6px 0;text-align:left;">
                          <span style="background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid #f59e0b;">
                            في انتظار صرف المستحقات
                          </span>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- CTA Button -->
                  <div style="text-align:center;margin-bottom:28px;">
                    <a href="${admin_panel_url || "https://direct-hub.net/admin/control-room"}"
                       style="display:inline-block;background:#1a56db;color:#ffffff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">
                      🏦 الذهاب إلى لوحة التحكم — صرف المستحقات
                    </a>
                  </div>

                  <!-- Steps -->
                  <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
                    <p style="margin:0 0 10px;color:#374151;font-size:13px;font-weight:700;">خطوات صرف المستحقات:</p>
                    <ol style="margin:0;padding-right:20px;color:#6b7280;font-size:13px;line-height:2;">
                      <li>افتح لوحة التحكم وانتقل إلى تبويب <strong>"إدارة الضمان"</strong></li>
                      <li>ابحث عن الطلب رقم <strong>#${order_number}</strong></li>
                      <li>اضغط على زر <strong>"صرف المستحقات"</strong></li>
                      <li>سيتم تحديث حالة الطلب إلى <strong>"مكتمل"</strong> تلقائياً</li>
                    </ol>
                  </div>

                  <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                    هذا البريد تم إرساله تلقائياً من نظام DirectHub عند تأكيد المشتري للاستلام. لا تقم بالرد على هذا البريد.
                  </p>
                </td></tr>

                <!-- Footer -->
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME} — نظام الضمان المالي الآمن | direct-hub.net</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildPinSecurityAlertEmail(data: Record<string, any>): { subject: string; html: string } {
  const { full_name, failed_attempts, locked_at, unlock_at, lockout_hours, site_url } = data;
  const lockedDate = locked_at
    ? new Date(locked_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
    : "—";
  const unlockDate = unlock_at
    ? new Date(unlock_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })
    : "—";

  return {
    subject: `🔒 تنبيه أمني عاجل: تم قفل رمز الأمان المالي — DirectHub`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr><td style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 40px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${APP_NAME}</h1>
                  <p style="margin:6px 0 0;color:#fca5a5;font-size:13px;">تنبيه أمني عاجل</p>
                </td></tr>

                <!-- Alert Banner -->
                <tr><td style="background:#fef2f2;border-bottom:2px solid #dc2626;padding:16px 40px;text-align:center;">
                  <p style="margin:0;color:#991b1b;font-size:16px;font-weight:700;">⚠️ تم رصد محاولات غير مصرح بها</p>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:36px 40px;">
                  <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
                    مرحباً ${full_name || "عزيزي المستخدم"},
                  </p>
                  <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
                    تم رصد <strong style="color:#dc2626;">${failed_attempts} محاولات فاشلة</strong> لإدخال رمز الأمان المالي (Transaction Security PIN) على حسابك في منصة DirectHub.
                  </p>

                  <!-- Alert Box -->
                  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:24px;margin-bottom:28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;color:#6b7280;font-size:13px;width:50%;border-bottom:1px solid #fee2e2;">الحالة</td>
                        <td style="padding:8px 0;text-align:left;border-bottom:1px solid #fee2e2;">
                          <span style="background:#dc2626;color:#fff;font-size:12px;font-weight:700;padding:3px 12px;border-radius:20px;">🔒 محظور</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #fee2e2;">عدد المحاولات الفاشلة</td>
                        <td style="padding:8px 0;color:#dc2626;font-size:15px;font-weight:800;text-align:left;border-bottom:1px solid #fee2e2;">${failed_attempts} محاولات</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #fee2e2;">وقت القفل</td>
                        <td style="padding:8px 0;color:#374151;font-size:13px;text-align:left;border-bottom:1px solid #fee2e2;">${lockedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#6b7280;font-size:13px;">يُفتح تلقائياً في</td>
                        <td style="padding:8px 0;color:#374151;font-size:13px;text-align:left;">${unlockDate}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- What happened -->
                  <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                    <p style="margin:0 0 8px;color:#92400e;font-size:13px;font-weight:700;">ماذا حدث؟</p>
                    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.7;">
                      تم إدخال رمز الأمان المالي بشكل خاطئ ${failed_attempts} مرات متتالية. لحماية أموالك وعملياتك المالية، قام النظام تلقائياً بتعليق إمكانية إدخال الرمز لمدة <strong>${lockout_hours} ساعات</strong>.
                    </p>
                  </div>

                  <!-- Security steps -->
                  <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
                    <p style="margin:0 0 10px;color:#166534;font-size:13px;font-weight:700;">خطوات الحماية الموصى بها:</p>
                    <ol style="margin:0;padding-right:20px;color:#15803d;font-size:13px;line-height:2.2;">
                      <li>تأكد من أن لا أحد يعلم برمز الأمان المالي الخاص بك</li>
                      <li>إذا لم تكن أنت من قام بهذه المحاولات، قم بتغيير كلمة مرور حسابك فوراً</li>
                      <li>تواصل مع فريق الدعم إذا كنت تشك في اختراق حسابك</li>
                      <li>بعد انتهاء فترة القفل، قم بتغيير رمز الأمان المالي</li>
                    </ol>
                  </div>

                  <!-- CTA -->
                  <div style="text-align:center;margin-bottom:20px;">
                    <a href="${site_url || "https://direct-hub.net"}/my-account"
                       style="display:inline-block;background:#1a56db;color:#ffffff;font-size:14px;font-weight:700;padding:12px 32px;border-radius:10px;text-decoration:none;">
                      🔐 الذهاب إلى إعدادات الحساب
                    </a>
                  </div>

                  <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
                    إذا كنت أنت من قام بهذه المحاولات وتذكرت رمزك، لا داعي لأي إجراء — سيُفتح حسابك تلقائياً بعد ${lockout_hours} ساعات.
                  </p>
                </td></tr>

                <!-- Footer -->
                <tr><td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${APP_NAME} — نظام الأمان المالي | direct-hub.net</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildEscrowBuyerFundedEmail(data: Record<string, any>): { subject: string; html: string } {
  const {
    buyer_name, buyer_company, buyer_address, buyer_country,
    order_number, invoice_number, issue_date, due_date,
    payment_terms, incoterms, items = [],
    subtotal, shipping_cost, tax_amount, total, currency = "USD",
    delivery_pin, notes,
  } = data;

  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;vertical-align:top;">
        <strong>${item.description || item.name || "Product"}</strong>
        ${item.hs_code ? `<br><span style="color:#9ca3af;font-size:11px;">HS: ${item.hs_code}</span>` : ""}
        ${item.country_of_origin ? `<br><span style="color:#6b7280;font-size:11px;">Origin: ${item.country_of_origin}</span>` : ""}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:center;vertical-align:top;">${item.quantity} ${item.unit || ""}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:right;vertical-align:top;">${currency} ${Number(item.unit_price).toFixed(2)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:right;vertical-align:top;font-weight:600;">${currency} ${Number(item.total || (item.quantity * item.unit_price)).toFixed(2)}</td>
    </tr>
  `).join("");

  return {
    subject: `✅ تم تأمين أموالك — فاتورة ${invoice_number} + رمز التسليم | DirectHub`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr><td style="background:#111827;padding:28px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">DirectHub</p>
                        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">INVOICE</h1>
                      </td>
                      <td style="text-align:right;">
                        <p style="margin:0;color:#ffffff;font-size:18px;font-weight:800;font-family:monospace;">${invoice_number}</p>
                        <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Order #${order_number}</p>
                        <span style="display:inline-block;margin-top:6px;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">🔒 FUNDS SECURED</span>
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <!-- Date Row -->
                <tr><td style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:16px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right:24px;">
                        <p style="margin:0 0 2px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Issue Date</p>
                        <p style="margin:0;color:#111827;font-size:13px;font-weight:600;">${issue_date || new Date().toISOString().split("T")[0]}</p>
                      </td>
                      <td style="padding-right:24px;">
                        <p style="margin:0 0 2px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Due Date</p>
                        <p style="margin:0;color:#111827;font-size:13px;font-weight:600;">${due_date || ""}</p>
                      </td>
                      <td style="padding-right:24px;">
                        <p style="margin:0 0 2px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Payment Terms</p>
                        <p style="margin:0;color:#111827;font-size:13px;font-weight:600;">${payment_terms || "T/T Advance"}</p>
                      </td>
                      <td>
                        <p style="margin:0 0 2px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Incoterms</p>
                        <p style="margin:0;color:#111827;font-size:13px;font-weight:600;">${incoterms || "FOB"}</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <!-- Bill From / Bill To -->
                <tr><td style="padding:24px 40px;border-bottom:1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="48%" style="vertical-align:top;">
                        <p style="margin:0 0 8px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Bill From</p>
                        <p style="margin:0 0 3px;color:#111827;font-size:14px;font-weight:700;">DirectHub</p>
                        <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">Direct Hub Trading Platform<br>Saudi Arabia</p>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="vertical-align:top;">
                        <p style="margin:0 0 8px;color:#9ca3af;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">Bill To</p>
                        <p style="margin:0 0 3px;color:#111827;font-size:14px;font-weight:700;">${buyer_name}</p>
                        ${buyer_company ? `<p style="margin:0 0 2px;color:#374151;font-size:13px;">${buyer_company}</p>` : ""}
                        ${buyer_address ? `<p style="margin:0 0 2px;color:#6b7280;font-size:12px;line-height:1.5;">${buyer_address}</p>` : ""}
                        ${buyer_country ? `<p style="margin:0;color:#6b7280;font-size:12px;">${buyer_country}</p>` : ""}
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:28px 40px;">

                  <!-- Items Table -->
                  <h3 style="margin:0 0 12px;color:#111827;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Description</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-top:2px solid #111827;">
                    <thead>
                      <tr>
                        <th style="padding:10px 8px 10px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;border-bottom:1px solid #e5e7eb;">Product / Description</th>
                        <th style="padding:10px 8px;text-align:center;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;border-bottom:1px solid #e5e7eb;">Qty</th>
                        <th style="padding:10px 8px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;border-bottom:1px solid #e5e7eb;">Unit Price</th>
                        <th style="padding:10px 0 10px 8px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;border-bottom:1px solid #e5e7eb;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml || `<tr><td colspan="4" style="padding:16px 0;text-align:center;color:#9ca3af;font-size:13px;">No items</td></tr>`}
                    </tbody>
                  </table>

                  <!-- Totals -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td width="55%"></td>
                      <td width="45%">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Subtotal</td>
                            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${currency} ${Number(subtotal).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Shipping</td>
                            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${currency} ${Number(shipping_cost).toFixed(2)}</td>
                          </tr>
                          ${Number(tax_amount) > 0 ? `
                          <tr>
                            <td style="padding:4px 0;color:#6b7280;font-size:13px;">Tax</td>
                            <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;">${currency} ${Number(tax_amount).toFixed(2)}</td>
                          </tr>` : ""}
                          <tr>
                            <td style="padding:10px 0 4px;color:#111827;font-size:15px;font-weight:800;border-top:2px solid #111827;">TOTAL DUE</td>
                            <td style="padding:10px 0 4px;color:#111827;font-size:15px;font-weight:800;text-align:right;border-top:2px solid #111827;">${currency} ${Number(total).toFixed(2)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Delivery PIN — Secure Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;padding:24px;">
                        <p style="margin:0 0 6px;color:#92400e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">🔐 Delivery PIN — Confidential</p>
                        <p style="margin:0 0 16px;color:#78350f;font-size:13px;line-height:1.6;">
                          This is your secret Delivery PIN. <strong>Keep it private.</strong> Only share it with the factory representative at the moment of physical delivery to confirm receipt and release escrow funds.
                        </p>
                        <div style="background:#ffffff;border:2px dashed #f59e0b;border-radius:8px;padding:16px;text-align:center;">
                          <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#92400e;font-family:monospace;">${delivery_pin}</span>
                        </div>
                        <p style="margin:12px 0 0;color:#92400e;font-size:12px;text-align:center;">⚠️ Do NOT share this PIN via chat, phone, or email with anyone except the factory at delivery.</p>
                      </td>
                    </tr>
                  </table>

                  ${notes ? `
                  <div style="background:#f9fafb;border-left:3px solid #d1d5db;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;">Notes</p>
                    <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">${notes}</p>
                  </div>` : ""}

                  <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;border-top:1px solid #f3f4f6;padding-top:16px;">
                    This is an official commercial invoice generated by the DirectHub Tripartite Escrow System. 
                    Your funds are secured in escrow and will be released to the factory only upon your confirmation of delivery using the PIN above.
                  </p>
                </td></tr>

                <!-- Footer -->
                <tr><td style="background:#111827;padding:20px 40px;text-align:center;">
                  <p style="margin:0;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} DirectHub. All rights reserved. | direct-hub.net</p>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildEscrowFactoryFundedEmail(data: Record<string, any>): { subject: string; html: string } {
  const {
    factory_name, factory_company,
    order_number, invoice_number, buyer_name, buyer_company,
    items = [], subtotal, shipping_cost, total, currency = "USD",
    issue_date, notes, site_url = "https://direct-hub.net",
  } = data;

  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;vertical-align:top;">
        <strong>${item.description || item.name || "Product"}</strong>
        ${item.hs_code ? `<br><span style="color:#9ca3af;font-size:11px;">HS: ${item.hs_code}</span>` : ""}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:center;vertical-align:top;">${item.quantity} ${item.unit || ""}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:13px;text-align:right;vertical-align:top;font-weight:600;">${currency} ${Number(item.total || (item.quantity * item.unit_price)).toFixed(2)}</td>
    </tr>
  `).join("");

  return {
    subject: `💰 تأكيد التمويل — الطلب #${order_number} جاهز للإنتاج | DirectHub`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;direction:rtl;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 20px;">
            <tr><td align="center">
              <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr><td style="background:#111827;padding:28px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0 0 2px;color:#9ca3af;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">DirectHub</p>
                        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">تأكيد التمويل</h1>
                        <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Funding Confirmation</p>
                      </td>
                      <td style="text-align:left;">
                        <span style="display:inline-block;background:#d1fae5;color:#065f46;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">💰 FUNDED</span>
                        <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;font-family:monospace;">Order #${order_number}</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>

                <!-- Green Banner -->
                <tr><td style="background:#d1fae5;border-bottom:2px solid #6ee7b7;padding:16px 40px;text-align:center;">
                  <p style="margin:0;color:#065f46;font-size:15px;font-weight:700;">✅ تم تأمين أموال الطلب في محفظة الضمان — ابدأ الإنتاج الآن</p>
                </td></tr>

                <!-- Body -->
                <tr><td style="padding:32px 40px;">

                  <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.7;">
                    مرحباً ${factory_name || "عزيزي المورد"}${factory_company ? ` — ${factory_company}` : ""},
                  </p>
                  <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
                    نُبشّرك بأن المشتري <strong>${buyer_name}${buyer_company ? ` (${buyer_company})` : ""}</strong> قد أتمّ عملية الدفع بنجاح، وتم تأمين المبلغ الكامل في محفظة الضمان المالي لمنصة DirectHub. يمكنك البدء في تنفيذ الطلب فوراً.
                  </p>

                  <!-- Order Summary Box -->
                  <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:24px;margin-bottom:28px;">
                    <p style="margin:0 0 16px;color:#1e40af;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">ملخص الطلب — Order Summary</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #dbeafe;">رقم الطلب</td>
                        <td style="padding:6px 0;color:#1e3a8a;font-size:14px;font-weight:700;text-align:left;border-bottom:1px solid #dbeafe;font-family:monospace;">#${order_number}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #dbeafe;">رقم الفاتورة</td>
                        <td style="padding:6px 0;color:#374151;font-size:13px;text-align:left;border-bottom:1px solid #dbeafe;font-family:monospace;">${invoice_number}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #dbeafe;">المشتري</td>
                        <td style="padding:6px 0;color:#374151;font-size:13px;text-align:left;border-bottom:1px solid #dbeafe;">${buyer_name}${buyer_company ? ` — ${buyer_company}` : ""}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #dbeafe;">تاريخ الإصدار</td>
                        <td style="padding:6px 0;color:#374151;font-size:13px;text-align:left;border-bottom:1px solid #dbeafe;">${issue_date || new Date().toISOString().split("T")[0]}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 4px;color:#111827;font-size:15px;font-weight:800;border-top:2px solid #bfdbfe;">إجمالي المبلغ المؤمَّن</td>
                        <td style="padding:10px 0 4px;color:#1a56db;font-size:16px;font-weight:800;text-align:left;border-top:2px solid #bfdbfe;">${currency} ${Number(total).toFixed(2)}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- Items Table -->
                  <h3 style="margin:0 0 12px;color:#111827;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">تفاصيل المنتجات المطلوبة</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                    <thead>
                      <tr style="background:#f3f4f6;">
                        <th style="padding:10px 8px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">المنتج</th>
                        <th style="padding:10px 8px;text-align:center;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">الكمية</th>
                        <th style="padding:10px 8px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:700;">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml || `<tr><td colspan="3" style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">لا توجد منتجات</td></tr>`}
                    </tbody>
                  </table>

                  <!-- Fund Release Instructions -->
                  <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:24px;margin-bottom:24px;">
                    <p style="margin:0 0 12px;color:#92400e;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">📋 تعليمات تحرير الأموال — Fund Release Instructions</p>
                    <ol style="margin:0;padding-right:20px;color:#78350f;font-size:13px;line-height:2.2;">
                      <li>قم بتنفيذ الطلب وشحن البضاعة وفق المواصفات المتفق عليها</li>
                      <li>قم بتحديث حالة الطلب إلى <strong>"تم الشحن"</strong> في لوحة تحكمك</li>
                      <li>عند وصول البضاعة، سيقوم المشتري بمشاركة <strong>رمز التسليم السري (Delivery PIN)</strong> معك</li>
                      <li>أدخل رمز التسليم في لوحة تحكمك لتأكيد الاستلام وتحرير الأموال تلقائياً</li>
                      <li>بعد التحقق من الرمز، ستُحوَّل الأموال إلى حسابك فوراً</li>
                    </ol>
                  </div>

                  <!-- CTA -->
                  <div style="text-align:center;margin-bottom:24px;">
                    <a href="${site_url}/manufacturer/dashboard"
                       style="display:inline-block;background:#111827;color:#ffffff;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">
                      🏭 الذهاب إلى لوحة تحكم المصنع
                    </a>
                  </div>

                  ${notes ? `
                  <div style="background:#f9fafb;border-left:3px solid #d1d5db;border-radius:4px;padding:12px 16px;margin-bottom:20px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;">ملاحظات</p>
                    <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">${notes}</p>
                  </div>` : ""}

                  <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;border-top:1px solid #f3f4f6;padding-top:16px;">
                    هذا الإشعار صادر تلقائياً من نظام الضمان المالي لمنصة DirectHub. الأموال مؤمَّنة ولن تُحرَّر إلا بعد تأكيد التسليم عبر رمز التسليم السري.
                  </p>
                </td></tr>

                <!-- Footer -->
                <tr><td style="background:#111827;padding:20px 40px;text-align:center;">
                  <p style="margin:0;color:#6b7280;font-size:12px;">&copy; ${new Date().getFullYear()} DirectHub — نظام الضمان المالي الآمن | direct-hub.net</p>
                </td></tr>

              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  };
}

function buildWelcomeEmail(data: Record<string, any>): { subject: string; html: string } {
  const full_name = data.full_name ? `${data.full_name}` : "";
  const role = (data.role || data.seller_category || "buyer").toLowerCase();

  // Determine if this user is a supplier/factory
  const isSupplier = role === "supplier" || role === "factory" || role === "manufacturer" || role === "seller";

  // Role-based welcome message
  const welcomeMessageAr = isSupplier
    ? "تفضل بزيارة المنصة وعرض منتجك وقم بالبيع من خلال المنصة مباشرة." :"مرحباً، تفضل بزيارة المنتجات داخل المنصة واشتري من مصانع موثوقة.";

  const welcomeMessageEn = isSupplier
    ? "Welcome, please visit the platform to showcase your products and sell directly through the platform."
    : "Welcome, please explore products inside the platform and buy from trusted factories.";

  // Always use the direct production URL — never pass through tracking links
  const dashboardUrl = "https://direct-hub.net/dashboard";

  return {
    subject: `أهلاً بك في أسواق دايركت هب العالمية – بوابة التجارة والصناعة الأولى`,
    html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Tahoma, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; direction: rtl; text-align: right; }
        .container { max-width: 600px; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: auto; }
        .header { text-align: center; color: #1e293b; margin-bottom: 20px; }
        .content { color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; text-align: center; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        .arabic-name { color: #1e40af; font-weight: bold; font-size: 18px; }
        .welcome-msg { background: #eff6ff; border-right: 4px solid #2563eb; padding: 14px 18px; border-radius: 6px; margin: 20px 0; color: #1e40af; font-size: 15px; line-height: 1.7; }
    </style>
</head>
<body>
    <div class="container">
        <h2 class="header">أهلاً بك في <span class="arabic-name">DirectHub</span> 🚀</h2>
        <div class="content">
            <p>مرحباً${full_name ? ` ${full_name}` : ""}،</p>
            <p>يسعدنا انضمامك إلى <strong>DirectHub</strong>، بوابتك الموثوقة لتجارة المواد الخام والمنتجات الصناعية على المستوى العالمي.</p>
            <div class="welcome-msg">
                <strong>🌟 ${welcomeMessageAr}</strong><br>
                <span style="color:#64748b;font-size:13px;">${welcomeMessageEn}</span>
            </div>
            <p>حسابك الآن جاهز تماماً لتصفح الموردين، استعراض المنتجات، وإدارة طلباتك بكل سهولة ويسر.</p>
            <div style="text-align: center; margin-top: 30px;">
                <a href="${dashboardUrl}" class="btn" style="color:#ffffff !important;">الانتقال إلى لوحة التحكم</a>
            </div>
        </div>
        <div class="footer">
            <p>DirectHub &copy; 2026 جميع الحقوق محفوظة لمنصة</p>
        </div>
    </div>
</body>
</html>`,
  };
}

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const payload: EmailPayload = await req.json();
    const { type, to, data } = payload;

    if (!type || !to) {
      throw new Error("Missing required fields: type and to");
    }

    let emailContent: { subject: string; html: string };

    switch (type) {
      case "otp":
        emailContent = buildOtpEmail(data);
        break;
      case "order_confirmation":
        emailContent = buildOrderConfirmationEmail(data);
        break;
      case "rfq_response":
        emailContent = buildRfqResponseEmail(data);
        break;
      case "shipping_notification":
        emailContent = buildShippingNotificationEmail(data);
        break;
      case "escrow_status_update":
        emailContent = buildEscrowStatusEmail(data);
        break;
      case "commercial_invoice":
        emailContent = buildCommercialInvoiceEmail(data);
        break;
      case "admin_payout_review":
        emailContent = buildAdminPayoutReviewEmail(data);
        break;
      case "pin_security_alert":
        emailContent = buildPinSecurityAlertEmail(data);
        break;
      case "escrow_buyer_funded":
        emailContent = buildEscrowBuyerFundedEmail(data);
        break;
      case "escrow_factory_funded":
        emailContent = buildEscrowFactoryFundedEmail(data);
        break;
      case "welcome":
        emailContent = buildWelcomeEmail(data);
        break;
      case "admin_notification":
        emailContent = {
          subject: data.subject || 'New International RFQ Notification',
          html: data.body ? `<p>${escapeHtml(String(data.body))}</p>` : 'New international RFQ received.'
        };
        break;
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        ...(["rfq_response", "admin_payout_review", "order_confirmation"].includes(type) && {
          reply_to: SALES_RFQ_EMAIL,
          bcc: [SALES_RFQ_EMAIL],
        }),
        subject: emailContent.subject,
        html: emailContent.html,
        headers: {
          "X-Entity-Ref-ID": type,
        },
        tags: [{ name: "type", value: type }],
        click_tracking: false,
        open_tracking: false,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to send email via Resend");
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id, type }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
