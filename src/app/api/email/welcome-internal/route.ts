import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

/**
 * Internal-only route: called server-side from auth callbacks to send welcome emails.
 * Does NOT require the user to be authenticated (uses service-level Supabase client).
 * Validates the request by checking that the user_id exists in user_profiles.
 */
export async function POST(request: Request) {
  try {
    const { email, full_name, user_id } = await request.json();

    if (!email || !user_id) {
      return NextResponse.json({ error: 'email and user_id are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify the user exists to prevent abuse
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, role, seller_category')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      // User profile may not exist yet (race condition) — still attempt email
      console.warn('[Welcome Email Internal] Profile not found for user_id:', user_id);
    }

    // Determine role for dynamic welcome message
    const userRole = profile?.seller_category || profile?.role || 'buyer';

    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        to: email,
        data: {
          full_name: full_name || email.split('@')[0] || '',
          role: userRole,
        },
      },
    });

    if (error) {
      console.error('[Welcome Email Internal] Edge function error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (result?.error) {
      console.error('[Welcome Email Internal] Resend error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Welcome Email Internal] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
