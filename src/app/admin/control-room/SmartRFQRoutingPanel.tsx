'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface RFQItem {
  id: string;
  product_name: string;
  specifications: string | null;
  quantity: number;
  unit: string;
  destination_country: string | null;
  target_price: number | null;
  currency: string;
  status: string;
  ai_routed: boolean;
  ai_sector: string | null;
  ai_classification: string | null;
  created_at: string;
  buyer_profile?: { full_name: string; company_name: string; country: string };
}

interface MatchResult {
  supplier_id: string;
  company_name: string;
  match_score: number;
  match_reason: string;
  sector_match: boolean;
  keyword_matches: string[];
}

interface RoutingResult {
  success: boolean;
  routing_id: string | null;
  classification: {
    sector: string;
    product_category: string;
    keywords: string[];
    detected_language: string;
    english_translation: string | null;
  };
  matches: MatchResult[];
  total_matched: number;
  routing_summary: string;
  suppliers_evaluated: number;
}

interface RoutingHistory {
  id: string;
  rfq_id: string;
  ai_classification: string | null;
  ai_sector: string | null;
  ai_keywords: string[];
  ai_language: string;
  routing_status: string;
  total_matched: number;
  routed_at: string;
  created_at: string;
  match_scores: MatchResult[];
}

const SECTOR_COLORS: Record<string, string> = {
  textiles: 'bg-purple-50 text-purple-700 border-purple-200',
  metals: 'bg-gray-50 text-gray-700 border-gray-200',
  chemicals: 'bg-orange-50 text-orange-700 border-orange-200',
  food: 'bg-green-50 text-green-700 border-green-200',
  electronics: 'bg-blue-50 text-blue-700 border-blue-200',
  construction: 'bg-amber-50 text-amber-700 border-amber-200',
  general: 'bg-slate-50 text-slate-700 border-slate-200',
  apparel: 'bg-pink-50 text-pink-700 border-pink-200',
  plastics: 'bg-teal-50 text-teal-700 border-teal-200',
  machinery: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    score >= 60 ? 'bg-blue-100 text-blue-700 border-blue-200' :
    score >= 40 ? 'bg-amber-100 text-amber-700 border-amber-200': 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {score}%
    </span>
  );
}

export default function SmartRFQRoutingPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.smartRfq;

  const supabase = createClient();

  const [rfqs, setRfqs] = useState<RFQItem[]>([]);
  const [loadingRFQs, setLoadingRFQs] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQItem | null>(null);
  const [routingResult, setRoutingResult] = useState<RoutingResult | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routingError, setRoutingError] = useState('');
  const [routingHistory, setRoutingHistory] = useState<RoutingHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeView, setActiveView] = useState<'queue' | 'history'>('queue');
  const [filterRouted, setFilterRouted] = useState<'all' | 'pending' | 'routed'>('all');
  const [customText, setCustomText] = useState('');

  const fetchRFQs = useCallback(async () => {
    setLoadingRFQs(true);
    try {
      const { data } = await supabase
        .from('rfq_requests')
        .select('*, buyer_profile:user_profiles!rfq_requests_buyer_id_fkey(full_name, company_name, country)')
        .order('created_at', { ascending: false })
        .limit(100);
      setRfqs(data || []);
    } catch {
      setRfqs([]);
    } finally {
      setLoadingRFQs(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('rfq_routing_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setRoutingHistory(data || []);
    } catch {
      setRoutingHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchRFQs();
    fetchHistory();
  }, [fetchRFQs, fetchHistory]);

  const handleRoute = async (rfq: RFQItem) => {
    setSelectedRFQ(rfq);
    setRoutingResult(null);
    setRoutingError('');
    setIsRouting(true);

    try {
      const res = await fetch('/api/ai/rfq-routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rfq_id: rfq.id,
          product_name: rfq.product_name,
          specifications: rfq.specifications,
          quantity: rfq.quantity,
          unit: rfq.unit,
          destination_country: rfq.destination_country,
          rfq_text: customText || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRoutingError(data.error_ar || data.error || 'حدث خطأ في التوجيه');
        return;
      }

      setRoutingResult(data);
      // Refresh lists
      fetchRFQs();
      fetchHistory();
    } catch {
      setRoutingError('فشل الاتصال بخادم التوجيه');
    } finally {
      setIsRouting(false);
    }
  };

  const filteredRFQs = rfqs.filter(r => {
    if (filterRouted === 'pending') return !r.ai_routed;
    if (filterRouted === 'routed') return r.ai_routed;
    return true;
  });

  const pendingCount = rfqs.filter(r => !r.ai_routed).length;
  const routedCount = rfqs.filter(r => r.ai_routed).length;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="SparklesIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">
              تحليل وتصنيف طلبات عروض الأسعار بالذكاء الاصطناعي · مطابقة دقيقة مع الموردين المتخصصين · منع البث العشوائي
            </p>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <div className="flex items-center gap-1.5 justify-end">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold">Gemini AI</span>
            </div>
            <p className="text-[10px] text-white/60">{ui.totalRequests.replace('{count}', String(rfqs.length))}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{ui.awaitingRouting}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{routedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">{ui.routed}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{routingHistory.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{ui.routingLogs}</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-xl">
        {[
          { key: 'queue', label: ui.requestList, icon: 'QueueListIcon' },
          { key: 'history', label: ui.routingHistory, icon: 'ClockIcon' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key as 'queue' | 'history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              activeView === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue View */}
      {activeView === 'queue' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {[
              { key: 'all', label: t.admin.all },
              { key: 'pending', label: ui.awaitingRouting },
              { key: 'routed', label: ui.routed },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterRouted(f.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  filterRouted === f.key
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-card border-border text-muted-foreground hover:border-violet-300'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={fetchRFQs}
              className="mr-auto flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
            >
              <Icon name="ArrowPathIcon" size={13} />
              {t.admin.refresh}
            </button>
          </div>

          {loadingRFQs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredRFQs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 bg-card border border-border rounded-xl">
              <Icon name="DocumentTextIcon" size={36} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{ui.empty}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRFQs.map(rfq => (
                <div
                  key={rfq.id}
                  className={`bg-card border rounded-xl p-4 transition-all ${
                    selectedRFQ?.id === rfq.id ? 'border-violet-400 shadow-md' : 'border-border hover:border-violet-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground text-sm truncate">{rfq.product_name}</h3>
                        {rfq.ai_routed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                            <Icon name="CheckCircleIcon" size={10} />
                            تم التوجيه
                          </span>
                        )}
                        {!rfq.ai_routed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                            <Icon name="ClockIcon" size={10} />
                            بانتظار التوجيه
                          </span>
                        )}
                        {rfq.ai_sector && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SECTOR_COLORS[rfq.ai_sector] || SECTOR_COLORS.general}`}>
                            {rfq.ai_sector}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || 'مشتري'}</span>
                        <span>·</span>
                        <span>{rfq.quantity?.toLocaleString('en-US')} {rfq.unit}</span>
                        {rfq.destination_country && (
                          <>
                            <span>·</span>
                            <span>→ {rfq.destination_country}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(rfq.created_at).toLocaleDateString('ar-SA')}</span>
                      </div>
                      {rfq.specifications && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{rfq.specifications}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRoute(rfq)}
                      disabled={isRouting && selectedRFQ?.id === rfq.id}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-60"
                    >
                      {isRouting && selectedRFQ?.id === rfq.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          جارٍ التحليل...
                        </>
                      ) : (
                        <>
                          <Icon name="SparklesIcon" size={13} />
                          {rfq.ai_routed ? 'إعادة التوجيه' : 'توجيه ذكي'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History View */}
      {activeView === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{ui.routingLogs}</p>
            <button onClick={fetchHistory} className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline">
              <Icon name="ArrowPathIcon" size={13} />
              {t.admin.refresh}
            </button>
          </div>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : routingHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 bg-card border border-border rounded-xl">
              <Icon name="ClockIcon" size={36} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">{ui.empty}</p>
            </div>
          ) : (
            routingHistory.map(h => (
              <div key={h.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        h.routing_status === 'routed' ?'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {h.routing_status === 'routed' ? '✓ تم التوجيه' : '✗ فشل'}
                      </span>
                      {h.ai_sector && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SECTOR_COLORS[h.ai_sector] || SECTOR_COLORS.general}`}>
                          {h.ai_sector}
                        </span>
                      )}
                      {h.ai_classification && (
                        <span className="text-xs text-muted-foreground">{h.ai_classification}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(h.created_at).toLocaleString('ar-SA')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-violet-600">{h.total_matched}</p>
                    <p className="text-[10px] text-muted-foreground">مورّد مطابق</p>
                  </div>
                </div>

                {h.ai_keywords && h.ai_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {h.ai_keywords.slice(0, 6).map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px]">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {h.match_scores && Array.isArray(h.match_scores) && h.match_scores.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">أعلى التطابقات</p>
                    {(h.match_scores as MatchResult[]).slice(0, 3).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                        <ScoreBadge score={m.match_score} />
                        <span className="text-xs font-semibold text-foreground flex-1 truncate">{m.company_name}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{m.match_reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Routing Result Panel */}
      {(routingResult || routingError || isRouting) && selectedRFQ && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => { if (!isRouting) { setRoutingResult(null); setRoutingError(''); } }}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            dir={dir}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-violet-600 to-indigo-700 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Icon name="SparklesIcon" size={20} className="text-white" />
                <div>
                  <h3 className="font-bold text-white text-sm">نتيجة التوجيه الذكي</h3>
                  <p className="text-xs text-white/70 truncate max-w-[260px]">{selectedRFQ.product_name}</p>
                </div>
              </div>
              {!isRouting && (
                <button
                  onClick={() => { setRoutingResult(null); setRoutingError(''); }}
                  className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <Icon name="XMarkIcon" size={16} className="text-white" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Loading */}
              {isRouting && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-center">
                    <p className="font-semibold text-foreground">جارٍ تحليل الطلب بالذكاء الاصطناعي...</p>
                    <p className="text-xs text-muted-foreground mt-1">تصنيف القطاع · مطابقة الموردين · توجيه ذكي</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {routingError && !isRouting && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                  <Icon name="ExclamationCircleIcon" size={20} />
                  <p className="text-sm">{routingError}</p>
                </div>
              )}

              {/* Result */}
              {routingResult && !isRouting && (
                <>
                  {/* Classification */}
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Icon name="TagIcon" size={16} className="text-violet-600" />
                      <h4 className="font-bold text-violet-800 text-sm">تصنيف الطلب بالذكاء الاصطناعي</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1">القطاع</p>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SECTOR_COLORS[routingResult.classification?.sector] || SECTOR_COLORS.general}`}>
                          {routingResult.classification?.sector || '—'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1">الفئة</p>
                        <p className="text-sm font-semibold text-foreground">{routingResult.classification?.product_category || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1">اللغة المكتشفة</p>
                        <p className="text-sm font-semibold text-foreground uppercase">{routingResult.classification?.detected_language || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1">الموردون المُقيَّمون</p>
                        <p className="text-sm font-semibold text-foreground">{routingResult.suppliers_evaluated}</p>
                      </div>
                    </div>
                    {routingResult.classification?.keywords?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1.5">الكلمات المفتاحية المستخرجة</p>
                        <div className="flex flex-wrap gap-1.5">
                          {routingResult.classification.keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {routingResult.classification?.english_translation && (
                      <div className="bg-white border border-violet-100 rounded-lg p-3">
                        <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wide mb-1">الترجمة الإنجليزية</p>
                        <p className="text-xs text-foreground">{routingResult.classification.english_translation}</p>
                      </div>
                    )}
                  </div>

                  {/* Routing Summary */}
                  {routingResult.routing_summary && (
                    <div className="bg-muted/40 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground">{routingResult.routing_summary}</p>
                    </div>
                  )}

                  {/* Matched Suppliers */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="BuildingOfficeIcon" size={16} className="text-emerald-600" />
                      <h4 className="font-bold text-foreground text-sm">الموردون المطابقون</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        routingResult.total_matched > 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {routingResult.total_matched} مورّد
                      </span>
                    </div>

                    {routingResult.total_matched === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 bg-muted/20 rounded-xl gap-2">
                        <Icon name="ExclamationTriangleIcon" size={28} className="text-amber-500" />
                        <p className="text-sm font-semibold text-foreground">لم يتم العثور على موردين مطابقين</p>
                        <p className="text-xs text-muted-foreground text-center">لا يوجد موردون مسجلون يتخصصون في هذا القطاع حالياً</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {routingResult.matches.map((match, idx) => (
                          <div key={idx} className="bg-card border border-border rounded-xl p-4 space-y-2 hover:border-emerald-200 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-semibold text-foreground text-sm truncate">{match.company_name}</h5>
                                  {match.sector_match && (
                                    <span className="shrink-0 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-bold">
                                      ✓ قطاع مطابق
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{match.match_reason}</p>
                              </div>
                              <ScoreBadge score={match.match_score} />
                            </div>
                            {match.keyword_matches?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {match.keyword_matches.map((kw, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-medium">{kw}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Success Banner */}
                  {routingResult.total_matched > 0 && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <Icon name="CheckCircleIcon" size={20} className="text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-emerald-800">
                          تم توجيه الطلب بنجاح إلى {routingResult.total_matched} مورّد متخصص
                        </p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          تم إرسال إشعارات للموردين المطابقين فقط — لا بث عشوائي
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
