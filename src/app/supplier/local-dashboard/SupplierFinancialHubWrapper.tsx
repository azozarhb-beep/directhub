'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import FinancialHubPanel from '@/app/manufacturer/dashboard/FinancialHubPanel';

const EMPTY_BANK_ACCOUNT = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  iban: '',
  swift_bic: '',
  currency: 'YER',
  account_type: 'local_collection',
  account_type_label: '',
};

const MD = {
  bankCenterTitle: 'مركز الحسابات البنكية',
  addBanksHint: 'أضف حساباتك البنكية لاستلام المدفوعات',
  addAccountAction: 'إضافة حساب',
  accountHolderRequired: 'اسم صاحب الحساب مطلوب',
  bankNameRequired: 'اسم البنك مطلوب',
  accountNumberRequired: 'رقم الحساب مطلوب',
  dealLocalCollection: 'حساب تحصيل محلي',
  dealIntlSupply: 'حساب توريد دولي',
  dealLocalGeneral: 'حساب محلي عام',
  dealIntlGeneral: 'حساب دولي عام',
  bankStatusPending: 'قيد المراجعة',
  bankStatusApproved: 'موافق عليه',
  bankStatusRejected: 'مرفوض',
  primaryAccount: 'الحساب الرئيسي',
  deleteAccount: 'حذف',
  confirmDelete: 'هل أنت متأكد من حذف هذا الحساب؟',
  accountAdded: 'تم إضافة الحساب بنجاح',
  accountDeleted: 'تم حذف الحساب',
  accountHolderLabel: 'اسم صاحب الحساب',
  bankNameLabel: 'اسم البنك',
  accountNumberLabel: 'رقم الحساب',
  ibanLabel: 'IBAN',
  swiftLabel: 'SWIFT/BIC',
  currencyLabel: 'العملة',
  accountTypeLabel: 'نوع الحساب',
  cancelAction: 'إلغاء',
  saveAction: 'حفظ',
  noAccountsYet: 'لا توجد حسابات بنكية بعد',
  addFirstAccount: 'أضف حسابك البنكي الأول لاستلام المدفوعات',
  // PaymentSettings keys
  paymentSettingsTitle: 'إعدادات الدفع',
  paymentMethodsHint: 'اختر طرق الدفع المقبولة',
  saveSettings: 'حفظ الإعدادات',
  settingsSaved: 'تم حفظ الإعدادات',
  settingsSaveFailed: 'فشل حفظ الإعدادات',
  bankTransfer: 'تحويل بنكي',
  cashOnDelivery: 'الدفع عند الاستلام',
  escrowPayment: 'الضمان المالي',
  onlinePayment: 'الدفع الإلكتروني',
};

const T = {
  save: 'حفظ',
  cancel: 'إلغاء',
  loading: 'جاري التحميل...',
};

interface Props {
  userId: string;
}

export default function SupplierFinancialHubWrapper({ userId }: Props) {
  const supabase = createClient();

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [bankFormData, setBankFormData] = useState(EMPTY_BANK_ACCOUNT);
  const [bankFormLoading, setBankFormLoading] = useState(false);
  const [bankFormError, setBankFormError] = useState('');
  const [bankFormSuccess, setBankFormSuccess] = useState('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState<any>({});
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const fetchBankAccounts = useCallback(async () => {
    setBankAccountsLoading(true);
    try {
      const { data } = await supabase
        .from('factory_bank_accounts')
        .select('*')
        .eq('manufacturer_id', userId)
        .order('created_at', { ascending: false });
      setBankAccounts(data || []);
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
    } finally {
      setBankAccountsLoading(false);
    }
  }, [supabase, userId]);

  const fetchPaymentSettings = useCallback(async () => {
    setPaymentLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_payment_settings')
        .select('*')
        .eq('manufacturer_id', userId)
        .maybeSingle();
      setPaymentSettings({
        ...(data || {}),
        bank_country: data?.bank_country || 'Yemen',
        bank_currency: data?.bank_currency || 'YER',
      });
    } catch (err) {
      console.error('Failed to fetch payment settings:', err);
    } finally {
      setPaymentLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchBankAccounts();
    fetchPaymentSettings();
  }, [fetchBankAccounts, fetchPaymentSettings]);

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankFormLoading(true);
    setBankFormError('');
    setBankFormSuccess('');
    try {
      if (!bankFormData.account_holder_name.trim()) throw new Error(MD.accountHolderRequired);
      if (!bankFormData.bank_name.trim()) throw new Error(MD.bankNameRequired);
      if (!bankFormData.account_number.trim()) throw new Error(MD.accountNumberRequired);

      const { error } = await supabase.from('factory_bank_accounts').insert({
        manufacturer_id: userId,
        account_holder_name: bankFormData.account_holder_name.trim(),
        bank_name: bankFormData.bank_name.trim(),
        account_number: bankFormData.account_number.trim(),
        iban: bankFormData.iban.trim().toUpperCase(),
        swift_bic: bankFormData.swift_bic.trim().toUpperCase(),
        currency: bankFormData.currency,
        account_type: bankFormData.account_type,
        account_type_label: bankFormData.account_type_label,
        status: 'pending_review',
        is_primary: bankAccounts.length === 0,
      });
      if (error) throw error;
      setBankFormSuccess(MD.accountAdded);
      setBankFormData(EMPTY_BANK_ACCOUNT);
      await fetchBankAccounts();
      setTimeout(() => { setShowAddBankModal(false); setBankFormSuccess(''); }, 1500);
    } catch (err: any) {
      setBankFormError(err.message || 'حدث خطأ');
    } finally {
      setBankFormLoading(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm(MD.confirmDelete)) return;
    setDeletingBankId(id);
    try {
      await supabase.from('factory_bank_accounts').delete().eq('id', id);
      await fetchBankAccounts();
    } catch (err) {
      console.error('Failed to delete bank account:', err);
    } finally {
      setDeletingBankId(null);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSaving(true);
    setPaymentError('');
    setPaymentSuccess('');
    try {
      const { error } = await supabase
        .from('manufacturer_payment_settings')
        .upsert({ ...paymentSettings, manufacturer_id: userId }, { onConflict: 'manufacturer_id' });
      if (error) throw error;
      setPaymentSuccess(MD.settingsSaved);
      setTimeout(() => setPaymentSuccess(''), 3000);
    } catch (err: any) {
      setPaymentError(err.message || MD.settingsSaveFailed);
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <FinancialHubPanel
      bankAccounts={bankAccounts}
      bankAccountsLoading={bankAccountsLoading}
      showAddBankModal={showAddBankModal}
      setShowAddBankModal={setShowAddBankModal}
      bankFormData={bankFormData}
      setBankFormData={setBankFormData}
      bankFormLoading={bankFormLoading}
      bankFormError={bankFormError}
      bankFormSuccess={bankFormSuccess}
      deletingBankId={deletingBankId}
      handleAddBankAccount={handleAddBankAccount}
      handleDeleteBankAccount={handleDeleteBankAccount}
      paymentSettings={paymentSettings}
      setPaymentSettings={setPaymentSettings}
      paymentLoading={paymentLoading}
      paymentSaving={paymentSaving}
      paymentError={paymentError}
      paymentSuccess={paymentSuccess}
      handleSavePaymentSettings={handleSavePaymentSettings}
      t={T}
      md={MD}
    />
  );
}
