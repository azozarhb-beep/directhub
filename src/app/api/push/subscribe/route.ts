import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, userId, action } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const supabase = await createClient();

    // Always resolve the authenticated user from the session
    const { data: { user } } = await supabase.auth.getUser();
    // Prefer the session user; fall back to the userId passed in the body
    const targetUserId = user?.id || userId || null;

    if (action === 'unsubscribe') {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);

      return NextResponse.json({ success: true, action: 'unsubscribed' });
    }

    // Validate that we have the encryption keys — without them the push
    // server cannot encrypt the payload and the subscription is useless.
    const p256dh = subscription.keys?.p256dh || null;
    const auth = subscription.keys?.auth || null;

    if (!p256dh || !auth) {
      return NextResponse.json(
        { error: 'Subscription is missing encryption keys (p256dh / auth). Re-subscribe with userVisibleOnly=true and a valid applicationServerKey.' },
        { status: 400 }
      );
    }

    // Try upsert by endpoint first
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: targetUserId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (upsertError) {
      // If upsert fails (e.g. RLS conflict on existing row owned by another user),
      // attempt a plain insert — the endpoint may have changed ownership.
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: targetUserId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        });

      if (insertError) {
        console.error('Push subscription save error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, action: action === 'resubscribe' ? 'resubscribed' : 'subscribed' });
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
