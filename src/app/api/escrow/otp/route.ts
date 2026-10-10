import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRequestSigning } from '@/lib/securitySigner';

function generateOtp(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/otp',
    method: 'POST',
    description: 'رمز OTP للضمان المالي — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام OTP يعمل في وضع المحاكاة الآمنة.',
  });
}

async function postHandler(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, order_id, otp_code } = body;

    if (action === 'send') {
      // Fetch order and verify ownership
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, escrow_status, user_id, otp_email')
        .eq('id', order_id)
        .eq('user_id', user.id)
        .single();

      if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (order.escrow_status !== 'shipped') {
        return NextResponse.json({ error: 'Order must be in shipped status to confirm receipt' }, { status: 400 });
      }

      // Get user email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      const recipientEmail = profile?.email || user.email || '';
      const fullName = profile?.full_name || user.email?.split('@')[0] || '';

      // Invalidate previous OTPs for this order
      await supabase
        .from('delivery_otps')
        .update({ is_used: true })
        .eq('order_id', order_id)
        .eq('user_id', user.id)
        .eq('is_used', false);

      // Generate new OTP
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store OTP
      let insertFailed = false;
      try {
        const { error: insertError } = await supabase
          .from('delivery_otps')
          .insert({
            order_id,
            user_id: user.id,
            email: recipientEmail,
            otp_code: otpCode,
            expires_at: expiresAt,
          });

        if (insertError) {
          console.error('[Escrow OTP] Insert error:', insertError.message);
          insertFailed = true;
        }
      } catch (insertEx: any) {
        console.error('[Escrow OTP] Insert exception:', insertEx.message);
        insertFailed = true;
      }

      if (insertFailed) {
        return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
      }

      // Update order status to pending_otp_confirmation
      await supabase
        .from('orders')
        .update({
          escrow_status: 'pending_otp_confirmation',
          otp_sent_at: new Date().toISOString(),
          otp_email: recipientEmail,
        })
        .eq('id', order_id);

      // Send OTP email via Supabase Edge Function (Resend)
      try {
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            type: 'otp',
            to: recipientEmail,
            data: {
              otp_code: otpCode,
              full_name: fullName,
              order_number: order.order_number,
              purpose: 'receipt_confirmation',
            },
          },
        });

        if (emailError) {
          console.error('[Escrow OTP] Email send error:', emailError.message);
        }
      } catch (emailEx: any) {
        console.error('[Escrow OTP] Email send exception:', emailEx.message);
      }

      return NextResponse.json({
        success: true,
        email: recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        message: 'OTP sent to your registered email address',
        debug_otp: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
      });
    }

    if (action === 'verify') {
      // Fetch order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, escrow_status, user_id')
        .eq('id', order_id)
        .eq('user_id', user.id)
        .single();

      if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (order.escrow_status !== 'pending_otp_confirmation') {
        return NextResponse.json({ error: 'OTP verification not applicable for this order' }, { status: 400 });
      }

      // Find valid OTP
      const { data: otpRecord, error: otpError } = await supabase
        .from('delivery_otps')
        .select('*')
        .eq('order_id', order_id)
        .eq('user_id', user.id)
        .eq('otp_code', otp_code)
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        return NextResponse.json({ error: 'Invalid or expired OTP. Please request a new code.' }, { status: 400 });
      }

      // Mark OTP as used
      await supabase
        .from('delivery_otps')
        .update({ is_used: true })
        .eq('id', otpRecord.id);

      // ─── MANUAL PAYOUT FLOW ───────────────────────────────────────────────
      // Set escrow to pending_admin_payout — NO automatic fund release.
      // Admin must manually approve via "صرف المستحقات" button.
      const now = new Date().toISOString();
      await supabase
        .from('orders')
        .update({
          escrow_status: 'pending_admin_payout',
          status: 'delivered',
          delivered_at: now,
          delivery_otp_verified_at: now,
          buyer_confirmed_at: now,
        })
        .eq('id', order_id);

      // Add status history — receipt confirmed, awaiting admin payout
      await supabase
        .from('order_status_history')
        .insert({
          order_id,
          status: 'delivered',
          note: `المشتري أكد الاستلام والفحص بنجاح عبر رمز OTP في ${new Date(now).toLocaleString('ar-SA')}. الطلب جاهز لمراجعة الإدارة وصرف المستحقات.`,
        });

      // ─── NOTIFY ALL ADMINS (in-app) ──────────────────────────────────────
      const { data: adminProfiles } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('role', 'admin' as any);

      if (adminProfiles && adminProfiles.length > 0) {
        const adminNotifications = adminProfiles.map((admin: any) => ({
          user_id: admin.id,
          type: 'payout_review_required',
          title: `🔔 الطلب #${order.order_number} جاهز لصرف المستحقات`,
          message: `المشتري أكد استلام وفحص الطلب رقم ${order.order_number}. يرجى مراجعة الطلب والضغط على "صرف المستحقات" في لوحة التحكم.`,
          data: { order_id, order_number: order.order_number },
          is_read: false,
        }));

        await supabase.from('notifications').insert(adminNotifications);

        // ─── NOTIFY ALL ADMINS (email) ──────────────────────────────────────
        for (const admin of adminProfiles) {
          if (admin.email) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'admin_payout_review',
                to: admin.email,
                data: {
                  admin_name: admin.full_name || 'Admin',
                  order_number: order.order_number,
                  order_id,
                  buyer_confirmed_at: now,
                  admin_panel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/admin/control-room`,
                },
              },
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: 'تم تأكيد الاستلام بنجاح. تم إشعار الإدارة لمراجعة الطلب وصرف المستحقات.',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[Escrow OTP API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestSigning(postHandler, { skipInDev: true });
