'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

interface CreateRFQModalProps {
  onClose: () => void;
  onSuccess?: (rfq: any) => void;
}

const CURRENCIES = ['USD', 'SAR', 'AED', 'EUR', 'GBP', 'CNY', 'TRY', 'EGP', 'YER'];

const UNIT_CATEGORY_KEYS = [
  { key: 'weight' as const, units: ['kg', 'g', 'ton', 'lb', 'oz', 'mg'] },
  { key: 'length' as const, units: ['m', 'cm', 'mm', 'lm', 'yd', 'ft', 'in'] },
  { key: 'area' as const, units: ['m2', 'ft2', 'acre', 'ha'] },
  { key: 'volume' as const, units: ['m3', 'l', 'ml', 'gal', 'ft3'] },
  { key: 'packaging' as const, units: ['pcs', 'set', 'pair', 'box', 'carton', 'pack', 'roll', 'bundle', 'pallet', 'drum', 'barrel', 'container', 'bag', 'sack', 'dozen'] },
];

const ALL_UNIT_VALUES = UNIT_CATEGORY_KEYS.flatMap((c) => c.units);

export default function CreateRFQModal({ onClose, onSuccess }: CreateRFQModalProps) {
  const { user } = useAuth();
  const { t, dir, isRTL } = useLanguage();
  const supabase = createClient();
  const labels = t.createRfq;

  const [form, setForm] = useState({
    product_name: '',
    quantity: '',
    unit: 'pcs',
    specifications: '',
    target_price: '',
    currency: 'USD',
    destination_country: '',
    supplier_name: '',
    supplier_country: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  const unitLabel = (value: string) =>
    (labels.units as Record<string, string>)[value] || value;

  const selectedUnitLabel = unitLabel(form.unit);

  const searchLower = unitSearch.toLowerCase();
  const filteredCategories = UNIT_CATEGORY_KEYS.map((cat) => ({
    ...cat,
    units: cat.units.filter((u) => {
      if (!unitSearch) return true;
      const lab = unitLabel(u).toLowerCase();
      return lab.includes(searchLower) || u.toLowerCase().includes(searchLower) || unitLabel(u).includes(unitSearch);
    }),
  })).filter((cat) => cat.units.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.product_name.trim() || !form.quantity.trim()) {
      setError(labels.requiredFields);
      return;
    }

    if (!user) return;
    setSubmitting(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const payload = {
        buyer_id: user.id,
        product_id: '',
        product_name: form.product_name.trim(),
        quantity: parseInt(form.quantity) || 1,
        unit: form.unit,
        specifications: form.specifications.trim() || null,
        target_price: form.target_price ? parseFloat(form.target_price) : null,
        currency: form.currency,
        destination_country: form.destination_country.trim() || null,
        supplier_name: form.supplier_name.trim() || 'Any',
        supplier_country: form.supplier_country.trim() || 'Any',
        status: 'pending',
        is_published: true,
        expires_at: expiresAt.toISOString(),
      };

      const { data, error: insertError } = await supabase
        .from('rfq_requests')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'rfq_submitted',
        title: labels.notifTitle,
        body: labels.notifBody.replace('{name}', form.product_name.trim()),
        link: '/rfq-board',
        metadata: { rfq_id: data.id, product_name: form.product_name.trim() },
      }).then(() => {}).catch(() => {});

      onSuccess?.(data);
      onClose();
    } catch (err: any) {
      setError(err.message || labels.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
      <div className="flex items-center justify-between p-5 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="DocumentTextIcon" size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-base">{labels.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{labels.subtitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
        >
          <Icon name="XMarkIcon" size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 pb-24 md:pb-6">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.productName}</label>
          <input
            type="text"
            required
            value={form.product_name}
            onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
            placeholder={labels.productNamePlaceholder}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.quantity}</label>
            <input
              type="number"
              required
              min="1"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="1000"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.unit}</label>
            <button
              type="button"
              onClick={() => setUnitDropdownOpen((o) => !o)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors flex items-center justify-between gap-1 text-start"
            >
              <span className="truncate">{selectedUnitLabel}</span>
              <Icon name={unitDropdownOpen ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground shrink-0" />
            </button>

            {unitDropdownOpen && (
              <div className="absolute z-50 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-xl flex flex-col" style={{ maxHeight: '280px' }}>
                <div className="p-2 border-b border-border shrink-0">
                  <div className="relative">
                    <Icon name="MagnifyingGlassIcon" size={14} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground" style={{ [isRTL ? 'right' : 'left']: '8px' }} />
                    <input
                      autoFocus
                      type="text"
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      placeholder={labels.unitSearchPlaceholder}
                      className="w-full bg-background border border-border rounded-lg text-xs py-1.5 focus:outline-none focus:border-primary transition-colors"
                      style={{ paddingInlineStart: '28px', paddingInlineEnd: '8px' }}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredCategories.map((cat) => (
                    <div key={cat.key}>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
                        {labels.unitCategories[cat.key]}
                      </div>
                      {cat.units.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, unit: u }));
                            setUnitDropdownOpen(false);
                            setUnitSearch('');
                          }}
                          className={`w-full text-start px-3 py-2 text-sm hover:bg-primary/10 transition-colors flex items-center justify-between gap-2 ${form.unit === u ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}
                        >
                          <span>{unitLabel(u)}</span>
                          {form.unit === u && <Icon name="CheckIcon" size={14} className="text-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredCategories.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {labels.noResults}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.specifications}</label>
          <textarea
            rows={3}
            value={form.specifications}
            onChange={(e) => setForm((f) => ({ ...f, specifications: e.target.value }))}
            placeholder={labels.specificationsPlaceholder}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.targetPrice}</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.target_price}
              onChange={(e) => setForm((f) => ({ ...f, target_price: e.target.value }))}
              placeholder="0.00"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.currency}</label>
            <select
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">{labels.destination}</label>
          <input
            type="text"
            value={form.destination_country}
            onChange={(e) => setForm((f) => ({ ...f, destination_country: e.target.value }))}
            placeholder={labels.destinationPlaceholder}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                {labels.submitting}
              </>
            ) : (
              <>
                <Icon name="PaperAirplaneIcon" size={16} />
                {labels.submit}
              </>
            )}
          </button>
        </div>
      </form>

      {unitDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => { setUnitDropdownOpen(false); setUnitSearch(''); }} />
      )}
    </div>
  );
}
