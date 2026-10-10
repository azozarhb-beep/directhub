'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface SupplierSourceRow {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  registration_source: string;
  created_at: string;
}

interface PendingSupplierRow {
  id: string;
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  factory_type: string;
  registration_status: string;
  created_at: string;
  user_profiles?: { full_name: string; email: string; registration_source?: string };
}

const SOURCE_LABELS: Record<string, { label: string; labelAr: string; color: string; icon: string }> = {
  direct: {
    label: 'Direct Registration',
    labelAr: 'تسجيل مباشر',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: 'UserIcon',
  },
  field_representative: {
    label: 'Field Representative',
    labelAr: 'مندوب ميداني',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: 'UserGroupIcon',
  },
  amal_assistant: {
    label: 'AI Assistant "Amal"',
    labelAr: 'مساعد Amal',
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: 'CpuChipIcon',
  },
};

export default function ProductApprovalTogglePanel() {
  const supabase = createClient();

  // ── Existing: require_product_approval ────────────────────────────────────
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── New: initial_auto_launch_batch ────────────────────────────────────────
  const [autoLaunchBatch, setAutoLaunchBatch] = useState(true);
  const [autoLaunchSaving, setAutoLaunchSaving] = useState(false);
  const [autoLaunchMsg, setAutoLaunchMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── New: require_supplier_approval ────────────────────────────────────────
  const [supplierApprovalRequired, setSupplierApprovalRequired] = useState(false);
  const [supplierApprovalSaving, setSupplierApprovalSaving] = useState(false);
  const [supplierApprovalMsg, setSupplierApprovalMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Supplier registration sources ─────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<SupplierSourceRow[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);

  // ── Pending Suppliers Approval Queue ─────────────────────────────────────
  const [pendingSuppliers, setPendingSuppliers] = useState<PendingSupplierRow[]>([]);
  const [pendingSuppliersLoading, setPendingSuppliersLoading] = useState(false);
  const [supplierActionLoading, setSupplierActionLoading] = useState<string | null>(null);
  const [supplierActionMsg, setSupplierActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Load all settings on mount ────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['require_product_approval', 'initial_auto_launch_batch', 'require_supplier_approval']);
        if (error && error.code !== 'PGRST116') throw error;
        const map: Record<string, string> = {};
        (data || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
        setApprovalRequired(map['require_product_approval'] === 'true');
        // Default initial_auto_launch_batch to true if not set
        setAutoLaunchBatch(map['initial_auto_launch_batch'] !== 'false');
        setSupplierApprovalRequired(map['require_supplier_approval'] === 'true');
      } catch (err: any) {
        setMsg({ text: err.message || 'فشل تحميل الإعدادات', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Load supplier registration sources ────────────────────────────────────
  useEffect(() => {
    const loadSuppliers = async () => {
      setSuppliersLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, full_name, company_name, email, registration_source, created_at')
          .eq('role', 'manufacturer')
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        setSuppliers(data || []);
      } catch {
        // non-critical — silently ignore
      } finally {
        setSuppliersLoading(false);
      }
    };
    loadSuppliers();
  }, []);

  // ── Load pending suppliers ────────────────────────────────────────────────
  const fetchPendingSuppliers = async () => {
    setPendingSuppliersLoading(true);
    try {
      const { data, error } = await supabase
        .from('factory_registrations')
        .select('id, company_name, contact_person, contact_phone, contact_email, factory_type, registration_status, created_at, user_id, user_profiles:user_id(full_name, email, registration_source)')
        .eq('registration_status', 'pending_supplier_approval')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPendingSuppliers(data || []);
    } catch {
      // silently ignore
    } finally {
      setPendingSuppliersLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingSuppliers();
  }, []);

  // ── Save helper ───────────────────────────────────────────────────────────
  const saveSetting = async (key: string, value: boolean) => {
    const stringValue = String(value);
    const { data: existing, error: selectError } = await supabase
      .from('platform_settings')
      .select('id')
      .eq('setting_key', key)
      .maybeSingle();
    if (selectError) throw selectError;

    const payload = {
      setting_key: key,
      setting_value: stringValue,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing?.id
      ? await supabase.from('platform_settings').update(payload).eq('setting_key', key)
      : await supabase.from('platform_settings').insert(payload);
    if (error) throw error;
  };

  // ── Toggle: require_product_approval ─────────────────────────────────────
  const handleToggle = async () => {
    const newValue = !approvalRequired;
    setSaving(true);
    setMsg(null);
    try {
      await saveSetting('require_product_approval', newValue);
      setApprovalRequired(newValue);
      setMsg({
        text: newValue
          ? '✅ تم التفعيل — المنتجات الجديدة تحتاج موافقة الإدارة قبل النشر' :'✅ تم الإيقاف — المنتجات الجديدة تُنشر فوراً بدون موافقة',
        type: 'success',
      });
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setMsg({ text: err.message || 'فشل حفظ الإعداد', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle: initial_auto_launch_batch ─────────────────────────────────────
  const handleAutoLaunchToggle = async () => {
    const newValue = !autoLaunchBatch;
    setAutoLaunchSaving(true);
    setAutoLaunchMsg(null);
    try {
      await saveSetting('initial_auto_launch_batch', newValue);
      setAutoLaunchBatch(newValue);
      setAutoLaunchMsg({
        text: newValue
          ? '✅ مفعّل — المنتجات والموردون الجدد يُوافَق عليهم تلقائياً (وضع الإطلاق)'
          : '✅ معطّل — جميع الطلبات تذهب إلى قائمة الانتظار وتحتاج موافقة صريحة',
        type: 'success',
      });
      setTimeout(() => setAutoLaunchMsg(null), 4000);
    } catch (err: any) {
      setAutoLaunchMsg({ text: err.message || 'فشل حفظ الإعداد', type: 'error' });
    } finally {
      setAutoLaunchSaving(false);
    }
  };

  // ── Toggle: require_supplier_approval ─────────────────────────────────────
  const handleSupplierApprovalToggle = async () => {
    const newValue = !supplierApprovalRequired;
    setSupplierApprovalSaving(true);
    setSupplierApprovalMsg(null);
    try {
      await saveSetting('require_supplier_approval', newValue);
      setSupplierApprovalRequired(newValue);
      setSupplierApprovalMsg({
        text: newValue
          ? '✅ مفعّل — تسجيلات الموردين الجدد تحتاج موافقة الإدارة' :'✅ معطّل — الموردون الجدد يُفعَّلون فوراً بعد التسجيل',
        type: 'success',
      });
      setTimeout(() => setSupplierApprovalMsg(null), 4000);
    } catch (err: any) {
      setSupplierApprovalMsg({ text: err.message || 'فشل حفظ الإعداد', type: 'error' });
    } finally {
      setSupplierApprovalSaving(false);
    }
  };

  // ── Approve / Reject supplier ─────────────────────────────────────────────
  const handleSupplierAction = async (supplierId: string, action: 'approve' | 'reject') => {
    setSupplierActionLoading(supplierId);
    setSupplierActionMsg(null);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('factory_registrations')
        .update({ registration_status: newStatus, is_approved: action === 'approve', updated_at: new Date().toISOString() })
        .eq('id', supplierId);
      if (error) throw error;
      setPendingSuppliers(prev => prev.filter(s => s.id !== supplierId));
      setSupplierActionMsg({
        text: action === 'approve' ? '✅ تم قبول المورد وتفعيل حسابه' : '❌ تم رفض طلب المورد',
        type: action === 'approve' ? 'success' : 'error',
      });
      setTimeout(() => setSupplierActionMsg(null), 3000);
    } catch (err: any) {
      setSupplierActionMsg({ text: err.message || 'فشلت العملية', type: 'error' });
    } finally {
      setSupplierActionLoading(null);
    }
  };

  // ── Source counts ──────────────────────────────────────────────────────────
  const sourceCounts = suppliers.reduce<Record<string, number>>((acc, s) => {
    const src = s.registration_source || 'direct';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  const ToggleButton = ({
    value,
    onToggle,
    disabled,
    color = 'orange',
  }: {
    value: boolean;
    onToggle: () => void;
    disabled: boolean;
    color?: 'orange' | 'blue' | 'emerald';
  }) => {
    const colorMap: Record<string, string> = {
      orange: 'bg-orange-500',
      blue: 'bg-blue-500',
      emerald: 'bg-emerald-500',
    };
    return (
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label="Toggle setting"
        className={`relative inline-flex h-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
          value ? colorMap[color] : 'bg-muted-foreground/30'
        }`}
        style={{ width: '52px' }}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
            value ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Initial Auto-Launch Batch Toggle ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Icon name="RocketLaunchIcon" size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">دفعة الإطلاق الأولى / Initial Auto-Launch Batch</h3>
            <p className="text-xs text-muted-foreground">Auto-approve submissions during platform launch phase</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                دفعة الإطلاق الأولى — الموافقة التلقائية
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? '…' : autoLaunchBatch ?'مفعّل — المنتجات والموردون الجدد يُوافَق عليهم تلقائياً لملء المنصة في مرحلة الإطلاق' :'معطّل — جميع الطلبات تذهب إلى قائمة الانتظار وتحتاج موافقة صريحة من الإدارة'}
              </p>
            </div>
            {loading ? (
              <div className="w-12 h-6 rounded-full bg-muted animate-pulse" />
            ) : (
              <ToggleButton value={autoLaunchBatch} onToggle={handleAutoLaunchToggle} disabled={autoLaunchSaving} color="blue" />
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
            autoLaunchBatch
              ? 'bg-blue-50 border-blue-200 text-blue-700' :'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <Icon name={autoLaunchBatch ? 'RocketLaunchIcon' : 'ClockIcon'} size={14} />
            {autoLaunchBatch
              ? 'الوضع الحالي: الموافقة التلقائية مفعّلة (وضع الإطلاق)'
              : 'الوضع الحالي: جميع الطلبات تحتاج مراجعة يدوية'}
          </div>
          {autoLaunchMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              autoLaunchMsg.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-red-50 border-red-200 text-red-700'
            }`}>
              <Icon name={autoLaunchMsg.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={14} />
              {autoLaunchMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Require Product Approval Toggle ──────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <Icon name="Cog6ToothIcon" size={18} className="text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">موافقة الإدارة على المنتجات الجديدة</h3>
            <p className="text-xs text-muted-foreground">Require Admin Approval for New Products</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                مطلوب موافقة الإدارة على المنتجات الجديدة
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? '…' : approvalRequired ?'مفعّل — أي منتج جديد يدخل قائمة الانتظار قبل النشر' :'معطّل — المنتجات تُنشر فوراً (مثالي للدفعة الأولى)'}
              </p>
            </div>
            {loading ? (
              <div className="w-12 h-6 rounded-full bg-muted animate-pulse" />
            ) : (
              <ToggleButton value={approvalRequired} onToggle={handleToggle} disabled={saving} color="orange" />
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
            approvalRequired
              ? 'bg-orange-50 border-orange-200 text-orange-700' :'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            <Icon name={approvalRequired ? 'ShieldCheckIcon' : 'BoltIcon'} size={14} />
            {approvalRequired
              ? 'الوضع الحالي: المنتجات تحتاج موافقة قبل النشر' :'الوضع الحالي: النشر الفوري مفعّل (بدون موافقة)'}
          </div>
          {msg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              msg.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-red-50 border-red-200 text-red-700'
            }`}>
              <Icon name={msg.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={14} />
              {msg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Require Supplier Approval Toggle ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Icon name="BuildingStorefrontIcon" size={18} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">مطلوب موافقة الإدارة على الموردين الجدد / Require Approval for New Suppliers</h3>
            <p className="text-xs text-muted-foreground">Applies when Initial Auto-Launch Batch is OFF</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-background">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                مطلوب موافقة الإدارة على الموردين الجدد
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? '…' : supplierApprovalRequired ?'مفعّل — تسجيلات الموردين الجدد تدخل طابور الانتظار وتحتاج موافقة صريحة' :'معطّل — الموردون الجدد يُفعَّلون فوراً بعد التسجيل'}
              </p>
            </div>
            {loading ? (
              <div className="w-12 h-6 rounded-full bg-muted animate-pulse" />
            ) : (
              <ToggleButton value={supplierApprovalRequired} onToggle={handleSupplierApprovalToggle} disabled={supplierApprovalSaving} color="emerald" />
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
            supplierApprovalRequired
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <Icon name={supplierApprovalRequired ? 'ShieldCheckIcon' : 'UserPlusIcon'} size={14} />
            {supplierApprovalRequired
              ? 'الوضع الحالي: الموردون الجدد يحتاجون موافقة الإدارة' :'الوضع الحالي: تفعيل فوري للموردين الجدد'}
          </div>
          {supplierApprovalMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              supplierApprovalMsg.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-red-50 border-red-200 text-red-700'
            }`}>
              <Icon name={supplierApprovalMsg.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={14} />
              {supplierApprovalMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Supplier Approval Queue ───────────────────────────────────────── */}
      <div className="bg-card border-2 border-emerald-300 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <Icon name="UserGroupIcon" size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-900">
                طابور التحقق — الموردين / Supplier Approval Queue
              </h3>
              <p className="text-xs text-emerald-700">
                {pendingSuppliersLoading ? 'جارٍ التحميل…' : `${pendingSuppliers.length} مورد بانتظار الموافقة`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchPendingSuppliers}
            disabled={pendingSuppliersLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Icon name="ArrowPathIcon" size={13} className={pendingSuppliersLoading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
        <div className="p-4">
          {supplierActionMsg && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border mb-3 ${
              supplierActionMsg.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-700' :'bg-red-50 border-red-200 text-red-700'
            }`}>
              <Icon name={supplierActionMsg.type === 'success' ? 'CheckCircleIcon' : 'XCircleIcon'} size={14} />
              {supplierActionMsg.text}
            </div>
          )}
          {pendingSuppliersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : pendingSuppliers.length === 0 ? (
            <div className="text-center py-10">
              <Icon name="CheckBadgeIcon" size={36} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">لا يوجد موردون معلقون</p>
              <p className="text-xs text-muted-foreground mt-1">جميع طلبات التسجيل تمت مراجعتها أو الموافقة التلقائية مفعّلة</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pendingSuppliers.map(supplier => {
                const profile = supplier.user_profiles as any;
                const src = profile?.registration_source;
                return (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl hover:border-emerald-300 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Icon name="BuildingStorefrontIcon" size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {supplier.company_name || 'شركة بدون اسم'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          {supplier.contact_person || profile?.full_name || '—'}
                        </p>
                        {supplier.contact_phone && (
                          <span className="text-xs text-muted-foreground">{supplier.contact_phone}</span>
                        )}
                        {src && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            src === 'field_representative' ?'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : src === 'amal_assistant' ?'bg-violet-50 text-violet-700 border-violet-200' :'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {src === 'field_representative' ? '👤 مندوب' :
                             src === 'amal_assistant' ? '🤖 Amal' : '🔗 مباشر'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleSupplierAction(supplier.id, 'approve')}
                        disabled={supplierActionLoading === supplier.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {supplierActionLoading === supplier.id ? (
                          <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                        ) : (
                          <Icon name="CheckCircleIcon" size={12} />
                        )}
                        قبول
                      </button>
                      <button
                        onClick={() => handleSupplierAction(supplier.id, 'reject')}
                        disabled={supplierActionLoading === supplier.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        <Icon name="XCircleIcon" size={12} />
                        رفض
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Registration Source Summary ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Icon name="UsersIcon" size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">مصادر تسجيل الموردين</h3>
            <p className="text-xs text-muted-foreground">Supplier Registration Source Tracking</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(SOURCE_LABELS).map(([key, meta]) => (
              <div
                key={key}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background text-center"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.color.split(' ').slice(0, 2).join(' ')}`}>
                  <Icon name={meta.icon} size={16} />
                </div>
                <span className="text-xl font-bold text-foreground">{sourceCounts[key] || 0}</span>
                <span className="text-xs text-muted-foreground leading-tight">{meta.labelAr}</span>
              </div>
            ))}
          </div>
          {suppliersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">لا يوجد موردون مسجلون بعد</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {suppliers.map(s => {
                const src = s.registration_source || 'direct';
                const meta = SOURCE_LABELS[src] || SOURCE_LABELS.direct;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.color.split(' ').slice(0, 2).join(' ')}`}>
                      <Icon name={meta.icon} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {s.company_name || s.full_name || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
                      {meta.labelAr}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
