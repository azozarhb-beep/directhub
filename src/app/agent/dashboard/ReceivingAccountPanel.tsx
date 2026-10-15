'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Factory {
  id: string;
  company_name: string;
  factory_type: string;
}

interface ReceivingAccount {
  id: string;
  factory_id: string;
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
  created_at: string;
}

interface Props {
  userId: string;
  factories: Factory[];
}

const ACCOUNT_TYPE_DEFS = [
  { value: 'bank_account', labelKey: 'typeBank' as const, icon: 'BuildingLibraryIcon' },
  { value: 'mobile_wallet', labelKey: 'typeWallet' as const, icon: 'DevicePhoneMobileIcon' },
  { value: 'collection_transfer', labelKey: 'typeCollection' as const, icon: 'ArrowsRightLeftIcon' },
];

const WALLET_PROVIDER_KEYS = [
  { value: 'بنك كريمي', label: 'بنك كريمي' },
  { value: 'سبأفون كاش', label: 'سبأفون كاش' },
  { value: 'MTN كاش', label: 'MTN كاش' },
  { value: 'يمن موبايل', label: 'يمن موبايل' },
  { value: '__other__', labelKey: 'walletOther' as const },
];

const CURRENCIES = ['YER', 'USD', 'SAR', 'AED'];

const FACTORY_TYPE_KEYS: Record<string, 'typeLocalFactory' | 'typeIntlFactory' | 'typeLocalSupplier'> = {
  local_factory: 'typeLocalFactory',
  international_factory: 'typeIntlFactory',
  local_supplier: 'typeLocalSupplier',
};

const EMPTY_FORM = {
  factory_id: '',
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

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function AccountFormModal({
  factories,
  initial,
  onClose,
  onSave,
}: {
  factories: Factory[];
  initial?: ReceivingAccount | null;
  onClose: () => void;
  onSave: (data: typeof EMPTY_FORM) => Promise<void>;
}) {
  const { t, dir } = useLanguage();
  const ra = t.receivingAccount;

  const [form, setForm] = useState(
    initial
      ? {
          factory_id: initial.factory_id,
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
    if (!form.factory_id) { setError(ra.errorSelectFactory); return; }
    if (!form.account_label.trim()) { setError(ra.errorAccountLabel); return; }
    if (!form.account_holder.trim()) { setError(ra.errorAccountHolder); return; }
    if (form.account_type === 'bank_account' && !form.account_number.trim() && !form.iban.trim()) {
      setError(ra.errorAccountOrIban);
      return;
    }
    if (form.account_type === 'mobile_wallet' && !form.wallet_phone.trim()) {
      setError(ra.errorWalletPhone);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : ra.errorSave);
    } finally {
      setSaving(false);
    }
  };

  const factoryTypeLabel = (ft: string) =>
    FACTORY_TYPE_KEYS[ft] ? ra[FACTORY_TYPE_KEYS[ft]] : ft;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} dir={dir}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="BanknotesIcon" size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                {initial ? ra.editTitle : ra.addTitle}
              </h3>
              <p className="text-xs text-muted-foreground">{ra.formSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              {ra.factorySupplier} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.factory_id}
              onChange={e => set('factory_id', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">{ra.selectFactory}</option>
              {factories.map(f => (
                <option key={f.id} value={f.id}>
                  {f.company_name} ({factoryTypeLabel(f.factory_type)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">{ra.accountType}</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPE_DEFS.map(def => (
                <button
                  key={def.value}
                  type="button"
                  onClick={() => set('account_type', def.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                    form.account_type === def.value
                      ? 'bg-primary/10 border-primary text-primary' :'bg-background border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon name={def.icon as any} size={18} />
                  {ra[def.labelKey]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {ra.accountLabel} <span className="text-red-500">*</span>
              </label>
              <input
                value={form.account_label}
                onChange={e => set('account_label', e.target.value)}
                placeholder={ra.accountLabelPlaceholder}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {ra.accountHolderName} <span className="text-red-500">*</span>
              </label>
              <input
                value={form.account_holder}
                onChange={e => set('account_holder', e.target.value)}
                placeholder={ra.fullNamePlaceholder}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{ra.currency}</label>
            <div className="flex gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('currency', c)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    form.currency === c
                      ? 'bg-primary text-white border-primary' :'bg-background border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {form.account_type === 'bank_account' && (
            <div className="space-y-3 bg-blue-50/50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                <Icon name="BuildingLibraryIcon" size={13} />
                {ra.bankDetails}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">{ra.bankName}</label>
                  <input
                    value={form.bank_name}
                    onChange={e => set('bank_name', e.target.value)}
                    placeholder={ra.bankNamePlaceholder}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">{ra.branch}</label>
                  <input
                    value={form.bank_branch}
                    onChange={e => set('bank_branch', e.target.value)}
                    placeholder={ra.branchPlaceholder}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">{ra.accountNumber}</label>
                <input
                  value={form.account_number}
                  onChange={e => set('account_number', e.target.value)}
                  placeholder={ra.accountNumberPlaceholder}
                  dir="ltr"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">IBAN</label>
                  <input
                    value={form.iban}
                    onChange={e => set('iban', e.target.value)}
                    placeholder="YE..."
                    dir="ltr"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">SWIFT / BIC</label>
                  <input
                    value={form.swift_code}
                    onChange={e => set('swift_code', e.target.value)}
                    placeholder="SWIFT Code"
                    dir="ltr"
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {form.account_type === 'mobile_wallet' && (
            <div className="space-y-3 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                <Icon name="DevicePhoneMobileIcon" size={13} />
                {ra.walletDetails}
              </p>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">{ra.walletProvider}</label>
                <select
                  value={form.wallet_provider}
                  onChange={e => set('wallet_provider', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">{ra.selectWalletProvider}</option>
                  {WALLET_PROVIDER_KEYS.map(p => (
                    <option key={p.value} value={p.value === '__other__' ? ra.walletOther : p.value}>
                      {'labelKey' in p ? ra[p.labelKey!] : p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  {ra.walletNumber} <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.wallet_phone}
                  onChange={e => set('wallet_phone', e.target.value)}
                  placeholder="07XXXXXXXX"
                  dir="ltr"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          )}

          {form.account_type === 'collection_transfer' && (
            <div className="space-y-3 bg-amber-50/50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                <Icon name="ArrowsRightLeftIcon" size={13} />
                {ra.transferDetailsTitle}
              </p>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">{ra.transferDetails}</label>
                <textarea
                  value={form.transfer_details}
                  onChange={e => set('transfer_details', e.target.value)}
                  rows={3}
                  placeholder={ra.transferDetailsPlaceholder}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{ra.additionalNotes}</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder={ra.notesPlaceholder}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('is_primary', !form.is_primary)}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.is_primary ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_primary ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-foreground">{ra.setPrimary}</span>
          </label>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              <Icon name="ExclamationCircleIcon" size={15} />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            {ra.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {ra.saving}
              </>
            ) : (
              <>
                <Icon name="CheckIcon" size={15} />
                {ra.saveAccount}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ReceivingAccountPanel({ userId, factories }: Props) {
  const { t, dir } = useLanguage();
  const ra = t.receivingAccount;
  const supabase = createClient();
  const [accounts, setAccounts] = useState<ReceivingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<ReceivingAccount | null>(null);
  const [selectedFactory, setSelectedFactory] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_receiving_accounts')
        .select('*')
        .eq('agent_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts(data || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : ra.errorLoad);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, supabase, ra.errorLoad]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSave = async (form: typeof EMPTY_FORM) => {
    const payload = {
      agent_id: userId,
      factory_id: form.factory_id,
      account_type: form.account_type,
      account_label: form.account_label.trim(),
      account_holder: form.account_holder.trim(),
      currency: form.currency,
      bank_name: form.bank_name.trim() || null,
      bank_branch: form.bank_branch.trim() || null,
      account_number: form.account_number.trim() || null,
      iban: form.iban.trim() || null,
      swift_code: form.swift_code.trim() || null,
      wallet_provider: form.wallet_provider.trim() || null,
      wallet_phone: form.wallet_phone.trim() || null,
      transfer_details: form.transfer_details.trim() || null,
      notes: form.notes.trim() || null,
      is_primary: form.is_primary,
    };

    if (editAccount) {
      const { error } = await supabase
        .from('agent_receiving_accounts')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editAccount.id)
        .eq('agent_id', userId);
      if (error) throw error;
      setSuccessMsg(ra.successUpdated);
    } else {
      const { data: inserted, error } = await supabase
        .from('agent_receiving_accounts')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      if (inserted) {
        const newAccount = inserted as ReceivingAccount;
        setAccounts(prev => {
          const base = newAccount.is_primary
            ? prev.map(a => (a.factory_id === newAccount.factory_id ? { ...a, is_primary: false } : a))
            : prev;
          return [newAccount, ...base.filter(a => a.id !== newAccount.id)];
        });
      }
      setSuccessMsg(ra.successAdded);
    }

    setTimeout(() => setSuccessMsg(''), 4000);
    setShowForm(false);
    setEditAccount(null);
    await fetchAccounts(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('agent_receiving_accounts')
        .delete()
        .eq('id', id)
        .eq('agent_id', userId);
      if (error) throw error;
      setSuccessMsg(ra.successDeleted);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAccounts();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : ra.errorDelete);
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAccounts = selectedFactory
    ? accounts.filter(a => a.factory_id === selectedFactory)
    : accounts;

  const getAccountTypeInfo = (type: string) => {
    const def = ACCOUNT_TYPE_DEFS.find(d => d.value === type) || ACCOUNT_TYPE_DEFS[0];
    return { ...def, label: ra[def.labelKey] };
  };

  const getFactoryName = (id: string) =>
    factories.find(f => f.id === id)?.company_name || '—';

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Icon name="BanknotesIcon" size={18} className="text-primary" />
            {ra.panelTitle}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ra.panelSubtitle}
          </p>
        </div>
        <button
          onClick={() => { setEditAccount(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={15} />
          {ra.addAccount}
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
          <Icon name="CheckCircleIcon" size={15} />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          <Icon name="ExclamationCircleIcon" size={15} />
          {errorMsg}
        </div>
      )}

      {factories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedFactory('')}
            className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              !selectedFactory ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {ra.all} ({accounts.length})
          </button>
          {factories.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFactory(f.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                selectedFactory === f.id ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {f.company_name} ({accounts.filter(a => a.factory_id === f.id).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Icon name="BanknotesIcon" size={26} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">{ra.noAccounts}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {ra.emptyHint}
          </p>
          <button
            onClick={() => { setEditAccount(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Icon name="PlusIcon" size={15} />
            {ra.addNow}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAccounts.map(account => {
            const typeInfo = getAccountTypeInfo(account.account_type);
            return (
              <div
                key={account.id}
                className={`bg-card border rounded-xl p-4 ${account.is_primary ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      account.account_type === 'bank_account' ? 'bg-blue-50' :
                      account.account_type === 'mobile_wallet' ? 'bg-emerald-50' : 'bg-amber-50'
                    }`}>
                      <Icon
                        name={typeInfo.icon as any}
                        size={18}
                        className={
                          account.account_type === 'bank_account' ? 'text-blue-600' :
                          account.account_type === 'mobile_wallet' ? 'text-emerald-600' : 'text-amber-600'
                        }
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-bold text-foreground text-sm">{account.account_label}</span>
                        {account.is_primary && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {ra.primary}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          account.account_type === 'bank_account' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          account.account_type === 'mobile_wallet'? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {typeInfo.label}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {account.currency}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Icon name="BuildingOffice2Icon" size={11} />
                        {getFactoryName(account.factory_id)}
                      </p>

                      <p className="text-xs text-foreground font-medium">
                        {ra.accountHolder}: {account.account_holder}
                      </p>

                      {account.account_type === 'bank_account' && (
                        <div className="mt-1.5 space-y-0.5">
                          {account.bank_name && (
                            <p className="text-xs text-muted-foreground">🏦 {account.bank_name}{account.bank_branch ? ` — ${account.bank_branch}` : ''}</p>
                          )}
                          {account.account_number && (
                            <p className="text-xs text-muted-foreground font-mono" dir="ltr">{ra.accountNumber}: {account.account_number}</p>
                          )}
                          {account.iban && (
                            <p className="text-xs text-muted-foreground font-mono" dir="ltr">IBAN: {account.iban}</p>
                          )}
                          {account.swift_code && (
                            <p className="text-xs text-muted-foreground font-mono" dir="ltr">SWIFT: {account.swift_code}</p>
                          )}
                        </div>
                      )}
                      {account.account_type === 'mobile_wallet' && (
                        <div className="mt-1.5 space-y-0.5">
                          {account.wallet_provider && (
                            <p className="text-xs text-muted-foreground">📱 {account.wallet_provider}</p>
                          )}
                          {account.wallet_phone && (
                            <p className="text-xs text-muted-foreground font-mono" dir="ltr">{account.wallet_phone}</p>
                          )}
                        </div>
                      )}
                      {account.account_type === 'collection_transfer' && account.transfer_details && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{account.transfer_details}</p>
                      )}
                      {account.notes && (
                        <p className="text-xs text-blue-600 mt-1 italic">📝 {account.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditAccount(account); setShowForm(true); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-muted border border-border text-muted-foreground rounded-lg text-xs font-semibold hover:bg-muted/80 transition-colors"
                    >
                      <Icon name="PencilIcon" size={12} />
                      {ra.edit}
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      disabled={deletingId === account.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {deletingId === account.id ? (
                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="TrashIcon" size={12} />
                      )}
                      {ra.delete}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <AccountFormModal
          factories={factories}
          initial={editAccount}
          onClose={() => { setShowForm(false); setEditAccount(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
