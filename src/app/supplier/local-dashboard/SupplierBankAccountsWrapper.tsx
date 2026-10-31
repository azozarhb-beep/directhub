'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import SupplierPayoutChannelsPanel, {
  CARD_LABEL_PREFIX,
  WALLET_LABEL_PREFIX,
  detectCardBrand,
  type PayoutFormData,
} from './SupplierPayoutChannelsPanel';

const EMPTY_FORM: PayoutFormData = {
  channel: 'bank',
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  iban: '',
  swift_bic: '',
  currency: 'YER',
  account_type: 'local_collection',
  account_type_label: '',
  card_number: '',
  card_expiry: '',
};

const MD: Record<string, string> = {
  bankCenterTitle: 'مركز الحسابات البنكية',
  addBanksHint: 'أضف حساباتك البنكية أو محافظك أو بطاقاتك لاستلام المدفوعات',
  addAccountAction: 'إضافة حساب',
  accountHolderRequired: 'اسم صاحب الحساب مطلوب',
  bankNameRequired: 'اسم البنك مطلوب',
  accountNumberRequired: 'رقم الحساب مطلوب',
  dealLocalCollection: 'حساب تحصيل محلي',
  bankStatusPending: 'قيد المراجعة',
  bankStatusApproved: 'موافق عليه',
  bankStatusRejected: 'مرفوض',
  deleteAccount: 'حذف',
  confirmDelete: 'هل أنت متأكد من حذف هذا الحساب؟',
  accountAdded: 'تم إضافة الحساب بنجاح',
  accountHolderLabel: 'اسم صاحب الحساب',
  bankNameLabel: 'اسم البنك',
  accountNumberLabel: 'رقم الحساب',
  currencyLabel: 'العملة',
  cancelAction: 'إلغاء',
  saveAction: 'حفظ',
  noAccountsYet: 'لا توجد حسابات بنكية بعد',
  addFirstAccount: 'أضف حسابك الأول لاستلام المدفوعات',
  optional: 'اختياري',
  tabBank: 'حساب بنكي محلي',
  tabWallet: 'محفظة إلكترونية / صرافة',
  tabCard: 'بطاقة دفع / ائتمان (Card)',
  walletProviderLabel: 'اسم المحفظة / شركة الصرافة',
  walletProviderPlaceholder: 'مثال: محفظة جيب، كاش، ون كاش',
  bankNamePlaceholder: 'مثال: بنك الكريمي',
  walletNumberLabel: 'رقم المحفظة / الحساب',
  cardHolderLabel: 'اسم حامل البطاقة (مطابق للمطبوع على البطاقة)',
  cardNumberLabel: 'رقم البطاقة (16 رقماً)',
  cardExpiryLabel: 'تاريخ انتهاء الصلاحية (MM/YY)',
  cardIssuerLabel: 'البنك / الجهة المصدرة',
  cardIssuerPlaceholder: 'مثال: بنك الكريمي، بنك التضامن، بنك اليمن والكويت، أو مصدر دولي',
  cardCurrencyLabel: 'عملة استلام البطاقة',
  cardUnknownBrand: 'غير معروفة',
  cardIssuerFallback: 'بطاقة دفع',
  cardSecurityNotice:
    'ملاحظة أمنية: يتم تسجيل بيانات البطاقة لاستلام وسحب الأرباح فقط. لن تطلب المنصة رمز الأمان السري (CVV) إطلاقاً.',
  cardNumberInvalid: 'رقم البطاقة يجب أن يتكون من 16 رقماً',
  cardExpiryInvalid: 'تاريخ الانتهاء غير صالح (MM/YY)',
  cardExpired: 'البطاقة منتهية الصلاحية',
  cardIssuerRequired: 'البنك / الجهة المصدرة مطلوب',
};

interface Props {
  userId: string;
}

export default function SupplierBankAccountsWrapper({ userId }: Props) {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<PayoutFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('factory_bank_accounts')
        .select('*')
        .eq('manufacturer_id', userId)
        .order('created_at', { ascending: false });
      setAccounts(data || []);
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      if (!formData.account_holder_name.trim()) throw new Error(MD.accountHolderRequired);

      let bankName = formData.bank_name.trim();
      let accountNumber = formData.account_number.trim();
      let label = formData.account_type_label;
      let iban = '';
      let swift = '';

      if (formData.channel === 'card') {
        const digits = formData.card_number.replace(/\D/g, '');
        if (digits.length !== 16) throw new Error(MD.cardNumberInvalid);
        const m = /^(\d{2})\/(\d{2})$/.exec(formData.card_expiry);
        if (!m) throw new Error(MD.cardExpiryInvalid);
        const mm = parseInt(m[1], 10);
        const yy = 2000 + parseInt(m[2], 10);
        if (mm < 1 || mm > 12) throw new Error(MD.cardExpiryInvalid);
        const now = new Date();
        if (yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) {
          throw new Error(MD.cardExpired);
        }
        const brand = detectCardBrand(digits);
        if (!bankName) bankName = MD.cardIssuerFallback;
        // Never persist the full PAN or CVV — only the masked number with last 4 digits.
        accountNumber = `•••• •••• •••• ${digits.slice(-4)}`;
        label = `${CARD_LABEL_PREFIX}${brand}|${formData.card_expiry}`;
      } else {
        if (!bankName) throw new Error(MD.bankNameRequired);
        if (!accountNumber) throw new Error(MD.accountNumberRequired);
        if (formData.channel === 'wallet') {
          label = `${WALLET_LABEL_PREFIX}${bankName}`;
        } else {
          iban = formData.iban.trim().toUpperCase();
          swift = formData.swift_bic.trim().toUpperCase();
        }
      }

      const { error } = await supabase.from('factory_bank_accounts').insert({
        manufacturer_id: userId,
        account_holder_name: formData.account_holder_name.trim(),
        bank_name: bankName,
        account_number: accountNumber,
        iban,
        swift_bic: swift,
        currency: 'YER',
        account_type: 'local_collection',
        account_type_label: label,
        status: 'pending_review',
        is_primary: accounts.length === 0,
      });
      if (error) throw error;
      setFormSuccess(MD.accountAdded);
      setFormData(EMPTY_FORM);
      await fetchAccounts();
      setTimeout(() => { setShowModal(false); setFormSuccess(''); }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(MD.confirmDelete)) return;
    setDeletingId(id);
    try {
      await supabase.from('factory_bank_accounts').delete().eq('id', id);
      await fetchAccounts();
    } catch (err) {
      console.error('Failed to delete bank account:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <SupplierPayoutChannelsPanel
      accounts={accounts}
      loading={loading}
      showModal={showModal}
      setShowModal={setShowModal}
      formData={formData}
      setFormData={setFormData}
      formLoading={formLoading}
      formError={formError}
      formSuccess={formSuccess}
      deletingId={deletingId}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onOpenModal={() => { setFormData(EMPTY_FORM); setFormError(''); setShowModal(true); }}
      md={MD}
    />
  );
}
