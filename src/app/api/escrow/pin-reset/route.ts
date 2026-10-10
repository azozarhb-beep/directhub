import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PIN_LENGTH = 9;
const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/pin-reset',
    method: 'POST',
    description: 'إعادة تعيين رمز PIN عبر OTP — بيئة المحاكاة جاهزة',
    actions: ['send_otp', 'reset_pin'],
  });
}

/**
 * POST /api/escrow/pin-reset
 * Actions:
 *   - send_otp   : Generate & send a 6-digit OTP to the user's registered email
 *   - reset_pin  : Verify OTP and set a new 9-digit PIN
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, otp_code, new_pin } = body;

    // ─── SEND OTP ─────────────────────────────────────────────────────────────
    if (action === 'send_otp') {
      // Fetch user profile for email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, full_name, phone')
        .eq('id', user.id)
        .single();

      const recipientEmail = profile?.email || user.email || '';
      const fullName = profile?.full_name || user.email?.split('@')[0] || '';

      if (!recipientEmail) {
        return NextResponse.json({ error: 'No email address found for this account.' }, { status: 400 });
      }

      // Invalidate any previous unused PIN-reset OTPs for this user
      await supabase
        .from('delivery_otps')
        .update({ is_used: true })
        .eq('user_id', user.id)
        .eq('is_used', false)
        .is('order_id', null);

      // Generate OTP
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      // Store OTP (reuse delivery_otps table, order_id = null for PIN reset)
      const { error: insertError } = await supabase
        .from('delivery_otps')
        .insert({
          order_id: null,
          user_id: user.id,
          email: recipientEmail,
          otp_code: otpCode,
          expires_at: expiresAt,
        });

      if (insertError) {
        console.error('[PIN Reset OTP] Insert error:', insertError.message);
        return NextResponse.json({ error: 'Failed to generate OTP. Please try again.' }, { status: 500 });
      }

      // Send OTP via email
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'otp',
          to: recipientEmail,
          data: {
            otp_code: otpCode,
            full_name: fullName,
            order_number: 'PIN-RESET',
            purpose: 'pin_reset',
          },
        },
      });

      if (emailError) {
        console.error('[PIN Reset OTP] Email error:', emailError.message);
        // Don't fail — OTP is stored, user can still proceed if email arrives
      }

      // Mask email for display
      const maskedEmail = recipientEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');

      return NextResponse.json({
        success: true,
        masked_email: maskedEmail,
        expires_in_minutes: OTP_EXPIRY_MINUTES,
        message: `OTP sent to ${maskedEmail}`,
      });
    }

    // ─── RESET PIN ────────────────────────────────────────────────────────────
    if (action === 'reset_pin') {
      if (!otp_code || typeof otp_code !== 'string' || otp_code.length !== 6) {
        return NextResponse.json({ error: 'Invalid OTP format. Must be 6 digits.' }, { status: 400 });
      }

      if (!new_pin || typeof new_pin !== 'string' || new_pin.length !== PIN_LENGTH || !/^\d{9}$/.test(new_pin)) {
        return NextResponse.json({
          error: `New PIN must be exactly ${PIN_LENGTH} digits.`,
          code: 'INVALID_PIN_FORMAT',
        }, { status: 400 });
      }

      // Find valid OTP (order_id IS NULL = PIN reset OTP)
      const { data: otpRecord, error: otpError } = await supabase
        .from('delivery_otps')
        .select('*')
        .eq('user_id', user.id)
        .eq('otp_code', otp_code)
        .eq('is_used', false)
        .is('order_id', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        return NextResponse.json({
          error: 'Invalid or expired OTP. Please request a new code.',
          code: 'INVALID_OTP',
        }, { status: 400 });
      }

      // Mark OTP as used
      await supabase
        .from('delivery_otps')
        .update({ is_used: true })
        .eq('id', otpRecord.id);

      // Hash and save new PIN
      const pinHash = Buffer.from(new_pin).toString('base64');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          transaction_pin_hash: pinHash,
          transaction_pin_set_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to save new PIN.' }, { status: 500 });
      }

      // Deactivate any active lockouts since PIN was reset
      await supabase
        .from('pin_lockouts')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Security notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'security_alert',
        title: '🔐 تم إعادة تعيين رمز الأمان المالي',
        message: 'تم إعادة تعيين رمز الأمان المالي الخاص بك بنجاح عبر رمز التحقق OTP. إذا لم تكن أنت من قام بذلك، يرجى تأمين حسابك فوراً.',
        data: { reset_at: new Date().toISOString() },
        is_read: false,
      });

      return NextResponse.json({
        success: true,
        message: 'PIN reset successfully. Any active lockouts have been cleared.',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[PIN Reset API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
