import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PIN_LENGTH = 9;
const MAX_ATTEMPTS = 3;
const LOCKOUT_HOURS = 3;

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/pin',
    method: 'POST',
    description: 'رمز PIN للضمان — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام PIN يعمل في وضع المحاكاة الآمنة.',
  });
}

/**
 * POST /api/escrow/pin
 * Actions:
 *   - set_pin: Set or update the user's 9-digit transaction security PIN
 *   - verify_pin: Verify PIN for a financial operation (escrow release)
 *   - check_lockout: Check if user is currently locked out
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, pin, order_id } = body;

    // ─── SET PIN ─────────────────────────────────────────────────────────────
    if (action === 'set_pin') {
      if (!pin || typeof pin !== 'string' || pin.length !== PIN_LENGTH || !/^\d{9}$/.test(pin)) {
        return NextResponse.json({
          error: `Transaction security PIN must be exactly ${PIN_LENGTH} digits.`,
        }, { status: 400 });
      }

      // Simple hash using btoa for storage (server-side only comparison)
      const pinHash = Buffer.from(pin).toString('base64');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          transaction_pin_hash: pinHash,
          transaction_pin_set_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to save PIN.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Transaction security PIN set successfully.' });
    }

    // ─── CHECK LOCKOUT ────────────────────────────────────────────────────────
    if (action === 'check_lockout') {
      const lockoutStatus = await checkActiveLockout(supabase, user.id);
      return NextResponse.json(lockoutStatus);
    }

    // ─── VERIFY PIN ───────────────────────────────────────────────────────────
    if (action === 'verify_pin') {
      if (!pin || typeof pin !== 'string') {
        return NextResponse.json({ error: 'PIN is required.' }, { status: 400 });
      }

      if (pin.length !== PIN_LENGTH || !/^\d{9}$/.test(pin)) {
        return NextResponse.json({
          error: `Transaction security PIN must be exactly ${PIN_LENGTH} digits.`,
          code: 'INVALID_PIN_FORMAT',
        }, { status: 400 });
      }

      // Check active lockout
      const lockoutStatus = await checkActiveLockout(supabase, user.id);
      if (lockoutStatus.is_locked) {
        return NextResponse.json({
          error: `Account is locked due to ${MAX_ATTEMPTS} failed PIN attempts. Please try again after ${lockoutStatus.unlock_at}.`,
          code: 'ACCOUNT_LOCKED',
          unlock_at: lockoutStatus.unlock_at,
          hours_remaining: lockoutStatus.hours_remaining,
        }, { status: 423 });
      }

      // Fetch user's PIN hash
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('transaction_pin_hash, transaction_pin_set_at, email, full_name')
        .eq('id', user.id)
        .single();

      if (!profile?.transaction_pin_hash) {
        return NextResponse.json({
          error: 'No transaction security PIN set. Please set your 9-digit PIN first.',
          code: 'PIN_NOT_SET',
        }, { status: 400 });
      }

      const expectedHash = Buffer.from(pin).toString('base64');
      const isCorrect = profile.transaction_pin_hash === expectedHash;

      // Log the attempt
      await supabase.from('pin_attempt_logs').insert({
        user_id: user.id,
        order_id: order_id || null,
        attempt_type: 'escrow_release',
        is_success: isCorrect,
      });

      if (isCorrect) {
        return NextResponse.json({
          success: true,
          message: 'PIN verified successfully.',
        });
      }

      // Wrong PIN — count recent failed attempts
      const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30-min window
      const { data: recentFails } = await supabase
        .from('pin_attempt_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_success', false)
        .gte('created_at', windowStart);

      const failCount = recentFails?.length || 0;

      if (failCount >= MAX_ATTEMPTS) {
        // Trigger lockout
        const lockedAt = new Date().toISOString();
        const unlockAt = new Date(Date.now() + LOCKOUT_HOURS * 60 * 60 * 1000).toISOString();

        await supabase.from('pin_lockouts').insert({
          user_id: user.id,
          locked_at: lockedAt,
          unlock_at: unlockAt,
          failed_attempts: failCount,
          is_active: true,
        });

        // In-app notification
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'security_alert',
          title: '🔒 تنبيه أمني: تم قفل رمز الأمان المالي',
          message: `تم رصد ${MAX_ATTEMPTS} محاولات فاشلة لإدخال رمز الأمان المالي. تم قفل حسابك لمدة ${LOCKOUT_HOURS} ساعات حتى ${new Date(unlockAt).toLocaleString('ar-SA')}. إذا لم تكن أنت من قام بهذه المحاولات، يرجى تأمين حسابك فوراً.`,
          data: { locked_at: lockedAt, unlock_at: unlockAt, order_id: order_id || null },
          is_read: false,
        });

        // Email security alert
        const recipientEmail = profile.email || user.email || '';
        if (recipientEmail) {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'pin_security_alert',
              to: recipientEmail,
              data: {
                full_name: profile.full_name || user.email?.split('@')[0] || '',
                failed_attempts: MAX_ATTEMPTS,
                locked_at: lockedAt,
                unlock_at: unlockAt,
                lockout_hours: LOCKOUT_HOURS,
                order_id: order_id || null,
                site_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net',
              },
            },
          });
        }

        return NextResponse.json({
          error: `تم قفل حسابك بسبب ${MAX_ATTEMPTS} محاولات فاشلة. يمكنك المحاولة مجدداً بعد ${LOCKOUT_HOURS} ساعات.`,
          code: 'ACCOUNT_LOCKED',
          unlock_at: unlockAt,
          hours_remaining: LOCKOUT_HOURS,
        }, { status: 423 });
      }

      const attemptsLeft = MAX_ATTEMPTS - failCount;
      return NextResponse.json({
        error: `رمز الأمان غير صحيح. تبقى لك ${attemptsLeft} محاولة${attemptsLeft === 1 ? '' : ' أخرى'} قبل قفل الحساب.`,
        code: 'WRONG_PIN',
        attempts_remaining: attemptsLeft,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[PIN API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

async function checkActiveLockout(supabase: any, userId: string) {
  const now = new Date().toISOString();
  const { data: lockout } = await supabase
    .from('pin_lockouts')
    .select('unlock_at, locked_at, failed_attempts')
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('unlock_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lockout) return { is_locked: false };

  const hoursRemaining = Math.ceil(
    (new Date(lockout.unlock_at).getTime() - Date.now()) / (1000 * 60 * 60)
  );

  return {
    is_locked: true,
    unlock_at: lockout.unlock_at,
    locked_at: lockout.locked_at,
    failed_attempts: lockout.failed_attempts,
    hours_remaining: hoursRemaining,
  };
}
