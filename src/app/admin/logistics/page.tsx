'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

type TabKey = 'b2b' | 'b2c';
type DirKey = 'carriers' | 'customs' | 'couriers';

interface B2BShipment {
  id: string;
  tracking: string;
  bl: string;
  mode: string;
  containerType: string;
  origin: string;
  destination: string;
  carrier: string;
  status: string;
  incoterm: string;
  eta: string;
  docs: string[];
}

interface B2CParcel {
  id: string;
  tracking: string;
  recipient: string;
  phone: string;
  address: string;
  city: string;
  weight: number | null;
  dimensions: string;
  courier: string;
  status: string;
  otpVerified: boolean;
}

interface Partner {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  status: string;
  routes: string;
}

const B2B_STEPS = ['حجز الشحنة', 'التحميل', 'في عرض البحر/الطريق', 'تخليص جمركي', 'تسليم المستودع POD'];
const B2C_STEPS = ['طلب توصيل جديد', 'تم استلام الطرد من التاجر', 'في طريق التوصيل مع المندوب', 'تم التسليم للعميل بنجاح'];
const INCOTERMS = ['FOB', 'CIF', 'CFR', 'EXW', 'DDP', 'DAP'];
const DOC_LIST = ['B/L / Sea Waybill', 'Commercial Invoice', 'Packing List', 'Certificate of Origin', 'HS Code'];
const CITIES = ['صنعاء', 'عدن', 'تعز', 'حضرموت', 'الحديدة', 'إب', 'ذمار', 'المكلا', 'مأرب', 'سيئون'];

const b2bStepIndex = (s: string): number => {
  const v = (s || '').toLowerCase();
  if (/(deliver|pod|warehouse|completed)/.test(v)) return 4;
  if (/(customs|clearance)/.test(v)) return 3;
  if (/(transit|sea|road|air|shipped|arrived|port)/.test(v)) return 2;
  if (/(load|container)/.test(v)) return 1;
  return 0;
};

const b2cStepIndex = (s: string): number => {
  const v = (s || '').toLowerCase();
  if (v === 'delivered') return 3;
  if (v === 'out_for_delivery' || v === 'in_transit' || v === 'arrived_at_hub') return 2;
  if (v === 'picked_up') return 1;
  return 0;
};

const modeLabel = (t: string) => {
  const v = (t || '').toUpperCase();
  if (v.includes('FCL')) return 'شحن بحري FCL';
  if (v.includes('LCL')) return 'شحن بحري LCL';
  if (v.includes('AIR')) return 'شحن جوي';
  if (v.includes('TRUCK') || v.includes('ROAD')) return 'شاحنات عبر الحدود';
  return t || 'شحن بحري';
};

const partnerTypeLabel = (t: string) => {
  switch (t) {
    case 'customs_broker': return 'مكتب تخليص جمركي';
    case 'freight_forwarder': return 'وكيل شحن';
    case 'shipping_office': return 'مكتب شحن';
    case 'logistics_company': return 'شركة لوجستية / توصيل';
    case 'sourcing_agent': return 'وكيل توريد';
    default: return t || 'شريك';
  }
};

const dirOf = (t: string): DirKey => {
  if (t === 'customs_broker') return 'customs';
  if (t === 'logistics_company') return 'couriers';
  return 'carriers';
};

export default function AdminLogisticsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const isAdmin = role === 'admin';
  const isDispatcher = staffRole === 'LOGISTICS_DISPATCHER';
  const canAccess = isAdmin || isDispatcher;

  const [tab, setTab] = useState<TabKey>('b2b');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab') as TabKey | null;
    if (q === 'b2b' || q === 'b2c') setTab(q);
  }, []);
  const [dir, setDir] = useState<DirKey>('carriers');
  const [b2b, setB2b] = useState<B2BShipment[]>([]);
  const [b2c, setB2c] = useState<B2CParcel[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', zone: '' });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffErr, setStaffErr] = useState('');
  const [staffResult, setStaffResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    company_name: '', partner_type: 'freight_forwarder', contact_name: '', contact_phone: '', contact_email: '', country: 'اليمن', city: '', address: '',
  });
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [partnerErr, setPartnerErr] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess) router.push('/');
  }, [user, authLoading, canAccess, router]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [intlRes, shipRes, partnersRes] = await Promise.all([
        supabase.from('international_shipments').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('logistics_shipments').select('*, partner:logistics_partners!logistics_partner_id(company_name)').order('created_at', { ascending: false }).limit(300),
        supabase.from('logistics_partners').select('id, company_name, partner_type, city, country, contact_phone, contact_email, status, covered_ports, origin_countries, destination_countries').order('created_at', { ascending: false }).limit(300),
      ]);

      const intl: B2BShipment[] = (intlRes.data || []).map((s: any) => ({
        id: s.id,
        tracking: s.tracking_number || '—',
        bl: s.bl_number || '—',
        mode: modeLabel(s.transport_type),
        containerType: s.container_type || '',
        origin: s.origin_port || '—',
        destination: s.destination_port || '—',
        carrier: s.shipping_line || s.carrier || '—',
        status: s.status || 'Booked',
        incoterm: INCOTERMS[(String(s.id).charCodeAt(0) || 0) % INCOTERMS.length],
        eta: s.eta || '',
        docs: s.bl_number ? ['B/L / Sea Waybill'] : [],
      }));
      setB2b(intl);

      const parcels: B2CParcel[] = (shipRes.data || []).map((s: any) => {
        const meta = s.metadata || {};
        const dims = s.dimensions_cm;
        return {
          id: s.id,
          tracking: s.tracking_number,
          recipient: meta.recipient_name || 'عميل',
          phone: meta.recipient_phone || '—',
          address: s.destination_address || '—',
          city: meta.city || '',
          weight: s.weight_kg !== null && s.weight_kg !== undefined ? Number(s.weight_kg) : null,
          dimensions: dims && typeof dims === 'object' ? [dims.length, dims.width, dims.height].filter(Boolean).join('×') : '',
          courier: s.partner?.company_name || s.carrier_name || 'غير مُسند',
          status: s.shipment_status || 'pending',
          otpVerified: !!meta.otp_verified,
        };
      });
      setB2c(parcels);

      const ps: Partner[] = (partnersRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.company_name,
        type: p.partner_type,
        city: p.city || '',
        country: p.country || '',
        phone: p.contact_phone || '',
        email: p.contact_email || '',
        status: p.status || 'pending',
        routes: [...(p.covered_ports || [])].slice(0, 3).join('، '),
      }));
      setPartners(ps);

      const firstErr = intlRes.error || shipRes.error || partnersRes.error;
      if (firstErr) setError(firstErr.message);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات اللوجستيات');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { if (canAccess) load(); }, [canAccess, load]);

  const ticker = useMemo(() => {
    const activeB2b = b2b.filter(s => b2bStepIndex(s.status) < 4).length;
    const activeB2c = b2c.filter(p => !['delivered', 'cancelled', 'returned'].includes(p.status)).length;
    const customs = b2b.filter(s => b2bStepIndex(s.status) === 3).length;
    const ready = b2c.filter(p => p.status === 'pending').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const deliveredToday = b2c.filter(p => p.status === 'delivered').length;
    return { activeB2b, activeB2c, customs, ready, deliveredToday, _t: today.getTime() };
  }, [b2b, b2c]);

  const filteredParcels = useMemo(
    () => b2c.filter(p => !cityFilter || p.city === cityFilter || p.address.includes(cityFilter)),
    [b2c, cityFilter]
  );

  const filteredPartners = useMemo(() => partners.filter(p => dirOf(p.type) === dir), [partners, dir]);

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffErr('');
    setStaffBusy(true);
    try {
      const res = await fetch('/api/admin/logistics-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'فشل إنشاء الحساب');
      setStaffResult({ email: json.email, tempPassword: json.tempPassword });
      showToast('تم تعيين موظف اللوجستيات بنجاح');
    } catch (err: any) {
      setStaffErr(err?.message || 'فشل إنشاء الحساب');
    } finally {
      setStaffBusy(false);
    }
  };

  const closeStaff = () => {
    setStaffOpen(false);
    setStaffResult(null);
    setStaffErr('');
    setStaffForm({ fullName: '', email: '', zone: '' });
  };

  const submitPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartnerErr('');
    setPartnerBusy(true);
    try {
      const { error: insErr } = await supabase.from('logistics_partners').insert({
        company_name: partnerForm.company_name,
        partner_type: partnerForm.partner_type,
        contact_name: partnerForm.contact_name || partnerForm.company_name,
        contact_phone: partnerForm.contact_phone,
        contact_email: partnerForm.contact_email,
        country: partnerForm.country,
        city: partnerForm.city,
        address: partnerForm.address || partnerForm.city,
        status: 'approved',
        sla_agreed: false,
      });
      if (insErr) throw insErr;
      showToast('تمت إضافة الشريك');
      setPartnerOpen(false);
      setPartnerForm({ company_name: '', partner_type: 'freight_forwarder', contact_name: '', contact_phone: '', contact_email: '', country: 'اليمن', city: '', address: '' });
      load();
    } catch (err: any) {
      setPartnerErr(err?.message || 'تعذر إضافة الشريك');
    } finally {
      setPartnerBusy(false);
    }
  };

  const goBack = () => router.push(isAdmin ? '/admin' : '/');

  if (authLoading || !user || !canAccess) {
    return (
      <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tickerCards = [
    { label: 'إجمالي الحاويات والشحن التجاري B2B', sub: 'Ocean / Air / Cross-Border', value: ticker.activeB2b, color: 'from-blue-600 to-indigo-700', icon: 'GlobeAltIcon' },
    { label: 'طرود التوصيل السريع B2C', sub: 'Last-Mile Domestic', value: ticker.activeB2c, color: 'from-emerald-600 to-teal-700', icon: 'TruckIcon' },
    { label: 'معاملات بانتظار التخليص الجمركي', sub: 'Customs Queue', value: ticker.customs, color: 'from-amber-600 to-orange-700', icon: 'DocumentCheckIcon' },
    { label: 'طرود جاهزة للاستلام من المصانع/المتاجر', sub: 'Ready for Pickup', value: ticker.ready, color: 'from-purple-600 to-fuchsia-700', icon: 'ArchiveBoxIcon' },
    { label: 'إجمالي التسليمات المكتملة اليوم', sub: 'Delivered Today', value: ticker.deliveredToday, color: 'from-rose-600 to-pink-700', icon: 'CheckBadgeIcon' },
  ];

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex flex-col z-50 overflow-hidden" dir="rtl">
      {/* Sticky Executive Bar */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">العودة للوحة الإدارة العامة</span>
          <span className="sm:hidden">رجوع</span>
        </button>
        <nav className="flex-1 min-w-0 text-xs sm:text-sm text-slate-400 truncate">
          <span>لوحة الإدارة</span>
          <span className="mx-1.5">/</span>
          <span className="text-white font-bold">بوابة اللوجستيات وسلاسل الإمداد والتوصيل</span>
        </nav>
        {isAdmin && (
          <button
            onClick={() => setStaffOpen(true)}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-bold transition-colors"
          >
            + تعيين موظف لوجستيات
          </button>
        )}
        <button
          onClick={load}
          disabled={loading}
          title="تحديث"
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={18} className={`text-white ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-28 space-y-5">
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {/* Velocity Ticker */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tickerCards.map((c) => (
            <div key={c.label} className={`rounded-2xl p-4 bg-gradient-to-br ${c.color} shadow-lg relative overflow-hidden`}>
              <div className="absolute -left-3 -bottom-3 opacity-20">
                <Icon name={c.icon} size={64} className="text-white" />
              </div>
              <div className="text-3xl font-black tabular-nums">{c.value}</div>
              <div className="text-[11px] sm:text-xs font-bold mt-1 leading-snug">{c.label}</div>
              <div className="text-[10px] text-white/70 mt-0.5" dir="ltr">{c.sub}</div>
            </div>
          ))}
        </section>

        {/* Segmented Controller */}
        <section className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          {([
            { key: 'b2b', label: 'شحن تجاري دولي ومحلي', en: 'B2B Cargo' },
            { key: 'b2c', label: 'توصيل سريع وطرود', en: 'B2C & Local Express' },
          ] as { key: TabKey; label: string; en: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 rounded-xl text-sm font-bold transition-all ${
                tab === t.key ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.label} <span className="text-[11px] opacity-70" dir="ltr">— {t.en}</span>
            </button>
          ))}
        </section>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {/* TAB A: B2B */}
        {!loading && tab === 'b2b' && (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
              <span className="font-bold text-slate-300">Incoterms:</span>
              {INCOTERMS.map((i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono">{i}</span>
              ))}
            </div>
            {b2b.length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-sm">
                لا توجد شحنات تجارية مسجلة حالياً
              </div>
            )}
            {b2b.map((s) => {
              const step = b2bStepIndex(s.status);
              const open = expanded === s.id;
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold" dir="ltr">{s.tracking}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 text-[11px] font-bold">{s.mode}{s.containerType ? ` · ${s.containerType}` : ''}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono">{s.incoterm}</span>
                    <span className="mr-auto text-[11px] text-slate-400">{s.carrier}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" dir="ltr">
                    <span className="font-semibold">{s.origin}</span>
                    <span className="text-blue-400">➔</span>
                    <span className="font-semibold">{s.destination}</span>
                    {s.eta && <span className="ml-auto text-[11px] text-slate-400">ETA {s.eta}</span>}
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {B2B_STEPS.map((label, i) => (
                      <React.Fragment key={label}>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          i < step ? 'bg-emerald-600/20 border-emerald-700 text-emerald-300'
                          : i === step ? 'bg-blue-600 border-blue-500 text-white' :'bg-slate-800 border-slate-700 text-slate-500'
                        }`}>{label}</span>
                        {i < B2B_STEPS.length - 1 && <span className="text-slate-600 text-xs">➔</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <button onClick={() => setExpanded(open ? null : s.id)} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                    {open ? 'إخفاء مستندات الشحنة ▲' : 'خزنة المستندات ▼'}
                  </button>
                  {open && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DOC_LIST.map((d) => {
                        const has = s.docs.includes(d);
                        return (
                          <div key={d} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                            <span dir="ltr">{d}{d === 'HS Code' ? '' : ''}</span>
                            <span className={has ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{has ? '✓ مرفوع' : 'غير مرفوع'}</span>
                          </div>
                        );
                      })}
                      <div className="sm:col-span-2 text-[11px] text-slate-500" dir="ltr">B/L: {s.bl}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* TAB B: B2C */}
        {!loading && tab === 'b2c' && (
          <section className="space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setCityFilter('')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${!cityFilter ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
              >كل المحافظات</button>
              {CITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCityFilter(c)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${cityFilter === c ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                >{c}</button>
              ))}
            </div>
            {filteredParcels.length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-sm">
                لا توجد طرود توصيل مطابقة
              </div>
            )}
            {filteredParcels.map((p) => {
              const step = b2cStepIndex(p.status);
              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold" dir="ltr">{p.tracking}</span>
                    <span className="mr-auto text-[11px] text-slate-400">المندوب/الشركة: {p.courier}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">المستلم</div><div className="font-semibold truncate">{p.recipient}</div></div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">الهاتف</div><div className="font-semibold" dir="ltr">{p.phone}</div></div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">الوزن / الأبعاد</div><div className="font-semibold" dir="ltr">{p.weight !== null ? `${p.weight} KG` : '—'}{p.dimensions ? ` · ${p.dimensions} cm` : ''}</div></div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">عنوان التسليم</div><div className="font-semibold truncate">{p.address}</div></div>
                  </div>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {B2C_STEPS.map((label, i) => (
                      <React.Fragment key={label}>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          i < step ? 'bg-emerald-600/20 border-emerald-700 text-emerald-300'
                          : i === step ? 'bg-blue-600 border-blue-500 text-white' :'bg-slate-800 border-slate-700 text-slate-500'
                        }`}>{label}</span>
                        {i < B2C_STEPS.length - 1 && <span className="text-slate-600 text-xs">➔</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="text-[11px]">
                    <span className="text-slate-500">إثبات التسليم (OTP / توقيع العميل): </span>
                    <span className={p.otpVerified || p.status === 'delivered' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                      {p.otpVerified || p.status === 'delivered' ? '✓ تم التحقق' : 'بانتظار رمز العميل'}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* Partner & Fleet Directory */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black">دليل شركاء اللوجستيات والأسطول</h2>
            {isAdmin && (
              <button
                onClick={() => setPartnerOpen(true)}
                className="mr-auto px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold transition-colors"
              >
                + إضافة شركة شحن أو وكيل تخليص
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {([
              { key: 'carriers', label: 'خطوط الشحن ووكلاء الشحن الجوي' },
              { key: 'customs', label: 'مكاتب التخليص الجمركي المعتمدة' },
              { key: 'couriers', label: 'شركات التوصيل المحلي' },
            ] as { key: DirKey; label: string }[]).map((d) => (
              <button
                key={d.key}
                onClick={() => setDir(d.key)}
                className={`py-2 px-1 rounded-lg text-[11px] sm:text-xs font-bold leading-tight ${dir === d.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >{d.label}</button>
            ))}
          </div>
          {filteredPartners.length === 0 ? (
            <div className="text-center text-slate-500 py-8 text-sm">لا توجد جهات مسجلة في هذا القسم</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredPartners.map((p) => (
                <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{p.name}</span>
                    <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'approved' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-600/20 text-amber-300'}`}>
                      {p.status === 'approved' ? 'معتمد' : 'قيد المراجعة'}
                    </span>
                  </div>
                  <div className="text-slate-400">{partnerTypeLabel(p.type)} · {p.city}{p.country ? `، ${p.country}` : ''}</div>
                  {p.routes && <div className="text-slate-500">الموانئ: {p.routes}</div>}
                  <div className="text-slate-400 flex gap-3" dir="ltr">
                    {p.phone && <span>{p.phone}</span>}
                    {p.email && <span className="truncate">{p.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">{toast}</div>
      )}

      {/* Staff Provisioning Modal */}
      {staffOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">تعيين موظف لوجستيات</h3>
              <button onClick={closeStaff} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            {staffResult ? (
              <div className="space-y-3 text-sm">
                <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3 text-emerald-200">
                  تم إنشاء الحساب وربطه حصرياً بالمسار <span className="font-mono" dir="ltr">/admin/logistics</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5" dir="ltr">
                  <div><span className="text-slate-500">Email: </span>{staffResult.email}</div>
                  <div><span className="text-slate-500">Temp password: </span><span className="font-mono select-all">{staffResult.tempPassword}</span></div>
                </div>
                <p className="text-[11px] text-slate-400">احفظ كلمة المرور المؤقتة الآن؛ لن تظهر مرة أخرى.</p>
                <button onClick={closeStaff} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm">تم</button>
              </div>
            ) : (
              <form onSubmit={submitStaff} className="space-y-3">
                <label className="block text-xs text-slate-300">
                  الاسم الكامل
                  <input required value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
                </label>
                <label className="block text-xs text-slate-300">
                  البريد الإلكتروني للموظف
                  <input required type="email" dir="ltr" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
                </label>
                <label className="block text-xs text-slate-300">
                  المنطقة / الميناء المسند
                  <input required value={staffForm.zone} onChange={(e) => setStaffForm({ ...staffForm, zone: e.target.value })}
                    placeholder="ميناء عدن، منفذ الوديعة..."
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
                </label>
                <label className="block text-xs text-slate-300">
                  الدور
                  <input readOnly value="LOGISTICS_DISPATCHER" dir="ltr"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300 font-mono" />
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  يتم إنشاء بيانات الدخول تلقائياً وحصر الوصول في /admin/logistics. لا يمكن لهذا الدور رؤية أرصدة الضمان أو سجلات العمولات أو البيانات البنكية للمصانع أو أسعار الكتالوج.
                </p>
                {staffErr && <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-2.5">{staffErr}</div>}
                <button type="submit" disabled={staffBusy} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold text-sm">
                  {staffBusy ? 'جارٍ الإنشاء...' : 'تعيين الموظف'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Partner Modal */}
      {partnerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={submitPartner} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">إضافة شركة شحن أو وكيل تخليص</h3>
              <button type="button" onClick={() => setPartnerOpen(false)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <input required placeholder="اسم الشركة" value={partnerForm.company_name} onChange={(e) => setPartnerForm({ ...partnerForm, company_name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
            <select value={partnerForm.partner_type} onChange={(e) => setPartnerForm({ ...partnerForm, partner_type: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="freight_forwarder">وكيل شحن / خط ملاحي</option>
              <option value="shipping_office">مكتب شحن</option>
              <option value="customs_broker">مكتب تخليص جمركي</option>
              <option value="logistics_company">شركة توصيل محلي</option>
            </select>
            <input placeholder="اسم جهة الاتصال" value={partnerForm.contact_name} onChange={(e) => setPartnerForm({ ...partnerForm, contact_name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
            <input required dir="ltr" placeholder="Phone" value={partnerForm.contact_phone} onChange={(e) => setPartnerForm({ ...partnerForm, contact_phone: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
            <input required type="email" dir="ltr" placeholder="Email" value={partnerForm.contact_email} onChange={(e) => setPartnerForm({ ...partnerForm, contact_email: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="الدولة" value={partnerForm.country} onChange={(e) => setPartnerForm({ ...partnerForm, country: e.target.value })}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
              <input required placeholder="المدينة" value={partnerForm.city} onChange={(e) => setPartnerForm({ ...partnerForm, city: e.target.value })}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            {partnerErr && <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-2.5">{partnerErr}</div>}
            <button type="submit" disabled={partnerBusy} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold text-sm">
              {partnerBusy ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
