'use client';

import React, { useEffect } from 'react';
import {
  X,
  Package,
  Send,
  EyeOff,
  CheckCircle2,
  FileText,
  Download,
  Eye,
  Image as ImageIcon,
  Ship,
  MapPin,
  CalendarClock,
  Boxes,
  Ruler,
  Layers,
  PackageOpen,
} from 'lucide-react';

export interface RFQDetails {
  id: string;
  product_name: string | null;
  custom_product_description: string | null;
  quantity: number | null;
  unit: string | null;
  specifications: string | null;
  customization_notes: string | null;
  additional_notes: string | null;
  target_price: number | null;
  currency: string | null;
  destination_country: string | null;
  destination_port: string | null;
  incoterms: string | null;
  payment_terms: string | null;
  urgency: string | null;
  sector: string | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
}

interface RFQDetailsDrawerProps {
  rfq: RFQDetails | null;
  responded: boolean;
  onClose: () => void;
  onSubmitQuote: (rfq: RFQDetails) => void;
  onDismiss: (rfq: RFQDetails) => void;
}

interface ParsedAttachment {
  url: string;
  name: string;
  isImage: boolean;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i;
const URL_RE = /https?:\/\/[^\s<>"']+/g;

function extractAttachments(text: string | null): ParsedAttachment[] {
  if (!text) return [];
  const matches = text.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const result: ParsedAttachment[] = [];
  matches.forEach((raw) => {
    const url = raw.replace(/[),.;]+$/, '');
    if (seen.has(url)) return;
    seen.add(url);
    const clean = url.split('?')[0];
    let name = clean.substring(clean.lastIndexOf('/') + 1);
    try {
      name = decodeURIComponent(name);
    } catch {
      // keep raw name
    }
    result.push({ url, name: name || 'attachment', isImage: IMAGE_EXT.test(clean) });
  });
  return result;
}

function stripAttachmentBlock(text: string | null): string {
  if (!text) return '';
  const idx = text.indexOf('المرفقات:');
  const body = idx >= 0 ? text.slice(0, idx) : text;
  return body.replace(URL_RE, '').trim();
}

function findLine(text: string | null, label: RegExp): string {
  if (!text) return '';
  const line = text.split('\n').find((l) => label.test(l));
  if (!line) return '';
  const colon = line.indexOf(':');
  return colon >= 0 ? line.slice(colon + 1).trim() : line.trim();
}

function findDimensions(text: string): string {
  const labeled = findLine(text, /(dimensions?|size|الأبعاد|المقاس)/i);
  if (labeled) return labeled;
  const m = text.match(/\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?(?:\s*[x×*]\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|m|in|inch|مم|سم|م)?/i);
  return m ? m[0].trim() : '';
}

const URGENCY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  express: 'عاجل جداً',
  standard: 'عادي',
};

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
      <div>
        <h5 className="text-sm font-bold text-white">{title}</h5>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-900/70 rounded-lg px-3 py-2.5 flex items-start gap-2">
      <span className="text-cyan-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500">{label}</p>
        <p className="text-sm text-slate-100 font-semibold break-words whitespace-pre-line">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function RFQDetailsDrawer({ rfq, responded, onClose, onSubmitQuote, onDismiss }: RFQDetailsDrawerProps) {
  useEffect(() => {
    if (!rfq) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rfq, onClose]);

  if (!rfq) return null;

  const title = rfq.product_name || rfq.custom_product_description || 'طلب بدون عنوان';
  const combined = [rfq.specifications, rfq.customization_notes, rfq.additional_notes].filter(Boolean).join('\n');

  const attachments = extractAttachments(rfq.specifications);
  const description = stripAttachmentBlock(rfq.specifications) || rfq.custom_product_description || '';

  const materialGrade = findLine(combined, /(material\s*grade|درجة الخامة|الخامة)/i);
  const packaging = findLine(combined, /(packaging|التعبئة|التغليف)/i);
  const dimensions = findDimensions(combined);
  const deliveryDeadline = findLine(rfq.additional_notes, /(تاريخ التسليم المطلوب|delivery)/i);

  const destination = [rfq.destination_port, rfq.destination_country].filter(Boolean).join(' / ');
  const quantityText = rfq.quantity ? `${rfq.quantity} ${rfq.unit || ''}`.trim() : '';
  const targetPrice = rfq.target_price ? `${rfq.target_price} ${rfq.currency || 'USD'}` : 'غير محدد';

  const extraNotes = (rfq.additional_notes || '')
    .split('\n')
    .filter((l) => l.trim() && !/(تاريخ التسليم المطلوب)/.test(l))
    .join('\n');

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl" role="dialog" aria-modal="true" aria-label="تفاصيل طلب المشتري">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <aside className="relative mr-0 ml-auto h-full w-full max-w-xl bg-slate-900 border-r border-slate-700 shadow-2xl flex flex-col">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-700">
          <div className="min-w-0">
            <p className="text-[11px] text-purple-300 font-semibold">تفاصيل طلب المشتري · Buyer RFQ Details</p>
            <h4 className="text-base font-bold text-white mt-0.5 break-words">{title}</h4>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {rfq.category && (
                <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full">
                  {rfq.category}
                </span>
              )}
              {rfq.urgency && rfq.urgency !== 'standard' && (
                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                  {URGENCY_LABELS[rfq.urgency] || rfq.urgency}
                </span>
              )}
              {rfq.created_at && <span className="text-[10px] text-slate-500">{rfq.created_at.slice(0, 10)}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Section title="المواصفات الفنية للمنتج" subtitle="Product & Technical Specifications">
            <div className="bg-slate-900/70 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-slate-500 mb-1">الوصف التفصيلي</p>
              <p className="text-sm text-slate-200 whitespace-pre-line break-words">
                {description || 'لا يوجد وصف تفصيلي مضاف من المشتري'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field icon={<Ruler size={14} />} label="الأبعاد" value={dimensions} />
              <Field icon={<Layers size={14} />} label="درجة الخامة" value={materialGrade} />
              <div className="sm:col-span-2">
                <Field icon={<PackageOpen size={14} />} label="تعليمات التعبئة والتغليف" value={packaging} />
              </div>
            </div>
            {extraNotes && (
              <div className="bg-slate-900/70 rounded-lg px-3 py-2.5">
                <p className="text-[11px] text-slate-500 mb-1">ملاحظات إضافية</p>
                <p className="text-sm text-slate-300 whitespace-pre-line break-words">{extraNotes}</p>
              </div>
            )}
          </Section>

          <Section title="مرفقات المشتري" subtitle="Buyer Attachments">
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-500 border border-dashed border-slate-700 rounded-lg px-3 py-4 text-center">
                لم يقم المشتري برفع أي مرفقات
              </p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a) => (
                  <li
                    key={a.url}
                    className="flex items-center gap-3 bg-slate-900/70 rounded-lg px-3 py-2 border border-slate-800"
                  >
                    {a.isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.url}
                        alt={`صورة مرفقة من المشتري: ${a.name}`}
                        className="w-11 h-11 rounded-md object-cover bg-slate-800 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-md bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-cyan-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-100 font-medium truncate" dir="ltr">
                        {a.name}
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        {a.isImage ? <ImageIcon size={10} /> : <FileText size={10} />}
                        {a.isImage ? 'صورة عينة' : 'مستند / مخطط'}
                      </p>
                    </div>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200"
                    >
                      <Eye size={12} /> معاينة
                    </a>
                    <a
                      href={a.url}
                      download={a.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-[11px] text-cyan-200"
                    >
                      <Download size={12} /> تحميل
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="الشروط التجارية واللوجستية" subtitle="Commercial & Logistics Terms">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Field icon={<Boxes size={14} />} label="الكمية المستهدفة" value={quantityText} />
              <Field icon={<Package size={14} />} label="السعر المستهدف" value={targetPrice} />
              <Field icon={<Ship size={14} />} label="شرط الشحن (Incoterms)" value={rfq.incoterms || ''} />
              <Field icon={<MapPin size={14} />} label="ميناء / دولة الوجهة" value={destination} />
              <div className="sm:col-span-2">
                <Field icon={<CalendarClock size={14} />} label="الموعد النهائي للتسليم" value={deliveryDeadline} />
              </div>
              {rfq.payment_terms && (
                <div className="sm:col-span-2">
                  <Field icon={<FileText size={14} />} label="شروط الدفع" value={rfq.payment_terms} />
                </div>
              )}
            </div>
          </Section>
        </div>

        <footer className="px-5 py-4 border-t border-slate-700 bg-slate-900 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onSubmitQuote(rfq)}
            disabled={responded}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              responded
                ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/40 cursor-not-allowed' :'bg-purple-600 hover:bg-purple-500 text-white'
            }`}
          >
            {responded ? <CheckCircle2 size={15} /> : <Send size={15} />}
            {responded ? 'تم تقديم العرض' : 'تقديم عرض سعر / Submit Quotation'}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(rfq)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-200 border border-slate-700 hover:border-red-700/50 transition-colors"
          >
            <EyeOff size={15} />✕ إهمال الطلب / Dismiss RFQ
          </button>
        </footer>
      </aside>
    </div>
  );
}
