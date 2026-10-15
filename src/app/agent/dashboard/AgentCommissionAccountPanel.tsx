'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommissionAccount {
  id: string;
  agent_id: string;
  account_type: string;
  account_label: string;
  account_holder: string;
  currency: string;
  bank_name: string | null;
  bank_branch: string | null;
  account_number: string | null;
  iban: string | null;
  swift_code: string | null;
  wallet_provider: string | null;
  wallet_phone: string | null;
  transfer_details: string | null;
  notes: string | null;
  is_primary: boolean;
  is_active: boolean;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
}

const ACCOUNT_TYPES = [
  { value: 'bank_account', icon: 'BuildingLibraryIcon', labelAr: 'حساب بنكي', labelEn: 'Bank Account' },
  { value: 'mobile_wallet', icon: 'DevicePhoneMobileIcon', labelAr: 'محفظة إلكترونية', labelEn: 'Mobile Wallet' },
  { value: 'collection_transfer', icon: 'ArrowsRightLeftIcon', labelAr: 'تحويل تحصيل', labelEn: 'Collection Transfer' },
];

const WALLET_PROVIDERS = [
  'بنك كريمي',
  'سبأفون كاش',
  'MTN كاش',
  'يمن موبايل',
  'جوالي',
  'جيب',
  'كاش',
  'فلوسك',
  'موبايل موني',
  'نقطة حاسب الكريمي',
];

const CURRENCIES = ['YER', 'USD', 'SAR', 'AED'];

const EMPTY_FORM = {
  account_type: 'bank_account',
  account_label: '',
  account_holder: '',
  currency: 'YER',
  bank_name: '',
  bank_branch: '',
  account_number: '',
  iban: '',
  swift_code: '',
  wallet_provider: '',
  wallet_phone: '',
  transfer_details: '',
  notes: '',
  is_primary: false,
};

// ─── Account Form Modal ───────────────────────────────────────────────────────

function AccountFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: CommissionAccount | null;
  onClose: () => void;
  onSave: (data: typeof EMPTY_FORM) => Promise<void>;
}) {
  const { dir } = useLanguage();
  const [form, setForm] = useState(
    initial
      ? {
          account_type: initial.account_type,
          account_label: initial.account_label,
          account_holder: initial.account_holder,
          currency: initial.currency,
          bank_name: initial.bank_name || '',
          bank_branch: initial.bank_branch || '',
          account_number: initial.account_number || '',
          iban: initial.iban || '',
          swift_code: initial.swift_code || '',
          wallet_provider: initial.wallet_provider || '',
          wallet_phone: initial.wallet_phone || '',
          transfer_details: initial.transfer_details || '',
          notes: initial.notes || '',
          is_primary: initial.is_primary,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.account_label.trim()) { setError('يرجى إدخال اسم/تسمية الحساب'); return; }
    if (!form.account_holder.trim()) { setError('يرجى إدخال اسم صاحب الحساب'); return; }
    if (form.account_type === 'bank_account' && !form.account_number.trim() && !form.iban.trim()) {
      setError('يرجى إدخال رقم الحساب أو IBAN');
      return;
    }
    if (form.account_type === 'mobile_wallet' && !form.wallet_phone.trim()) {
      setError('يرجى إدخال رقم المحفظة');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = ACCOUNT_TYPES.find(t => t.value === form.account_type);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} dir={dir}>
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#1E1E1E', border: '1px solid #D4AF37' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#D4AF37' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
              <Icon name="BanknotesIcon" size={20} style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#D4AF37' }}>
                {initial ? 'تعديل حساب الاستلام' : 'إضافة حساب استلام العمولة'}
              </h3>
              <p className="text-xs" style={{ color: '#8899aa' }}>استلام العمولة بالريال اليمني (YER)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <Icon name="XMarkIcon" size={16} style={{ color: '#8899aa' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Account Type */}
          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: '#D4AF37' }}>نوع الحساب</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('account_type', t.value)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all"
                  style={{
                    background: form.account_type === t.value ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: form.account_type === t.value ? '#D4AF37' : '#333',
                    color: form.account_type === t.value ? '#D4AF37' : '#8899aa',
                  }}
                >
                  <Icon name={t.icon as any} size={18} />
                  {t.labelAr}
                </button>
              ))}
            </div>
          </div>

          {/* Label & Holder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>
                تسمية الحساب <span style={{ color: '#D4AF37' }}>*</span>
              </label>
              <input
                value={form.account_label}
                onChange={e => set('account_label', e.target.value)}
                placeholder="مثال: الحساب الرئيسي"
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>
                اسم صاحب الحساب <span style={{ color: '#D4AF37' }}>*</span>
              </label>
              <input
                value={form.account_holder}
                onChange={e => set('account_holder', e.target.value)}
                placeholder="الاسم الكامل"
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
              />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#ccc' }}>العملة</label>
            <div className="flex gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('currency', c)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all"
                  style={{
                    background: form.currency === c ? '#D4AF37' : 'rgba(255,255,255,0.04)',
                    borderColor: form.currency === c ? '#D4AF37' : '#444',
                    color: form.currency === c ? '#1E1E1E' : '#8899aa',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Bank Account Fields */}
          {form.account_type === 'bank_account' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>اسم البنك</label>
                  <input
                    value={form.bank_name}
                    onChange={e => set('bank_name', e.target.value)}
                    placeholder="مثال: بنك اليمن والخليج"
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>الفرع</label>
                  <input
                    value={form.bank_branch}
                    onChange={e => set('bank_branch', e.target.value)}
                    placeholder="اسم الفرع"
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>
                  رقم الحساب <span style={{ color: '#D4AF37' }}>*</span>
                </label>
                <input
                  value={form.account_number}
                  onChange={e => set('account_number', e.target.value)}
                  placeholder="رقم الحساب البنكي"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                  style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>IBAN</label>
                  <input
                    value={form.iban}
                    onChange={e => set('iban', e.target.value)}
                    placeholder="YE..."
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>SWIFT</label>
                  <input
                    value={form.swift_code}
                    onChange={e => set('swift_code', e.target.value)}
                    placeholder="SWIFT Code"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                    style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Wallet Fields */}
          {form.account_type === 'mobile_wallet' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>مزود المحفظة</label>
                <select
                  value={form.wallet_provider}
                  onChange={e => set('wallet_provider', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                  style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                >
                  <option value="">اختر مزود المحفظة</option>
                  {WALLET_PROVIDERS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>
                  رقم المحفظة <span style={{ color: '#D4AF37' }}>*</span>
                </label>
                <input
                  value={form.wallet_phone}
                  onChange={e => set('wallet_phone', e.target.value)}
                  placeholder="+967..."
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
                  style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
                />
              </div>
            </div>
          )}

          {/* Collection Transfer Fields */}
          {form.account_type === 'collection_transfer' && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>تفاصيل التحويل</label>
              <textarea
                value={form.transfer_details}
                onChange={e => set('transfer_details', e.target.value)}
                rows={3}
                placeholder="أدخل تفاصيل طريقة التحصيل والتحويل..."
                className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-none"
                style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#ccc' }}>ملاحظات إضافية</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="أي ملاحظات إضافية..."
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none resize-none"
              style={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff' }}
            />
          </div>

          {/* Primary toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('is_primary', !form.is_primary)}
              className="w-11 h-6 rounded-full transition-colors relative"
              style={{ background: form.is_primary ? '#D4AF37' : '#444' }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                style={{
                  background: '#fff',
                  transform: form.is_primary ? 'translateX(20px)' : 'translateX(2px)',
                }}
              />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#ccc' }}>تعيين كحساب رئيسي لاستلام العمولات</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              <Icon name="ExclamationCircleIcon" size={15} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: '#333' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: '1px solid #444', color: '#8899aa' }}
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#D4AF37', color: '#1E1E1E' }}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="CheckIcon" size={15} />
            )}
            {saving ? 'جارٍ الحفظ...' : 'حفظ الحساب'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onEdit,
  onDelete,
  onSetPrimary,
}: {
  account: CommissionAccount;
  onEdit: (a: CommissionAccount) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
}) {
  const typeInfo = ACCOUNT_TYPES.find(t => t.value === account.account_type);

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        background: '#252525',
        border: account.is_primary ? '1.5px solid #D4AF37' : '1px solid #333',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,175,55,0.12)' }}
          >
            <Icon name={(typeInfo?.icon || 'BanknotesIcon') as any} size={20} style={{ color: '#D4AF37' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ color: '#fff' }}>{account.account_label}</span>
              {account.is_primary && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid #D4AF37' }}>
                  رئيسي
                </span>
              )}
              {account.is_verified && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <Icon name="CheckBadgeIcon" size={10} />
                  موثّق
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>
              {typeInfo?.labelAr} · {account.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!account.is_primary && (
            <button
              onClick={() => onSetPrimary(account.id)}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors"
              style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
              title="تعيين كرئيسي"
            >
              رئيسي
            </button>
          )}
          <button
            onClick={() => onEdit(account)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <Icon name="PencilSquareIcon" size={14} style={{ color: '#8899aa' }} />
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
          >
            <Icon name="TrashIcon" size={14} style={{ color: '#ef4444' }} />
          </button>
        </div>
      </div>

      {/* Account Details */}
      <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid #333' }}>
        <p className="text-xs font-semibold" style={{ color: '#ccc' }}>{account.account_holder}</p>
        {account.account_type === 'bank_account' && (
          <>
            {account.bank_name && <p className="text-xs" style={{ color: '#8899aa' }}>🏦 {account.bank_name}{account.bank_branch ? ` — ${account.bank_branch}` : ''}</p>}
            {account.account_number && <p className="text-xs font-mono" dir="ltr" style={{ color: '#8899aa' }}>#{account.account_number}</p>}
            {account.iban && <p className="text-xs font-mono" dir="ltr" style={{ color: '#8899aa' }}>IBAN: {account.iban}</p>}
          </>
        )}
        {account.account_type === 'mobile_wallet' && (
          <>
            {account.wallet_provider && <p className="text-xs" style={{ color: '#8899aa' }}>📱 {account.wallet_provider}</p>}
            {account.wallet_phone && <p className="text-xs font-mono" dir="ltr" style={{ color: '#8899aa' }}>{account.wallet_phone}</p>}
          </>
        )}
        {account.account_type === 'collection_transfer' && account.transfer_details && (
          <p className="text-xs" style={{ color: '#8899aa' }}>{account.transfer_details}</p>
        )}
        {account.notes && (
          <p className="text-xs italic" style={{ color: '#667788' }}>📝 {account.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function AgentCommissionAccountPanel({ userId }: Props) {
  const { dir } = useLanguage();
  const supabase = createClient();

  const [accounts, setAccounts] = useState<CommissionAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<CommissionAccount | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agent_commission_accounts')
      .select('*')
      .eq('agent_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setAccounts(data);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const handleSave = async (form: typeof EMPTY_FORM) => {
    // If setting as primary, unset others first
    if (form.is_primary) {
      await supabase
        .from('agent_commission_accounts')
        .update({ is_primary: false })
        .eq('agent_id', userId);
    }

    if (editAccount) {
      const { error } = await supabase
        .from('agent_commission_accounts')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editAccount.id)
        .eq('agent_id', userId);
      if (error) throw error;
      showSuccess('تم تحديث الحساب بنجاح');
    } else {
      const { error } = await supabase
        .from('agent_commission_accounts')
        .insert({ ...form, agent_id: userId });
      if (error) throw error;
      showSuccess('تم إضافة حساب الاستلام بنجاح');
    }
    setShowForm(false);
    setEditAccount(null);
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('agent_commission_accounts')
      .delete()
      .eq('id', id)
      .eq('agent_id', userId);
    if (error) { showError('حدث خطأ أثناء الحذف'); return; }
    showSuccess('تم حذف الحساب');
    fetchAccounts();
  };

  const handleSetPrimary = async (id: string) => {
    await supabase
      .from('agent_commission_accounts')
      .update({ is_primary: false })
      .eq('agent_id', userId);
    const { error } = await supabase
      .from('agent_commission_accounts')
      .update({ is_primary: true })
      .eq('id', id)
      .eq('agent_id', userId);
    if (error) { showError('حدث خطأ'); return; }
    showSuccess('تم تعيين الحساب الرئيسي');
    fetchAccounts();
  };

  const primaryAccount = accounts.find(a => a.is_primary);

  return (
    <div dir={dir} className="space-y-5">
      {/* Header Banner */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, #0A192F 0%, #1E1E1E 100%)', border: '1px solid #D4AF37' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.2)' }}>
                <Icon name="BanknotesIcon" size={20} style={{ color: '#D4AF37' }} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: '#D4AF37' }}>حساب استلام العمولة</h2>
            </div>
            <p className="text-sm" style={{ color: '#8899aa' }}>
              سجّل حسابك البنكي أو محفظتك الإلكترونية لاستلام عمولتك بنسبة <span style={{ color: '#D4AF37', fontWeight: 700 }}>20%</span> بالريال اليمني (YER)
            </p>
          </div>
          <button
            onClick={() => { setEditAccount(null); setShowForm(true); }}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: '#D4AF37', color: '#1E1E1E' }}
          >
            <Icon name="PlusIcon" size={15} />
            إضافة حساب
          </button>
        </div>

        {/* Primary Account Quick View */}
        {primaryAccount && (
          <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid rgba(212,175,55,0.3)' }}>
            <Icon name="CheckCircleIcon" size={16} style={{ color: '#10b981' }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: '#10b981' }}>الحساب الرئيسي النشط</p>
              <p className="text-sm font-bold" style={{ color: '#fff' }}>
                {primaryAccount.account_label}
                {primaryAccount.wallet_provider ? ` — ${primaryAccount.wallet_provider}` : ''}
                {primaryAccount.bank_name ? ` — ${primaryAccount.bank_name}` : ''}
              </p>
            </div>
            <span className="mr-auto text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
              {primaryAccount.currency}
            </span>
          </div>
        )}

        {!primaryAccount && accounts.length === 0 && (
          <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(212,175,55,0.2)' }}>
            <Icon name="ExclamationTriangleIcon" size={15} style={{ color: '#f59e0b' }} />
            <p className="text-xs" style={{ color: '#f59e0b' }}>لم يتم تسجيل أي حساب بعد — أضف حسابك لاستلام العمولات</p>
          </div>
        )}
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <Icon name="ExclamationCircleIcon" size={16} />
          {errorMsg}
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: '#252525', border: '1px dashed #444' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(212,175,55,0.1)' }}>
            <Icon name="BanknotesIcon" size={26} style={{ color: '#D4AF37' }} />
          </div>
          <p className="font-bold mb-1" style={{ color: '#fff' }}>لا توجد حسابات مسجلة</p>
          <p className="text-sm mb-4" style={{ color: '#8899aa' }}>أضف حسابك البنكي أو محفظتك الإلكترونية لاستلام عمولاتك</p>
          <button
            onClick={() => { setEditAccount(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#D4AF37', color: '#1E1E1E' }}
          >
            <Icon name="PlusIcon" size={15} />
            إضافة حساب الآن
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={a => { setEditAccount(a); setShowForm(true); }}
              onDelete={handleDelete}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      )}

      {/* Info Note */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(10,25,47,0.6)', border: '1px solid rgba(212,175,55,0.2)' }}>
        <Icon name="InformationCircleIcon" size={16} className="shrink-0 mt-0.5" style={{ color: '#D4AF37' }} />
        <div className="text-xs space-y-1" style={{ color: '#8899aa' }}>
          <p>• يتم صرف العمولات (20% من رسوم منصة دايركت هب المحققة) بالريال اليمني (YER) شهرياً.</p>
          <p>• تأكد من صحة بيانات الحساب لضمان استلام مدفوعاتك في الوقت المحدد.</p>
          <p>• يمكنك تسجيل أكثر من حساب وتحديد الحساب الرئيسي لاستلام العمولات.</p>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <AccountFormModal
          initial={editAccount}
          onClose={() => { setShowForm(false); setEditAccount(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
