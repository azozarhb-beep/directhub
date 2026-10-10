import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Admin authentication ──────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── Parse payload ─────────────────────────────────────────────────────
    const body = await req.json();
    const { idea } = body as {
      idea: {
        id: string;
        title: string;
        category: string;
        priority: string;
        description: string;
        estimated_impact: string;
        implementation_steps?: string[];
        admin_note?: string;
      };
    };

    if (!idea || !idea.id || !idea.title) {
      return NextResponse.json({ error: 'Missing required idea payload' }, { status: 400 });
    }

    const executedActions: string[] = [];
    const errors: string[] = [];

    // ── 1. Persist approval to platform_live_updates ──────────────────────
    // Columns: id, update_type (enum), title, title_ar, body, body_ar, icon, color,
    //          link_url, link_label, is_auto, status, display_order, scheduled_at,
    //          expires_at, created_by, created_at, updated_at
    const { error: updateError } = await supabase
      .from('platform_live_updates')
      .insert({
        update_type: 'platform_news',
        title: `✅ فكرة AI معتمدة: ${idea.title}`,
        title_ar: `✅ فكرة AI معتمدة: ${idea.title}`,
        body: idea.description,
        body_ar: idea.description,
        icon: 'LightBulbIcon',
        color: idea.priority === 'high' ? 'red' : idea.priority === 'medium' ? 'amber' : 'green',
        is_auto: true,
        status: 'active',
        created_by: user.id,
      });

    if (updateError) {
      console.error('[IdeaExecute] platform_live_updates insert error:', updateError);
      errors.push(`live_updates: ${updateError.message}`);
    } else {
      executedActions.push('تم تسجيل الموافقة في سجل التحديثات الحية');
    }

    // ── 2. Log to security_audit_log ──────────────────────────────────────
    // Columns: id, user_id, event_type (CHECK constraint), severity, ip_address,
    //          user_agent, path, details, created_at
    // Valid event_type values: pin_set, pin_verified, pin_failed, pin_lockout,
    //   escrow_release_attempt, escrow_released, escrow_disputed, ai_firewall_blocked,
    //   ai_injection_attempt, rls_violation_attempt, suspicious_access, admin_action, bulk_operation
    const { error: auditError } = await supabase
      .from('security_audit_log')
      .insert({
        user_id: user.id,
        event_type: 'admin_action',
        severity: 'info',
        path: '/api/ai/idea-execute',
        details: {
          action: 'ai_idea_approved_and_executed',
          idea_id: idea.id,
          idea_title: idea.title,
          idea_category: idea.category,
          idea_priority: idea.priority,
          estimated_impact: idea.estimated_impact,
          admin_note: idea.admin_note || null,
        },
      });

    if (auditError) {
      console.error('[IdeaExecute] security_audit_log insert error:', auditError);
      errors.push(`audit_log: ${auditError.message}`);
    } else {
      executedActions.push('تم تسجيل الإجراء في سجل التدقيق الأمني');
    }

    // ── 3. Category-specific backend actions ──────────────────────────────

    // AUTOMATION: Route pending RFQs that are stuck
    if (idea.category === 'automation') {
      const { data: pendingRFQs, error: rfqFetchError } = await supabase
        .from('rfq_requests')
        .select('id, status, routing_status')
        .eq('status', 'pending')
        .is('routing_status', null)
        .limit(20);

      if (!rfqFetchError && pendingRFQs && pendingRFQs.length > 0) {
        const rfqIds = pendingRFQs.map(r => r.id);
        const { error: rfqUpdateError } = await supabase
          .from('rfq_requests')
          .update({ routing_status: 'queued_for_routing', updated_at: new Date().toISOString() })
          .in('id', rfqIds);

        if (!rfqUpdateError) {
          executedActions.push(`تم تحديث ${rfqIds.length} طلب RFQ معلق لبدء التوجيه الآلي`);
        } else {
          errors.push(`rfq_routing: ${rfqUpdateError.message}`);
        }
      } else if (!rfqFetchError) {
        executedActions.push('لا توجد طلبات RFQ معلقة تحتاج توجيهاً');
      }
    }

    // SUPPLIER: Notify pending factory registrations for review
    if (idea.category === 'supplier') {
      const { data: pendingRegs, error: regFetchError } = await supabase
        .from('factory_registrations')
        .select('id, factory_name, user_id')
        .eq('registration_status', 'pending')
        .limit(10);

      if (!regFetchError && pendingRegs && pendingRegs.length > 0) {
        // notifications table columns: user_id, type, title, message, is_read, created_at
        const notifInserts = pendingRegs
          .filter(reg => reg.user_id)
          .map(reg => ({
            user_id: reg.user_id,
            type: 'registration_review',
            title: 'طلب تسجيلك قيد المراجعة',
            message: 'تم تفعيل مراجعة سريعة لطلبات التسجيل. سيتم الرد على طلبك قريباً.',
            is_read: false,
          }));

        if (notifInserts.length > 0) {
          const { error: notifError } = await supabase
            .from('notifications')
            .insert(notifInserts);

          if (!notifError) {
            executedActions.push(`تم إرسال إشعار لـ ${notifInserts.length} مصنع معلق بأن طلبه قيد المراجعة`);
          } else {
            errors.push(`notifications: ${notifError.message}`);
          }
        } else {
          executedActions.push('لا توجد تسجيلات مصانع معلقة مرتبطة بمستخدمين');
        }
      } else if (!regFetchError) {
        executedActions.push('لا توجد تسجيلات مصانع معلقة');
      }
    }

    // ESCROW: Flag held escrow orders — log to security_audit_log as bulk_operation
    if (idea.category === 'escrow') {
      const { data: heldOrders, error: escrowFetchError } = await supabase
        .from('orders')
        .select('id, buyer_id, escrow_status')
        .eq('escrow_status', 'held')
        .limit(10);

      if (!escrowFetchError && heldOrders && heldOrders.length > 0) {
        // Log escrow review trigger to audit log (admin_notifications has wrong schema for this)
        const { error: escrowAuditError } = await supabase
          .from('security_audit_log')
          .insert({
            user_id: user.id,
            event_type: 'bulk_operation',
            severity: 'info',
            path: '/api/ai/idea-execute',
            details: {
              action: 'escrow_review_triggered',
              order_ids: heldOrders.map(o => o.id),
              idea_id: idea.id,
              count: heldOrders.length,
            },
          });

        if (!escrowAuditError) {
          executedActions.push(`تم تسجيل مراجعة ${heldOrders.length} طلب Escrow محتجز في سجل التدقيق`);
        } else {
          errors.push(`escrow_audit: ${escrowAuditError.message}`);
        }
      } else if (!escrowFetchError) {
        executedActions.push('لا توجد طلبات Escrow محتجزة حالياً');
      }
    }

    // FEATURE / UX / MARKET_GAP: Log as platform improvement task
    if (['feature', 'ux', 'market_gap'].includes(idea.category)) {
      const { error: settingError } = await supabase
        .from('platform_settings')
        .upsert({
          key: `ai_idea_approved_${idea.id}`,
          value: JSON.stringify({
            title: idea.title,
            category: idea.category,
            approved_at: new Date().toISOString(),
            approved_by: user.id,
            implementation_steps: idea.implementation_steps || [],
          }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (!settingError) {
        executedActions.push('تم حفظ الفكرة كمهمة تحسين في إعدادات المنصة');
      } else {
        errors.push(`platform_settings: ${settingError.message}`);
      }
    }

    // ── Return result ─────────────────────────────────────────────────────
    const success = executedActions.length > 0;

    return NextResponse.json({
      success,
      idea_id: idea.id,
      executed_actions: executedActions,
      errors: errors.length > 0 ? errors : undefined,
      executed_at: new Date().toISOString(),
      message: success
        ? `تم تنفيذ ${executedActions.length} إجراء بنجاح`
        : 'لم يتم تنفيذ أي إجراء',
    });
  } catch (error: any) {
    console.error('[IdeaExecute] Critical error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
