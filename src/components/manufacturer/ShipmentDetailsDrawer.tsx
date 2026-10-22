'use client';

import React, { useEffect, useState } from 'react';

export interface DrawerShipment {
  id: string;
  tracking_number: string;
  bl_number: string;
  transport_type: string;
  origin_port: string;
  destination_port: string;
  carrier: string;
  shipping_line: string;
  container_number: string;
  etd: string;
  eta: string;
  status: string;
}

interface ShipmentDetailsDrawerProps {
  shipment: DrawerShipment | null;
  onClose: () => void;
  onStatusChange: (shipmentId: string, status: string) => Promise<boolean>;
}

const TIMELINE_STEPS: { key: string; ar: string; en: string }[] = [
  { key: 'booking', ar: 'تأكيد الحجز', en: 'Booking Confirmed' },
  { key: 'loaded', ar: 'تم التحميل في ميناء مرسين', en: 'Loaded at Port Mersin' },
  { key: 'transit', ar: 'إبحار السفينة / في الطريق', en: 'Vessel Sailing / In Transit' },
  { key: 'arrival', ar: 'الوصول إلى ميناء عدن', en: 'Port of Aden Arrival' },
  { key: 'customs', ar: 'التخليص الجمركي', en: 'Customs Clearance' },
  { key: 'delivered', ar: 'تم التسليم', en: 'Delivered' },
];

const STATUS_OPTIONS: { value: string; ar: string; stepIndex: number }[] = [
  { value: 'Booking Confirmed', ar: 'تم تأكيد الحجز', stepIndex: 0 },
  { value: 'Loaded at Port', ar: 'تم التحميل في الميناء', stepIndex: 1 },
  { value: 'In Transit', ar: 'في الطريق', stepIndex: 2 },
  { value: 'Arrived at Port', ar: 'وصلت إلى الميناء', stepIndex: 3 },
  { value: 'Customs Clearance', ar: 'قيد التخليص الجمركي', stepIndex: 4 },
  { value: 'Delivered', ar: 'تم التسليم', stepIndex: 5 },
];

const MSC_TRACKING_URL = 'https://www.msc.com/en/track-a-shipment';

const DEFAULT_CONTAINER = 'MSCU7654321';

function statusToStep(status: string): number {
  const found = STATUS_OPTIONS.find((o) => o.value.toLowerCase() === (status || '').toLowerCase());
  if (found) return found.stepIndex;
  const s = (status || '').toLowerCase();
  if (s.includes('deliver')) return 5;
  if (s.includes('customs')) return 4;
  if (s.includes('arriv')) return 3;
  if (s.includes('transit') || s.includes('sail')) return 2;
  if (s.includes('load')) return 1;
  return 0;
}

function buildMscUrl(ref: string): string {
  return `${MSC_TRACKING_URL}?trackingNumber=${encodeURIComponent(ref)}`;
}

export default function ShipmentDetailsDrawer({ shipment, onClose, onStatusChange }: ShipmentDetailsDrawerProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('In Transit');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(2);

  useEffect(() => {
    if (!shipment) return;
    const matched = STATUS_OPTIONS.find((o) => o.value.toLowerCase() === (shipment.status || '').toLowerCase());
    setSelectedStatus(matched ? matched.value : 'In Transit');
    setCurrentStep(statusToStep(shipment.status));
    setFeedback('');
  }, [shipment]);

  useEffect(() => {
    if (!shipment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shipment, onClose]);

  if (!shipment) return null;

  const containerNo = shipment.container_number || DEFAULT_CONTAINER;
  const blNo = shipment.bl_number || '';
  const originPort = shipment.origin_port || 'Mersin';
  const destPort = shipment.destination_port || 'Aden';

  const documents: { key: string; ar: string; en: string; file: string }[] = [
    { key: 'bl', ar: 'بوليصة الشحن', en: 'Bill of Lading (B/L)', file: 'bill-of-lading' },
    { key: 'ci', ar: 'الفاتورة التجارية', en: 'Commercial Invoice', file: 'commercial-invoice' },
    { key: 'pl', ar: 'قائمة التعبئة', en: 'Packing List', file: 'packing-list' },
    { key: 'coo', ar: 'شهادة المنشأ', en: 'Certificate of Origin', file: 'certificate-of-origin' },
  ];

  const buildDocContent = (docEn: string) =>
    [
      docEn,
      `Shipment: ${shipment.tracking_number}`,
      `B/L: ${blNo || '—'}`,
      `Container: ${containerNo}`,
      `Route: ${originPort} -> ${destPort}`,
      `Carrier: ${shipment.shipping_line || 'MSC'}`,
    ].join('\n');

  const openDocument = (docEn: string, download: boolean, file: string) => {
    const blob = new Blob([buildDocContent(docEn)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${shipment.tracking_number}-${file}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleUpdateStatus = async () => {
    setSaving(true);
    setFeedback('');
    const ok = await onStatusChange(shipment.id, selectedStatus);
    setSaving(false);
    if (ok) {
      setCurrentStep(statusToStep(selectedStatus));
      setFeedback('تم تحديث حالة الشحنة بنجاح');
    } else {
      setFeedback('تعذر تحديث الحالة، حاول مرة أخرى');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-start" dir="rtl" role="dialog" aria-modal="true" aria-label="تفاصيل الشحنة">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside className="relative h-full w-full max-w-md bg-slate-900 border-r border-slate-700 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">ملف الشحنة</p>
            <h3 className="text-base font-bold text-white font-mono truncate">{shipment.tracking_number}</h3>
            <p className="text-xs text-slate-400 mt-1">
              {originPort} → {destPort} · {shipment.shipping_line || 'MSC'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h4 className="text-sm font-semibold text-white mb-3">مراحل الشحن البحري</h4>
            <ol className="space-y-0">
              {TIMELINE_STEPS.map((step, idx) => {
                const done = idx < currentStep;
                const active = idx === currentStep;
                const last = idx === TIMELINE_STEPS.length - 1;
                return (
                  <li key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                          done
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : active
                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 animate-pulse' :'bg-slate-800 border-slate-700 text-slate-500'
                        }`}
                      >
                        {done ? '✓' : idx + 1}
                      </span>
                      {!last && <span className={`w-0.5 flex-1 min-h-[24px] ${done ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
                    </div>
                    <div className="pb-4">
                      <p className={`text-sm ${done || active ? 'text-white font-medium' : 'text-slate-500'}`}>{step.ar}</p>
                      <p className="text-xs text-slate-500">{step.en}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white">التتبع المباشر MSC</h4>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">رقم الحاوية</span>
              <a
                href={buildMscUrl(containerNo)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                {containerNo} ↗
              </a>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">رقم B/L</span>
              {blNo ? (
                <a
                  href={buildMscUrl(blNo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  {blNo} ↗
                </a>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
            {shipment.eta ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-400">الوصول المتوقع ETA</span>
                <span className="text-slate-200">{shipment.eta}</span>
              </div>
            ) : null}
          </section>

          <section>
            <h4 className="text-sm font-semibold text-white mb-3">المستندات المرتبطة</h4>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100">{doc.ar}</p>
                    <p className="text-xs text-slate-500">{doc.en}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openDocument(doc.en, false, doc.file)}
                      className="px-2.5 py-1 rounded-md text-xs border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      معاينة
                    </button>
                    <button
                      type="button"
                      onClick={() => openDocument(doc.en, true, doc.file)}
                      className="px-2.5 py-1 rounded-md text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      تحميل
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white">تحديث حالة الشحنة</h4>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.ar} — {o.value}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? '...' : 'تحديث الحالة'}
            </button>
            {feedback ? <p className="text-xs text-emerald-300">{feedback}</p> : null}
          </section>
        </div>
      </aside>
    </div>
  );
}
