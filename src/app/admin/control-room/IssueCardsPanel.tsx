'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IssueCard {
  id: string;
  title: string;
  source: string;
  severity: 'critical' | 'warning' | 'info' | 'improvement';
  type: 'product_missing_data' | 'supplier_escalation' | 'registration_pending' | 'escrow_delay' | 'system_error' | 'improvement';
  description: string;
  diagnostic: string;
  suggested_action: string;
  auto_fix_available: boolean;
  reference_id?: string;
  reference_type?: string;
  status: 'open' | 'in_progress' | 'approved' | 'fixed' | 'manual_edit' | 'dismissed';
  created_at: string;
  // For product issues
  product_id?: string;
  product_name?: string;
  manufacturer_id?: string;
  manufacturer_name?: string;
  missing_fields?: string[];
  // For auto-generated description
  generated_description?: string;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; headerBg: string }> = {
  critical: { label: '🔴 حرج', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', headerBg: 'bg-red-600' },
  warning: { label: '🟡 تحذير', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-amber-500' },
  info: { label: '🔵 معلومة', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-600' },
  improvement: { label: '🟢 تحسين', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-600' },
};

const FIELD_LABELS: Record<string, string> = {
  price: 'السعر',
  image: 'صورة المنتج',
  quantity: 'الكمية',
  name: 'اسم المنتج',
  description: 'وصف المنتج',
  category: 'الفئة',
  sku: 'كود المنتج',
  origin_country: 'بلد المنشأ',
};

function formatDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function IssueCardsPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.issueCards;
  const severityLabels: Record<string, string> = {
    critical: `🔴 ${ui.critical}`,
    warning: `🟡 ${ui.warning}`,
    info: `🔵 ${ui.info}`,
    improvement: `🟢 ${ui.improvement}`,
  };
  const supabase = createClient();
  const [cards, setCards] = useState<IssueCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'fixed' | 'dismissed'>('open');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<IssueCard | null>(null);
  const [editNote, setEditNote] = useState('');
  const [generatingDesc, setGeneratingDesc] = useState<string | null>(null);
  const [generatedDescs, setGeneratedDescs] = useState<Record<string, string>>({});
  const [cardStatuses, setCardStatuses] = useState<Record<string, IssueCard['status']>>({});

  const buildIssueCards = useCallback(async () => {
    setLoading(true);
    const collected: IssueCard[] = [];
    const now = new Date();

    try {
      // 1. Escalated supplier alerts → Critical issue cards
      const { data: escalated } = await supabase
        .from('supplier_alerts')
        .select('id, product_id, product_name, manufacturer_id, manufacturer_name, missing_fields, escalated_at, admin_note')
        .eq('status', 'escalated')
        .order('escalated_at', { ascending: false })
        .limit(20);

      (escalated || []).forEach((a: any) => {
        const fields = (a.missing_fields as string[] || []).map((f: string) => FIELD_LABELS[f] || f);
        const hasDescMissing = (a.missing_fields as string[] || []).includes('description');
        collected.push({
          id: `issue_esc_${a.id}`,
          title: `منتج مُصعَّد: ${a.product_name || 'منتج'}`,
          source: 'محرك تنبيهات الموردين',
          severity: 'critical',
          type: 'supplier_escalation',
          description: `المورد "${a.manufacturer_name || '—'}" لم يستجب خلال مهلة 48 ساعة. الحقول الناقصة: ${fields.join('، ')}`,
          diagnostic: `تم تصعيد التنبيه تلقائياً بعد انتهاء مهلة الاستجابة. المنتج غير مكتمل ولا يمكن نشره.`,
          suggested_action: hasDescMissing
            ? 'توليد وصف تلقائي بخدمات المنصة + إشعار المورد بالتحديثات المتبقية' :'مراجعة بيانات المنتج يدوياً وإشعار المورد بالتصحيح المطلوب',
          auto_fix_available: hasDescMissing,
          reference_id: a.id,
          reference_type: 'supplier_alert',
          status: cardStatuses[`issue_esc_${a.id}`] || 'open',
          created_at: a.escalated_at || now.toISOString(),
          product_id: a.product_id,
          product_name: a.product_name,
          manufacturer_id: a.manufacturer_id,
          manufacturer_name: a.manufacturer_name,
          missing_fields: a.missing_fields || [],
        });
      });

      // 2. Open supplier alerts (notified, not yet escalated)
      const { data: openAlerts } = await supabase
        .from('supplier_alerts')
        .select('id, product_id, product_name, manufacturer_id, manufacturer_name, missing_fields, created_at, deadline_at')
        .eq('status', 'notified')
        .order('created_at', { ascending: false })
        .limit(15);

      (openAlerts || []).forEach((a: any) => {
        const fields = (a.missing_fields as string[] || []).map((f: string) => FIELD_LABELS[f] || f);
        const hasDescMissing = (a.missing_fields as string[] || []).includes('description');
        const deadline = a.deadline_at ? new Date(a.deadline_at) : null;
        const hoursLeft = deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60))) : null;
        collected.push({
          id: `issue_open_${a.id}`,
          title: `بيانات ناقصة: ${a.product_name || 'منتج'}`,
          source: 'الماسح الشامل',
          severity: hoursLeft !== null && hoursLeft < 6 ? 'warning' : 'info',
          type: 'product_missing_data',
          description: `الحقول الناقصة: ${fields.join('، ')}${hoursLeft !== null ? `. المهلة المتبقية: ${hoursLeft} ساعة` : ''}`,
          diagnostic: `تم إشعار المورد وبانتظار الاستجابة. ${hoursLeft !== null && hoursLeft < 6 ? 'تحذير: المهلة على وشك الانتهاء!' : ''}`,
          suggested_action: hasDescMissing
            ? 'توليد وصف تلقائي احترافي بخدمات المنصة لتسريع النشر' :'انتظار استجابة المورد أو التدخل اليدوي',
          auto_fix_available: hasDescMissing,
          reference_id: a.id,
          reference_type: 'supplier_alert',
          status: cardStatuses[`issue_open_${a.id}`] || 'open',
          created_at: a.created_at,
          product_id: a.product_id,
          product_name: a.product_name,
          manufacturer_id: a.manufacturer_id,
          manufacturer_name: a.manufacturer_name,
          missing_fields: a.missing_fields || [],
        });
      });

      // 3. Pending factory registrations > 48h
      const { data: pendingRegs } = await supabase
        .from('factory_registrations')
        .select('id, company_name, contact_email, submitted_at, registration_status')
        .eq('registration_status', 'pending')
        .lt('submitted_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
        .limit(10);

      (pendingRegs || []).forEach((r: any) => {
        collected.push({
          id: `issue_reg_${r.id}`,
          title: `تسجيل معلق: ${r.company_name || 'مصنع'}`,
          source: 'نظام التسجيل',
          severity: 'warning',
          type: 'registration_pending',
          description: `طلب تسجيل المصنع معلق منذ أكثر من 48 ساعة دون مراجعة. البريد: ${r.contact_email || '—'}`,
          diagnostic: `الطلب في حالة "pending" ولم يتم تعيين مراجع له. قد يؤدي التأخير إلى فقدان المورد.`,
          suggested_action: 'مراجعة الوثائق المرفقة واتخاذ قرار الاعتماد أو الرفض فوراً',
          auto_fix_available: false,
          reference_id: r.id,
          reference_type: 'factory_registration',
          status: cardStatuses[`issue_reg_${r.id}`] || 'open',
          created_at: r.submitted_at || now.toISOString(),
        });
      });

      // 4. Escrow delays
      const { data: escrowOrders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, currency, created_at')
        .eq('escrow_status', 'held')
        .lt('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(5);

      (escrowOrders || []).forEach((o: any) => {
        collected.push({
          id: `issue_escrow_${o.id}`,
          title: `تأخير Escrow: طلب #${o.order_number || o.id.slice(0, 8)}`,
          source: 'نظام الضمان المالي',
          severity: 'critical',
          type: 'escrow_delay',
          description: `الأموال محتجزة منذ أكثر من 7 أيام. المبلغ: ${o.currency || 'USD'} ${Number(o.total_amount || 0).toLocaleString('en-US')}`,
          diagnostic: `الطلب في حالة Escrow لفترة طويلة. قد يكون هناك نزاع أو تأخير في التسليم.`,
          suggested_action: 'مراجعة حالة الطلب والتواصل مع البائع والمشتري لحل النزاع أو الإفراج عن الأموال',
          auto_fix_available: false,
          reference_id: o.id,
          reference_type: 'order',
          status: cardStatuses[`issue_escrow_${o.id}`] || 'open',
          created_at: o.created_at,
        });
      });

      // Sort: critical first, then by date
      const severityOrder = { critical: 0, warning: 1, info: 2, improvement: 3 };
      collected.sort((a, b) => {
        const sA = severityOrder[a.severity] ?? 4;
        const sB = severityOrder[b.severity] ?? 4;
        if (sA !== sB) return sA - sB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setCards(collected);
    } catch (e) {
      console.error('Issue cards error:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase, cardStatuses]);

  useEffect(() => {
    buildIssueCards();
  }, []);

  const handleApprovePublish = async (card: IssueCard) => {
    if (!card.product_id) return;
    setActionLoading(card.id + '_approve');
    try {
      // Resolve the supplier alert
      if (card.reference_id && card.reference_type === 'supplier_alert') {
        await fetch('/api/supplier-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve', alertId: card.reference_id, adminNote: 'اعتمد المدير النشر' }),
        });
      }
      // Mark product as active
      await supabase
        .from('manufacturer_products')
        .update({ is_active: true })
        .eq('id', card.product_id);

      setCardStatuses((prev) => ({ ...prev, [card.id]: 'approved' }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleFixIt = async (card: IssueCard) => {
    if (!card.product_id || !card.missing_fields?.includes('description')) return;
    setGeneratingDesc(card.id);
    try {
      const res = await fetch('/api/auto-generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: card.product_id,
          productName: card.product_name,
          alertId: card.reference_id,
        }),
      });
      const data = await res.json();
      if (data.description) {
        setGeneratedDescs((prev) => ({ ...prev, [card.id]: data.description }));
        setCardStatuses((prev) => ({ ...prev, [card.id]: 'fixed' }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingDesc(null);
    }
  };

  const handleManualEdit = (card: IssueCard) => {
    setEditModal(card);
    setEditNote(card.diagnostic);
  };

  const handleSaveManualEdit = async () => {
    if (!editModal) return;
    setActionLoading(editModal.id + '_manual');
    try {
      if (editModal.reference_id && editModal.reference_type === 'supplier_alert') {
        await fetch('/api/supplier-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve', alertId: editModal.reference_id, adminNote: editNote }),
        });
      }
      setCardStatuses((prev) => ({ ...prev, [editModal.id]: 'manual_edit' }));
      setEditModal(null);
      setEditNote('');
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (card: IssueCard) => {
    setActionLoading(card.id + '_dismiss');
    try {
      if (card.reference_id && card.reference_type === 'supplier_alert') {
        await fetch('/api/supplier-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'dismiss', alertId: card.reference_id }),
        });
      }
      setCardStatuses((prev) => ({ ...prev, [card.id]: 'dismissed' }));
    } finally {
      setActionLoading(null);
    }
  };

  const getCardStatus = (card: IssueCard): IssueCard['status'] => {
    return cardStatuses[card.id] || card.status;
  };

  const filtered = cards.filter((c) => {
    const status = getCardStatus(c);
    const matchStatus = filter === 'all' || status === filter || (filter === 'open' && (status === 'open' || status === 'in_progress'));
    const matchSeverity = severityFilter === 'all' || c.severity === severityFilter;
    return matchStatus && matchSeverity;
  });

  const stats = {
    open: cards.filter((c) => ['open', 'in_progress'].includes(getCardStatus(c))).length,
    critical: cards.filter((c) => c.severity === 'critical').length,
    fixed: cards.filter((c) => ['fixed', 'approved', 'manual_edit'].includes(getCardStatus(c))).length,
    total: cards.length,
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="RectangleStackIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/70">{ui.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {stats.critical > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                {stats.critical} حرج
              </span>
            )}
            <span className="text-xs text-white/70">{ui.openCount.replace('{count}', String(stats.open))}</span>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: ui.totalCards, value: stats.total, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', icon: 'RectangleStackIcon' },
          { label: ui.openInProgress, value: stats.open, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: 'ExclamationCircleIcon' },
          { label: ui.criticalNeedsAction, value: stats.critical, color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: 'ShieldExclamationIcon' },
          { label: ui.fixed, value: stats.fixed, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border ${s.bg}`}>
            <Icon name={s.icon as any} size={20} className={s.color} />
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {[
            { key: 'open', label: ui.open },
            { key: 'fixed', label: ui.fixed },
            { key: 'dismissed', label: 'مُغلق' },
            { key: 'all', label: ui.filterAll },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mr-auto">
          {[
            { key: 'all', label: 'كل الأولويات' },
            { key: 'critical', label: '🔴 حرج' },
            { key: 'warning', label: '🟡 تحذير' },
            { key: 'info', label: '🔵 معلومة' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setSeverityFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${severityFilter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Refresh ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setCardStatuses({}); buildIssueCards(); }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="ArrowPathIcon" size={16} />
          )}
          تحديث البطاقات
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} بطاقة</span>
      </div>

      {/* ── Issue Cards Grid ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Icon name="CheckBadgeIcon" size={48} className="text-emerald-400" />
          <p className="text-base font-bold text-foreground">لا توجد بطاقات مفتوحة</p>
          <p className="text-sm text-muted-foreground">جميع المشاكل تمت معالجتها</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((card) => {
            const cfg = SEVERITY_CONFIG[card.severity];
            const status = getCardStatus(card);
            const isResolved = ['approved', 'fixed', 'manual_edit', 'dismissed'].includes(status);
            const genDesc = generatedDescs[card.id];

            return (
              <div
                key={card.id}
                className={`rounded-2xl border-2 overflow-hidden transition-all ${isResolved ? 'opacity-70' : ''} ${cfg.border}`}
              >
                {/* Card Header */}
                <div className={`${cfg.bg} px-4 py-3 border-b ${cfg.border}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${cfg.color} leading-snug`}>{card.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                          {severityLabels[card.severity] || card.severity}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Icon name="ServerIcon" size={9} />
                          {card.source}
                        </span>
                      </div>
                    </div>
                    {isResolved && (
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                        {status === 'approved' ? '✅ اعتُمد' : status === 'fixed' ? '🔧 أُصلح' : status === 'manual_edit' ? '✏️ عُدِّل' : '🚫 مُغلق'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="bg-card p-4 space-y-3">
                  {/* Description */}
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">الوصف التشخيصي</p>
                    <p className="text-xs text-foreground leading-relaxed">{card.description}</p>
                  </div>

                  {/* Diagnostic */}
                  <div className="bg-muted/40 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-1">{ui.problemAnalysis}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{card.diagnostic}</p>
                  </div>

                  {/* Suggested Action */}
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-1">
                      ⚡ الإجراء المقترح من خدمات المنصة
                    </p>
                    <p className="text-xs text-blue-800 leading-relaxed">{card.suggested_action}</p>
                  </div>

                  {/* Generated Description (if available) */}
                  {genDesc && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">
                        ✅ الوصف المُولَّد تلقائياً
                      </p>
                      <p className="text-xs text-emerald-800 leading-relaxed">{genDesc}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
                    <span>{formatDate(card.created_at)}</span>
                    {card.manufacturer_name && <span>{ui.supplier}: {card.manufacturer_name}</span>}
                  </div>

                  {/* Action Buttons */}
                  {!isResolved && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* Approve Publish */}
                      {card.product_id && (
                        <button
                          onClick={() => handleApprovePublish(card)}
                          disabled={actionLoading === card.id + '_approve'}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                          {actionLoading === card.id + '_approve' ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icon name="CheckCircleIcon" size={13} />
                          )}
                          اعتماد النشر
                        </button>
                      )}

                      {/* Fix It — auto generate description */}
                      {card.auto_fix_available && (
                        <button
                          onClick={() => handleFixIt(card)}
                          disabled={generatingDesc === card.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
                        >
                          {generatingDesc === card.id ? (
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Icon name="SparklesIcon" size={13} />
                          )}
                          Fix It — توليد وصف
                        </button>
                      )}

                      {/* Manual Edit */}
                      <button
                        onClick={() => handleManualEdit(card)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
                      >
                        <Icon name="PencilSquareIcon" size={13} />
                        تعديل يدوي
                      </button>

                      {/* Dismiss */}
                      <button
                        onClick={() => handleDismiss(card)}
                        disabled={actionLoading === card.id + '_dismiss'}
                        className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground text-xs font-semibold rounded-xl hover:bg-muted/80 transition-colors"
                      >
                        <Icon name="XMarkIcon" size={13} />
                        إغلاق
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Manual Edit Modal ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">{ui.manualEdit} — {editModal.title}</h3>
              <button onClick={() => setEditModal(null)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-2">{ui.adminNote}</label>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder={ui.notePlaceholder}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveManualEdit}
                  disabled={actionLoading === editModal.id + '_manual'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60"
                >
                  {actionLoading === editModal.id + '_manual' ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="CheckIcon" size={16} />
                  )}
                  حفظ التعديل
                </button>
                <button
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2.5 border border-border text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
