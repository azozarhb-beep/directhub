import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import webpush from 'web-push';

interface PushPayload {
  title: string;
  body: string;
  image?: string;
  icon?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  broadcastId?: string;
  actions?: Array<{ action: string; title: string }>;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  user_id: string | null;
}

// Send a push notification to a single subscription using web-push library
async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ success: boolean; endpoint: string; error?: string }> {
  try {
    webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey);

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh || '',
        auth: sub.auth || '',
      },
    };

    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { success: true, endpoint: sub.endpoint };
  } catch (err: any) {
    // 410 Gone or 404 = subscription expired, should be removed
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return { success: false, endpoint: sub.endpoint, error: 'expired' };
    }
    return { success: false, endpoint: sub.endpoint, error: err?.message || 'Network error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      message,
      image,
      url = '/',
      targetRoles,
      targetUserIds,
      tag = 'directhub-broadcast',
      requireInteraction = false,
    } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'title and message are required' }, { status: 400 });
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = `mailto:admin@directhub.com`;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: 'VAPID keys not configured. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.' },
        { status: 503 }
      );
    }

    const supabase = await createClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build subscription query
    let subsQuery = supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id');

    if (targetUserIds && targetUserIds.length > 0) {
      subsQuery = subsQuery.in('user_id', targetUserIds);
    } else if (targetRoles && targetRoles.length > 0) {
      // Get user IDs for the target roles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', targetRoles);

      const userIds = (profiles || []).map((p: { id: string }) => p.id);
      if (userIds.length === 0) {
        return NextResponse.json({ success: true, sent: 0, failed: 0, message: 'No users found for target roles' });
      }
      subsQuery = subsQuery.in('user_id', userIds);
    }

    const { data: subscriptions, error: subsError } = await subsQuery;

    if (subsError) {
      return NextResponse.json({ error: subsError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        message: 'No push subscriptions found for target users',
      });
    }

    const pushPayload: PushPayload = {
      title,
      body: message,
      url,
      tag,
      requireInteraction,
      icon: '/api/icons/192',
      ...(image ? { image } : {}),
    };

    // Send to all subscriptions in parallel (batches of 50)
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

    return NextResponse.json({
      success: true,
      sent: totalSent,
      failed: totalFailed,
      total: subscriptions.length,
      expiredRemoved: expiredEndpoints.length,
    });
  } catch (err: any) {
    console.error('Push send error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
