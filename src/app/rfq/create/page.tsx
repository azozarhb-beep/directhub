'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { sendDualNotification } from '@/lib/notificationService';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Electronics', 'Machinery', 'Metals & Steel', 'Textiles', 'Chemicals',
  'Plastics & Rubber', 'Food & Agriculture', 'Construction', 'Automotive',
  'Medical & Pharma', 'Furniture', 'Packaging', 'Energy', 'Raw Materials',
  'Home Appliances', 'Office Supplies', 'Cleaning & Hygiene', 'Toys & Sports',
  'Beauty & Personal Care', 'Other',
];

const CURRENCIES = ['USD', 'SAR', 'AED', 'EUR', 'GBP', 'CNY', 'TRY', 'EGP', 'YER'];

const UNITS = ['pcs', 'kg', 'ton', 'set', 'pair', 'box', 'carton', 'pack', 'roll', 'pallet', 'drum', 'container', 'bag', 'm', 'cm', 'm2', 'l'];

const URGENCY_OPTIONS = [
  { value: 'urgent', label: 'عاجل (خلال أسبوع)', labelEn: 'Urgent (within 1 week)', color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'standard', label: 'عادي (2-4 أسابيع)', labelEn: 'Standard (2-4 weeks)', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'flexible', label: 'مرن (أكثر من شهر)', labelEn: 'Flexible (1+ month)', color: 'text-green-600 bg-green-50 border-green-200' },
];

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  product_name: string;
  category: string;
  quantity: string;
  unit: string;
  target_price: string;
  currency: string;
  technical_specs: string;
  delivery_date: string;
  urgency: string;
  destination_country: string;
  additional_notes: string;
}

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  url?: string;
  uploading: boolean;
  error?: string;
}

// ─── Toast Component ──────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium transition-all animate-in slide-in-from-top-4 duration-300 ${
        type === 'success' ?'bg-emerald-600 text-white' :'bg-red-600 text-white'
      }`}
    >
      <Icon name={type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={18} />
      {message}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateRFQPage() {
  const router = useRouter();
  const { user, loading: authLoading, requireAuth } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    product_name: '',
    category: '',
    quantity: '',
    unit: 'pcs',
    target_price: '',
    currency: 'USD',
    technical_specs: '',
    delivery_date: '',
    urgency: 'standard',
    destination_country: '',
    additional_notes: '',
  });

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      requireAuth();
    }
  }, [user, authLoading]);

  // ── Toast auto-dismiss ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── File handling ───────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const remaining = MAX_FILES - files.length;
    const toAdd = selected.slice(0, remaining);

    const newFiles: UploadedFile[] = toAdd
      .filter((f) => {
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          setError(`الملف "${f.name}" يتجاوز الحد المسموح (${MAX_FILE_SIZE_MB} MB)`);
          return false;
        }
        return true;
      })
      .map((f) => ({ file: f, name: f.name, size: f.size, uploading: false }));

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) return 'PhotoIcon';
    if (ext === 'pdf') return 'DocumentTextIcon';
    if (['xls', 'xlsx'].includes(ext || '')) return 'TableCellsIcon';
    return 'DocumentIcon';
  };

  // ── Upload files to Supabase Storage ───────────────────────────────────────
  const uploadFiles = async (): Promise<string[]> => {
    if (!files.length || !user) return [];

    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setFiles((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, uploading: true } : item))
      );

      try {
        const ext = f.name.split('.').pop();
        const path = `rfq-attachments/${user.id}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('factory-documents')
          .upload(path, f.file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('factory-documents')
          .getPublicUrl(path);

        urls.push(urlData.publicUrl);

        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, uploading: false, url: urlData.publicUrl } : item
          )
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, uploading: false, error: err.message } : item
          )
        );
      }
    }

    return urls;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.product_name.trim()) {
      setError('يرجى إدخال اسم المنتج');
      return;
    }
    if (!form.quantity.trim() || isNaN(Number(form.quantity)) || Number(form.quantity) < 1) {
      setError('يرجى إدخال كمية صحيحة');
      return;
    }
    if (!user) {
      requireAuth();
      return;
    }

    setSubmitting(true);

    try {
      // Upload files first
      const attachmentUrls = await uploadFiles();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Build additional_notes to include delivery date
      const additionalNotesValue = [
        form.delivery_date ? `تاريخ التسليم المطلوب: ${form.delivery_date}` : '',
        form.additional_notes.trim(),
      ]
        .filter(Boolean)
        .join('\n');

      // Build specifications to include file URLs
      const specificationsValue = [
        form.technical_specs.trim(),
        attachmentUrls.length
          ? `المرفقات:\n${attachmentUrls.join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const payload = {
        buyer_id: user.id,
        product_name: form.product_name.trim(),
        category: form.category || 'Other',
        quantity: parseInt(form.quantity) || 1,
        unit: form.unit,
        target_price: form.target_price ? parseFloat(form.target_price) : null,
        currency: form.currency,
        specifications: specificationsValue || null,
        customization_notes: form.technical_specs.trim() || null,
        additional_notes: additionalNotesValue || null,
        urgency: form.urgency,
        destination_country: form.destination_country.trim() || null,
        supplier_name: 'Any',
        supplier_country: 'Any',
        status: 'pending',
        is_published: true,
        expires_at: expiresAt.toISOString(),
        sector: 'general',
      };

      // ── Critical path: DB insert only ──────────────────────────────────────
      const { data, error: insertError } = await supabase
        .from('rfq_requests')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      // ── Fire-and-forget: dual notification (in-app + email, never blocks redirect) ──
      sendDualNotification({
        userId: user.id,
        title: 'تم إرسال طلب عرض السعر',
        message: `تم إرسال طلب عرض السعر للمنتج: ${form.product_name.trim()}`,
        type: 'rfq_submitted',
        link: '/rfq-management',
      }).catch((notifErr: any) => {
        console.warn('[RFQ] Dual notification failed (non-critical):', notifErr?.message);
      });

      // ── Success: show toast and redirect immediately ─────────────────────────
      setToast({ message: '✅ تم إرسال طلب عرض السعر بنجاح!', type: 'success' });

      setTimeout(() => {
        router.push('/rfq-management');
      }, 1500);
    } catch (err: any) {
      console.error('[RFQ] Submit error:', err?.message);
      setError(err.message || 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.');
      setToast({ message: 'فشل إرسال الطلب. يرجى المحاولة مرة أخرى.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Auth loading / unauthenticated states ───────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icon name="LockClosedIcon" size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">تسجيل الدخول مطلوب</h2>
            <p className="text-sm text-muted-foreground mb-6">
              يجب تسجيل الدخول لإنشاء طلب عرض سعر
            </p>
            <button
              onClick={() => requireAuth()}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:bg-primary/90 transition-colors"
            >
              تسجيل الدخول
            </button>
            <Link
              href="/search"
              className="block mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              تصفح المنتجات بدلاً من ذلك
            </Link>
          </div>
        </div>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} />}
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24 md:pb-8">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/rfq-management"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border hover:bg-muted transition-colors shrink-0"
          >
            <Icon name="ChevronRightIcon" size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="DocumentTextIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">إنشاء طلب عرض سعر</h1>
              <p className="text-xs text-muted-foreground">Request for Quotation (RFQ)</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <Icon name="ExclamationCircleIcon" size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Section 1: Product Info ── */}
          <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Icon name="CubeIcon" size={14} className="text-blue-600" />
              </div>
              <h2 className="text-sm font-bold text-foreground">معلومات المنتج</h2>
            </div>

            {/* Product name */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                اسم المنتج <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.product_name}
                onChange={(e) => setField('product_name', e.target.value)}
                placeholder="مثال: محرك كهربائي 5 كيلوواط، قماش قطني 100%..."
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                الفئة / القطاع
              </label>
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
              >
                <option value="">-- اختر الفئة --</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  الكمية المطلوبة (MOQ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setField('quantity', e.target.value)}
                  placeholder="1000"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">الوحدة</label>
                <select
                  value={form.unit}
                  onChange={(e) => setField('unit', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target price + Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  السعر المستهدف (للوحدة)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.target_price}
                  onChange={(e) => setField('target_price', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">العملة</label>
                <select
                  value={form.currency}
                  onChange={(e) => setField('currency', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Section 2: Technical Specs ── */}
          <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Icon name="WrenchScrewdriverIcon" size={14} className="text-purple-600" />
              </div>
              <h2 className="text-sm font-bold text-foreground">المواصفات الفنية</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                المواصفات والمتطلبات التقنية
              </label>
              <textarea
                rows={4}
                value={form.technical_specs}
                onChange={(e) => setField('technical_specs', e.target.value)}
                placeholder="اذكر المواصفات الفنية الدقيقة: المواد، الأبعاد، المعايير الدولية (ISO/CE/RoHS)، اللون، التشطيب..."
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                ملاحظات إضافية
              </label>
              <textarea
                rows={2}
                value={form.additional_notes}
                onChange={(e) => setField('additional_notes', e.target.value)}
                placeholder="أي متطلبات أخرى، تعبئة خاصة، شهادات مطلوبة..."
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
          </section>

          {/* ── Section 3: Delivery & Urgency ── */}
          <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Icon name="CalendarDaysIcon" size={14} className="text-amber-600" />
              </div>
              <h2 className="text-sm font-bold text-foreground">التسليم والأولوية</h2>
            </div>

            {/* Delivery date */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                تاريخ التسليم المطلوب
              </label>
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setField('delivery_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                مستوى الأولوية
              </label>
              <div className="grid grid-cols-3 gap-2">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('urgency', opt.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs font-medium transition-all ${
                      form.urgency === opt.value
                        ? opt.color + 'ring-2 ring-offset-1 ring-current' :'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-center leading-tight">{opt.label}</span>
                    <span className="text-[10px] opacity-70 text-center leading-tight">{opt.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                بلد الوجهة / الاستلام
              </label>
              <input
                type="text"
                value={form.destination_country}
                onChange={(e) => setField('destination_country', e.target.value)}
                placeholder="مثال: المملكة العربية السعودية، الإمارات، مصر..."
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </section>

          {/* ── Section 4: File Attachments ── */}
          <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Icon name="PaperClipIcon" size={14} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">المرفقات والمخططات</h2>
                <p className="text-xs text-muted-foreground">PDF، صور، ملفات Excel/Word — حتى {MAX_FILES} ملفات، {MAX_FILE_SIZE_MB} MB لكل ملف</p>
              </div>
            </div>

            {/* Drop zone */}
            {files.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-primary rounded-xl py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <Icon name="ArrowUpTrayIcon" size={20} />
                </div>
                <span className="text-sm font-medium">انقر لرفع الملفات</span>
                <span className="text-xs opacity-70">أو اسحب وأفلت هنا</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-muted/40 border border-border rounded-xl px-3 py-2.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                      <Icon name={getFileIcon(f.name)} size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    {f.uploading && (
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    {f.url && !f.uploading && (
                      <Icon name="CheckCircleIcon" size={16} className="text-emerald-500 shrink-0" />
                    )}
                    {f.error && (
                      <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 shrink-0" />
                    )}
                    {!f.uploading && (
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                      >
                        <Icon name="XMarkIcon" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {files.length >= MAX_FILES && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                تم الوصول للحد الأقصى ({MAX_FILES} ملفات)
              </p>
            )}
          </section>

          {/* ── Submit button ── */}
          <div className="flex gap-3 pt-1">
            <Link
              href="/rfq-management"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>جارٍ الإرسال...</span>
                </>
              ) : (
                <>
                  <Icon name="PaperAirplaneIcon" size={16} />
                  <span>إرسال طلب عرض السعر</span>
                </>
              )}
            </button>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            <Icon name="InformationCircleIcon" size={15} className="shrink-0 mt-0.5" />
            <span>
              سيتم نشر طلبك للموردين والمصانع المؤهلة. ستصلك عروض الأسعار خلال 24-72 ساعة عبر لوحة إدارة الطلبات.
            </span>
          </div>
        </form>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
