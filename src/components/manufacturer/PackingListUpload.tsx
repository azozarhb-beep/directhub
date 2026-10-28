'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'packing_lists';
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = ['pdf', 'xls', 'xlsx', 'csv'];
const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

interface PackingListUploadProps {
  shipmentId: string;
}

interface StoredPackingList {
  path: string;
  name: string;
}

export default function PackingListUpload({ shipmentId }: PackingListUploadProps) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState<StoredPackingList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('international_shipments')
      .select('packing_list_url, packing_list_name')
      .eq('id', shipmentId)
      .maybeSingle();
    const row = data as { packing_list_url?: string | null; packing_list_name?: string | null } | null;
    if (row?.packing_list_url) {
      setCurrent({ path: row.packing_list_url, name: row.packing_list_name || 'packing-list' });
    } else {
      setCurrent(null);
    }
  }, [supabase, shipmentId]);

  useEffect(() => {
    setMessage(null);
    load();
  }, [load]);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setMessage(null);
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext) && !ALLOWED_MIME.includes(file.type)) {
      setMessage({ type: 'err', text: 'الصيغ المسموحة: PDF أو Excel (xls / xlsx / csv)' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ type: 'err', text: 'حجم الملف يتجاوز 25 ميغابايت' });
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error('يجب تسجيل الدخول لرفع الملف');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${uid}/${shipmentId}/packing-list-${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from('international_shipments')
        .update({ packing_list_url: path, packing_list_name: file.name })
        .eq('id', shipmentId);
      if (dbErr) throw dbErr;
      setCurrent({ path, name: file.name });
      setMessage({ type: 'ok', text: 'تم رفع قائمة التعبئة بنجاح' });
    } catch (e: any) {
      setMessage({ type: 'err', text: e?.message || 'فشل رفع قائمة التعبئة' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleOpen = async () => {
    if (!current) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(current.path, 600);
    if (error || !data?.signedUrl) {
      setMessage({ type: 'err', text: 'تعذر فتح الملف' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white">رفع قائمة التعبئة (Packing List)</h4>
        <p className="text-xs text-slate-500">PDF أو Excel · حتى 25 ميغابايت</p>
      </div>

      {current ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <p className="text-xs text-emerald-200 truncate" dir="ltr">{current.name}</p>
          <button
            type="button"
            onClick={handleOpen}
            className="shrink-0 px-2.5 py-1 rounded-md text-xs border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
          >
            فتح
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">لم يتم رفع قائمة تعبئة لهذه الشحنة بعد</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xls,.xlsx,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        className="hidden"
        aria-label="اختيار ملف قائمة التعبئة"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60"
      >
        {uploading ? 'جارٍ الرفع...' : current ? 'استبدال الملف' : 'اختيار ملف PDF / Excel'}
      </button>

      {message && (
        <p className={`text-xs ${message.type === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>
      )}
    </section>
  );
}
