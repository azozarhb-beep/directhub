'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';


type VehicleType = 'تريلا' | 'دينا' | 'مخلص جمركي';
type Currency = 'USD' | 'SAR' | 'YER';
type DeliveryMode = 'retail' | 'commercial';

interface ActiveTask {
  trackingId: string;
  cargoType: string;
  containerNo: string | null;
  sealNo: string | null;
  originName: string;
  originAddress: string;
  destinationName: string;
  destinationAddress: string;
  receiverName: string;
  receiverPhone: string;
  mode: DeliveryMode;
}

interface AvailableTask {
  id: string;
  vehicle: VehicleType;
  cargoType: string;
  pickup: string;
  dropoff: string;
  deadline: string;
  payout: number;
  currency: Currency;
}

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  SAR: 'ر.س',
  YER: 'ر.ي',
};

const CURRENCY_RATE_TO_USD: Record<Currency, number> = {
  USD: 1,
  SAR: 3.75,
  YER: 250,
};

const AGENT = {
  name: 'محمد عبدالله الحداد',
  vehicle: 'تريلا' as VehicleType,
  plate: 'صنعاء 48213',
};

const INITIAL_ACTIVE_TASK: ActiveTask = {
  trackingId: 'TRK-2026-4812',
  cargoType: 'حديد تسليح - 24 طن',
  containerNo: 'MSKU 7731946',
  sealNo: 'SL-902381',
  originName: 'مصنع الأمل للحديد والصلب',
  originAddress: 'المنطقة الصناعية، الحديدة، اليمن',
  destinationName: 'مستودع النور للمقاولات',
  destinationAddress: 'شارع الستين الجنوبي، صنعاء',
  receiverName: 'م. خالد المقطري',
  receiverPhone: '+967 771 234 567',
  mode: 'commercial',
};

const AVAILABLE_TASKS: AvailableTask[] = [
  {
    id: 'TRK-2026-4820',
    vehicle: 'تريلا',
    cargoType: 'حاويات 40 قدم - مواد بناء',
    pickup: 'ميناء الحديدة - رصيف 3',
    dropoff: 'صنعاء - المنطقة الصناعية',
    deadline: 'خلال 18 ساعة',
    payout: 450,
    currency: 'USD',
  },
  {
    id: 'TRK-2026-4826',
    vehicle: 'تريلا',
    cargoType: 'ألواح ألمنيوم - 20 طن',
    pickup: 'مصنع اليمن للألمنيوم - عدن',
    dropoff: 'تعز - سوق الجملة',
    deadline: 'غداً 6:00 م',
    payout: 1650,
    currency: 'SAR',
  },
  {
    id: 'TRK-2026-4831',
    vehicle: 'دينا',
    cargoType: 'مواد غذائية مبردة',
    pickup: 'مصنع الريان - صنعاء',
    dropoff: 'إب - مراكز التوزيع',
    deadline: 'اليوم 9:00 م',
    payout: 210,
    currency: 'USD',
  },
  {
    id: 'TRK-2026-4835',
    vehicle: 'مخلص جمركي',
    cargoType: 'تخليص شحنة قطع غيار',
    pickup: 'جمرك ميناء عدن',
    dropoff: 'مكتب التخليص - عدن',
    deadline: 'خلال 36 ساعة',
    payout: 95000,
    currency: 'YER',
  },
];

const EARNINGS: Record<Currency, { released: number; pending: number }> = {
  USD: { released: 320, pending: 450 },
  SAR: { released: 1200, pending: 1690 },
  YER: { released: 80000, pending: 112500 },
};

const TOTAL_TRIPS = 147;

function formatAmount(value: number, currency: Currency): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
  return currency === 'USD' ? `$${formatted}` : `${formatted} ${CURRENCY_SYMBOL[currency]}`;
}

function formatAmountUSD(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

interface DeliveryModalProps {
  task: ActiveTask;
  onClose: () => void;
  onComplete: () => void;
}

function DeliveryProofModal({ task, onClose, onComplete }: DeliveryModalProps) {
  const [pin, setPin] = useState<string>('');
  const [sealIntact, setSealIntact] = useState<boolean>(true);
  const [podFileName, setPodFileName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isRetail = task.mode === 'retail';
  const canSubmit = isRetail ? pin.length === 6 : Boolean(podFileName) && sealIntact;

  const pressKey = (key: string) => {
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    setPin((prev) => (prev.length < 6 ? prev + key : prev));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      toast.success('تم تأكيد التسليم وفك الضمان بنجاح');
      onComplete();
    }, 700);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">إثبات التسليم وفك الضمان</h2>
            <p className="text-xs text-gray-500 mt-0.5">{task.trackingId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {isRetail ? (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">رمز التسليم للمستلم (6 أرقام)</p>
              <p className="text-xs text-gray-500 mb-4">
                اطلب من العميل رمز PIN المرسل إليه ثم أدخله لفك الضمان المالي.
              </p>
              <div className="flex justify-center gap-2 mb-5" dir="ltr">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${
                      pin[i] ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-300'
                    }`}
                  >
                    {pin[i] ? '●' : ''}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2" dir="ltr">
                {keys.map((k, i) =>
                  k === '' ? (
                    <div key={i} />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pressKey(k)}
                      className="h-14 rounded-2xl bg-gray-100 text-xl font-bold text-gray-800 active:bg-gray-200 hover:bg-gray-200"
                      aria-label={k === 'del' ? 'حذف' : k}
                    >
                      {k === 'del' ? '⌫' : k}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">إثبات التسليم (POD)</p>
                <p className="text-xs text-gray-500 mb-3">
                  صوّر سند الاستلام الموقّع أو ارفع مستنداً رسمياً من المستلم.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-indigo-300 bg-indigo-50 rounded-2xl py-5 cursor-pointer hover:bg-indigo-100">
                    <span className="text-2xl">📷</span>
                    <span className="text-xs font-semibold text-indigo-700">التقاط صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => setPodFileName(e.target.files?.[0]?.name ?? '')}
                    />
                  </label>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-sky-300 bg-sky-50 rounded-2xl py-5 cursor-pointer hover:bg-sky-100">
                    <span className="text-2xl">📄</span>
                    <span className="text-xs font-semibold text-sky-700">رفع مستند</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setPodFileName(e.target.files?.[0]?.name ?? '')}
                    />
                  </label>
                </div>
                {podFileName && (
                  <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 truncate">
                    ✓ تم إرفاق: {podFileName}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">سلامة ختم الحاوية</p>
                  <p className="text-xs text-gray-500 truncate">
                    ختم رقم {task.sealNo ?? '—'} {sealIntact ? 'سليم وغير مفتوح' : 'تالف / مفتوح'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sealIntact}
                  onClick={() => setSealIntact((v) => !v)}
                  className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
                    sealIntact ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                      sealIntact ? 'right-1' : 'right-7'
                    }`}
                  />
                </button>
              </div>

              {!sealIntact && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  ⚠️ لا يمكن فك الضمان مع ختم تالف. أبلغ عن الحالة من زر "إبلاغ عن طارئ / تأخير".
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-sm disabled:bg-gray-300 disabled:text-gray-500 hover:bg-emerald-700 transition-colors"
          >
            {submitting ? 'جارٍ التأكيد...' : 'تأكيد التسليم وفك الضمان'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FieldAgentDashboardPage() {
  const [available, setAvailable] = useState<boolean>(true);
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(INITIAL_ACTIVE_TASK);
  const [tasks, setTasks] = useState<AvailableTask[]>(AVAILABLE_TASKS);
  const [showDelivery, setShowDelivery] = useState<boolean>(false);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [completedTrips, setCompletedTrips] = useState<number>(TOTAL_TRIPS);

  const matchingTasks = useMemo(
    () => tasks.filter((t) => t.vehicle === AGENT.vehicle),
    [tasks]
  );

  const earnings = useMemo(() => EARNINGS[currency], [currency]);

  const handleNavigate = () => {
    if (!activeTask) return;
    const q = encodeURIComponent(`${activeTask.originName} ${activeTask.originAddress}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank', 'noopener,noreferrer');
  };

  const handleAccept = (task: AvailableTask) => {
    if (!available) {
      toast.error('فعّل حالة "متاح للتحميل والمهام" أولاً');
      return;
    }
    if (activeTask) {
      toast.error('أنهِ مهمتك النشطة الحالية قبل قبول شحنة جديدة');
      return;
    }
    setActiveTask({
      trackingId: task.id,
      cargoType: task.cargoType,
      containerNo: null,
      sealNo: null,
      originName: task.pickup,
      originAddress: task.pickup,
      destinationName: task.dropoff,
      destinationAddress: task.dropoff,
      receiverName: 'جهة الاستلام',
      receiverPhone: '+967 700 000 000',
      mode: 'retail',
    });
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    toast.success(`تم قبول الشحنة ${task.id}`);
  };

  const handleDeliveryComplete = () => {
    setShowDelivery(false);
    setActiveTask(null);
    setCompletedTrips((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-xl mx-auto px-4 pt-3 pb-3 space-y-3">
          <Link
            href="/logistics"
            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            <span>← رجوع للوحة العمليات اللوجستية</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
              {AGENT.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{AGENT.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5">
                  🚛 {AGENT.vehicle}
                </span>
                <span className="text-[11px] text-gray-500">{AGENT.plate}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={available}
            onClick={() => {
              setAvailable((v) => !v);
              toast(available ? 'تم تحويل حالتك إلى: في استراحة' : 'أنت الآن متاح للتحميل والمهام');
            }}
            className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
              available ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-100 border-gray-300'
            }`}
          >
            <span className={`text-sm font-bold ${available ? 'text-emerald-800' : 'text-gray-600'}`}>
              {available ? '🟢 متاح للتحميل والمهام' : '⚪ في استراحة / غير متاح'}
            </span>
            <span
              className={`relative w-12 h-7 rounded-full transition-colors ${
                available ? 'bg-emerald-500' : 'bg-gray-400'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  available ? 'right-1' : 'right-6'
                }`}
              />
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-6">
        {/* Active Task */}
        <section aria-labelledby="active-task-title">
          <h2 id="active-task-title" className="text-base font-bold text-gray-900 mb-3">
            المهمة النشطة الحالية
          </h2>

          {activeTask ? (
            <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-l from-indigo-600 to-violet-600 text-white px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold" dir="ltr">{activeTask.trackingId}</span>
                <span className="text-[11px] font-semibold bg-white/20 rounded-full px-2.5 py-1">
                  {activeTask.mode === 'retail' ? 'تجزئة · PIN' : 'شحن تجاري · POD'}
                </span>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500">نوع الحمولة</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{activeTask.cargoType}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-500">الحاوية / الختم</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5" dir="ltr">
                      {activeTask.containerNo ? `${activeTask.containerNo} · ${activeTask.sealNo}` : '—'}
                    </p>
                  </div>
                </div>

                <div className="relative pr-6 space-y-4">
                  <span className="absolute right-[7px] top-3 bottom-3 w-0.5 bg-gray-200" aria-hidden="true" />
                  <div className="relative">
                    <span className="absolute -right-6 top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow" />
                    <p className="text-[11px] text-gray-500">المصدر / المصنع</p>
                    <p className="text-sm font-bold text-gray-900">{activeTask.originName}</p>
                    <p className="text-xs text-gray-600">{activeTask.originAddress}</p>
                    <button
                      type="button"
                      onClick={handleNavigate}
                      className="mt-2 inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold rounded-full px-4 py-2 hover:bg-blue-700"
                    >
                      📍 ملاحة GPS
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute -right-6 top-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow" />
                    <p className="text-[11px] text-gray-500">الوجهة / المستلم</p>
                    <p className="text-sm font-bold text-gray-900">{activeTask.destinationName}</p>
                    <p className="text-xs text-gray-600">{activeTask.destinationAddress}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{activeTask.receiverName}</p>
                        <p className="text-xs text-gray-500" dir="ltr">{activeTask.receiverPhone}</p>
                      </div>
                      <a
                        href={`tel:${activeTask.receiverPhone.replace(/\s/g, '')}`}
                        className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full px-3 py-1.5 hover:bg-emerald-200"
                      >
                        📞 اتصال
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Link
                    href={`/logistics/coordination?id=${encodeURIComponent(activeTask.trackingId)}`}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-bold rounded-2xl py-3.5 hover:bg-indigo-700"
                  >
                    💬 غرفة التنسيق المباشر
                  </Link>
                  <Link
                    href="/logistics/delays"
                    className="flex items-center justify-center gap-2 bg-amber-50 text-amber-800 border border-amber-300 text-sm font-bold rounded-2xl py-3.5 hover:bg-amber-100"
                  >
                    ⚠️ إبلاغ عن طارئ / تأخير
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowDelivery(true)}
                    className="flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-bold rounded-2xl py-3.5 hover:bg-emerald-700"
                  >
                    ✅ إثبات التسليم وفك الضمان
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-3xl mb-2">🚚</p>
              <p className="text-sm font-semibold text-gray-700">لا توجد مهمة نشطة حالياً</p>
              <p className="text-xs text-gray-500 mt-1">اقبل شحنة من قائمة المهام الجاهزة أدناه.</p>
            </div>
          )}
        </section>

        {/* Available Tasks */}
        <section aria-labelledby="available-title">
          <div className="flex items-center justify-between mb-3">
            <h2 id="available-title" className="text-base font-bold text-gray-900">
              مهام جاهزة للاستلام
            </h2>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-1">
              مطابقة لـ {AGENT.vehicle}
            </span>
          </div>

          {!available && (
            <p className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 mb-3">
              أنت في وضع الاستراحة — فعّل حالة التوفر لقبول مهام جديدة.
            </p>
          )}

          <div className="space-y-3">
            {matchingTasks.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-sm text-gray-500">
                لا توجد مهام مطابقة لمركبتك حالياً.
              </div>
            )}
            {matchingTasks.map((task) => (
              <article key={task.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500" dir="ltr">{task.id}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{task.cargoType}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-full px-2.5 py-1 text-center leading-tight">
                    🔒 {formatAmount(task.payout, task.currency)} {task.currency} محجوزة في الضمان
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-gray-700">
                  <p>📦 الاستلام: <span className="font-semibold">{task.pickup}</span></p>
                  <p>🏁 التسليم: <span className="font-semibold">{task.dropoff}</span></p>
                  <p>⏰ الموعد النهائي: <span className="font-semibold text-rose-700">{task.deadline}</span></p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAccept(task)}
                  disabled={!available}
                  className="mt-4 w-full bg-indigo-600 text-white text-sm font-bold rounded-xl py-3 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500"
                >
                  قبول الشحنة
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Earnings Bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-slate-900 text-white border-t border-slate-700 shadow-2xl" dir="rtl">
        <div className="max-w-xl mx-auto px-4 pt-2.5 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-200">أرباح الرحلات الميدانية</p>
            <div className="flex items-center gap-1 bg-slate-800 rounded-full p-0.5" role="tablist" aria-label="العملة">
              {(['USD', 'SAR', 'YER'] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  aria-selected={currency === c}
                  onClick={() => setCurrency(c)}
                  className={`text-[11px] font-bold rounded-full px-2.5 py-1 transition-colors ${
                    currency === c ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800 rounded-xl px-2.5 py-2">
              <p className="text-[10px] text-slate-400">أرباح اليوم المحررة</p>
              <p className="text-sm font-bold text-emerald-400 mt-0.5">{formatAmount(earnings.released, currency)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl px-2.5 py-2">
              <p className="text-[10px] text-slate-400">معلق في الضمان</p>
              <p className="text-sm font-bold text-amber-400 mt-0.5">{formatAmount(earnings.pending, currency)}</p>
            </div>
            <div className="bg-slate-800 rounded-xl px-2.5 py-2">
              <p className="text-[10px] text-slate-400">إجمالي الرحلات المنجزة</p>
              <p className="text-sm font-bold text-white mt-0.5">{completedTrips}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 text-center">
            ≈ ${formatAmountUSD(earnings.released / CURRENCY_RATE_TO_USD[currency])} محررة اليوم بالدولار
          </p>
        </div>
      </div>

      {showDelivery && activeTask && (
        <DeliveryProofModal
          task={activeTask}
          onClose={() => setShowDelivery(false)}
          onComplete={handleDeliveryComplete}
        />
      )}
    </div>
  );
}
