'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface FastTrackItem {
  id: string;
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  factory_type: string;
  registration_status: string;
  approval_type: string | null;
  fast_track_approved_at: string | null;
  created_at: string;
  user_profiles?: { full_name: string; email: string };
}

export default function FastTrackApprovalPanel() {
  const supabase = createClient();

  const [fastTrackItems, setFastTrackItems] = useState<FastTrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [fastTrackEnabled, setFastTrackEnabled] = useState(true);
  const [settingSaving, setSettingSaving] = useState(false);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchFastTrackItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('factory_registrations')
        .select('id, company_name, contact_person, contact_phone, contact_email, factory_type, registration_status, approval_type, fast_track_approved_at, created_at, user_profiles!factory_registrations_user_id_fkey(full_name, email)')
        .eq('approval_type', 'fast_track_initial')
        .order('fast_track_approved_at', { ascending: false })
        .limit(50);
      setFastTrackItems(data || []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFastTrackItems();
    // Load setting
    supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'fast_track_approval_enabled')
      .maybeSingle()
      .then(({ data }) => {
        setFastTrackEnabled(data?.setting_value !== 'false');
      });
  }, [fetchFastTrackItems, supabase]);

  const handleToggleFastTrack = async () => {
    const newValue = !fastTrackEnabled;
    setSettingSaving(true);
    try {
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .eq('setting_key', 'fast_track_approval_enabled')
        .maybeSingle();

      const payload = {
        setting_key: 'fast_track_approval_enabled',
        setting_value: String(newValue),
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await supabase.from('platform_settings').update(payload).eq('setting_key', 'fast_track_approval_enabled');
      } else {
        await supabase.from('platform_settings').insert(payload);
      }
      setFastTrackEnabled(newValue);
      showMsg(
        newValue
          ? '⚡ تم تفعيل القبول السريع — الموردون يدخلون فوراً لملء الكتالوج' :'⏸️ تم إيقاف القبول السريع — جميع الطلبات تحتاج مراجعة كاملة',
        'success'
      );
    } catch (err: any) {
      showMsg(err.message || 'فشل حفظ الإعداد', 'error');
    } finally {
      setSettingSaving(false);
    }
  };

  const handleFullReview = async (item: FastTrackItem, action: 'approve' | 'reject') => {
    setActionLoading(item.id);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('factory_registrations')
        .update({
          registration_status: newStatus,
          kyc_status: newStatus,
          ...(action === 'approve' ? { product_listing_unlocked: true, is_approved: true } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) throw error;

      setFastTrackItems(prev => prev.filter(i => i.id !== item.id));
      showMsg(
        action === 'approve'
          ? `✅ تمت الموافقة الكاملة على "${item.company_name}"`
          : `❌ تم رفض "${item.company_name}" بعد المراجعة`,
        action === 'approve' ? 'success' : 'error'
      );
    } catch (err: any) {
      showMsg(err.message || 'فشلت العملية', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingReviewCount = fastTrackItems.filter(i => i.registration_status !== 'approved' && i.registration_status !== 'rejected').length;

  return (
    <div className="bg-card border-2 border-amber-300 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
            <Icon name="BoltIcon" size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-amber-900 text-sm">القبول السريع — Fast-Track Approval</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 border border-amber-300">
                fast_track_initial
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              دخول فوري للموردين لملء الكتالوج — مع الاحتفاظ ببياناتهم للمراجعة الكاملة لاحقاً
            </p>
          </div>
        </div>
        {pendingReviewCount > 0 && (
          <span className="shrink-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            {pendingReviewCount} بانتظار المراجعة
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50/50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">تفعيل آلية القبول السريع</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fastTrackEnabled
                ? 'مفعّل — الموردون يحصلون على دخول فوري بوسم fast_track_initial لملء الكتالوج' :'معطّل — جميع الطلبات تمر بالمسار الاعتيادي'}
            </p>
          </div>
          <button
            onClick={handleToggleFastTrack}
            disabled={settingSaving}
            aria-label="Toggle fast-track"
            className={`relative inline-flex h-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
              fastTrackEnabled ? 'bg-amber-500' : 'bg-muted-foreground/30'
            }`}
            style={{ width: '52px' }}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
                fastTrackEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
          <Icon name="InformationCircleIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">كيف يعمل القبول السريع؟</p>
            <ul className="space-y-0.5 list-disc list-inside text-amber-700">
              <li>يُمنح المورد دخولاً فورياً لرفع منتجاته وملء الكتالوج</li>
              <li>يُحفظ السجل بوسم <code className="bg-amber-100 px-1 rounded">approval_type: fast_track_initial</code></li>
              <li>تبقى بيانات المورد في قائمة المراجعة للتحقق الكامل لاحقاً</li>
              <li>يمكن للإدارة الموافقة الكاملة أو الرفض من هذه القائمة</li>
            </ul>
          </div>
        </div>

        {/* Feedback */}
        {msg && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
            msg.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-red-50 border-red-200 text-red-700'
          }`}>
            <Icon name={msg.type === 'success' ? 'CheckCircleIcon' : 'XCircleIcon'} size={14} />
            {msg.text}
          </div>
        )}

        {/* Fast-Track Queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Icon name="ClipboardDocumentListIcon" size={15} className="text-amber-600" />
              قائمة المراجعة الكاملة — Fast-Track Queue
            </h4>
            <button
              onClick={fetchFastTrackItems}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
            >
              <Icon name="ArrowPathIcon" size={13} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : fastTrackItems.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="BoltIcon" size={36} className="text-amber-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">لا يوجد موردون بوسم القبول السريع</p>
              <p className="text-xs text-muted-foreground mt-1">
                عند تفعيل القبول السريع وقبول موردين، ستظهر سجلاتهم هنا للمراجعة الكاملة
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {fastTrackItems.map(item => {
                const profile = item.user_profiles as any;
                const isPendingFullReview = item.registration_status !== 'approved' && item.registration_status !== 'rejected';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      isPendingFullReview
                        ? 'bg-amber-50/50 border-amber-200' :'bg-background border-border'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Icon name="BoltIcon" size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {item.company_name || 'شركة بدون اسم'}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                          ⚡ fast_track
                        </span>
                        {!isPendingFullReview && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            item.registration_status === 'approved' ?'bg-emerald-100 text-emerald-700 border border-emerald-200' :'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {item.registration_status === 'approved' ? '✅ موافق عليه' : '❌ مرفوض'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.contact_person || profile?.full_name || '—'}
                        {item.contact_phone && ` · ${item.contact_phone}`}
                      </p>
                    </div>
                    {isPendingFullReview && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleFullReview(item, 'approve')}
                          disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === item.id ? (
                            <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                          ) : (
                            <Icon name="CheckCircleIcon" size={12} />
                          )}
                          موافقة كاملة
                        </button>
                        <button
                          onClick={() => handleFullReview(item, 'reject')}
                          disabled={actionLoading === item.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <Icon name="XCircleIcon" size={12} />
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
