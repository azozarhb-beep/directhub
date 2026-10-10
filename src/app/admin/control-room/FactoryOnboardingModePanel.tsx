'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

type OnboardingMode = 'soft' | 'strict';

export default function FactoryOnboardingModePanel() {
  const supabase = createClient();

  const [mode, setMode] = useState<OnboardingMode>('soft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'factory_onboarding_mode')
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        if (data?.setting_value === 'strict') {
          setMode('strict');
        } else {
          setMode('soft');
        }
      } catch (err: any) {
        setMsg({ text: err.message || 'فشل تحميل الإعداد', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleToggle = async (newMode: OnboardingMode) => {
    if (saving || newMode === mode) return;
    setSaving(true);
    setMsg(null);
    try {
      const { data: existing, error: selectError } = await supabase
        .from('platform_settings')
        .select('id')
        .eq('setting_key', 'factory_onboarding_mode')
        .maybeSingle();
      if (selectError) throw selectError;

      const payload = {
        setting_key: 'factory_onboarding_mode',
        setting_value: newMode,
        updated_at: new Date().toISOString(),
      };

      const { error } = existing?.id
        ? await supabase.from('platform_settings').update(payload).eq('setting_key', 'factory_onboarding_mode')
        : await supabase.from('platform_settings').insert(payload);
      if (error) throw error;
      setMode(newMode);
      setMsg({
        text: newMode === 'soft' ?'✅ تم التفعيل: وضع التأهيل المرن — الوثائق اختيارية للدفعة الأولى' :'✅ تم التفعيل: وضع التحقق الصارم — رخصة تجارية إلزامية',
        type: 'success',
      });
    } catch (err: any) {
      setMsg({ text: err.message || 'فشل حفظ الإعداد', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const isSoft = mode === 'soft';

  return (
    <div className="bg-card border-2 border-violet-300 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-violet-200 bg-violet-50">
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
          <Icon name="BuildingOffice2Icon" size={18} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-violet-900 text-sm">وضع تأهيل المصانع</h3>
          <p className="text-xs text-violet-600 mt-0.5">Factory Onboarding Mode</p>
        </div>
        <div className="ml-auto">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
            isSoft
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isSoft ? 'Soft Onboarding' : 'Strict Verification'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            جارٍ تحميل الإعداد…
          </div>
        ) : (
          <>
            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              تحكم في مستوى التحقق المطلوب عند تسجيل المصانع الجديدة في المنصة.
            </p>

            {/* Toggle Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Soft Onboarding */}
              <button
                onClick={() => handleToggle('soft')}
                disabled={saving}
                className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  isSoft
                    ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                    : 'border-border bg-card hover:border-emerald-300 hover:bg-emerald-50/40'
                }`}
              >
                {isSoft && (
                  <span className="absolute top-3 right-3 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Icon name="CheckIcon" size={12} className="text-white" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSoft ? 'bg-emerald-500' : 'bg-muted'}`}>
                    <Icon name="RocketLaunchIcon" size={16} className={isSoft ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <span className={`font-bold text-sm ${isSoft ? 'text-emerald-800' : 'text-foreground'}`}>
                    Soft Onboarding
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${isSoft ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  تسجيل مرن — الوثائق اختيارية للدفعة الأولى. مناسب لمرحلة الإطلاق وجذب المصانع بسرعة.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">وثائق اختيارية</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">دخول فوري</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">مرحلة الإطلاق</span>
                </div>
              </button>

              {/* Strict Verification */}
              <button
                onClick={() => handleToggle('strict')}
                disabled={saving}
                className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  !isSoft
                    ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-border bg-card hover:border-amber-300 hover:bg-amber-50/40'
                }`}
              >
                {!isSoft && (
                  <span className="absolute top-3 right-3 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                    <Icon name="CheckIcon" size={12} className="text-white" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!isSoft ? 'bg-amber-500' : 'bg-muted'}`}>
                    <Icon name="ShieldCheckIcon" size={16} className={!isSoft ? 'text-white' : 'text-muted-foreground'} />
                  </div>
                  <span className={`font-bold text-sm ${!isSoft ? 'text-amber-800' : 'text-foreground'}`}>
                    Strict Verification
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${!isSoft ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  تحقق إلزامي — رخصة تجارية مطلوبة. يُفعَّل لاحقاً لضمان جودة المصانع المسجّلة.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">رخصة تجارية إلزامية</span>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">مراجعة يدوية</span>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">تفعيل لاحق</span>
                </div>
              </button>
            </div>

            {/* Current mode info banner */}
            <div className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
              isSoft
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <Icon
                name={isSoft ? 'InformationCircleIcon' : 'ExclamationTriangleIcon'}
                size={16}
                className={`shrink-0 mt-0.5 ${isSoft ? 'text-emerald-600' : 'text-amber-600'}`}
              />
              <span>
                {isSoft
                  ? 'الوضع الحالي: Soft Onboarding — يمكن للمصانع التسجيل دون رفع وثائق. مناسب للدفعة الأولى من الإطلاق.' :'الوضع الحالي: Strict Verification — يُشترط رفع الرخصة التجارية لإتمام التسجيل. سيُطبَّق على جميع المصانع الجديدة.'}
              </span>
            </div>

            {/* Feedback message */}
            {msg && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium border ${
                msg.type === 'success' ?'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-red-50 text-red-700 border-red-200'
              }`}>
                <Icon name={msg.type === 'success' ? 'CheckCircleIcon' : 'XCircleIcon'} size={14} className="shrink-0" />
                {msg.text}
              </div>
            )}

            {/* Saving indicator */}
            {saving && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                جارٍ الحفظ…
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
