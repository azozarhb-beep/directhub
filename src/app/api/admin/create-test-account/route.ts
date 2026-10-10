import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TEST_ACCOUNTS: Record<string, { email: string; company_name: string; industry: string; country: string; role: string }> = {
  international_factory: {
    email: 'test-intl-factory@directhub-test.com',
    company_name: 'International Test Factory Co.',
    industry: 'Manufacturing',
    country: 'China',
    role: 'manufacturer',
  },
  local_factory: {
    email: 'test-local-factory@directhub-test.com',
    company_name: 'مصنع الاختبار المحلي',
    industry: 'صناعة',
    country: 'Yemen',
    role: 'manufacturer',
  },
  logistics: {
    email: 'test-logistics@directhub-test.com',
    company_name: 'Test Logistics Partner',
    industry: 'Logistics',
    country: 'UAE',
    role: 'logistics',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();

    if (!role || !TEST_ACCOUNTS[role]) {
      return NextResponse.json({ success: false, error: 'Invalid role specified' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.user_metadata?.role || user.app_metadata?.role;
    if (userRole !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const account = TEST_ACCOUNTS[role];

    // Check if test registration already exists
    const { data: existing } = await supabase
      .from('factory_registrations')
      .select('id, status, company_name')
      .eq('email', account.email)
      .maybeSingle();

    if (existing) {
      // Update to approved fast-track if not already
      if (existing.status !== 'approved') {
        await supabase
          .from('factory_registrations')
          .update({
            status: 'approved',
            approval_type: 'fast_track_initial',
            fast_track_approved_at: new Date().toISOString(),
            fast_track_approved_by: user.id,
          })
          .eq('id', existing.id);
      }

      return NextResponse.json({
        success: true,
        action: 'updated',
        message: `Test account for ${role} already exists — status verified/updated`,
        account_id: existing.id,
        email: account.email,
      });
    }

    // Create new test factory registration
    const { data: newReg, error: insertError } = await supabase
      .from('factory_registrations')
      .insert({
        email: account.email,
        company_name: account.company_name,
        industry: account.industry,
        country: account.country,
        status: 'approved',
        approval_type: 'fast_track_initial',
        fast_track_approved_at: new Date().toISOString(),
        fast_track_approved_by: user.id,
        contact_name: `Test ${role.replace(/_/g, ' ')}`,
        phone: '+9660000000000',
        is_test_account: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[create-test-account] insert error:', insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      message: `Test account for ${role} created successfully`,
      account_id: newReg?.id,
      email: account.email,
    });
  } catch (err) {
    console.error('[create-test-account] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
