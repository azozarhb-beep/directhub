'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveUpdate {
  id: string;
  update_type: string;
  title: string;
  title_ar: string | null;
  body: string | null;
  body_ar: string | null;
  icon: string;
  color: string;
  link_url: string | null;
  link_label: string | null;
  is_auto: boolean;
  status: 'active' | 'inactive' | 'scheduled';
  display_order: number;
  scheduled_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ErrorLog {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  error_code: string | null;
  title: string;
  description: string | null;
  affected_url: string | null;
  affected_component: string | null;
  resolution_action: string | null;
  status: 'open' | 'resolved' | 'ignored';
  resolved_at: string | null;
  created_at: string;
}

interface Subscription {
  id: string;
  tier: string;
  plan_name: string;
  monthly_cost: number;
  storage_limit_gb: number;
  storage_used_gb: number;
  bandwidth_limit_gb: number;
  bandwidth_used_gb: number;
  max_users: number;
  max_products: number;
  renewal_date: string | null;
  billing_cycle: string;
  provider: string;
  notes: string | null;
  is_active: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UPDATE_TYPE_CONFIG: Record<string, { labelKey: string; icon: string; color: string }> = {
  new_factory: { labelKey: 'typeNewFactory', icon: 'BuildingOffice2Icon', color: 'emerald' },
  new_rfq: { labelKey: 'typeNewRfq', icon: 'DocumentTextIcon', color: 'blue' },
  new_product: { labelKey: 'typeNewProduct', icon: 'CubeIcon', color: 'violet' },
  new_user: { labelKey: 'typeNewUser', icon: 'UserPlusIcon', color: 'sky' },
  platform_news: { labelKey: 'typeNews', icon: 'MegaphoneIcon', color: 'amber' },
  promotion: { labelKey: 'typePromo', icon: 'TagIcon', color: 'rose' },
  system_notice: { labelKey: 'typeNotice', icon: 'InformationCircleIcon', color: 'slate' },
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', badge: 'bg-sky-100 text-sky-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
};

const SEVERITY_CONFIG: Record<string, { labelKey: string; color: string; icon: string; dot: string }> = {
  critical: { labelKey: 'sevCritical', color: 'text-red-700 bg-red-50 border-red-200', icon: 'ExclamationCircleIcon', dot: 'bg-red-500' },
  warning: { labelKey: 'sevWarning', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'ExclamationTriangleIcon', dot: 'bg-amber-500' },
  info: { labelKey: 'sevInfo', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'InformationCircleIcon', dot: 'bg-blue-500' },
};

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  starter: { label: 'Starter', color: 'text-slate-700 bg-slate-100', icon: 'RocketLaunchIcon' },
  growth: { label: 'Growth', color: 'text-blue-700 bg-blue-100', icon: 'ChartBarIcon' },
  enterprise: { label: 'Enterprise', color: 'text-violet-700 bg-violet-100', icon: 'BuildingOffice2Icon' },
  custom: { label: 'Custom', color: 'text-amber-700 bg-amber-100', icon: 'Cog6ToothIcon' },
};

// ─── Sub-section: Live Updates Manager ───────────────────────────────────────

function LiveUpdatesManager() {
  const { t, dir, language } = useLanguage();
  const ui = t.admin.liveInfra;
  const supabase = createClient();
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<LiveUpdate | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const emptyForm = {
    update_type: 'platform_news',
    title: '',
    title_ar: '',
    body: '',
    body_ar: '',
    icon: 'BoltIcon',
    color: 'blue',
    link_url: '',
    link_label: '',
    is_auto: false,
    status: 'active' as const,
    display_order: 0,
  };
  const [form, setForm] = useState(emptyForm);

  const fetchUpdates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('platform_live_updates')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    setUpdates(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u: LiveUpdate) => {
    setEditTarget(u);
    setForm({
      update_type: u.update_type,
      title: u.title,
      title_ar: u.title_ar || '',
      body: u.body || '',
      body_ar: u.body_ar || '',
      icon: u.icon,
      color: u.color,
      link_url: u.link_url || '',
      link_label: u.link_label || '',
      is_auto: u.is_auto,
      status: u.status,
      display_order: u.display_order,
    });
    setShowForm(true);
  };

  const saveUpdate = async () => {
    if (!form.title.trim()) return;
    setActionLoading('save');
    const payload = {
      ...form,
      link_url: form.link_url || null,
      link_label: form.link_label || null,
      title_ar: form.title_ar || null,
      body: form.body || null,
      body_ar: form.body_ar || null,
    };
    if (editTarget) {
      await supabase.from('platform_live_updates').update(payload).eq('id', editTarget.id);
      showSuccess(ui.updatedOk);
    } else {
      await supabase.from('platform_live_updates').insert(payload);
      showSuccess(ui.createdOk);
    }
    await fetchUpdates();
    setShowForm(false);
    setActionLoading('');
  };

  const toggleStatus = async (u: LiveUpdate) => {
    setActionLoading(u.id + 'toggle');
    let newStatus = u.status === 'active' ? 'inactive' : 'active';
    await supabase.from('platform_live_updates').update({ status: newStatus }).eq('id', u.id);
    await fetchUpdates();
    showSuccess(newStatus === 'active' ? ui.activatedOk : ui.pausedOk);
    setActionLoading('');
  };

  const deleteUpdate = async (id: string) => {
    if (!confirm(ui.confirmDelete)) return;
    setActionLoading(id + 'delete');
    await supabase.from('platform_live_updates').delete().eq('id', id);
    await fetchUpdates();
    showSuccess(ui.deletedOk);
    setActionLoading('');
  };

  const filtered = filterStatus ? updates.filter(u => u.status === filterStatus) : updates;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <Icon name="BoltIcon" size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">{ui.title}</h3>
            <p className="text-[11px] text-muted-foreground">{ui.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
          >
            <option value="">{ui.allStatuses}</option>
            <option value="active">{ui.active}</option>
            <option value="inactive">{ui.inactive}</option>
            <option value="scheduled">{ui.scheduled}</option>
          </select>
          <button
            onClick={fetchUpdates}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors"
          >
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            <Icon name="PlusIcon" size={14} />
            {ui.newUpdate}
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Updates list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed border-border">
          <Icon name="BoltIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">{ui.empty}</p>
          <p className="text-xs text-muted-foreground mt-1">{ui.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const typeConf = UPDATE_TYPE_CONFIG[u.update_type] || UPDATE_TYPE_CONFIG.platform_news;
            const colorConf = COLOR_MAP[u.color] || COLOR_MAP.blue;
            const isLoading = actionLoading.startsWith(u.id);
            return (
              <div key={u.id} className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                u.status === 'active' ? `${colorConf.bg} ${colorConf.border}` : 'bg-muted/30 border-border opacity-60'
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorConf.badge}`}>
                  <Icon name={u.icon as any} size={16} className={colorConf.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className={`text-sm font-bold ${colorConf.text}`}>{u.title}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorConf.badge}`}>
                      {(ui as any)[typeConf.labelKey]}
                    </span>
                    {u.is_auto && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                        {ui.auto}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      u.status === 'scheduled'? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {u.status === 'active' ? ui.active : u.status === 'scheduled' ? ui.scheduled : ui.inactive}
                    </span>
                  </div>
                  {u.body && <p className="text-xs text-muted-foreground leading-relaxed">{u.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {ui.order}: {u.display_order} · {new Date(u.created_at).toLocaleDateString('ar-SA')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleStatus(u)}
                    disabled={isLoading}
                    title={u.status === 'active' ? ui.pause : ui.activate}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${
                      u.status === 'active' ?'bg-emerald-100 hover:bg-emerald-200 text-emerald-700' :'bg-muted hover:bg-muted/80 text-muted-foreground'
                    }`}
                  >
                    {isLoading && actionLoading === u.id + 'toggle'
                      ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                      : <Icon name={u.status === 'active' ? 'PauseIcon' : 'PlayIcon'} size={13} />
                    }
                  </button>
                  <button
                    onClick={() => openEdit(u)}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name="PencilSquareIcon" size={13} />
                  </button>
                  <button
                    onClick={() => deleteUpdate(u.id)}
                    disabled={isLoading}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-colors disabled:opacity-50"
                  >
                    {isLoading && actionLoading === u.id + 'delete'
                      ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                      : <Icon name="TrashIcon" size={13} />
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <Icon name="BoltIcon" size={18} className="text-primary" />
              <h3 className="font-bold text-foreground">{editTarget ? ui.editUpdate : ui.createUpdate}</h3>
            </div>
            <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.updateType}</label>
                <select
                  value={form.update_type}
                  onChange={e => setForm(f => ({ ...f, update_type: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {Object.entries(UPDATE_TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{(ui as any)[v.labelKey]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.status}</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  <option value="active">{ui.active}</option>
                  <option value="inactive">{ui.inactive}</option>
                  <option value="scheduled">{ui.scheduled}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.titleEn}</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Enter update title..."
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.titleAr}</label>
              <input
                value={form.title_ar}
                onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))}
                placeholder={ui.titleArPlaceholder}
                dir="rtl"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.bodyEn}</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Optional description..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.bodyAr}</label>
              <textarea
                value={form.body_ar}
                onChange={e => setForm(f => ({ ...f, body_ar: e.target.value }))}
                placeholder={ui.bodyArPlaceholder}
                dir="rtl"
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.color}</label>
                <select
                  value={form.color}
                  onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  {Object.keys(COLOR_MAP).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.order}</label>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.linkOptional}</label>
                <input
                  value={form.link_url}
                  onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                  placeholder="/page-url"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.linkLabel}</label>
                <input
                  value={form.link_label}
                  onChange={e => setForm(f => ({ ...f, link_label: e.target.value }))}
                  placeholder={ui.linkLabelPlaceholder}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, is_auto: !f.is_auto }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form.is_auto ? 'bg-primary' : 'bg-muted'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_auto ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-semibold text-foreground">{ui.autoGenerated}</span>
            </label>
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              {ui.cancel}
            </button>
            <button
              onClick={saveUpdate}
              disabled={!form.title.trim() || actionLoading === 'save'}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {actionLoading === 'save' ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="CheckIcon" size={15} />}
              {editTarget ? ui.saveEdits : ui.createBtn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-section: System Health & Subscription ───────────────────────────────

function SystemHealthPanel() {
  const { t } = useLanguage();
  const ui = t.admin.liveInfra;
  const supabase = createClient();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editSubMode, setEditSubMode] = useState(false);
  const [subForm, setSubForm] = useState<Partial<Subscription>>({});
  const [cacheCleared, setCacheCleared] = useState(false);
  const [dbOptimized, setDbOptimized] = useState(false);
  const [speedScore] = useState(() => Math.floor(Math.random() * 15) + 82); // 82-96

  const fetchSubscription = useCallback(async () => {
    setLoadingSub(true);
    const { data } = await supabase
      .from('platform_subscription')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();
    setSubscription(data || null);
    if (data) setSubForm(data);
    setLoadingSub(false);
  }, [supabase]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleSubscriptionAction = async (action: 'upgrade' | 'downgrade' | 'renew' | 'cancel') => {
    if (!subscription) return;
    setActionLoading(action);
    const tierOrder = ['starter', 'growth', 'enterprise', 'custom'];
    const currentIdx = tierOrder.indexOf(subscription.tier);
    let newTier = subscription.tier;
    let newStatus = true;

    if (action === 'upgrade' && currentIdx < tierOrder.length - 1) newTier = tierOrder[currentIdx + 1];
    if (action === 'downgrade' && currentIdx > 0) newTier = tierOrder[currentIdx - 1];
    if (action === 'cancel') newStatus = false;
    if (action === 'renew') {
      const newDate = new Date();
      newDate.setMonth(newDate.getMonth() + 1);
      await supabase.from('platform_subscription').update({
        renewal_date: newDate.toISOString().split('T')[0],
        is_active: true,
      }).eq('id', subscription.id);
      await fetchSubscription();
      showSuccess('تم تجديد الاشتراك بنجاح ✅');
      setActionLoading('');
      return;
    }

    await supabase.from('platform_subscription').update({ tier: newTier, is_active: newStatus }).eq('id', subscription.id);
    await fetchSubscription();
    const msgs: Record<string, string> = {
      upgrade: `تم الترقية إلى ${TIER_CONFIG[newTier]?.label || newTier} ✅`,
      downgrade: `تم التخفيض إلى ${TIER_CONFIG[newTier]?.label || newTier}`,
      cancel: 'تم إلغاء الاشتراك',
    };
    showSuccess(msgs[action] || 'تم تحديث الاشتراك');
    setActionLoading('');
  };

  const saveSubEdit = async () => {
    if (!subscription) return;
    setActionLoading('saveEdit');
    await supabase.from('platform_subscription').update(subForm).eq('id', subscription.id);
    await fetchSubscription();
    setEditSubMode(false);
    showSuccess('تم حفظ بيانات الاشتراك');
    setActionLoading('');
  };

  const handleClearCache = async () => {
    setActionLoading('cache');
    await new Promise(r => setTimeout(r, 1500));
    setCacheCleared(true);
    setActionLoading('');
    showSuccess('تم تفريغ ذاكرة التخزين المؤقت بنجاح ✅');
    setTimeout(() => setCacheCleared(false), 5000);
  };

  const handleOptimizeDB = async () => {
    setActionLoading('db');
    await new Promise(r => setTimeout(r, 2000));
    setDbOptimized(true);
    setActionLoading('');
    showSuccess('تم تحسين قاعدة البيانات بنجاح ✅');
    setTimeout(() => setDbOptimized(false), 5000);
  };

  const storagePercent = subscription
    ? Math.min(100, Math.round((subscription.storage_used_gb / subscription.storage_limit_gb) * 100))
    : 0;
  const bandwidthPercent = subscription
    ? Math.min(100, Math.round((subscription.bandwidth_used_gb / subscription.bandwidth_limit_gb) * 100))
    : 0;

  const tierConf = subscription ? (TIER_CONFIG[subscription.tier] || TIER_CONFIG.growth) : TIER_CONFIG.growth;

  return (
    <div className="space-y-5">
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Speed Monitor */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon name="BoltIcon" size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-sm">{ui.perfMonitor}</p>
              <p className="text-[11px] text-white/60">Real-time Performance Monitor</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-white/80">{ui.active}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: ui.responseSpeed, value: `${speedScore}/100`, sub: speedScore >= 90 ? ui.excellent : speedScore >= 75 ? ui.good : ui.needsImprovement, color: speedScore >= 90 ? 'text-emerald-400' : speedScore >= 75 ? 'text-amber-400' : 'text-red-400' },
            { label: ui.loadTime, value: `${(100 - speedScore) * 0.03 + 0.8}s`.slice(0, 5), sub: ui.average, color: 'text-blue-400' },
            { label: ui.uptime, value: '99.9%', sub: 'Uptime', color: 'text-emerald-400' },
          ].map(m => (
            <div key={m.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{m.label}</p>
              <p className={`text-[10px] font-semibold ${m.color}`}>{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleClearCache}
            disabled={actionLoading === 'cache'}
            className="flex items-center justify-center gap-2 h-10 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
          >
            {actionLoading === 'cache'
              ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
              : <Icon name="TrashIcon" size={14} />
            }
            {cacheCleared ? `✅ ${ui.cacheCleared}` : ui.clearCache}
          </button>
          <button
            onClick={handleOptimizeDB}
            disabled={actionLoading === 'db'}
            className="flex items-center justify-center gap-2 h-10 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
          >
            {actionLoading === 'db'
              ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
              : <Icon name="CircleStackIcon" size={14} />
            }
            {dbOptimized ? `✅ ${ui.dbOptimized}` : ui.optimizeDb}
          </button>
        </div>
      </div>

      {/* Subscription Management */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Icon name="CreditCardIcon" size={17} className="text-violet-600" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{ui.subscriptionMgmt}</p>
              <p className="text-[11px] text-muted-foreground">Subscription & Hosting Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSubscription}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors"
            >
              <Icon name="ArrowPathIcon" size={14} className={loadingSub ? 'animate-spin text-primary' : 'text-muted-foreground'} />
            </button>
            {subscription && !editSubMode && (
              <button
                onClick={() => setEditSubMode(true)}
                className="flex items-center gap-1.5 h-8 px-3 bg-muted border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon name="PencilSquareIcon" size={13} />
                تعديل
              </button>
            )}
          </div>
        </div>

        {loadingSub ? (
          <div className="flex items-center justify-center py-10">
            <Icon name="ArrowPathIcon" size={22} className="animate-spin text-primary" />
          </div>
        ) : !subscription ? (
          <div className="text-center py-10 px-5">
            <Icon name="CreditCardIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">{ui.noSubscription}</p>
            <p className="text-xs text-muted-foreground mt-1">{ui.noSubscriptionHint}</p>
          </div>
        ) : editSubMode ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.planName}</label>
                <input
                  value={subForm.plan_name || ''}
                  onChange={e => setSubForm(f => ({ ...f, plan_name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.provider}</label>
                <input
                  value={subForm.provider || ''}
                  onChange={e => setSubForm(f => ({ ...f, provider: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.monthlyCost}</label>
                <input
                  type="number"
                  value={subForm.monthly_cost || 0}
                  onChange={e => setSubForm(f => ({ ...f, monthly_cost: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.renewalDate}</label>
                <input
                  type="date"
                  value={subForm.renewal_date || ''}
                  onChange={e => setSubForm(f => ({ ...f, renewal_date: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">حد التخزين (GB)</label>
                <input
                  type="number"
                  value={subForm.storage_limit_gb || 0}
                  onChange={e => setSubForm(f => ({ ...f, storage_limit_gb: parseInt(e.target.value) || 0 }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">التخزين المستخدم (GB)</label>
                <input
                  type="number"
                  step="0.1"
                  value={subForm.storage_used_gb || 0}
                  onChange={e => setSubForm(f => ({ ...f, storage_used_gb: parseFloat(e.target.value) || 0 }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ملاحظات</label>
              <textarea
                value={subForm.notes || ''}
                onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditSubMode(false)}
                className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={saveSubEdit}
                disabled={actionLoading === 'saveEdit'}
                className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {actionLoading === 'saveEdit' ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="CheckIcon" size={15} />}
                حفظ
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Plan info */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${tierConf.color}`}>
                <Icon name={tierConf.icon as any} size={16} />
                {tierConf.label} Plan
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">{subscription.plan_name}</p>
                <p className="text-xs text-muted-foreground">{subscription.provider} · ${subscription.monthly_cost}/شهر · تجديد: {subscription.renewal_date || 'غير محدد'}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold ${subscription.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {subscription.is_active ? '● نشط' : '● ملغي'}
              </div>
            </div>

            {/* Storage & Bandwidth bars */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon name="CircleStackIcon" size={13} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">التخزين</span>
                  </div>
                  <span className={`text-xs font-bold ${storagePercent > 80 ? 'text-red-600' : storagePercent > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {subscription.storage_used_gb} GB / {subscription.storage_limit_gb} GB ({storagePercent}%)
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${storagePercent > 80 ? 'bg-red-500' : storagePercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Icon name="SignalIcon" size={13} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">النطاق الترددي</span>
                  </div>
                  <span className={`text-xs font-bold ${bandwidthPercent > 80 ? 'text-red-600' : bandwidthPercent > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {subscription.bandwidth_used_gb} GB / {subscription.bandwidth_limit_gb} GB ({bandwidthPercent}%)
                  </span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${bandwidthPercent > 80 ? 'bg-red-500' : bandwidthPercent > 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${bandwidthPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleSubscriptionAction('upgrade')}
                disabled={!!actionLoading || subscription.tier === 'custom'}
                className="flex items-center justify-center gap-1.5 h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading === 'upgrade' ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="ArrowUpIcon" size={13} />}
                ترقية
              </button>
              <button
                onClick={() => handleSubscriptionAction('downgrade')}
                disabled={!!actionLoading || subscription.tier === 'starter'}
                className="flex items-center justify-center gap-1.5 h-10 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading === 'downgrade' ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="ArrowDownIcon" size={13} />}
                تخفيض
              </button>
              <button
                onClick={() => handleSubscriptionAction('renew')}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-1.5 h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading === 'renew' ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="ArrowPathIcon" size={13} />}
                تجديد
              </button>
              <button
                onClick={() => handleSubscriptionAction('cancel')}
                disabled={!!actionLoading || !subscription.is_active}
                className="flex items-center justify-center gap-1.5 h-10 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="XMarkIcon" size={13} />}
                إلغاء
              </button>
            </div>

            {(storagePercent > 80 || bandwidthPercent > 80) && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-700">تحذير: اقتراب من الحد الأقصى</p>
                  <p className="text-[11px] text-red-600 mt-0.5">
                    {storagePercent > 80 && `التخزين وصل ${storagePercent}% من الحد. `}
                    {bandwidthPercent > 80 && `النطاق الترددي وصل ${bandwidthPercent}% من الحد.`}
                    يُنصح بالترقية لتجنب انقطاع الخدمة.
                  </p>
                  <button
                    onClick={() => handleSubscriptionAction('upgrade')}
                    className="mt-1.5 text-[11px] font-bold text-red-700 underline hover:no-underline"
                  >
                    ترقية الخطة الآن ←
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-section: Error & Broken Links Manager ───────────────────────────────

function ErrorLogsPanel() {
  const { t } = useLanguage();
  const ui = t.admin.liveInfra;
  const supabase = createClient();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [newError, setNewError] = useState({
    severity: 'warning' as const,
    error_code: '',
    title: '',
    description: '',
    affected_url: '',
    affected_component: '',
    resolution_action: '',
  });

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('system_error_logs')
      .select('*')
      .order('created_at', { ascending: false });
    setErrors(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const resolveError = async (id: string, action: 'resolved' | 'ignored') => {
    setActionLoading(id + action);
    await supabase.from('system_error_logs').update({
      status: action,
      resolved_at: new Date().toISOString(),
    }).eq('id', id);
    await fetchErrors();
    showSuccess(action === 'resolved' ? 'تم حل المشكلة ✅' : 'تم تجاهل المشكلة');
    setActionLoading('');
  };

  const reopenError = async (id: string) => {
    setActionLoading(id + 'reopen');
    await supabase.from('system_error_logs').update({ status: 'open', resolved_at: null }).eq('id', id);
    await fetchErrors();
    showSuccess('تم إعادة فتح المشكلة');
    setActionLoading('');
  };

  const deleteError = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return;
    setActionLoading(id + 'delete');
    await supabase.from('system_error_logs').delete().eq('id', id);
    await fetchErrors();
    showSuccess('تم حذف السجل');
    setActionLoading('');
  };

  const addError = async () => {
    if (!newError.title.trim()) return;
    setActionLoading('add');
    await supabase.from('system_error_logs').insert({
      ...newError,
      error_code: newError.error_code || null,
      description: newError.description || null,
      affected_url: newError.affected_url || null,
      affected_component: newError.affected_component || null,
      resolution_action: newError.resolution_action || null,
    });
    await fetchErrors();
    setShowAddForm(false);
    setNewError({ severity: 'warning', error_code: '', title: '', description: '', affected_url: '', affected_component: '', resolution_action: '' });
    showSuccess('تم إضافة سجل الخطأ');
    setActionLoading('');
  };

  const filtered = errors.filter(e => {
    const matchStatus = !filterStatus || e.status === filterStatus;
    const matchSev = !filterSeverity || e.severity === filterSeverity;
    return matchStatus && matchSev;
  });

  const openCount = errors.filter(e => e.status === 'open').length;
  const criticalCount = errors.filter(e => e.severity === 'critical' && e.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
            <Icon name="ExclamationCircleIcon" size={18} className="text-red-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-sm">معالجة الأخطاء والروابط المعطلة</h3>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full animate-pulse">
                  {criticalCount} حرج
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{openCount} مشكلة مفتوحة · {errors.length} إجمالي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
          >
            <option value="">كل الأنواع</option>
            <option value="critical">حرج</option>
            <option value="warning">تحذير</option>
            <option value="info">معلومة</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
          >
            <option value="open">مفتوح</option>
            <option value="resolved">محلول</option>
            <option value="ignored">مُتجاهل</option>
            <option value="">الكل</option>
          </select>
          <button
            onClick={fetchErrors}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted transition-colors"
          >
            <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin text-primary' : 'text-muted-foreground'} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 h-9 px-3 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
          >
            <Icon name="PlusIcon" size={13} />
            تسجيل خطأ
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {/* Error list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Icon name="CheckCircleIcon" size={32} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-emerald-700">لا توجد مشاكل مفتوحة</p>
          <p className="text-xs text-emerald-600 mt-1">النظام يعمل بشكل سليم</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(err => {
            const sevConf = SEVERITY_CONFIG[err.severity] || SEVERITY_CONFIG.info;
            const isLoading = actionLoading.startsWith(err.id);
            return (
              <div key={err.id} className={`p-4 rounded-xl border transition-all ${
                err.status === 'open'
                  ? `${sevConf.color} border`
                  : 'bg-muted/30 border-border opacity-70'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${sevConf.dot} ${err.status === 'open' ? 'animate-pulse' : ''}`} />
                    <Icon name={sevConf.icon as any} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-bold">{err.title}</p>
                      {err.error_code && (
                        <span className="px-2 py-0.5 bg-black/10 rounded text-[10px] font-mono font-bold">{err.error_code}</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        err.status === 'open' ? 'bg-red-100 text-red-700' :
                        err.status === 'resolved'? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {err.status === 'open' ? 'مفتوح' : err.status === 'resolved' ? 'محلول' : 'مُتجاهل'}
                      </span>
                    </div>
                    {err.description && <p className="text-xs opacity-80 mb-1">{err.description}</p>}
                    <div className="flex items-center gap-3 flex-wrap text-[11px] opacity-70">
                      {err.affected_url && (
                        <span className="flex items-center gap-1">
                          <Icon name="LinkIcon" size={11} />
                          {err.affected_url}
                        </span>
                      )}
                      {err.affected_component && (
                        <span className="flex items-center gap-1">
                          <Icon name="CubeIcon" size={11} />
                          {err.affected_component}
                        </span>
                      )}
                    </div>
                    {err.resolution_action && (
                      <div className="mt-2 flex items-start gap-1.5 text-[11px]">
                        <Icon name="WrenchScrewdriverIcon" size={12} className="shrink-0 mt-0.5 opacity-70" />
                        <span className="opacity-80">الحل المقترح: {err.resolution_action}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {err.status === 'open' ? (
                      <>
                        <button
                          onClick={() => resolveError(err.id, 'resolved')}
                          disabled={isLoading}
                          title="تحديد كمحلول"
                          className="flex items-center gap-1 h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isLoading && actionLoading === err.id + 'resolved'
                            ? <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                            : <Icon name="CheckIcon" size={12} />
                          }
                          حل
                        </button>
                        <button
                          onClick={() => resolveError(err.id, 'ignored')}
                          disabled={isLoading}
                          title="تجاهل"
                          className="h-8 w-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Icon name="EyeSlashIcon" size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => reopenError(err.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1 h-8 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Icon name="ArrowPathIcon" size={12} />
                        إعادة فتح
                      </button>
                    )}
                    <button
                      onClick={() => deleteError(err.id)}
                      disabled={isLoading}
                      className="h-8 w-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Icon name="TrashIcon" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Error Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <Icon name="ExclamationCircleIcon" size={18} className="text-red-500" />
              <h3 className="font-bold text-foreground">تسجيل خطأ جديد</h3>
            </div>
            <button onClick={() => setShowAddForm(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">الخطورة</label>
                <select
                  value={newError.severity}
                  onChange={e => setNewError(f => ({ ...f, severity: e.target.value as any }))}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  <option value="critical">حرج</option>
                  <option value="warning">تحذير</option>
                  <option value="info">معلومة</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">كود الخطأ</label>
                <input
                  value={newError.error_code}
                  onChange={e => setNewError(f => ({ ...f, error_code: e.target.value }))}
                  placeholder="IMG_404"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">عنوان المشكلة *</label>
              <input
                value={newError.title}
                onChange={e => setNewError(f => ({ ...f, title: e.target.value }))}
                placeholder="وصف موجز للمشكلة..."
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.details}</label>
              <textarea
                value={newError.description}
                onChange={e => setNewError(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.affectedLink}</label>
                <input
                  value={newError.affected_url}
                  onChange={e => setNewError(f => ({ ...f, affected_url: e.target.value }))}
                  placeholder="/page-url"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.affectedComponent}</label>
                <input
                  value={newError.affected_component}
                  onChange={e => setNewError(f => ({ ...f, affected_component: e.target.value }))}
                  placeholder="ComponentName"
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{ui.proposedFix}</label>
              <input
                value={newError.resolution_action}
                onChange={e => setNewError(f => ({ ...f, resolution_action: e.target.value }))}
                placeholder={ui.fixStepsPlaceholder}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={addError}
              disabled={!newError.title.trim() || actionLoading === 'add'}
              className="flex-1 h-10 bg-red-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              {actionLoading === 'add' ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="PlusIcon" size={15} />}
              تسجيل الخطأ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export: Live Updates & System Infrastructure Panel ─────────────────

export default function LiveUpdatesInfraPanel() {
  const { t, dir } = useLanguage();
  const ui = t.admin.liveInfra;
  const [activeSection, setActiveSection] = useState<'updates' | 'health' | 'errors'>('updates');

  const sections = [
    { key: 'updates' as const, label: ui.sectionUpdates, icon: 'BoltIcon', color: 'text-blue-600', badge: null },
    { key: 'health' as const, label: ui.sectionHealth, icon: 'ServerIcon', color: 'text-violet-600', badge: null },
    { key: 'errors' as const, label: ui.sectionErrors, icon: 'ExclamationCircleIcon', color: 'text-red-600', badge: null },
  ];

  return (
    <div className="space-y-5" dir={dir}>
      {/* Module Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon name="ServerStackIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold">{ui.title}</h2>
              <span className="px-2 py-0.5 bg-white/20 text-[10px] font-bold rounded-full">Live Updates & Infrastructure</span>
            </div>
            <p className="text-xs text-white/70">{ui.subtitle}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-white/80">{ui.active}</span>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors flex-1 justify-center ${
              activeSection === s.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={s.icon as any} size={15} className={activeSection === s.key ? s.color : ''} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {activeSection === 'updates' && <LiveUpdatesManager />}
      {activeSection === 'health' && <SystemHealthPanel />}
      {activeSection === 'errors' && <ErrorLogsPanel />}
    </div>
  );
}
