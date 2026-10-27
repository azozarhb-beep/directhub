'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { enforceAgentGeofence } from '@/lib/agentGeofence';
import DemoPSIModal from './DemoPSIModal';

interface AgentInspectionTasksPanelProps {
  userId: string;
  embedded?: boolean;
}

interface InspectionRow {
  id: string;
  title: string;
  status: string;
  factoryName: string;
  city: string;
  orderId: string | null;
  orderNumber: string;
  poNumber: string;
  product: string;
  quantity: string;
  notes: string;
  photoUrls: string[];
  reportNotes: string;
  result: string;
  createdAt: string;
  checkQuantity: boolean;
  checkPackaging: boolean;
  checkDates: boolean;
}

interface Checklist {
  quantity: boolean;
  packaging: boolean;
  dates: boolean;
}

type TabKey = 'pending' | 'in_progress' | 'completed';

const PENDING_STATUSES = ['pending_inspection', 'assigned', 'dispatched'];
const PROGRESS_STATUSES = ['in_progress'];
const DONE_STATUSES = ['passed', 'failed', 'completed'];
const ALL_STATUSES = [...PENDING_STATUSES, ...PROGRESS_STATUSES, ...DONE_STATUSES];
const MIN_PHOTOS = 2;
const UPLOAD_BUCKET = 'chat-media';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'في انتظار التفتيش' },
  { key: 'in_progress', label: 'المهام الجارية' },
  { key: 'completed', label: 'المكتملة' },
];

const CHECK_ITEMS: { key: keyof Checklist; label: string }[] = [
  { key: 'quantity', label: 'مطابقة الكميات مع الفاتورة' },
  { key: 'packaging', label: 'سلامة التغليف والطبليات' },
  { key: 'dates', label: 'سلامة تواريخ الإنتاج والصلاحية' },
];

const EMPTY_CHECKLIST: Checklist = { quantity: false, packaging: false, dates: false };

function normStatus(s: string): string {
  return (s || '').toLowerCase();
}

function tabOf(status: string): TabKey {
  const s = normStatus(status);
  if (PROGRESS_STATUSES.includes(s)) return 'in_progress';
  if (DONE_STATUSES.includes(s)) return 'completed';
  return 'pending';
}

function summarizeItems(items: unknown): { product: string; quantity: string } {
  const arr = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  if (arr.length === 0) return { product: '—', quantity: '—' };
  const names = arr
    .slice(0, 2)
    .map((it) => String(it?.name_ar || it?.name_en || it?.product_name || it?.name || ''))
    .filter(Boolean);
  const totalQty = arr.reduce((sum, it) => sum + (Number(it?.quantity ?? it?.qty) || 0), 0);
  return {
    product: names.join('، ') || 'منتجات متعددة',
    quantity: totalQty > 0 ? String(totalQty) : '—',
  };
}

const AgentInspectionTasksPanel: React.FC<AgentInspectionTasksPanelProps> = ({ userId, embedded = false }) => {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [photosById, setPhotosById] = useState<Record<string, string[]>>({});
  const [checkById, setCheckById] = useState<Record<string, Checklist>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');

  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [walkInFactory, setWalkInFactory] = useState('');
  const [walkInCity, setWalkInCity] = useState('');
  const [walkInPo, setWalkInPo] = useState('');
  const [creating, setCreating] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('field_inspection_tasks')
        .select('*')
        .eq('assigned_agent_id', userId)
        .in('status', ALL_STATUSES)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows = data || [];
      const orderIds = Array.from(new Set(rows.map((r: any) => r.order_id).filter(Boolean)));
      const orderMap = new Map<string, any>();
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, items')
          .in('id', orderIds);
        (orders || []).forEach((o: any) => orderMap.set(o.id, o));
      }

      const mapped: InspectionRow[] = rows.map((r: any) => {
        const order = r.order_id ? orderMap.get(r.order_id) : null;
        const { product, quantity } = summarizeItems(order?.items);
        const orderNumber =
          order?.order_number || (r.order_id ? String(r.order_id).slice(0, 8).toUpperCase() : '—');
        return {
          id: r.id,
          title: r.title || '',
          status: normStatus(r.status),
          factoryName: r.factory_name || 'مصنع غير محدد',
          city: r.city || '',
          orderId: r.order_id || null,
          orderNumber,
          poNumber: r.po_number || (orderNumber !== '—' ? orderNumber : ''),
          product: product !== '—' ? product : r.title || '—',
          quantity,
          notes: r.notes || '',
          photoUrls: Array.isArray(r.photo_urls) ? r.photo_urls : [],
          reportNotes: r.report_notes || '',
          result: r.result || '',
          createdAt: r.created_at,
          checkQuantity: !!r.check_quantity_match,
          checkPackaging: !!r.check_packaging_ok,
          checkDates: !!r.check_dates_ok,
        };
      });
      setTasks(mapped);
    } catch (err: any) {
      console.error('Error loading inspection tasks:', err);
      showToast('error', err?.message || 'تعذر تحميل مهام التفتيش');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const cities = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.city).filter(Boolean))),
    [tasks]
  );

  const matchesFilters = useCallback(
    (t: InspectionRow) => {
      if (cityFilter && t.city !== cityFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        t.factoryName.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        t.poNumber.toLowerCase().includes(q) ||
        t.orderNumber.toLowerCase().includes(q)
      );
    },
    [search, cityFilter]
  );

  const filteredTasks = useMemo(() => tasks.filter(matchesFilters), [tasks, matchesFilters]);

  const counts = useMemo(() => ({
    pending: filteredTasks.filter((t) => tabOf(t.status) === 'pending').length,
    in_progress: filteredTasks.filter((t) => tabOf(t.status) === 'in_progress').length,
    completed: filteredTasks.filter((t) => tabOf(t.status) === 'completed').length,
  }), [filteredTasks]);

  const visible = filteredTasks.filter((t) => tabOf(t.status) === activeTab);

  const getChecklist = (id: string): Checklist => checkById[id] || EMPTY_CHECKLIST;

  const toggleCheck = (id: string, key: keyof Checklist) => {
    setCheckById((prev) => {
      const cur = prev[id] || EMPTY_CHECKLIST;
      return { ...prev, [id]: { ...cur, [key]: !cur[key] } };
    });
  };

  const startInspection = async (task: InspectionRow) => {
    setBusyId(task.id);
    const geo = await enforceAgentGeofence(supabase);
    if (!geo.allowed) {
      setBusyId(null);
      showToast('error', geo.message);
      return;
    }
    const { error } = await supabase
      .from('field_inspection_tasks')
      .update({ status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', task.id)
      .eq('assigned_agent_id', userId);
    setBusyId(null);
    if (error) {
      showToast('error', `فشل بدء التفتيش: ${error.message}`);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'in_progress' } : t)));
    setActiveTab('in_progress');
    showToast('success', 'تم بدء التفتيش الميداني');
  };

  const createWalkIn = async () => {
    const name = walkInFactory.trim();
    if (!name) {
      showToast('error', 'يرجى إدخال اسم المصنع / الموقع');
      return;
    }
    setCreating(true);
    const geo = await enforceAgentGeofence(supabase);
    if (!geo.allowed) {
      setCreating(false);
      showToast('error', geo.message);
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('field_inspection_tasks')
      .insert({
        factory_name: name,
        city: walkInCity.trim() || null,
        po_number: walkInPo.trim() || null,
        assigned_agent_id: userId,
        created_by: userId,
        title: `معاينة فورية - ${name}`,
        status: 'in_progress',
        is_walk_in: true,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    setCreating(false);
    if (error || !data) {
      showToast('error', `فشل بدء المعاينة الفورية: ${error?.message || 'خطأ غير معروف'}`);
      return;
    }
    setShowWalkIn(false);
    setWalkInFactory('');
    setWalkInCity('');
    setWalkInPo('');
    setSearch('');
    setCityFilter('');
    setActiveTab('in_progress');
    showToast('success', 'تم بدء المعاينة الفورية، أكمل نموذج الفحص أدناه');
    load();
  };

  const handlePhotoUpload = async (task: InspectionRow, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingId(task.id);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${userId}/inspections/${task.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
        if (urlData?.publicUrl) uploaded.push(urlData.publicUrl);
      }
      setPhotosById((prev) => ({ ...prev, [task.id]: [...(prev[task.id] || []), ...uploaded] }));
    } catch (err: any) {
      showToast('error', `فشل رفع الصور: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setUploadingId(null);
    }
  };

  const removePhoto = (taskId: string, url: string) => {
    setPhotosById((prev) => ({ ...prev, [taskId]: (prev[taskId] || []).filter((u) => u !== url) }));
  };

  const submitReport = async (task: InspectionRow, result: 'passed' | 'failed') => {
    const photos = photosById[task.id] || [];
    const note = (notesById[task.id] || '').trim();
    const checks = getChecklist(task.id);
    if (photos.length < MIN_PHOTOS) {
      showToast('error', `يجب رفع ${MIN_PHOTOS} صور على الأقل قبل إرسال تقرير التفتيش`);
      return;
    }
    if (result === 'passed' && !(checks.quantity && checks.packaging && checks.dates)) {
      showToast('error', 'يجب تأكيد جميع بنود قائمة الفحص قبل اعتماد الفحص');
      return;
    }
    if (result === 'failed' && !note) {
      showToast('error', 'يرجى كتابة ملاحظات توضح المخالفة قبل حجز الدفعة');
      return;
    }
    setBusyId(task.id);
    const { error } = await supabase.rpc('save_inspection_results', {
      p_task_id: task.id,
      p_result: result,
      p_photo_urls: photos,
      p_report_notes: note || null,
      p_check_quantity: checks.quantity,
      p_check_packaging: checks.packaging,
      p_check_dates: checks.dates,
    });
    setBusyId(null);
    if (error) {
      showToast('error', `فشل إرسال التقرير: ${error.message}`);
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: result,
              result,
              photoUrls: photos,
              reportNotes: note,
              checkQuantity: checks.quantity,
              checkPackaging: checks.packaging,
              checkDates: checks.dates,
            }
          : t
      )
    );
    setActiveTab('completed');
    showToast(
      'success',
      result === 'passed' ?'🟢 تم اعتماد الفحص ومنح الضوء الأخضر لتحرير دفعة Escrow' :'🚩 تم الإبلاغ عن المخالفة وحجز الدفعة'
    );
  };

  const statusBadge = (status: string) => {
    if (status === 'in_progress') return { label: 'قيد التفتيش', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (status === 'passed') return { label: 'مجتاز', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (status === 'failed') return { label: 'مخالفة / محجوز', cls: 'bg-red-50 text-red-700 border-red-200' };
    if (status === 'completed') return { label: 'مكتمل', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    return { label: 'في انتظار التفتيش', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  };

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded && (
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Icon name="ClipboardDocumentListIcon" size={18} className="text-amber-600 shrink-0" />
              <span className="break-words">مهام التفتيش الميداني</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              المهام المسندة إليك للتفتيش وإعطاء الضوء الأخضر لتحرير الدفعات
            </p>
          </div>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 shrink-0"
        >
          <Icon name="ArrowPathIcon" size={13} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Primary CTA: on-site inspection without prior assignment */}
      <button
        type="button"
        onClick={() => {
          setShowWalkIn(true);
          setShowDemoModal(true);
        }}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 active:scale-[0.99] transition-all"
      >
        <Icon name="PlusIcon" size={16} />
        [ + بدء تفتيش أو معاينة فورية ]
      </button>

      <button
        type="button"
        onClick={() => setShowDemoModal(true)}
        className="w-full text-center text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
      >
        🧪 معاينة بطاقة طلب تجريبية (Demo Order)
      </button>
      <DemoPSIModal open={showDemoModal} onClose={() => setShowDemoModal(false)} />

      {showWalkIn && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-foreground">بيانات المعاينة الفورية</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">اسم المصنع / الموقع *</label>
              <input
                type="text"
                value={walkInFactory}
                onChange={(e) => setWalkInFactory(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">المدينة</label>
              <input
                type="text"
                value={walkInCity}
                onChange={(e) => setWalkInCity(e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">رقم أمر الشراء (PO)</label>
              <input
                type="text"
                value={walkInPo}
                onChange={(e) => setWalkInPo(e.target.value)}
                dir="ltr"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={createWalkIn}
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
            >
              <Icon name="MagnifyingGlassIcon" size={15} />
              {creating ? 'جارٍ البدء...' : 'بدء المعاينة الآن'}
            </button>
            <button
              type="button"
              onClick={() => setShowWalkIn(false)}
              className="px-4 py-2.5 bg-muted border border-border rounded-xl text-sm font-semibold text-muted-foreground"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Icon
            name="MagnifyingGlassIcon"
            size={15}
            className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المصنع أو المدينة أو رقم أمر الشراء (PO)"
            className="w-full pr-9 pl-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="sm:w-48 px-3 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary"
        >
          <option value="">كل المدن</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {toast && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            toast.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl border p-2.5 sm:p-3 text-center transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white border-primary' :'bg-card border-border text-foreground hover:bg-muted'
            }`}
          >
            <p className="text-xl font-bold">{counts[tab.key]}</p>
            <p className="text-[11px] font-semibold mt-0.5 leading-tight break-words">{tab.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">جارٍ تحميل مهام التفتيش...</p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Icon name="CheckCircleIcon" size={28} className="text-emerald-500" />
          </div>
          <p className="font-semibold text-foreground mb-1">لا توجد مهام في هذا القسم</p>
          <p className="text-sm text-muted-foreground">ستظهر هنا المهام التي يتم إسنادها إليك</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((task) => {
            const badge = statusBadge(task.status);
            const tab = tabOf(task.status);
            const photos = photosById[task.id] || [];
            const checks = getChecklist(task.id);
            const allChecked = checks.quantity && checks.packaging && checks.dates;
            const isBusy = busyId === task.id;
            const isUploading = uploadingId === task.id;
            return (
              <div key={task.id} className="bg-card border border-border rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                        #{task.orderNumber}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Icon name="BuildingOffice2Icon" size={14} className="text-muted-foreground shrink-0" />
                      {task.factoryName}
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-xl p-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">رقم الطلب / PO</p>
                    <p className="text-xs font-semibold text-foreground">#{task.poNumber || task.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">المنشأة</p>
                    <p className="text-xs font-semibold text-foreground">
                      {task.factoryName}{task.city ? ` — ${task.city}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">المنتج</p>
                    <p className="text-xs font-semibold text-foreground">{task.product}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">الكمية</p>
                    <p className="text-xs font-semibold text-foreground">{task.quantity}</p>
                  </div>
                  {task.notes && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground font-medium">تعليمات الإدارة</p>
                      <p className="text-xs text-foreground">{task.notes}</p>
                    </div>
                  )}
                </div>

                {tab === 'pending' && (
                  <button
                    onClick={() => startInspection(task)}
                    disabled={isBusy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    <Icon name="MagnifyingGlassIcon" size={15} />
                    {isBusy ? 'جارٍ البدء...' : 'بدء التفتيش الميداني'}
                  </button>
                )}

                {tab === 'in_progress' && (
                  <div className="space-y-3 border-t border-border pt-3">
                    {/* Checklist toggles */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">قائمة الفحص الميداني</p>
                      <div className="space-y-2">
                        {CHECK_ITEMS.map((item) => {
                          const on = checks[item.key];
                          return (
                            <button
                              key={item.key}
                              type="button"
                              role="switch"
                              aria-checked={on}
                              onClick={() => toggleCheck(task.id, item.key)}
                              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                                on
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :'bg-background border-border text-foreground'
                              }`}
                            >
                              <span className="text-right break-words">{item.label}</span>
                              <span
                                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                                  on ? 'bg-emerald-500' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                    on ? 'right-0.5' : 'right-[18px]'
                                  }`}
                                />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        صور التفتيش الحية (كراتين، طبليات، خطوط إنتاج) — حد أدنى {MIN_PHOTOS} — {photos.length} مرفوعة
                      </label>
                      <label
                        className={`flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-border rounded-xl text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors ${
                          isUploading ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <Icon name="CameraIcon" size={16} />
                        {isUploading ? 'جارٍ رفع الصور...' : 'التقاط صورة بالكاميرا'}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            handlePhotoUpload(task, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <label
                        className={`mt-2 flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors ${
                          isUploading ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <Icon name="PhotoIcon" size={15} />
                        اختيار صور من المعرض
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handlePhotoUpload(task, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {photos.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {photos.map((url) => (
                            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="صورة تفتيش ميداني مرفوعة" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removePhoto(task.id, url)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center"
                                aria-label="حذف الصورة"
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
                        value={notesById[task.id] || ''}
                        onChange={(e) => setNotesById((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        rows={3}
                        placeholder="اكتب ملاحظاتك حول جودة المنتج والكمية وحالة التغليف..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => submitReport(task, 'passed')}
                        disabled={isBusy || isUploading || photos.length < MIN_PHOTOS || !allChecked}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}
                      >
                        <span>🟢</span>
                        <span className="break-words">[ اعتماد الفحص ومنح الضوء الأخضر لتحرير دفعة Escrow ]</span>
                      </button>
                      <button
                        onClick={() => submitReport(task, 'failed')}
                        disabled={isBusy || isUploading || photos.length < MIN_PHOTOS}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-50 border border-red-300 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>🚩</span>
                        إبلاغ عن مخالفة / حجز الدفعة
                      </button>
                    </div>
                    {(photos.length < MIN_PHOTOS || !allChecked) && (
                      <p className="text-[11px] text-amber-700">
                        {photos.length < MIN_PHOTOS
                          ? `ارفع ${MIN_PHOTOS - photos.length} صورة إضافية، `
                          : ''}
                        {!allChecked ? 'وأكّد جميع بنود قائمة الفحص ' : ''}
                        لتفعيل زر الاعتماد.
                      </p>
                    )}
                  </div>
                )}

                {tab === 'completed' && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {CHECK_ITEMS.map((item) => {
                        const ok =
                          item.key === 'quantity'
                            ? task.checkQuantity
                            : item.key === 'packaging'
                              ? task.checkPackaging
                              : task.checkDates;
                        return (
                          <span
                            key={item.key}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              ok
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {ok ? '✓' : '—'} {item.label}
                          </span>
                        );
                      })}
                    </div>
                    {task.reportNotes && (
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">ملاحظات المفتش: </span>
                        {task.reportNotes}
                      </p>
                    )}
                    {task.photoUrls.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {task.photoUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="صورة تقرير التفتيش الميداني" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentInspectionTasksPanel;
