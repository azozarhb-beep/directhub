'use client';

import React, { useEffect, useRef, useState } from 'react';

interface DemoPSIModalProps {
  open: boolean;
  onClose: () => void;
}

interface DemoPhoto {
  id: string;
  url: string;
  name: string;
}

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;

const CHECKS: { key: 'packaging' | 'dates' | 'weight'; label: string }[] = [
  { key: 'packaging', label: 'فحص سلامة التغليف الخارجي والبليتات' },
  { key: 'dates', label: 'مطابقة تواريخ الإنتاج والصلاحية' },
  { key: 'weight', label: 'التحقق من الوزن والكمية الإجمالية' },
];

const DemoPSIModal: React.FC<DemoPSIModalProps> = ({ open, onClose }) => {
  const [checks, setChecks] = useState({ packaging: false, dates: false, weight: false });
  const [photos, setPhotos] = useState<DemoPhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<'passed' | 'failed' | null>(null);
  const [error, setError] = useState('');
  const photosRef = useRef<DemoPhoto[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const allChecked = checks.packaging && checks.dates && checks.weight;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    if (incoming.length > room) {
      setError(`الحد الأقصى ${MAX_PHOTOS} صور للمعاينة`);
    } else {
      setError('');
    }
    const added = incoming.slice(0, Math.max(room, 0)).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(f),
      name: f.name,
    }));
    setPhotos((prev) => [...prev, ...added]);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  const approve = () => {
    if (!allChecked) {
      setError('يجب تأكيد جميع بنود قائمة الفحص قبل الاعتماد');
      return;
    }
    if (photos.length < MIN_PHOTOS) {
      setError(`ارفع ${MIN_PHOTOS - photos.length} صورة إضافية على الأقل (من ${MIN_PHOTOS} إلى ${MAX_PHOTOS} صور)`);
      return;
    }
    setError('');
    setResult('passed');
  };

  const reject = () => {
    if (!notes.trim()) {
      setError('يرجى كتابة ملاحظة توضح سبب الرفض');
      return;
    }
    setError('');
    setResult('failed');
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setChecks({ packaging: false, dates: false, weight: false });
    setNotes('');
    setResult(null);
    setError('');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="معاينة بطاقة طلب تجريبية"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border">
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">🧪 معاينة طلب تجريبية (Demo Order)</p>
            <p className="text-[11px] text-muted-foreground">محاكاة لسير عمل التفتيش الميداني — لا يتم حفظ أي بيانات</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-8 h-8 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/70 flex items-center justify-center text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-xl p-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">أمر شراء</p>
              <p className="text-xs font-bold text-foreground" dir="ltr" style={{ textAlign: 'right' }}>PO-9842</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">المنشأة</p>
              <p className="text-xs font-bold text-foreground">مصنع الوفاء لصابون تجريبي</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">المنتج</p>
              <p className="text-xs font-bold text-foreground">صابون غسيل عبوة 5 كجم</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">الكمية</p>
              <p className="text-xs font-bold text-foreground">500 كرتون</p>
            </div>
          </div>

          {result ? (
            <div
              className={`rounded-xl border p-4 text-center space-y-3 ${
                result === 'passed' ?'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <p className="text-sm font-bold">
                {result === 'passed' ?'🟢 تم اعتماد المطابقة وإطلاق الشحن (محاكاة)' :'🚩 تم تسجيل الملاحظة ورفض الشحنة (محاكاة)'}
              </p>
              {result === 'failed' && notes.trim() && <p className="text-xs">{notes.trim()}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-border text-xs font-bold text-foreground"
                >
                  إعادة التجربة
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">قائمة الفحص الميداني</p>
                <div className="space-y-2">
                  {CHECKS.map((c) => {
                    const on = checks[c.key];
                    return (
                      <label
                        key={c.key}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                          on
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :'bg-background border-border text-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setChecks((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                          className="w-4 h-4 accent-emerald-600 shrink-0"
                        />
                        <span className="break-words">{c.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-1.5">
                  صور إثبات المعاينة ({MIN_PHOTOS}–{MAX_PHOTOS} صور) — {photos.length} مرفوعة
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors ${
                      photos.length >= MAX_PHOTOS ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    📷 التقاط بالكاميرا
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <label
                    className={`flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors ${
                      photos.length >= MAX_PHOTOS ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    🖼️ من المعرض
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-2">
                    {photos.map((p) => (
                      <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={`صورة معاينة تجريبية: ${p.name}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePhoto(p.id)}
                          aria-label="حذف الصورة"
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">ملاحظات المفتش</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="اكتب ملاحظاتك (مطلوبة عند رفض الشحنة)..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {error && (
                <p className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-800">
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={approve}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
                >
                  <span>🟢</span>
                  <span>اعتماد المطابقة وإطلاق الشحن</span>
                </button>
                <button
                  type="button"
                  onClick={reject}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 transition-colors"
                >
                  <span>🚩</span>
                  <span>تسجيل ملاحظة / رفض الشحنة</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoPSIModal;
