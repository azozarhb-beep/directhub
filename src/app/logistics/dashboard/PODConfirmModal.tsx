'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';
import { uploadLogisticsFile, LOGISTICS_FILE_ACCEPT } from '@/lib/logisticsUpload';

interface PODConfirmModalProps {
  shipmentId: string;
  shipmentLabel: string;
  partnerId: string;
  onClose: () => void;
  onConfirmed: (shipmentId: string, podUrl: string) => void;
}

export default function PODConfirmModal({
  shipmentId,
  shipmentLabel,
  partnerId,
  onClose,
  onConfirmed,
}: PODConfirmModalProps) {
  const [pin, setPin] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    if (!/^\d{6}$/.test(pin.trim())) {
      setError('أدخل كود الاستلام المكوّن من 6 أرقام.');
      return;
    }
    if (!file) {
      setError('يرجى إرفاق صورة سند الاستلام الورقي المختوم.');
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = await uploadLogisticsFile(file, partnerId, `logistics-pod/${shipmentId}`);
      const res = await fetch('/api/logistics/pod-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: shipmentId,
          pin: pin.trim(),
          pod_url: uploaded.publicUrl,
          pod_file_name: uploaded.fileName,
          pod_file_size: uploaded.fileSize,
          pod_storage_path: uploaded.storagePath,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setError(json?.error || 'تعذر تأكيد التسليم.');
        return;
      }
      toast.success(json.message || 'تم تأكيد التسليم بنجاح');
      onConfirmed(shipmentId, uploaded.publicUrl);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Icon name="CheckBadgeIcon" size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">تأكيد التسليم وإنهاء الرحلة</p>
              <p className="text-[11px] text-muted-foreground">شحنة {shipmentLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="إغلاق"
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              كود الاستلام المسلّم من المصنع
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              dir="ltr"
              className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              صورة سند الاستلام الورقي المختوم
            </label>
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-medium cursor-pointer hover:bg-primary/10 transition-colors">
              <Icon name="PaperClipIcon" size={15} />
              <span className="truncate">{file ? file.name : 'اختر ملف (صورة / PDF)'}</span>
              <input
                type="file"
                accept={LOGISTICS_FILE_ACCEPT}
                className="hidden"
                disabled={submitting}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="CheckCircleIcon" size={16} />
              )}
              {submitting ? 'جاري التحقق...' : 'تأكيد التسليم'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
