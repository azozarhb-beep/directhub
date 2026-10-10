import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Abandoned Cart Push Notification Engine
 *
 * Called automatically every 4 hours via Vercel Cron (vercel.json).
 * No external scheduling service required.
 *
 * It will:
 *  1. Find all cart_items older than 4 hours where the user has NOT completed an order
 *  2. Skip users who were already notified in the last 4 hours
 *  3. Send a push notification to each eligible user with a direct link to buyer-dashboard
 *  4. Log the notification in abandoned_cart_notifications
 */

interface PushPayload {
  title: string;
  body: string;
  image?: string;
  icon?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  user_id: string | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = Buffer.from(base64, 'base64');
  return new Uint8Array(rawData);
}

async function buildVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: expiration, sub: subject };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const privateKeyBytes = urlBase64ToUint8Array(vapidPrivateKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    Buffer.from(signingInput)
  );

  const encodedSignature = Buffer.from(signature).toString('base64url');
  const jwt = `${signingInput}.${encodedSignature}`;
  return `vapid t=${jwt}, k=${vapidPublicKey}`;
}

async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ success: boolean; endpoint: string; error?: string }> {
  try {
    const authHeader = await buildVapidAuthHeader(sub.endpoint, vapidPublicKey, vapidPrivateKey, subject);
    const payloadStr = JSON.stringify(payload);

    const response = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(Buffer.byteLength(payloadStr)),
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: payloadStr,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, endpoint: sub.endpoint };
    }
    if (response.status === 410 || response.status === 404) {
      return { success: false, endpoint: sub.endpoint, error: 'expired' };
    }
    const errorText = await response.text().catch(() => response.statusText);
    return { success: false, endpoint: sub.endpoint, error: `HTTP ${response.status}: ${errorText}` };
  } catch (err: any) {
    return { success: false, endpoint: sub.endpoint, error: err?.message || 'Network error' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Accept Vercel Cron Authorization header or legacy ?secret query param
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const isVercelCron = request.headers.get('x-vercel-cron') === '1';
      const validBearer = bearerToken === cronSecret;
      const validQuery = secret === cronSecret;
      if (!isVercelCron && !validBearer && !validQuery) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
    const buyerDashboardUrl = `${siteUrl}/buyer-dashboard`;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
    }

    const supabase = await createClient();

    // 4 hours ago threshold (changed from 6 hours)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Find users who have cart items older than 4 hours
    const { data: abandonedCarts, error: cartError } = await supabase
      .from('cart_items')
      .select('user_id, product_name, product_name_ar, created_at')
      .lt('created_at', fourHoursAgo)
      .not('user_id', 'is', null);

    if (cartError) {
      return NextResponse.json({ error: cartError.message }, { status: 500 });
    }

    if (!abandonedCarts || abandonedCarts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No abandoned carts found',
        notified: 0,
      });
    }

    // Group by user_id
    const userCartMap = new Map<string, { productNames: string[]; count: number }>();
    for (const item of abandonedCarts) {
      if (!item.user_id) continue;
      const existing = userCartMap.get(item.user_id) || { productNames: [], count: 0 };
      const name = item.product_name_ar || item.product_name || 'منتج';
      if (!existing.productNames.includes(name)) {
        existing.productNames.push(name);
      }
      existing.count++;
      userCartMap.set(item.user_id, existing);
    }

    const eligibleUserIds = Array.from(userCartMap.keys());

    if (eligibleUserIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No eligible users', notified: 0 });
    }

    // Filter out users already notified in the last 4 hours
    const { data: recentNotifications } = await supabase
      .from('abandoned_cart_notifications')
      .select('user_id')
      .in('user_id', eligibleUserIds)
      .gte('notified_at', fourHoursAgo);

    const alreadyNotifiedIds = new Set((recentNotifications || []).map((n: any) => n.user_id));
    const usersToNotify = eligibleUserIds.filter((uid) => !alreadyNotifiedIds.has(uid));

    if (usersToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All eligible users already notified within the last 4 hours',
        notified: 0,
      });
    }

    // Get push subscriptions for these users
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', usersToNotify);

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      const logEntries = usersToNotify.map((uid) => ({
        user_id: uid,
        notified_at: new Date().toISOString(),
        cart_item_count: userCartMap.get(uid)?.count || 0,
        product_names: userCartMap.get(uid)?.productNames.slice(0, 3).join('، ') || '',
        sent_count: 0,
        failed_count: 0,
        status: 'no_subscription',
      }));
      await supabase.from('abandoned_cart_notifications').insert(logEntries);

      return NextResponse.json({
        success: true,
        message: 'No push subscriptions found for eligible users',
        notified: 0,
        usersEligible: usersToNotify.length,
      });
    }

    // Group subscriptions by user_id
    const subsByUser = new Map<string, PushSubscriptionRow[]>();
    for (const sub of subscriptions as PushSubscriptionRow[]) {
      if (!sub.user_id) continue;
      const arr = subsByUser.get(sub.user_id) || [];
      arr.push(sub);
      subsByUser.set(sub.user_id, arr);
    }

    const expiredEndpoints: string[] = [];
    let totalNotified = 0;
    let totalFailed = 0;
    const logEntries: any[] = [];

    for (const userId of usersToNotify) {
      const userSubs = subsByUser.get(userId);
      if (!userSubs || userSubs.length === 0) {
        logEntries.push({
          user_id: userId,
          notified_at: new Date().toISOString(),
          cart_item_count: userCartMap.get(userId)?.count || 0,
          product_names: userCartMap.get(userId)?.productNames.slice(0, 3).join('، ') || '',
          sent_count: 0,
          failed_count: 0,
          status: 'no_subscription',
        });
        continue;
      }

      const cartInfo = userCartMap.get(userId)!;
      const productList = cartInfo.productNames.slice(0, 2).join('، ');
      const itemCount = cartInfo.count;

      const pushPayload: PushPayload = {
        title: '🛒 لديك منتجات في سلة مشترياتك!',
        body: itemCount === 1
          ? `لم تكمل طلبك بعد: ${productList}. أتمم طلبك الآن من لوحة التحكم.`
          : `لديك ${itemCount} منتجات في سلتك (${productList}...). أتمم طلبك الآن!`,
        url: buyerDashboardUrl,
        tag: 'abandoned-cart',
        requireInteraction: true,
        icon: '/api/icons/192',
        actions: [
          { action: 'complete', title: 'إتمام الطلب' },
          { action: 'dismiss', title: 'لاحقاً' },
        ],
      };

      let sentCount = 0;
      let failedCount = 0;

      const results = await Promise.all(
        userSubs.map((sub) =>
          sendPushToSubscription(sub, pushPayload, vapidPublicKey, vapidPrivateKey, siteUrl)
        )
      );

      for (const result of results) {
        if (result.success) {
          sentCount++;
          totalNotified++;
        } else {
          failedCount++;
          totalFailed++;
          if (result.error === 'expired') {
            expiredEndpoints.push(result.endpoint);
          }
        }
      }

      logEntries.push({
        user_id: userId,
        notified_at: new Date().toISOString(),
        cart_item_count: itemCount,
        product_names: cartInfo.productNames.slice(0, 3).join('، '),
        sent_count: sentCount,
        failed_count: failedCount,
        status: sentCount > 0 ? 'sent' : 'failed',
      });
    }

    if (logEntries.length > 0) {
      await supabase.from('abandoned_cart_notifications').insert(logEntries);
    }

    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال إشعارات السلال المهملة',
      usersEligible: usersToNotify.length,
      notified: totalNotified,
      failed: totalFailed,
      expiredRemoved: expiredEndpoints.length,
    });
  } catch (err: any) {
    console.error('Abandoned cart notification error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

// Also support POST for manual trigger from admin panel
export async function POST(request: NextRequest) {
  return GET(request);
}
