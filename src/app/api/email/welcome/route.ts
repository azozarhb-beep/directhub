import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, full_name, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (user.email !== email) {
      return NextResponse.json({ error: 'Forbidden: email mismatch' }, { status: 403 });
    }

    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'welcome',
        to: email,
        data: {
          full_name: full_name || '',
          role: role || 'buyer',
        },
      },
    });

    if (error) {
      console.error('[Welcome Email] Edge function error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (result?.error) {
      console.error('[Welcome Email] Resend error:', result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Welcome Email] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
