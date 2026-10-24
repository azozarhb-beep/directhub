'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface PayoutAccount {
  id: string;
  bank_name: string;
  account_holder_name: string;
  iban: string | null;
  swift_bic: string | null;
  status: string;
}

interface FactoryPayoutSectionProps {
  userId: string;
  hasPinSet: boolean;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-700' },
  approved: { label: 'معتمد', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'مرفوض', cls: 'bg-red-100 text-red-700' },
};

const inputCls =
  'w-full px-3 py-2.5 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50';

const FactoryPayoutSection: React.FC<FactoryPayoutSectionProps> = ({ userId, hasPinSet }) => {
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ bank_name: '', account_holder_name: '', account_number: '', iban: '', swift_bic: '' });

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('manufacturer_bank_accounts')
      .select('id, bank_name, account_holder_name, iban, swift_bic, status')
      .or(`user_id.eq.${userId},manufacturer_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    setAccounts((data as PayoutAccount[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.bank_name.trim() || !form.account_holder_name.trim() || !form.account_number.trim()) {
      setMsg({ type: 'error', text: 'اسم البنك واسم المستفيد ورقم الحساب حقول مطلوبة' });
      return;
    }
    if (!hasPinSet) {
      setMsg({ type: 'error', text: 'يرجى إعداد رمز الأمان (9 أرقام) أولاً لتتمكن من إضافة أو تعديل الحساب البنكي' });
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const accountNumber = form.account_number.replace(/\s+/g, '').toUpperCase();
    const iban = form.iban.replace(/\s+/g, '').toUpperCase();
    const { error } = await supabase.from('manufacturer_bank_accounts').insert({
      user_id: userId,
      manufacturer_id: userId,
      account_type: 'local_collection',
      account_holder_name: form.account_holder_name.trim(),
      bank_name: form.bank_name.trim(),
      account_number: accountNumber,
      iban: iban || null,
      swift_bic: form.swift_bic.trim().toUpperCase() || null,
      status: 'pending_review',
    });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message || 'فشل حفظ الحساب البنكي' });
      return;
    }
    setForm({ bank_name: '', account_holder_name: '', account_number: '', iban: '', swift_bic: '' });
    setMsg({ type: 'success', text: 'تم إرسال الحساب البنكي للمراجعة ✓' });
    load();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5" dir="rtl">
      <h3 className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
          <Icon name="BuildingLibraryIcon" size={14} className="text-blue-600" />
        </div>
        حساب استلام الأرباح (الحساب البنكي للمصنع)
      </h3>

      <div className="flex items-start gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Icon name="ShieldCheckIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
          رمز الأمان المكوّن من 9 أرقام يُستخدم حصرياً لاعتماد تعديلات الحساب البنكي وتأكيد عمليات سحب الأموال، ولا يُستخدم لأي غرض آخر.
        </p>
      </div>

      {msg && (
        <div className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${msg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <Icon name={msg.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={14} />
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="h-12 bg-muted/40 rounded-xl animate-pulse mb-4" />
      ) : accounts.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {accounts.map((a) => {
            const st = STATUS_LABELS[a.status] || STATUS_LABELS.pending_review;
            return (
              <div key={a.id} className="p-3 bg-muted/40 border border-border rounded-xl">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-foreground truncate">{a.bank_name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{a.account_holder_name}</p>
                {a.iban && <p className="text-[11px] text-muted-foreground font-mono mt-0.5" dir="ltr">{a.iban}</p>}
                {a.swift_bic && <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{a.swift_bic}</p>}
              </div>
            );
          })}
        </div>
      ) : null}

      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">اسم البنك <span className="text-red-500">*</span></label>
          <input type="text" value={form.bank_name} onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))} placeholder="مثال: بنك الكريمي" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">اسم المستفيد <span className="text-red-500">*</span></label>
          <input type="text" value={form.account_holder_name} onChange={(e) => setForm((p) => ({ ...p, account_holder_name: e.target.value }))} placeholder="الاسم كما هو في الحساب البنكي" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">رقم الحساب المحلي <span className="text-red-500">*</span></label>
          <input type="text" dir="ltr" value={form.account_number} onChange={(e) => setForm((p) => ({ ...p, account_number: e.target.value }))} placeholder="رقم الحساب المحلي (مثال: بنك الكريمي)" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">رقم الآيبان (IBAN) — اختياري</label>
          <input type="text" dir="ltr" value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} placeholder="YE00 0000 0000 0000 0000" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">رمز السويفت (SWIFT/BIC) — اختياري</label>
          <input type="text" dir="ltr" value={form.swift_bic} onChange={(e) => setForm((p) => ({ ...p, swift_bic: e.target.value }))} placeholder="اختياري — للتحويلات الدولية فقط" className={inputCls} />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-xs font-extrabold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="PlusCircleIcon" size={13} />}
          إضافة حساب بنكي
        </button>
      </form>
    </div>
  );
};

export default FactoryPayoutSection;
