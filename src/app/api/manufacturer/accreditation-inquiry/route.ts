import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let companyName = '';
  try {
    const body = await req.json();
    companyName = typeof body?.companyName === 'string' ? body.companyName.slice(0, 200) : '';
  } catch {
    // body optional
  }

  const companyLabel = companyName || user.email || 'مصنع';
  const now = new Date().toISOString();
  const notifTitle = `🔔 استفسار عن حالة الاعتماد — ${companyLabel}`;
  const notifBody = `المصنع "${companyLabel}" يستفسر عن حالة مراجعة مستنداته (الرخصة التجارية وترخيص التصنيع). يرجى المتابعة الفورية.`;
  const ackBody = 'تم إشعار فريق الإدارة باستفسارك. سيتواصل معك المسؤول قريباً.';

  const { data: admins, error: adminsError } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(5);

  if (adminsError) {
    return NextResponse.json({ error: 'Failed to resolve admins' }, { status: 500 });
  }

  const rows = [
    ...(admins ?? []).map((admin: { id: string }) => ({
      user_id: admin.id,
      type: 'accreditation_inquiry',
      title: notifTitle,
      body: notifBody,
      message: notifBody,
      data: {
        factory_user_id: user.id,
        company_name: companyLabel,
        inquiry_type: 'accreditation_status',
        submitted_at: now,
      },
      is_read: false,
      created_at: now,
    })),
    {
      user_id: user.id,
      type: 'accreditation_inquiry_sent',
      title: '✅ تم إرسال استفسارك بنجاح',
      body: ackBody,
      message: ackBody,
      is_read: false,
      created_at: now,
    },
  ];

  const { error: insertError } = await supabaseAdmin.from('notifications').insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
