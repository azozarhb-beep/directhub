'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface BankAccount {
  id: string;
  manufacturer_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  currency: string;
  account_type: string;
  account_type_label: string;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_note: string;
  is_primary: boolean;
  created_at: string;
}

const EMPTY_BANK_ACCOUNT = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  iban: '',
  swift_bic: '',
  currency: 'SAR',
  account_type: 'local_collection',
  account_type_label: '',
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'local_collection', labelKey: 'dealLocalCollection' as const, labelEn: 'Local Collection Account' },
  { value: 'international_supply', labelKey: 'dealIntlSupply' as const, labelEn: 'International Supply Account' },
  { value: 'local_general', labelKey: 'dealLocalGeneral' as const, labelEn: 'Local General Account' },
  { value: 'international_general', labelKey: 'dealIntlGeneral' as const, labelEn: 'International General Account' },
];

const CURRENCIES = ['YER', 'SAR', 'USD', 'EUR', 'GBP', 'AED', 'CNY', 'TRY', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR'];

interface BankAccountsPanelProps {
  bankAccounts: BankAccount[];
  bankAccountsLoading: boolean;
  showAddBankModal: boolean;
  setShowAddBankModal: (v: boolean) => void;
  bankFormData: typeof EMPTY_BANK_ACCOUNT;
  setBankFormData: (v: typeof EMPTY_BANK_ACCOUNT) => void;
  bankFormLoading: boolean;
  bankFormError: string;
  bankFormSuccess: string;
  deletingBankId: string | null;
  handleAddBankAccount: (e: React.FormEvent) => void;
  handleDeleteBankAccount: (id: string) => void;
  md: any;
}

export default function BankAccountsPanel({
  bankAccounts,
  bankAccountsLoading,
  showAddBankModal,
  setShowAddBankModal,
  bankFormData,
  setBankFormData,
  bankFormLoading,
  bankFormError,
  bankFormSuccess,
  deletingBankId,
  handleAddBankAccount,
  handleDeleteBankAccount,
  md,
}: BankAccountsPanelProps) {
  const { language } = useLanguage();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="BuildingLibraryIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{md.bankCenterTitle}</h2>
            <p className="text-sm text-white/80">{md.addBanksHint}</p>
          </div>
          <button
            onClick={() => { setShowAddBankModal(true); setBankFormData(EMPTY_BANK_ACCOUNT); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Icon name="PlusIcon" size={16} />
            {md.addAccountAction}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <Icon name="ShieldExclamationIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">{md.adminAuditSystem}</p>
          <p className="text-xs text-amber-700 mt-0.5">{md.bankReviewPolicy}</p>
        </div>
      </div>

      {/* Accounts List */}
      {bankAccountsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : bankAccounts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="BuildingLibraryIcon" size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{md.noBankAccountsAdded}</p>
          <p className="text-xs text-muted-foreground mb-4">{md.addBanksHint2}</p>
          <button
            onClick={() => { setShowAddBankModal(true); setBankFormData(EMPTY_BANK_ACCOUNT); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="PlusIcon" size={16} />
            {md.addBankAccountAction}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bankAccounts.map((account) => {
            const typeOption = ACCOUNT_TYPE_OPTIONS.find(o => o.value === account.account_type);
            const statusConfig = {
              pending_review: { label: md.statusUnderReview, color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ClockIcon' },
              approved: { label: md.statusApprovedCheck, color: 'bg-green-50 text-green-700 border-green-200', icon: 'CheckBadgeIcon' },
              rejected: { label: md.statusRejected, color: 'bg-red-50 text-red-700 border-red-200', icon: 'XCircleIcon' },
            }[account.status];

            return (
              <div key={account.id} className={`bg-card border rounded-2xl overflow-hidden ${account.status === 'approved' ? 'border-green-200' : account.status === 'rejected' ? 'border-red-200' : 'border-border'}`}>
                <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${account.status === 'approved' ? 'bg-green-50/50 border-green-100' : account.status === 'rejected' ? 'bg-red-50/50 border-red-100' : 'bg-muted/30 border-border'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name="BuildingLibraryIcon" size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{account.bank_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{account.account_type_label || (typeOption ? (md[typeOption.labelKey as keyof typeof md] as string) : undefined) || account.account_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${statusConfig?.color}`}>
                      {statusConfig?.label}
                    </span>
                    {account.status === 'pending_review' && (
                      <button
                        onClick={() => handleDeleteBankAccount(account.id)}
                        disabled={deletingBankId === account.id}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                        title={md.deleteAccountBtn}
                      >
                        {deletingBankId === account.id
                          ? <Icon name="ArrowPathIcon" size={13} className="animate-spin text-muted-foreground" />
                          : <Icon name="TrashIcon" size={13} className="text-red-500" />
                        }
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-0.5">{md.accountHolderLabel}</p>
                      <p className="font-semibold text-foreground">{account.account_holder_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">{md.currencyLabel2}</p>
                      <p className="font-semibold text-foreground">{account.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5">{md.accountNumberLabel2}</p>
                      <p className="font-mono font-semibold text-foreground">{account.account_number}</p>
                    </div>
                    {account.iban && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">IBAN</p>
                        <p className="font-mono font-semibold text-foreground text-[11px] break-all">{account.iban}</p>
                      </div>
                    )}
                    {account.swift_bic && (
                      <div>
                        <p className="text-muted-foreground mb-0.5">SWIFT / BIC</p>
                        <p className="font-mono font-semibold text-foreground">{account.swift_bic}</p>
                      </div>
                    )}
                  </div>
                  {account.status === 'rejected' && account.admin_note && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      <span className="font-bold">{md.adminNoteLabel} </span>{account.admin_note}
                    </div>
                  )}
                  {account.status === 'pending_review' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                      <Icon name="ClockIcon" size={12} className="inline mr-1" />
                      {md.awaitingAdminActivate}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Bank Account Modal */}
      {showAddBankModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50"
          onClick={() => setShowAddBankModal(false)}
        >
          <div
            className="flex flex-col w-full md:max-w-lg max-h-[92vh] bg-background rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <Icon name="BuildingLibraryIcon" size={18} className="text-primary" />
              <h3 className="font-bold text-foreground">{md.addBankAccountNewTitle}</h3>
            </div>
            <button onClick={() => setShowAddBankModal(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 mobile-safe-bottom md:pb-6">
            <form onSubmit={handleAddBankAccount} className="space-y-4">
              {bankFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                  <Icon name="ExclamationCircleIcon" size={16} /> {bankFormError}
                </div>
              )}
              {bankFormSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={16} /> {bankFormSuccess}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.accountClassification} <span className="text-red-500">*</span></label>
                <select
                  value={bankFormData.account_type}
                  onChange={e => setBankFormData({ ...bankFormData, account_type: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                >
                  {ACCOUNT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{md[opt.labelKey as keyof typeof md] as string} — {opt.labelEn}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.customLabelOptional}</label>
                <input
                  type="text"
                  value={bankFormData.account_type_label}
                  onChange={e => setBankFormData({ ...bankFormData, account_type_label: e.target.value })}
                  placeholder={md.territoryPlaceholder}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.accountHolderLabel} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={bankFormData.account_holder_name}
                  onChange={e => setBankFormData({ ...bankFormData, account_holder_name: e.target.value })}
                  placeholder={md.legalNameFull}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.bankNameLabel2} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={bankFormData.bank_name}
                  onChange={e => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                  placeholder={md.bankNamePh2}
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.accountNumberLabel2} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  dir="ltr"
                  inputMode="text"
                  value={bankFormData.account_number}
                  onChange={e => setBankFormData({ ...bankFormData, account_number: e.target.value })}
                  placeholder="مثال: 3001234567 (رقم الحساب المحلي)"
                  required
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[11px] text-muted-foreground mt-1">رقم الحساب المحلي المعتاد (مثل بنك الكريمي) مقبول.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">IBAN (اختياري)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={bankFormData.iban}
                  onChange={e => setBankFormData({ ...bankFormData, iban: e.target.value.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase() })}
                  placeholder="YE00 0000 0000 0000 0000 0000 (اختياري)"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
                <p className="text-[11px] text-muted-foreground mt-1">اتركه فارغاً للحسابات المحلية، أو أدخل آيبان يمني يبدأ بـ YE.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.swiftBic || 'SWIFT / BIC'} (اختياري)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={bankFormData.swift_bic}
                  onChange={e => setBankFormData({ ...bankFormData, swift_bic: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() })}
                  placeholder="اختياري — للتحويلات الدولية فقط"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{md.currencyLabel2} <span className="text-red-500">*</span></label>
                <select
                  value={bankFormData.currency}
                  onChange={e => setBankFormData({ ...bankFormData, currency: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                <Icon name="InformationCircleIcon" size={13} className="inline mr-1" />
                {md.adminReviewBeforeReceive}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  {md.cancelAction}
                </button>
                <button
                  type="submit"
                  disabled={bankFormLoading}
                  className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                  {bankFormLoading ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> {md.savingNow}</> : <><Icon name="PlusIcon" size={15} /> {md.addAccountSubmit}</>}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
