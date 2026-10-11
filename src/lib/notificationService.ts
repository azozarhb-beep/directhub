/**
 * DirectHub Dual Notification Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Fires both an in-app Supabase notification and a Resend email in parallel
 * via Promise.allSettled. Each channel is fully isolated — a failure in one
 * never blocks the other or the calling request cycle.
 *
 * Usage:
 *   import { sendDualNotification } from '@/lib/notificationService';
 *   await sendDualNotification({ userId, title, message, type });
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@/lib/supabase/client';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'notifications@direct-hub.net';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

// ─── Payload Interface ────────────────────────────────────────────────────────

export interface NotificationPayload {
  /** Target user ID (used to insert into notifications table) */
  userId: string;
  /** Notification title (shown in bell icon) */
  title: string;
  /** Notification body message */
  message: string;
  /** Notification type (maps to existing notification types) */
  type: string;
  /** Optional: recipient email. If omitted, auto-fetched from user_profiles */
  userEmail?: string;
  /** Optional: deep-link shown in the email CTA */
  link?: string;
}

// ─── Result Interface ─────────────────────────────────────────────────────────

export interface DualNotificationResult {
  inApp: { success: boolean; error?: string };
  email: { success: boolean; error?: string; skipped?: boolean };
}

// ─── Helper: Fetch user email from user_profiles ──────────────────────────────

async function fetchUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (error || !data?.email) return null;
    return data.email as string;
  } catch {
    return null;
  }
}

// ─── Helper: Send Resend email directly via API ───────────────────────────────

async function sendResendEmail(
  to: string,
  title: string,
  message: string,
  link: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const ctaUrl = link.startsWith('http') ? link : `${SITE_URL}${link}`;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a56db,#0e9f6e);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">DirectHub</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">منصة التجارة الصناعية المباشرة</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;color:#111827;font-size:18px;font-weight:700;">${title}</h2>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">${message}</p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:#1a56db;border-radius:10px;padding:14px 32px;text-align:center;">
                    <a href="${ctaUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">
                      عرض التفاصيل
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">
                هذا البريد أُرسل تلقائياً من منصة DirectHub — لا تحتاج للرد عليه.
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:11px;">
                © ${new Date().getFullYear()} DirectHub. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: title,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `Resend API error ${res.status}: ${body}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown Resend error' };
  }
}

// ─── Main: sendDualNotification ───────────────────────────────────────────────

/**
 * Sends both an in-app notification (Supabase `notifications` table) and a
 * Resend email in parallel. Errors in either channel are isolated and logged
 * but never thrown — the calling code always continues.
 *
 * @param payload  NotificationPayload
 * @returns        DualNotificationResult with per-channel success/error info
 */
export async function sendDualNotification(
  payload: NotificationPayload
): Promise<DualNotificationResult> {
  const { userId, title, message, type, link = '/my-account' } = payload;
  let { userEmail } = payload;

  // ── Auto-fetch email if not provided ──────────────────────────────────────
  if (!userEmail) {
    const fetched = await fetchUserEmail(userId);
    if (fetched) userEmail = fetched;
  }

  // ── Run both channels in parallel ─────────────────────────────────────────
  const [inAppResult, emailResult] = await Promise.allSettled([
    // Channel A: In-app notification (Supabase)
    (async (): Promise<{ success: boolean; error?: string }> => {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('notifications').insert({
          user_id: userId,
          type,
          title,
          body: message,
          link,
          is_read: false,
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'In-app insert failed' };
      }
    })(),

    // Channel B: Resend email
    (async (): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
      if (!userEmail) {
        return { success: false, skipped: true, error: 'No email address available' };
      }
      return sendResendEmail(userEmail, title, message, link);
    })(),
  ]);

  // ── Normalise results ─────────────────────────────────────────────────────
  const inApp: DualNotificationResult['inApp'] =
    inAppResult.status === 'fulfilled'
      ? inAppResult.value
      : { success: false, error: String(inAppResult.reason) };

  const email: DualNotificationResult['email'] =
    emailResult.status === 'fulfilled'
      ? emailResult.value
      : { success: false, error: String(emailResult.reason) };

  // ── Isolated logging (never throws) ──────────────────────────────────────
  if (!inApp.success) {
    console.error('[DualNotification] In-app channel failed:', inApp.error);
  }
  if (!email.success && !email.skipped) {
    console.warn('[DualNotification] Email channel failed:', email.error);
  }

  return { inApp, email };
}

// ─── Server-side variant (uses supabaseAdmin for API routes) ──────────────────

/**
 * Server-side version of sendDualNotification.
 * Accepts a Supabase admin client so it can be called from API routes
 * without needing a browser session.
 */
export async function sendDualNotificationServer(
  supabaseClient: any,
  payload: NotificationPayload
): Promise<DualNotificationResult> {
  const { userId, title, message, type, link = '/my-account' } = payload;
  let { userEmail } = payload;

  // ── Auto-fetch email if not provided ──────────────────────────────────────
  if (!userEmail) {
    try {
      const { data } = await supabaseClient
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single();
      if (data?.email) userEmail = data.email as string;
    } catch {
      // silent — email is optional
    }
  }

  // ── Run both channels in parallel ─────────────────────────────────────────
  const [inAppResult, emailResult] = await Promise.allSettled([
    // Channel A: In-app notification
    (async (): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabaseClient.from('notifications').insert({
          user_id: userId,
          type,
          title,
          body: message,
          link,
          is_read: false,
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'In-app insert failed' };
      }
    })(),

    // Channel B: Resend email
    (async (): Promise<{ success: boolean; error?: string; skipped?: boolean }> => {
      if (!userEmail) {
        return { success: false, skipped: true, error: 'No email address available' };
      }
      return sendResendEmail(userEmail, title, message, link);
    })(),
  ]);

  const inApp: DualNotificationResult['inApp'] =
    inAppResult.status === 'fulfilled'
      ? inAppResult.value
      : { success: false, error: String(inAppResult.reason) };

  const email: DualNotificationResult['email'] =
    emailResult.status === 'fulfilled'
      ? emailResult.value
      : { success: false, error: String(emailResult.reason) };

  if (!inApp.success) {
    console.error('[DualNotification:Server] In-app channel failed:', inApp.error);
  }
  if (!email.success && !email.skipped) {
    console.warn('[DualNotification:Server] Email channel failed:', email.error);
  }

  return { inApp, email };
}
