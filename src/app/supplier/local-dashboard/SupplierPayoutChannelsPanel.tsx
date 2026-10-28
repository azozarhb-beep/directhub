'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

export interface SupplierPayoutAccount {
  id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string | null;
  swift_bic: string | null;
  currency: string;
  account_type: string;
  account_type_label: string | null;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_note: string | null;
  is_primary: boolean;
  created_at: string;
}

export type ChannelType = 'bank' | 'wallet' | 'card';

export interface PayoutFormData {
  channel: ChannelType;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  currency: string;
  account_type: string;
  account_type_label: string;
  card_number: string;
  card_expiry: string;
}

export const CARD_LABEL_PREFIX = 'CARD|';
export const WALLET_LABEL_PREFIX = 'WALLET|';

export type CardBrand = 'visa' | 'mastercard' | 'unknown';

export function detectCardBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa';
  if (/^5[1-5]/.test(digits)) return 'mastercard';
  if (/^2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720)/.test(digits)) return 'mastercard';
  return 'unknown';
}

export function parseCardMeta(account: SupplierPayoutAccount): { brand: CardBrand; expiry: string } | null {
  const label = account.account_type_label || '';
  if (!label.startsWith(CARD_LABEL_PREFIX)) return null;
  const [, brand, expiry] = label.split('|');
  return { brand: (brand as CardBrand) || 'unknown', expiry: expiry || '' };
}

interface Props {
  accounts: SupplierPayoutAccount[];
  loading: boolean;
  showModal: boolean;
  setShowModal: (v: boolean) => void;
  formData: PayoutFormData;
  setFormData: (v: PayoutFormData) => void;
  formLoading: boolean;
  formError: string;
  formSuccess: string;
  deletingId: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
  onOpenModal: () => void;
  md: Record<string, string>;
}

const inputCls =
  'w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30';

function BrandBadge({ brand, size = 'md' }: { brand: CardBrand; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-6' : 'h-7';
  if (brand === 'visa') {
    return (
      <span className={`inline-flex items-center ${h} px-2 rounded-md bg-white text-[#1a1f71] text-xs font-extrabold italic tracking-wider`}>
        VISA
      </span>
    );
  }
  if (brand === 'mastercard') {
    return (
      <span className={`inline-flex items-center ${h} px-1.5 rounded-md bg-white/95`}>
        <span className="w-4 h-4 rounded-full bg-[#eb001b] block" />
        <span className="w-4 h-4 rounded-full bg-[#f79e1b] block -ml-1.5 opacity-90" />
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center ${h} px-2 rounded-md bg-white/20 text-white text-[10px] font-bold`}>
      CARD
    </span>
  );
}

function CreditCardView({ account, md }: { account: SupplierPayoutAccount; md: Record<string, string> }) {
  const meta = parseCardMeta(account);
  const last4 = (account.account_number || '').replace(/\D/g, '').slice(-4);
  const gradient =
    meta?.brand === 'visa' ?'from-[#1a1f71] via-[#243b9b] to-[#3b82f6]'
      : meta?.brand === 'mastercard' ?'from-[#1f2937] via-[#7f1d1d] to-[#ea580c]' :'from-slate-700 via-slate-800 to-slate-900';
  return (
    <div className={`relative rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${gradient} overflow-hidden`} dir="ltr">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/70">{account.bank_name || md.cardIssuerFallback}</p>
          <div className="mt-3 w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
        </div>
        <BrandBadge brand={meta?.brand || 'unknown'} />
      </div>
      <p className="relative mt-5 font-mono text-lg tracking-[0.18em]">•••• •••• •••• {last4 || '••••'}</p>
      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] uppercase text-white/60">Card Holder</p>
          <p className="text-xs font-semibold truncate uppercase">{account.account_holder_name}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-white/60">Expires</p>
          <p className="text-xs font-mono font-semibold">{meta?.expiry || '--/--'}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase text-white/60">CCY</p>
          <p className="text-xs font-bold">{account.currency}</p>
        </div>
      </div>
    </div>
  );
}

export default function SupplierPayoutChannelsPanel({
  accounts,
  loading,
  showModal,
  setShowModal,
  formData,
  setFormData,
  formLoading,
  formError,
  formSuccess,
  deletingId,
  onSubmit,
  onDelete,
  onOpenModal,
  md,
}: Props) {
  const [focusExpiry, setFocusExpiry] = useState(false);
  const brand = detectCardBrand(formData.card_number.replace(/\D/g, ''));

  const statusCfg = {
    pending_review: { label: md.bankStatusPending, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    approved: { label: md.bankStatusApproved, color: 'bg-green-50 text-green-700 border-green-200' },
    rejected: { label: md.bankStatusRejected, color: 'bg-red-50 text-red-700 border-red-200' },
  } as const;

  const setChannel = (channel: ChannelType) => {
    setFormData({
      ...formData,
      channel,
      currency: 'YER',
    });
  };

  const tabs: { key: ChannelType; label: string; icon: string }[] = [
    { key: 'bank', label: md.tabBank, icon: 'BuildingLibraryIcon' },
    { key: 'wallet', label: md.tabWallet, icon: 'WalletIcon' },
    { key: 'card', label: md.tabCard, icon: 'CreditCardIcon' },
  ];

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <div className="space-y-5" dir="rtl">
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
            onClick={onOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            <Icon name="PlusIcon" size={16} />
            {md.addAccountAction}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="BuildingLibraryIcon" size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{md.noAccountsYet}</p>
          <p className="text-xs text-muted-foreground mb-4">{md.addFirstAccount}</p>
          <button
            onClick={onOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="PlusIcon" size={16} />
            {md.addAccountAction}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => {
            const isCard = !!parseCardMeta(account);
            const isWallet = (account.account_type_label || '').startsWith(WALLET_LABEL_PREFIX);
            const st = statusCfg[account.status] || statusCfg.pending_review;
            const typeLabel = isWallet
              ? (account.account_type_label || '').replace(WALLET_LABEL_PREFIX, '')
              : account.account_type_label || md.dealLocalCollection;
            return (
              <div key={account.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                {isCard ? (
                  <div className="p-3 pb-0">
                    <CreditCardView account={account} md={md} />
                  </div>
                ) : (
                  <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name={isWallet ? 'WalletIcon' : 'BuildingLibraryIcon'} size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{account.bank_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{typeLabel}</p>
                    </div>
                  </div>
                )}
                <div className="p-4 space-y-2.5">
                  {!isCard && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-0.5">{md.accountHolderLabel}</p>
                        <p className="font-semibold text-foreground">{account.account_holder_name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">{md.currencyLabel}</p>
                        <p className="font-semibold text-foreground">{account.currency}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground mb-0.5">{md.accountNumberLabel}</p>
                        <p className="font-mono font-semibold text-foreground" dir="ltr">{account.account_number}</p>
                      </div>
                      {account.iban ? (
                        <div className="col-span-2">
                          <p className="text-muted-foreground mb-0.5">IBAN</p>
                          <p className="font-mono font-semibold text-foreground text-[11px] break-all" dir="ltr">{account.iban}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${st.color}`}>{st.label}</span>
                    {account.status === 'pending_review' && (
                      <button
                        onClick={() => onDelete(account.id)}
                        disabled={deletingId === account.id}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                        title={md.deleteAccount}
                      >
                        {deletingId === account.id ? (
                          <Icon name="ArrowPathIcon" size={13} className="animate-spin text-muted-foreground" />
                        ) : (
                          <Icon name="TrashIcon" size={13} className="text-red-500" />
                        )}
                      </button>
                    )}
                  </div>
                  {account.status === 'rejected' && account.admin_note && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                      {account.admin_note}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="flex flex-col w-full md:max-w-lg max-h-[92vh] bg-background rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-2">
                <Icon name="BuildingLibraryIcon" size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">{md.addAccountAction}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pt-4 shrink-0">
              <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-xl">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setChannel(t.key)}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors ${
                      formData.channel === t.key ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name={t.icon} size={14} />
                    <span className="text-center leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <form onSubmit={onSubmit} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                    <Icon name="ExclamationCircleIcon" size={16} /> {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                    <Icon name="CheckCircleIcon" size={16} /> {formSuccess}
                  </div>
                )}

                {formData.channel === 'card' ? (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{md.cardHolderLabel} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.account_holder_name}
                        onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                        required
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{md.cardNumberLabel} <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          type="text"
                          dir="ltr"
                          inputMode="numeric"
                          autoComplete="off"
                          value={formatCardNumber(formData.card_number)}
                          onChange={(e) => setFormData({ ...formData, card_number: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                          placeholder="0000 0000 0000 0000"
                          required
                          className={`${inputCls} font-mono pe-20`}
                        />
                        <span className="absolute top-1/2 -translate-y-1/2 end-2">
                          {brand === 'visa' && (
                            <span className="inline-flex items-center h-6 px-2 rounded-md bg-[#1a1f71] text-white text-[11px] font-extrabold italic">VISA</span>
                          )}
                          {brand === 'mastercard' && (
                            <span className="inline-flex items-center h-6 px-1.5 rounded-md bg-gray-100 border border-gray-200">
                              <span className="w-3.5 h-3.5 rounded-full bg-[#eb001b] block" />
                              <span className="w-3.5 h-3.5 rounded-full bg-[#f79e1b] block -ml-1.5 opacity-90" />
                            </span>
                          )}
                          {brand === 'unknown' && formData.card_number.length >= 2 && (
                            <span className="inline-flex items-center h-6 px-2 rounded-md bg-muted text-muted-foreground text-[10px] font-bold">{md.cardUnknownBrand}</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">{md.cardExpiryLabel} <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          dir="ltr"
                          inputMode="numeric"
                          value={formData.card_expiry}
                          onFocus={() => setFocusExpiry(true)}
                          onBlur={() => setFocusExpiry(false)}
                          onChange={(e) => setFormData({ ...formData, card_expiry: formatExpiry(e.target.value) })}
                          placeholder={focusExpiry ? 'MM/YY' : 'MM/YY'}
                          required
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-foreground mb-1.5">{md.cardCurrencyLabel} <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value="ر.ي (YER)"
                          readOnly
                          aria-readonly="true"
                          className={`${inputCls} opacity-80 cursor-not-allowed`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{md.cardIssuerLabel}</label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder={md.cardIssuerPlaceholder}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                      <Icon name="ShieldCheckIcon" size={15} className="shrink-0 mt-0.5 text-amber-600" />
                      <span>{md.cardSecurityNotice}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        {formData.channel === 'wallet' ? md.walletProviderLabel : md.bankNameLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.bank_name}
                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                        placeholder={formData.channel === 'wallet' ? md.walletProviderPlaceholder : md.bankNamePlaceholder}
                        required
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{md.accountHolderLabel} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={formData.account_holder_name}
                        onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                        required
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        {formData.channel === 'wallet' ? md.walletNumberLabel : md.accountNumberLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={formData.account_number}
                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                        required
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    {formData.channel === 'bank' && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">IBAN ({md.optional})</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={formData.iban}
                            onChange={(e) => setFormData({ ...formData, iban: e.target.value.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase() })}
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">SWIFT / BIC ({md.optional})</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={formData.swift_bic}
                            onChange={(e) => setFormData({ ...formData, swift_bic: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() })}
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{md.currencyLabel} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value="ر.ي (YER)"
                        readOnly
                        aria-readonly="true"
                        className={`${inputCls} opacity-80 cursor-not-allowed`}
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    {md.cancelAction}
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    {formLoading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="PlusIcon" size={15} />}
                    {md.saveAction}
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
