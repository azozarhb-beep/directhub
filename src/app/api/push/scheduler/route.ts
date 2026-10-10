import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Automated Push Notification Scheduler
 * 
 * This endpoint is called by an external cron service (e.g. cron-job.org, Vercel Cron)
 * at 09:00, 13:00, and 18:00 daily.
 * 
 * It automatically:
 * 1. Detects which scheduled job should run based on current time
 * 2. Pulls a random active product from the database
 * 3. Sends a rich push notification to ALL subscribed users
 * 4. Logs the execution result
 * 
 * Cron URLs to configure:
 *   GET /api/push/scheduler?time=09:00
 *   GET /api/push/scheduler?time=13:00
 *   GET /api/push/scheduler?time=18:00
 * 
 * Or call without ?time to auto-detect based on current server time.
 */

interface PushPayload {
  title: string;
  body: string;
  image?: string;
  icon?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
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
        'Urgency': 'normal',
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

/**
 * Pick a random active product from manufacturer_products table.
 * Returns title, body (description), image_url, and destination URL.
 */
async function pickRandomProduct(supabase: any): Promise<{
  id: string;
  title: string;
  body: string;
  image: string | null;
  url: string;
} | null> {
  const selectFields = 'id, name, name_ar, description, description_ar, images, product_images, unit_price, b2c_price, is_active, is_published, inventory_status';

  // Strategy 1: is_active = true AND is_published = true
  let { count: count1 } = await supabase
    .from('manufacturer_products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('is_published', true);

  // Strategy 2: is_active = true (any publish state)
  let { count: count2 } = await supabase
    .from('manufacturer_products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  // Strategy 3: any product at all (fallback)
  let { count: count3 } = await supabase
    .from('manufacturer_products')
    .select('id', { count: 'exact', head: true });

  // Pick the best available strategy
  let query = supabase.from('manufacturer_products').select(selectFields);
  let totalCount = 0;

  if (count1 && count1 > 0) {
    query = supabase.from('manufacturer_products').select(selectFields)
      .eq('is_active', true)
      .eq('is_published', true);
    totalCount = count1;
  } else if (count2 && count2 > 0) {
    query = supabase.from('manufacturer_products').select(selectFields)
      .eq('is_active', true);
    totalCount = count2;
  } else if (count3 && count3 > 0) {
    query = supabase.from('manufacturer_products').select(selectFields);
    totalCount = count3;
  }

  if (totalCount === 0) return null;

  // Pick a random offset
  const randomOffset = Math.floor(Math.random() * totalCount);

  const { data: products, error } = await query
    .range(randomOffset, randomOffset)
    .limit(1);

  if (error || !products || products.length === 0) return null;

  const product = products[0];

  // Prefer Arabic name/description for the Arabic-first platform
  const title = product.name_ar || product.name || 'عرض جديد على دايركت هب';
  const rawDesc = product.description_ar || product.description || '';
  const body = rawDesc.length > 100 ? rawDesc.substring(0, 97) + '...' : rawDesc || 'اكتشف هذا المنتج المميز الآن';

  // Get first image from images array (try product_images first, then images)
  let image: string | null = null;
  const imageSource = (product.product_images && Array.isArray(product.product_images) && product.product_images.length > 0)
    ? product.product_images
    : product.images;

  if (imageSource && Array.isArray(imageSource) && imageSource.length > 0) {
    image = typeof imageSource[0] === 'string' ? imageSource[0] : imageSource[0]?.url || null;
  } else if (typeof imageSource === 'string') {
    image = imageSource;
  }

  const price = product.unit_price || product.b2c_price;
  const priceText = price ? ` - ${price} USD` : '';
  const fullBody = body + priceText;

  return {
    id: product.id,
    title,
    body: fullBody,
    image,
    url: `/product/${product.id}`,
  };
}

/**
 * Determine which scheduled time slot we're in (±30 min window).
 */
function detectCurrentTimeSlot(): string | null {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();
  const totalMinutes = hours * 60 + minutes;

  const slots = [
    { time: '09:00', minutes: 9 * 60 },
    { time: '13:00', minutes: 13 * 60 },
    { time: '18:00', minutes: 18 * 60 },
  ];

  for (const slot of slots) {
    const diff = Math.abs(totalMinutes - slot.minutes);
    if (diff <= 30) return slot.time;
  }
  return null;
}

/**
 * Core scheduler logic — shared by GET (cron) and POST (manual admin trigger).
 * Accepts an already-created supabase client so the session context is preserved.
 */
async function runScheduler(supabase: any, timeSlot: string): Promise<NextResponse> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 });
  }

  // Find the job for this time slot
  const { data: job, error: jobError } = await supabase
    .from('push_scheduler_jobs')
    .select('*')
    .eq('scheduled_time', timeSlot)
    .eq('is_active', true)
    .single();

  if (jobError || !job) {
    return NextResponse.json({
      success: false,
      message: `No active job found for time slot: ${timeSlot}`,
    });
  }

  // Auto-pick a product from the database
  const product = await pickRandomProduct(supabase);

  if (!product) {
    await supabase.from('push_scheduler_log').insert({
      job_id: job.id,
      scheduled_time: timeSlot,
      status: 'no_content',
      error_message: 'No active products found in database',
      sent_count: 0,
      failed_count: 0,
    });

    await supabase
      .from('push_scheduler_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'no_content',
        last_sent_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: false,
      message: 'No active products found to send notification',
      timeSlot,
    });
  }

  // Get ALL push subscriptions (broadcast to everyone)
  const { data: subscriptions, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .not('p256dh', 'is', null)
    .not('auth', 'is', null);

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    await supabase.from('push_scheduler_log').insert({
      job_id: job.id,
      scheduled_time: timeSlot,
      product_id: product.id,
      product_title: product.title,
      product_image: product.image,
      destination_url: product.url,
      status: 'no_subscribers',
      error_message: 'No push subscriptions found',
      sent_count: 0,
      failed_count: 0,
    });

    await supabase
      .from('push_scheduler_jobs')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'no_subscribers',
        last_sent_count: 0,
        last_product_id: product.id,
        last_product_title: product.title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: false,
      message: 'No push subscriptions found',
      timeSlot,
      product: product.title,
    });
  }

  // Build the push payload
  const pushPayload: PushPayload = {
    title: product.title,
    body: product.body,
    url: product.url,
    tag: `directhub-auto-${timeSlot.replace(':', '')}`,
    requireInteraction: false,
    icon: '/api/icons/192',
    ...(product.image ? { image: product.image } : {}),
  };

  // Send to all subscriptions in batches of 50
  const batchSize = 50;
  let totalSent = 0;
  let totalFailed = 0;
  const expiredEndpoints: string[] = [];

  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize) as PushSubscriptionRow[];
    const results = await Promise.all(
      batch.map((sub) =>
        sendPushToSubscription(sub, pushPayload, vapidPublicKey, vapidPrivateKey, vapidSubject)
      )
    );

    for (const result of results) {
      if (result.success) {
        totalSent++;
      } else {
        totalFailed++;
        if (result.error === 'expired') {
          expiredEndpoints.push(result.endpoint);
        }
      }
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  const status = totalSent > 0 ? 'success' : 'failed';

  // Log execution
  await supabase.from('push_scheduler_log').insert({
    job_id: job.id,
    scheduled_time: timeSlot,
    product_id: product.id,
    product_title: product.title,
    product_image: product.image,
    destination_url: product.url,
    status,
    sent_count: totalSent,
    failed_count: totalFailed,
  });

  // Update job record
  await supabase
    .from('push_scheduler_jobs')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: status,
      last_sent_count: totalSent,
      last_product_id: product.id,
      last_product_title: product.title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  return NextResponse.json({
    success: true,
    timeSlot,
    product: product.title,
    sent: totalSent,
    failed: totalFailed,
    total: subscriptions.length,
    expiredRemoved: expiredEndpoints.length,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTime = searchParams.get('time');
    const secret = searchParams.get('secret');

    // Accept both Vercel Cron Authorization header and legacy ?secret query param
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

    // Determine which time slot to run
    const timeSlot = requestedTime || detectCurrentTimeSlot();
    if (!timeSlot) {
      return NextResponse.json({
        success: false,
        message: 'No scheduled job for current time window. Use ?time=09:00, ?time=13:00, or ?time=18:00',
      });
    }

    const supabase = await createClient();
    return runScheduler(supabase, timeSlot);
  } catch (err: any) {
    console.error('Push scheduler error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

// Also support POST for manual triggers from admin panel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timeSlot } = body;

    // Verify admin using the authenticated supabase client (preserves session/cookies)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Pass the same authenticated supabase client to runScheduler
    // so the admin session is preserved for the subscriptions query
    return runScheduler(supabase, timeSlot || '09:00');
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
