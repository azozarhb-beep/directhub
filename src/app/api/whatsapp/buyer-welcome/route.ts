import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildWelcomeWhatsAppLink } from '@/lib/whatsappOrderLinks';

/**
 * POST /api/whatsapp/buyer-welcome
 *
 * Logs new user registration to admin_notifications.
 * Returns a wa.me welcome link for the user (no Meta API calls).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Authentication check ──────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, phone, fullName, role, country } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch user profile if phone not provided
    let userPhone = phone;
    let userName = fullName;
    let userCountry = country;

    if (!userPhone || !userName) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('phone, full_name, company_name, role, country')
        .eq('id', userId)
        .single();

      if (profile) {
        userPhone = userPhone || profile.phone;
        userName = userName || profile.full_name || profile.company_name || 'عميل DirectHub';
        userCountry = userCountry || profile.country;
      }
    }

    // Generate wa.me welcome link
    const waLink = userPhone
      ? buildWelcomeWhatsAppLink(userPhone, userCountry)
      : null;

    // Log to admin_notifications
    await supabase.from('admin_notifications').insert({
      type: 'new_registration',
      title: `تسجيل جديد: ${userName || 'مستخدم'} (${role === 'buyer' ? 'مشتري' : 'مورد'})`,
      message: `مستخدم جديد انضم للمنصة. الهاتف: ${userPhone || 'غير متوفر'}.`,
      data: { userId, role, phone: userPhone, waLink },
      is_read: false,
    }).then(() => {}).catch(() => {});

    return NextResponse.json({
      success: true,
      system: 'wa_me_click_to_chat',
      waLink,
      message: 'User registered. Use the waLink for click-to-chat welcome.',
    });

  } catch (err: any) {
    console.error('[Buyer Welcome API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
