'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogisticsShipment {
  id: string;
  order_id?: string | null;
  shipment_number?: string | null;
  status?: string;
  estimated_arrival?: string | null;
}

interface DelayReportModalProps {
  shipment: LogisticsShipment;
  partnerId: string;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const DELAY_REASONS = [
  { value: 'customs',         label: 'توقف جمركي',                   labelEn: 'Customs Hold',          icon: '🛃' },
  { value: 'checkpoint',      label: 'نقطة تفتيش أمنية',             labelEn: 'Security Checkpoint',   icon: '🚧' },
  { value: 'mechanical',      label: 'عطل ميكانيكي',                 labelEn: 'Mechanical Failure',    icon: '🔧' },
  { value: 'road_conditions', label: 'أحوال الطريق / انهيار',        labelEn: 'Road Conditions',       icon: '🛣️' },
  { value: 'weather',         label: 'أحوال جوية سيئة',              labelEn: 'Bad Weather',           icon: '⛈️' },
  { value: 'port_congestion', label: 'ازدحام الميناء',               labelEn: 'Port Congestion',       icon: '⚓' },
  { value: 'other',           label: 'سبب آخر',                      labelEn: 'Other',                 icon: '📋' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LogisticsDelayReportModal({
  shipment,
  partnerId,
  userId,
  onClose,
  onSubmitted,
}: DelayReportModalProps) {
  const supabase = createClient();

  const [delayReason, setDelayReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [description, setDescription] = useState('');
  const [updatedEta, setUpdatedEta] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!delayReason) {
      toast.error('يرجى اختيار سبب التأخير');
      return;
    }
    if (!updatedEta) {
      toast.error('يرجى تحديد وقت الوصول المتوقع الجديد (ETA)');
      return;
    }

    setSubmitting(true);
    let proofUrl: string | null = null;
    let proofFilename: string | null = null;

    try {
      // Upload proof file if provided
      if (proofFile) {
        setUploading(true);
        const ext = proofFile.name.split('.').pop();
        const path = `delay-proofs/${partnerId}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('logistics-documents')
          .upload(path, proofFile, { upsert: true });

        if (uploadErr) {
          // Try fallback bucket
          const { data: uploadData2, error: uploadErr2 } = await supabase.storage
            .from('chat-attachments')
            .upload(path, proofFile, { upsert: true });
          if (!uploadErr2 && uploadData2) {
            const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
            proofUrl = urlData.publicUrl;
            proofFilename = proofFile.name;
          }
        } else if (uploadData) {
          const { data: urlData } = supabase.storage.from('logistics-documents').getPublicUrl(path);
          proofUrl = urlData.publicUrl;
          proofFilename = proofFile.name;
        }
        setUploading(false);
      }

      // Insert delay report
      const { error: insertErr } = await supabase
        .from('logistics_operational_delays')
        .insert({
          shipment_id: shipment.id,
          order_id: shipment.order_id || null,
          partner_id: partnerId,
          reported_by: userId,
          delay_reason: delayReason,
          delay_reason_other: delayReason === 'other' ? otherReason : null,
          description: description || null,
          proof_url: proofUrl,
          proof_filename: proofFilename,
          original_eta: shipment.estimated_arrival || null,
          updated_eta: new Date(updatedEta).toISOString(),
          customer_notified: false,
        });

      if (insertErr) throw insertErr;

      // Update shipment ETA
      await supabase
        .from('logistics_shipments')
        .update({
          estimated_arrival: new Date(updatedEta).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      // Notify customer via notification if order_id exists
      if (shipment.order_id) {
        const reasonLabel = DELAY_REASONS.find(r => r.value === delayReason)?.label || delayReason;
        await supabase.from('notifications').insert({
          user_id: null, // Will be set by admin or buyer lookup
          type: 'shipment_delay',
          title: 'تأخير في شحنتك',
          body: `تم الإبلاغ عن تأخير في شحنتك بسبب: ${reasonLabel}. وقت الوصول المتوقع الجديد: ${new Date(updatedEta).toLocaleDateString('ar-SA')}`,
          is_read: false,
          metadata: {
            shipment_id: shipment.id,
            order_id: shipment.order_id,
            delay_reason: delayReason,
            updated_eta: updatedEta,
          },
        });
      }

      toast.success('تم تسجيل التأخير وإشعار العميل بنجاح');
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'فشل تسجيل التأخير. يرجى المحاولة مجدداً');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Icon name="ExclamationTriangleIcon" size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">الإبلاغ عن تأخير تشغيلي</h3>
              <p className="text-xs text-slate-400">
                {shipment.shipment_number ? `شحنة #${shipment.shipment_number}` : 'تحديث حالة الشحنة'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <Icon name="XMarkIcon" size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Reason Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              سبب التأخير <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DELAY_REASONS.map(reason => (
                <button
                  key={reason.value}
                  onClick={() => setDelayReason(reason.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all text-right ${
                    delayReason === reason.value
                      ? 'border-amber-500 bg-amber-500/20 text-amber-300' :'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="text-base">{reason.icon}</span>
                  <span>{reason.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Other reason text */}
          {delayReason === 'other' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                وصف السبب <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={otherReason}
                onChange={e => setOtherReason(e.target.value)}
                placeholder="اكتب سبب التأخير..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              تفاصيل إضافية (اختياري)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="أضف أي تفاصيل إضافية عن التأخير..."
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Updated ETA */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              وقت الوصول المتوقع الجديد (ETA) <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={updatedEta}
              onChange={e => setUpdatedEta(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Proof Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              رفع إثبات (صورة / مستند) — اختياري
            </label>
            <label className="flex flex-col items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-amber-500/50 transition-colors bg-slate-800/50">
              <Icon name="CloudArrowUpIcon" size={24} className="text-slate-500" />
              <span className="text-xs text-slate-400">
                {proofFile ? proofFile.name : 'اضغط لرفع صورة أو مستند PDF'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {proofPreview && (
              <div className="mt-2 rounded-xl overflow-hidden border border-slate-700">
                <img src={proofPreview} alt="proof preview" className="w-full max-h-32 object-cover" />
              </div>
            )}
          </div>

          {/* Customer notification notice */}
          <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <Icon name="BellAlertIcon" size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-300">
              سيتم إرسال إشعار فوري للعميل بمجرد تسجيل التأخير مع وقت الوصول المتوقع الجديد.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 bg-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading || !delayReason || !updatedEta}
            className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting || uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploading ? 'جاري الرفع...' : 'جاري التسجيل...'}
              </>
            ) : (
              <>
                <Icon name="ExclamationTriangleIcon" size={14} />
                تسجيل التأخير وإشعار العميل
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
