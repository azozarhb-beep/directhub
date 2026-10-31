'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { copyAgentProductLink } from './AgentProductShareModal';

export interface EditableAgentProduct {
  id: string;
  factory_id: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  price: number;
  currency: string;
  moq: number;
  unit: string;
  category?: string;
  is_active: boolean;
  is_b2b_only?: boolean | null;
  retail_price?: number | null;
  wholesale_price?: number | null;
  images?: string[] | null;
  video_url?: string | null;
}

const INPUT_CLS =
  'w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary';

interface EditDrawerProps {
  product: EditableAgentProduct;
  onClose: () => void;
  onSaved: (updated: EditableAgentProduct) => void;
}

export function AgentProductEditDrawer({ product, onClose, onSaved }: EditDrawerProps) {
  const { t, dir } = useLanguage();
  const pa = t.agentProductActions;
  const supabase = createClient();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name_ar: product.name_ar || '',
    name_en: product.name_en || '',
    description_ar: product.description_ar || '',
    description_en: product.description_en || '',
    category: product.category || '',
    wholesale_price: String(product.wholesale_price ?? product.price ?? ''),
    retail_price: product.retail_price != null ? String(product.retail_price) : '',
    is_b2b_only: product.is_b2b_only !== false,
    moq: String(product.moq ?? ''),
    unit: product.unit || '',
    currency: product.currency || 'SAR',
  });

  const set = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSave = async () => {
    if (!form.name_ar.trim()) { setError(pa.errName); return; }
    const wholesale = Number(form.wholesale_price);
    if (!form.wholesale_price || !Number.isFinite(wholesale) || wholesale <= 0) { setError(pa.errWholesale); return; }
    const retail = Number(form.retail_price);
    if (!form.is_b2b_only && (!form.retail_price || !Number.isFinite(retail) || retail <= 0)) { setError(pa.errRetail); return; }
    const moq = Number(form.moq);
    if (!form.moq || !Number.isFinite(moq) || moq <= 0) { setError(pa.errMoq); return; }

    setSaving(true);
    setError('');
    try {
      // Edits send the product back to moderation so changes are re-checked before going live
      const payload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        description_ar: form.description_ar.trim(),
        description_en: form.description_en.trim(),
        category: form.category.trim(),
        price: wholesale,
        wholesale_price: wholesale,
        retail_price: form.is_b2b_only ? null : retail,
        is_b2b_only: form.is_b2b_only,
        moq,
        unit: form.unit.trim(),
        currency: form.currency,
        is_active: false,
      };
      const { error: updateError } = await supabase
        .from('agent_products')
        .update(payload)
        .eq('id', product.id);
      if (updateError) throw updateError;
      // Re-apply auto-approval policy: re-activates when auto-launch is on
      const { data: pubRes } = await supabase.rpc('publish_agent_product', { p_product_id: product.id, p_initial_stock: 100 });
      const republished = (pubRes as { published?: boolean } | null)?.published === true;
      toast.success(pa.saved);
      onSaved({ ...product, ...payload, is_active: republished });
    } catch (err: any) {
      setError(err?.message || pa.errGeneric);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex" dir={dir} role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={pa.close}
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative ms-auto h-full w-full max-w-md bg-card border-s border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="PencilSquareIcon" size={18} className="text-primary" />
            <h2 className="font-bold text-foreground text-base">{pa.editTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={pa.close} className="p-1.5 rounded-lg hover:bg-muted">
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs">
            <Icon name="InformationCircleIcon" size={15} className="shrink-0 mt-0.5" />
            <span>{pa.editReviewNote}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{pa.nameAr}</label>
            <input value={form.name_ar} onChange={e => set('name_ar', e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{pa.nameEn}</label>
            <input value={form.name_en} onChange={e => set('name_en', e.target.value)} className={INPUT_CLS} dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{pa.descAr}</label>
            <textarea value={form.description_ar} onChange={e => set('description_ar', e.target.value)} rows={3} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{pa.descEn}</label>
            <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)} rows={3} className={INPUT_CLS} dir="ltr" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">{pa.category}</label>
            <input value={form.category} onChange={e => set('category', e.target.value)} className={INPUT_CLS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{pa.wholesalePrice}</label>
              <input type="number" min="0" step="0.01" value={form.wholesale_price} onChange={e => set('wholesale_price', e.target.value)} className={INPUT_CLS} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{pa.currency}</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className={INPUT_CLS}>
                {['SAR', 'USD', 'EUR', 'AED', 'YER', 'CNY', 'TRY'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={form.is_b2b_only} onChange={e => set('is_b2b_only', e.target.checked)} className="w-4 h-4 accent-primary" />
            {pa.b2bOnly}
          </label>

          {!form.is_b2b_only && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{pa.retailPrice}</label>
              <input type="number" min="0" step="0.01" value={form.retail_price} onChange={e => set('retail_price', e.target.value)} className={INPUT_CLS} dir="ltr" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{pa.moq}</label>
              <input type="number" min="1" value={form.moq} onChange={e => set('moq', e.target.value)} className={INPUT_CLS} dir="ltr" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">{pa.unit}</label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} className={INPUT_CLS} />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? pa.saving : pa.save}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted"
          >
            {pa.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PreviewProps {
  product: EditableAgentProduct;
  factoryName?: string;
  onClose: () => void;
  onEdit: () => void;
  onShare?: () => void;
}

export function AgentProductPreviewModal({ product, factoryName, onClose, onEdit, onShare }: PreviewProps) {
  const { t, dir } = useLanguage();
  const pa = t.agentProductActions;
  const images = (product.images || []).filter(Boolean);
  const [activeImg, setActiveImg] = useState(0);
  const description = product.description_ar || product.description_en || '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" dir={dir} role="dialog" aria-modal="true">
      <button type="button" aria-label={pa.close} onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Icon name="EyeIcon" size={18} className="text-primary" />
            <h2 className="font-bold text-foreground text-base">{pa.previewTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={pa.close} className="p-1.5 rounded-lg hover:bg-muted">
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div
            className={`flex items-start gap-2 rounded-xl p-3 text-xs border ${
              product.is_active
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <Icon name={product.is_active ? 'CheckCircleIcon' : 'ClockIcon'} size={15} className="shrink-0 mt-0.5" />
            <span>{product.is_active ? pa.statusLive : pa.statusPending}</span>
          </div>

          <div className="aspect-square w-full max-h-[320px] mx-auto bg-white dark:bg-zinc-900 flex items-center justify-center rounded-xl overflow-hidden border border-border">
            {images[activeImg] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={images[activeImg]} alt={product.name_ar} className="w-full h-full object-contain p-3" />
            ) : (
              <Icon name="PhotoIcon" size={40} className="text-muted-foreground" />
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${i === activeImg ? 'border-primary' : 'border-border'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${product.name_ar} ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {product.video_url && (
            <video src={product.video_url} controls preload="metadata" className="w-full rounded-xl border border-border bg-black max-h-64" />
          )}

          <div>
            <h3 className="font-bold text-foreground text-lg">{product.name_ar}</h3>
            {product.name_en && <p className="text-sm text-muted-foreground" dir="ltr">{product.name_en}</p>}
            {factoryName && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Icon name="BuildingOffice2Icon" size={12} />
                {factoryName}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{pa.wholesalePrice}</p>
              <p className="text-sm font-bold text-foreground">{product.wholesale_price ?? product.price} {product.currency}</p>
            </div>
            {product.is_b2b_only === false && product.retail_price != null && (
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground">{pa.retailPrice}</p>
                <p className="text-sm font-bold text-foreground">{product.retail_price} {product.currency}</p>
              </div>
            )}
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{pa.moq}</p>
              <p className="text-sm font-bold text-foreground">{product.moq} {product.unit}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">{pa.category}</p>
              <p className="text-sm font-bold text-foreground">{product.category || '—'}</p>
            </div>
          </div>

          {description && <p className="text-sm text-foreground whitespace-pre-line">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
          >
            <Icon name="PencilSquareIcon" size={15} />
            {pa.edit}
          </button>
          {product.is_active && (
            <Link
              href={`/store/${product.factory_id}`}
              target="_blank"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Icon name="ArrowTopRightOnSquareIcon" size={15} />
              {pa.viewInStore}
            </Link>
          )}
          <button
            type="button"
            onClick={() => copyAgentProductLink(product.id, pa.linkCopied, pa.linkCopyFailed)}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted"
          >
            <Icon name="LinkIcon" size={15} />
            {pa.copyLink}
          </button>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Icon name="QrCodeIcon" size={15} />
              {pa.shareQr}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
