'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogisticsShipment {
  id: string;
  order_id?: string | null;
  tracking_number?: string | null;
  bl_number?: string | null;
  shipment_status?: string;
  estimated_delivery?: string | null;
}

interface DelayReportFormProps {
  shipment: LogisticsShipment;
  partnerId: string;
  userId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

// `dbValue` maps to the existing delay_reason_type enum in the database.
const DELAY_REASONS = [
  { value: 'customs',  dbValue: 'customs',         label: 'إجراءات وتفتيش جمركي',                     labelEn: 'Customs Clearance & Inspection' },
  { value: 'port',     dbValue: 'port_congestion', label: 'ازدحام في الميناء / المطار / المنفذ',       labelEn: 'Port / Airport / Border Congestion' },
  { value: 'vehicle',  dbValue: 'mechanical',      label: 'عطل فني أو ميكانيكي لمركبة النقل',          labelEn: 'Vehicle / Fleet Breakdown' },
  { value: 'weather',  dbValue: 'weather',         label: 'ظروف مناخية وطرق طارئة',                    labelEn: 'Weather & Route Conditions' },
  { value: 'factory',  dbValue: 'checkpoint',      label: 'تأخر تصاريح أو جاهزية المصنع للتحميل',      labelEn: 'Factory Gate & Loading Delays' },
  { value: 'other',    dbValue: 'other',           label: 'سبب تشغيلي آخر',                            labelEn: 'Other Operational Reason' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LogisticsDelayReportModal({
  shipment,
  partnerId,
  userId,
  onClose,
  onSubmitted,
}: DelayReportFormProps) {
  const supabase = createClient();

  const [delayReason, setDelayReason] = useState('');
  const [description, setDescription] = useState('');
  const [updatedEta, setUpdatedEta] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !!shipment?.id && !!delayReason && !!updatedEta && !submitting && !uploading;

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

    const reasonItem = DELAY_REASONS.find(r => r.value === delayReason);
    if (!reasonItem) return;

    setSubmitting(true);
    let proofUrl: string | null = null;
    let proofFilename: string | null = null;

    try {
      if (proofFile) {
        setUploading(true);
        const ext = proofFile.name.split('.').pop() || 'bin';
        const path = `${partnerId}/delay-proofs/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('logistics-documents')
          .upload(path, proofFile, { upsert: true });

        if (uploadErr) {
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

      const { error: insertErr } = await supabase
        .from('logistics_operational_delays')
        .insert({
          shipment_id: shipment.id,
          order_id: shipment.order_id || null,
          partner_id: partnerId,
          reported_by: userId,
          delay_reason: reasonItem.dbValue,
          delay_reason_other: reasonItem.dbValue === 'other' || reasonItem.value === 'factory' ? reasonItem.label : null,
          description: description || null,
          proof_url: proofUrl,
          proof_filename: proofFilename,
          original_eta: shipment.estimated_delivery || null,
          updated_eta: new Date(updatedEta).toISOString(),
          customer_notified: false,
        });

      if (insertErr) throw insertErr;

      await supabase
        .from('logistics_shipments')
        .update({
          estimated_delivery: new Date(updatedEta).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.id);

      if (shipment.order_id) {
        await supabase.from('notifications').insert({
          user_id: null,
          type: 'shipment_delay',
          title: 'تأخير في شحنتك',
          body: `تم الإبلاغ عن تأخير في شحنتك بسبب: ${reasonItem.label}. وقت الوصول المتوقع الجديد: ${new Date(updatedEta).toLocaleDateString('ar-SA')}`,
          is_read: false,
          metadata: {
            shipment_id: shipment.id,
            order_id: shipment.order_id,
            delay_reason: reasonItem.dbValue,
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
    <div className="space-y-4 pt-1">
      {/* New ETA */}
      <div>
        <label className="block text-xs font-semibold text-slate-200 mb-1.5">
          تاريخ ووقت الوصول المتوقع الجديد (New ETA) <span className="text-red-400">*</span>
        </label>
        <input
          type="datetime-local"
          value={updatedEta}
          onChange={e => setUpdatedEta(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Reason dropdown */}
      <div>
        <label className="block text-xs font-semibold text-slate-200 mb-1.5">
          سبب التأخير <span className="text-red-400">*</span>
        </label>
        <select
          value={delayReason}
          onChange={e => setDelayReason(e.target.value)}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="">— اختر سبب التأخير —</option>
          {DELAY_REASONS.map(reason => (
            <option key={reason.value} value={reason.value}>
              {reason.label} ({reason.labelEn})
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-slate-200 mb-1.5">
          تفاصيل وملاحظات التأخير
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="أضف أي تفاصيل إضافية عن التأخير..."
          rows={3}
          className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      {/* Proof upload */}
      <div>
        <label className="block text-xs font-semibold text-slate-200 mb-1.5">
          إرفاق مستند أو صورة إثبات - اختياري
        </label>
        <label className="flex flex-col items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-amber-500/60 transition-colors bg-slate-800/50">
          <Icon name="CloudArrowUpIcon" size={24} className="text-slate-400" />
          <span className="text-xs text-slate-300 text-center">
            {proofFile ? proofFile.name : 'إشعار ميناء رسمي، إيصال ورشة، أو مذكرة تأخير تخليص (صورة / PDF)'}
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
            <img src={proofPreview} alt="معاينة مستند إثبات التأخير" className="w-full max-h-32 object-cover" />
          </div>
        )}
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
          canSubmit
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/60'
            : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'
        }`}
      >
        {submitting || uploading ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {uploading ? 'جاري الرفع...' : 'جاري التسجيل...'}
          </>
        ) : (
          <>
            <Icon name="ExclamationTriangleIcon" size={16} />
            تحديث ETA وإشعار العميل بالتأخير
          </>
        )}
      </button>
    </div>
  );
}
