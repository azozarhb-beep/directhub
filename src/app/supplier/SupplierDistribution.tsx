'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SUPPLIER_UNIT_OPTIONS, supplierUnitLabel } from './supplierUnits';

interface SupplierDistributionProps {
  userId: string;
}

interface ProfileForm {
  monthly_supply_capacity: string;
  capacity_unit: string;
  available_supply_volume: string;
  supply_category: string;
  warehouse_name: string;
  warehouse_governorate: string;
  warehouse_city: string;
  notes: string;
}

interface ChannelRow {
  id: string;
  channel_name: string;
  channel_type: string;
  coverage_area: string | null;
  coverage_governorates: string[] | null;
  delivery_time: string | null;
  monthly_volume: number;
  volume_unit: string;
  lead_time_days: number;
  status: string;
}

interface ChannelForm {
  channel_name: string;
  channel_type: string;
  coverage_governorates: string[];
  delivery_time: string;
  monthly_volume: string;
  volume_unit: string;
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

const SUPPLY_CATEGORIES: string[] = [
  'تغليف وبلاستيك',
  'مواد غذائية ومشروبات',
  'قطع غيار',
  'أدوات ومعدات',
  'مواد بناء وتشييد',
  'منظفات ومستلزمات صحية',
  'ملابس ومنسوجات',
  'أجهزة كهربائية وإلكترونيات',
  'مواد خام صناعية',
  'أدوية ومستلزمات طبية',
  'مستلزمات مكتبية وقرطاسية',
  'أخرى',
];

const YEMEN_GOVERNORATES: string[] = [
  'صنعاء',
  'عدن',
  'تعز',
  'حضرموت',
  'مأرب',
  'الحديدة',
  'إب',
  'ذمار',
  'لحج',
  'أبين',
  'شبوة',
  'المهرة',
  'سقطرى',
  'الجوف',
  'البيضاء',
  'صعدة',
  'حجة',
  'عمران',
  'المحويت',
  'ريمة',
  'الضالع',
  'أمانة العاصمة',
];

const DELIVERY_TIMES: Array<{ value: string; label: string; days: number }> = [
  { value: 'same_day', label: 'نفس اليوم', days: 1 },
  { value: 'within_48h', label: 'خلال 24-48 ساعة', days: 2 },
];

const EMPTY_PROFILE: ProfileForm = {
  monthly_supply_capacity: '',
  capacity_unit: 'carton',
  available_supply_volume: '',
  supply_category: '',
  warehouse_name: '',
  warehouse_governorate: '',
  warehouse_city: '',
  notes: '',
};

const EMPTY_CHANNEL: ChannelForm = {
  channel_name: '',
  channel_type: 'direct_fleet',
  coverage_governorates: [],
  delivery_time: 'within_48h',
  monthly_volume: '',
  volume_unit: 'carton',
};

const CHANNEL_TYPES: Array<{ value: string; label: string }> = [
  { value: 'direct_fleet', label: 'أسطول شاحنات وسيارات توزيع مباشر' },
  { value: 'agents_network', label: 'شبكة وكلاء وتجار تجزئة' },
  { value: 'shipping_offices', label: 'مكاتب وشركات شحن متعاقد معها' },
  { value: 'regional_warehouse', label: 'مستودع / فرع إقليمي' },
  { value: 'wholesale', label: 'جملة' },
  { value: 'retail', label: 'تجزئة' },
  { value: 'distributor', label: 'موزعون وتجار' },
  { value: 'import', label: 'استيراد' },
  { value: 'online', label: 'بيع إلكتروني' },
];

const NEW_CHANNEL_TYPES = CHANNEL_TYPES.slice(0, 4);

const STATUS_LABEL: Record<string, string> = { active: 'نشطة', paused: 'متوقفة', archived: 'مؤرشفة' };

export default function SupplierDistribution({ userId }: SupplierDistributionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [channelForm, setChannelForm] = useState<ChannelForm>(EMPTY_CHANNEL);
  const [savingChannel, setSavingChannel] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [pRes, cRes] = await Promise.all([
      supabase.from('supplier_supply_profile').select('*').eq('supplier_id', userId).maybeSingle(),
      supabase.from('supplier_distribution_channels').select('*').eq('supplier_id', userId).neq('status', 'archived').order('created_at', { ascending: false }),
    ]);
    if (pRes.error) setError(pRes.error.message);
    if (cRes.error) setError(cRes.error.message);
    const p = pRes.data as Record<string, any> | null;
    if (p) {
      setProfile({
        monthly_supply_capacity: String(p.monthly_supply_capacity ?? ''),
        capacity_unit: p.capacity_unit || 'carton',
        available_supply_volume: String(p.available_supply_volume ?? ''),
        supply_category: p.supply_category ?? '',
        warehouse_name: p.warehouse_name ?? '',
        warehouse_governorate: p.warehouse_governorate ?? '',
        warehouse_city: p.warehouse_city ?? '',
        notes: p.notes ?? '',
      });
    }
    setChannels((cRes.data as ChannelRow[]) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setSavingProfile(true);
    const { error: err } = await supabase.from('supplier_supply_profile').upsert(
      {
        supplier_id: userId,
        monthly_supply_capacity: Number(profile.monthly_supply_capacity) || 0,
        capacity_unit: profile.capacity_unit,
        available_supply_volume: Number(profile.available_supply_volume) || 0,
        supply_category: profile.supply_category || null,
        warehouse_name: profile.warehouse_name.trim() || null,
        warehouse_governorate: profile.warehouse_governorate || null,
        warehouse_city: profile.warehouse_city.trim() || null,
        notes: profile.notes.trim() || null,
      },
      { onConflict: 'supplier_id' },
    );
    setSavingProfile(false);
    setProfileMsg(err ? `تعذر الحفظ: ${err.message}` : 'تم حفظ بيانات القدرة التوريدية');
  };

  const openAdd = () => {
    setEditingId(null);
    setChannelForm(EMPTY_CHANNEL);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (c: ChannelRow) => {
    setEditingId(c.id);
    setChannelForm({
      channel_name: c.channel_name,
      channel_type: c.channel_type,
      coverage_governorates: Array.isArray(c.coverage_governorates) ? c.coverage_governorates : [],
      delivery_time: c.delivery_time || 'within_48h',
      monthly_volume: String(c.monthly_volume),
      volume_unit: c.volume_unit,
    });
    setFormError('');
    setShowModal(true);
  };

  const toggleGovernorate = (g: string) => {
    setChannelForm((f) => ({
      ...f,
      coverage_governorates: f.coverage_governorates.includes(g)
        ? f.coverage_governorates.filter((x) => x !== g)
        : [...f.coverage_governorates, g],
    }));
  };

  const saveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.channel_name.trim()) {
      setFormError('اسم القناة مطلوب');
      return;
    }
    if (channelForm.coverage_governorates.length === 0) {
      setFormError('اختر محافظة واحدة على الأقل لنطاق التغطية');
      return;
    }
    setSavingChannel(true);
    setFormError('');
    const delivery = DELIVERY_TIMES.find((d) => d.value === channelForm.delivery_time) ?? DELIVERY_TIMES[1];
    const payload = {
      supplier_id: userId,
      channel_name: channelForm.channel_name.trim(),
      channel_type: channelForm.channel_type,
      coverage_area: channelForm.coverage_governorates.join('، '),
      coverage_governorates: channelForm.coverage_governorates,
      delivery_time: channelForm.delivery_time,
      monthly_volume: Number(channelForm.monthly_volume) || 0,
      volume_unit: channelForm.volume_unit,
      lead_time_days: delivery.days,
    };
    const { error: err } = editingId
      ? await supabase.from('supplier_distribution_channels').update(payload).eq('id', editingId).eq('supplier_id', userId)
      : await supabase.from('supplier_distribution_channels').insert(payload);
    setSavingChannel(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setShowModal(false);
    await load();
  };

  const toggleStatus = async (c: ChannelRow) => {
    await supabase
      .from('supplier_distribution_channels')
      .update({ status: c.status === 'active' ? 'paused' : 'active' })
      .eq('id', c.id)
      .eq('supplier_id', userId);
    await load();
  };

  const removeChannel = async (c: ChannelRow) => {
    await supabase.from('supplier_distribution_channels').update({ status: 'archived' }).eq('id', c.id).eq('supplier_id', userId);
    await load();
  };

  const capacity = Number(profile.monthly_supply_capacity) || 0;
  const committed = channels.filter((c) => c.status === 'active').reduce((s, c) => s + Number(c.monthly_volume || 0), 0);
  const usedPct = capacity > 0 ? Math.min(100, Math.round((committed / capacity) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      <form onSubmit={saveProfile} className={`${CARD} p-5 space-y-4`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">مجال / قطاع التوريد الرئيسي</label>
            <select className={INPUT} value={profile.supply_category} onChange={(e) => setProfile({ ...profile, supply_category: e.target.value })}>
              <option value="">اختر مجال التوريد</option>
              {SUPPLY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">القدرة التوريدية الشهرية</label>
            <input type="number" min="0" className={INPUT} value={profile.monthly_supply_capacity} onChange={(e) => setProfile({ ...profile, monthly_supply_capacity: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">وحدة القياس</label>
            <select className={INPUT} value={profile.capacity_unit} onChange={(e) => setProfile({ ...profile, capacity_unit: e.target.value })}>
              {SUPPLIER_UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">حجم التوريد المتاح حالياً</label>
            <input type="number" min="0" className={INPUT} value={profile.available_supply_volume} onChange={(e) => setProfile({ ...profile, available_supply_volume: e.target.value })} />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستودع / المنشأة التجارية</label>
            <input className={INPUT} value={profile.warehouse_name} onChange={(e) => setProfile({ ...profile, warehouse_name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">المحافظة</label>
            <select className={INPUT} value={profile.warehouse_governorate} onChange={(e) => setProfile({ ...profile, warehouse_governorate: e.target.value })}>
              <option value="">اختر المحافظة</option>
              {YEMEN_GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">المدينة / المديرية</label>
            <input className={INPUT} value={profile.warehouse_city} onChange={(e) => setProfile({ ...profile, warehouse_city: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">ملاحظات</label>
          <textarea rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none" value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} />
        </div>
        {capacity > 0 && (
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>المخصص للقنوات النشطة: {committed.toLocaleString('en-US')} {supplierUnitLabel(profile.capacity_unit)}</span>
              <span>{usedPct}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-cyan-500'}`} style={{ width: `${usedPct}%` }} />
            </div>
          </div>
        )}
        {profileMsg && <p className="text-xs text-cyan-300">{profileMsg}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={savingProfile} className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-sm font-bold">
            {savingProfile ? 'جاري الحفظ...' : 'حفظ القدرة التوريدية'}
          </button>
        </div>
      </form>

      <div className={`${CARD} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-black text-white">قنوات التوزيع وسلاسل التوريد ({channels.length})</h2>
          <button type="button" onClick={openAdd} className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold">
            + إضافة قناة
          </button>
        </div>
        {channels.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">لم تُضف أي قناة توزيع بعد</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {channels.map((c) => (
              <div key={c.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-white break-words">{c.channel_name}</h3>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {CHANNEL_TYPES.find((t) => t.value === c.channel_type)?.label || c.channel_type}
                  {c.coverage_area ? ` · ${c.coverage_area}` : ''}
                </p>
                <p className="text-xs text-slate-300">
                  {Number(c.monthly_volume).toLocaleString('en-US')} {supplierUnitLabel(c.volume_unit)} / شهر · توصيل {DELIVERY_TIMES.find((d) => d.value === c.delivery_time)?.label || `خلال ${c.lead_time_days} يوم`}
                </p>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => openEdit(c)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold">تعديل</button>
                  <button type="button" onClick={() => toggleStatus(c)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold">
                    {c.status === 'active' ? 'إيقاف' : 'تفعيل'}
                  </button>
                  <button type="button" onClick={() => removeChannel(c)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-300 font-bold">أرشفة</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => !savingChannel && setShowModal(false)}>
          <form onSubmit={saveChannel} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h4 className="text-base font-bold text-white">{editingId ? 'تعديل قناة التوزيع' : 'إضافة قناة توزيع'}</h4>
            <div>
              <label className="block text-xs text-slate-400 mb-1">اسم القناة *</label>
              <input className={INPUT} value={channelForm.channel_name} onChange={(e) => setChannelForm({ ...channelForm, channel_name: e.target.value })} placeholder="مثال: موزعو محافظة تعز" />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">نوع القناة</label>
                <select className={INPUT} value={channelForm.channel_type} onChange={(e) => setChannelForm({ ...channelForm, channel_type: e.target.value })}>
                  {(NEW_CHANNEL_TYPES.some((t) => t.value === channelForm.channel_type) ? NEW_CHANNEL_TYPES : CHANNEL_TYPES).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">متوسط زمن التوصيل</label>
                <select className={INPUT} value={channelForm.delivery_time} onChange={(e) => setChannelForm({ ...channelForm, delivery_time: e.target.value })}>
                  {DELIVERY_TIMES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-400">نطاق التغطية الجغرافية (المحافظات المخدومة) *</label>
                <span className="text-[11px] text-cyan-300">{channelForm.coverage_governorates.length} محافظة</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-xl border border-slate-700 bg-slate-950">
                {YEMEN_GOVERNORATES.map((g) => {
                  const on = channelForm.coverage_governorates.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGovernorate(g)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${on ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">الحجم الشهري</label>
                <input type="number" min="0" className={INPUT} value={channelForm.monthly_volume} onChange={(e) => setChannelForm({ ...channelForm, monthly_volume: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الوحدة</label>
                <select className={INPUT} value={channelForm.volume_unit} onChange={(e) => setChannelForm({ ...channelForm, volume_unit: e.target.value })}>
                  {SUPPLIER_UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>
            {formError && <div className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{formError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={savingChannel} className="flex-1 h-11 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-bold">
                {savingChannel ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setShowModal(false)} disabled={savingChannel} className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
