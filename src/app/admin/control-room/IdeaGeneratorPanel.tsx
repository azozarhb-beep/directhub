'use client';

import React, { useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlatformIdea {
  id: string;
  title: string;
  category: 'feature' | 'ux' | 'market_gap' | 'automation' | 'escrow' | 'supplier';
  priority: 'high' | 'medium' | 'low';
  description: string;
  feasibility: string;
  estimated_impact: 'high' | 'medium' | 'low';
  data_basis: string;
  implementation_steps: string[];
  status?: 'pending' | 'approved' | 'editing' | 'rejected';
  admin_note?: string;
}

interface PlatformContext {
  totalProducts: number;
  pendingAlerts: number;
  escalatedAlerts: number;
  pendingRegistrations: number;
  totalOrders: number;
  heldEscrow: number;
  totalRFQs: number;
  pendingRFQs: number;
  missingDescCount: number;
  missingImageCount: number;
  missingPriceCount: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  feature: { label: 'ميزة جديدة', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: 'SparklesIcon' },
  ux: { label: 'تحسين UX', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: 'PaintBrushIcon' },
  market_gap: { label: 'فجوة سوقية', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: 'ChartBarIcon' },
  automation: { label: 'أتمتة', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: 'CpuChipIcon' },
  escrow: { label: 'Escrow', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: 'ShieldCheckIcon' },
  supplier: { label: 'موردون', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: 'BuildingOffice2Icon' },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string }> = {
  high: { label: 'أولوية عالية', dot: 'bg-red-500' },
  medium: { label: 'أولوية متوسطة', dot: 'bg-amber-500' },
  low: { label: 'أولوية منخفضة', dot: 'bg-emerald-500' },
};

const IMPACT_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'تأثير عالٍ', color: 'text-red-600' },
  medium: { label: 'تأثير متوسط', color: 'text-amber-600' },
  low: { label: 'تأثير منخفض', color: 'text-emerald-600' },
};

// ─── Idea Card ────────────────────────────────────────────────────────────────
function IdeaCard({
  idea,
  onApprove,
  onEdit,
  onReject,
  actionLoading,
}: {
  idea: PlatformIdea;
  onApprove: (id: string) => void;
  onEdit: (idea: PlatformIdea) => void;
  onReject: (id: string) => void;
  actionLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_CONFIG[idea.category] || CATEGORY_CONFIG.feature;
  const pri = PRIORITY_CONFIG[idea.priority] || PRIORITY_CONFIG.medium;
  const imp = IMPACT_CONFIG[idea.estimated_impact] || IMPACT_CONFIG.medium;

  const isLoading = actionLoading === idea.id;
  const isDone = idea.status === 'approved' || idea.status === 'rejected';

  return (
    <div
      className={`relative bg-card border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
        idea.status === 'approved' ?'border-emerald-300 bg-emerald-50/30'
          : idea.status === 'rejected' ?'border-red-200 bg-red-50/20 opacity-60'
          : idea.status === 'editing' ?'border-amber-300 bg-amber-50/30' :'border-border hover:border-primary/40 hover:shadow-md'
      }`}
    >
      {/* Status ribbon */}
      {idea.status === 'approved' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
      )}
      {idea.status === 'rejected' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
      )}
      {idea.status === 'editing' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.bg}`}>
            <Icon name={cat.icon as any} size={20} className={cat.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${pri.dot}`} />
                {pri.label}
              </span>
              <span className={`text-xs font-semibold ${imp.color}`}>{imp.label}</span>
            </div>
            <h3 className="font-bold text-foreground text-sm leading-snug">{idea.title}</h3>
          </div>
          {/* Status badge */}
          {idea.status === 'approved' && (
            <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              <Icon name="CheckCircleIcon" size={13} /> معتمدة
            </span>
          )}
          {idea.status === 'rejected' && (
            <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
              <Icon name="XCircleIcon" size={13} /> مرفوضة
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{idea.description}</p>

        {/* Data basis */}
        <div className="flex items-start gap-2 bg-muted/40 rounded-xl px-3 py-2 mb-3">
          <Icon name="ChartBarIcon" size={13} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{idea.data_basis}</p>
        </div>

        {/* Feasibility */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
          <Icon name="LightBulbIcon" size={13} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed font-medium">{idea.feasibility}</p>
        </div>

        {/* Expandable steps */}
        {idea.implementation_steps && idea.implementation_steps.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Icon name={expanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} />
              {expanded ? 'إخفاء خطوات التنفيذ' : `عرض خطوات التنفيذ (${idea.implementation_steps.length})`}
            </button>
            {expanded && (
              <ol className="mt-2 space-y-1.5 pr-4">
                {idea.implementation_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Admin note */}
        {idea.admin_note && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-xs text-amber-700"><span className="font-bold">ملاحظة: </span>{idea.admin_note}</p>
          </div>
        )}

        {/* Action buttons */}
        {!isDone && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => onApprove(idea.id)}
              disabled={isLoading}
              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
              ) : (
                <Icon name="CheckCircleIcon" size={13} />
              )}
              ✅ موافقة وتنفيذ
            </button>
            <button
              onClick={() => onEdit(idea)}
              disabled={isLoading}
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <Icon name="PencilSquareIcon" size={13} />
              ✏️ تعديل
            </button>
            <button
              onClick={() => onReject(idea.id)}
              disabled={isLoading}
              className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <Icon name="XCircleIcon" size={13} />
              ❌ رفض
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  idea,
  onSave,
  onClose,
}: {
  idea: PlatformIdea;
  onSave: (id: string, note: string) => void;
  onClose: () => void;
}) {
  const { t, dir, language } = useLanguage();
  const ui = t.admin.ideaGenerator;
  const [note, setNote] = useState(idea.admin_note || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-foreground">{language === "ar" ? "✏️ تعديل المقترح" : "✏️ Edit proposal"}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">{language === "ar" ? "الفكرة" : "Idea"}</p>
            <p className="text-sm font-bold text-foreground">{idea.title}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ملاحظة التعديل / التوجيه</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              placeholder="أضف ملاحظتك أو توجيهك لتعديل هذه الفكرة..."
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-background text-foreground focus:outline-none focus:border-primary resize-none"
              dir={dir}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={() => onSave(idea.id, note)}
              className="flex-1 h-10 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors"
            >
              حفظ التعديل
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function IdeaGeneratorPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.ideaGenerator;

  const [ideas, setIdeas] = useState<PlatformIdea[]>([]);
  const [platformContext, setPlatformContext] = useState<PlatformContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingIdea, setEditingIdea] = useState<PlatformIdea | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<{ ideaId: string; actions: string[] } | null>(null);

  const generateIdeas = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/idea-generator', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setIdeas((data.ideas || []).map((idea: PlatformIdea) => ({ ...idea, status: 'pending' })));
        setPlatformContext(data.platformContext);
        setGeneratedAt(data.generatedAt);
        setApprovedCount(0);
        setRejectedCount(0);
      } else {
        setErrorMsg(data.error || 'حدث خطأ أثناء توليد الأفكار');
      }
    } catch (e: any) {
      console.error('Idea generator error:', e);
      setErrorMsg('تعذّر الاتصال بمحرك الأفكار. يرجى المحاولة مجدداً.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApprove = useCallback(async (id: string) => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;

    setActionLoading(id);
    setExecuteResult(null);

    try {
      const res = await fetch('/api/ai/idea-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'فشل تنفيذ الفكرة. يرجى المحاولة مجدداً.';
        console.error('[IdeaExecute] Backend error:', errMsg, data.errors);
        setErrorMsg(errMsg);
        setActionLoading(null);
        return;
      }

      // Backend succeeded — now update UI state
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'approved' } : i));
      setApprovedCount(c => c + 1);
      setExecuteResult({ ideaId: id, actions: data.executed_actions || [] });
    } catch (e: any) {
      console.error('[IdeaExecute] Network error:', e);
      setErrorMsg('تعذّر الاتصال بالخادم. يرجى التحقق من الاتصال والمحاولة مجدداً.');
    } finally {
      setActionLoading(null);
    }
  }, [ideas]);

  const handleEdit = useCallback((idea: PlatformIdea) => {
    setEditingIdea(idea);
  }, []);

  const handleSaveEdit = useCallback((id: string, note: string) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'editing', admin_note: note } : i));
    setEditingIdea(null);
  }, []);

  const handleReject = useCallback(async (id: string) => {
    setActionLoading(id);
    await new Promise(r => setTimeout(r, 400));
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: 'rejected' } : i));
    setRejectedCount(c => c + 1);
    setActionLoading(null);
  }, []);

  const filteredIdeas = filterCategory === 'all'
    ? ideas
    : ideas.filter(i => i.category === filterCategory);

  const pendingCount = ideas.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="LightBulbIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">{ui.subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            {generatedAt && (
              <p className="text-xs text-white/60 mb-2">
                آخر تحليل: {new Date(generatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button
              onClick={generateIdeas}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-violet-700 text-sm font-bold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Icon name="ArrowPathIcon" size={15} className="animate-spin" />
              ) : (
                <Icon name="SparklesIcon" size={15} />
              )}
              {loading ? 'جاري التحليل...' : 'تشغيل محرك الأفكار'}
            </button>
          </div>
        </div>
      </div>

      {/* Platform Context Stats */}
      {platformContext && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'منتجات بدون وصف', value: platformContext.missingDescCount, color: 'text-amber-600 bg-amber-50', icon: 'DocumentTextIcon' },
            { label: 'تنبيهات مُصعَّدة', value: platformContext.escalatedAlerts, color: 'text-red-600 bg-red-50', icon: 'BellAlertIcon' },
            { label: 'تسجيلات معلقة', value: platformContext.pendingRegistrations, color: 'text-blue-600 bg-blue-50', icon: 'ClockIcon' },
            { label: 'Escrow محتجز', value: platformContext.heldEscrow, color: 'text-indigo-600 bg-indigo-50', icon: 'ShieldCheckIcon' },
          ].map(stat => (
            <div key={stat.label} className={`flex items-center gap-3 p-3 rounded-xl border border-border ${stat.color}`}>
              <Icon name={stat.icon as any} size={20} />
              <div>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-xs font-medium opacity-80">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision Stats */}
      {ideas.length > 0 && (
        <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-sm text-muted-foreground">معلقة: <strong className="text-foreground">{pendingCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">معتمدة: <strong className="text-emerald-700">{approvedCount}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="text-sm text-muted-foreground">مرفوضة: <strong className="text-red-600">{rejectedCount}</strong></span>
          </div>
          <div className="flex-1" />
          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-8 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
          >
            <option value="all">{t.admin.all}</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Empty state */}
      {ideas.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 bg-card border border-dashed border-border rounded-2xl">
          <div className="w-20 h-20 rounded-3xl bg-violet-100 flex items-center justify-center">
            <Icon name="LightBulbIcon" size={40} className="text-violet-500" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-foreground mb-2">{ui.empty}</h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              اضغط على "تشغيل محرك الأفكار" ليقوم الذكاء الاصطناعي بتحليل بيانات المنصة وابتكار أفكار تحسينية مخصصة لك.
            </p>
          </div>
          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-sm">
              <Icon name="ExclamationCircleIcon" size={16} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}
          <button
            onClick={generateIdeas}
            className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors"
          >
            <Icon name="SparklesIcon" size={16} />
            تشغيل محرك الأفكار الآن
          </button>
        </div>
      )}

      {/* Execute result banner */}
      {executeResult && executeResult.actions.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <Icon name="CheckCircleIcon" size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-800 mb-2">✅ تم تنفيذ الفكرة بنجاح — الإجراءات المنفذة:</p>
              <ul className="space-y-1">
                {executeResult.actions.map((action, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setExecuteResult(null)}
              className="w-6 h-6 rounded-lg hover:bg-emerald-100 flex items-center justify-center shrink-0"
            >
              <Icon name="XMarkIcon" size={14} className="text-emerald-600" />
            </button>
          </div>
        </div>
      )}

      {/* Error banner (outside empty state) */}
      {errorMsg && ideas.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <Icon name="ExclamationCircleIcon" size={18} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{errorMsg}</p>
          <button
            onClick={() => setErrorMsg(null)}
            className="w-6 h-6 rounded-lg hover:bg-red-100 flex items-center justify-center shrink-0"
          >
            <Icon name="XMarkIcon" size={14} className="text-red-500" />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-3 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-5/6" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 h-9 bg-muted rounded-xl" />
                <div className="flex-1 h-9 bg-muted rounded-xl" />
                <div className="flex-1 h-9 bg-muted rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ideas Grid */}
      {!loading && filteredIdeas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIdeas.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onApprove={handleApprove}
              onEdit={handleEdit}
              onReject={handleReject}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingIdea && (
        <EditModal
          idea={editingIdea}
          onSave={handleSaveEdit}
          onClose={() => setEditingIdea(null)}
        />
      )}
    </div>
  );
}
