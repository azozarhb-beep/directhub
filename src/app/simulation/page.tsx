'use client';

import React, { useState, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import {
  SIMULATION_MODULES,
  getModuleApis,
  getModuleRoutes,
  getTotalSimSteps,
  type SimModule,
} from '@/lib/platformRegistry';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pending' | 'active' | 'completed' | 'error';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'notification' | 'system';
  message: string;
  detail?: string;
  module?: string;
}

// ─── Live Test Stream Data ────────────────────────────────────────────────────

interface TestStream {
  id: string;
  label: string;
  labelAr: string;
  badge: string;
  badgeColor: string;
  gradient: string;
  icon: string;
  product: string;
  productAr: string;
  sku: string;
  price: string;
  priceNote: string;
  priceNoteAr: string;
  account: { email: string; password: string; role: string };
  buyerAccount: { email: string; password: string };
  searchQuery: string;
}

const LIVE_TEST_STREAMS: TestStream[] = [
  {
    id: 'local-factory',
    label: 'Local Factory',
    labelAr: 'المصنع المحلي',
    badge: 'Stream 1',
    badgeColor: 'bg-blue-600',
    gradient: 'from-blue-700 to-blue-900',
    icon: 'BuildingOffice2Icon',
    product: '[TEST] Local Factory — Yemeni Honey 500g Jar',
    productAr: '[اختبار] مصنع محلي — عسل يمني أصيل 500 جرام',
    sku: 'TEST-LF-HONEY-500G',
    price: 'B2B: $18/unit (min 10) · B2C: $25/unit',
    priceNote: 'Hybrid order model — test both B2B bulk and B2C retail',
    priceNoteAr: 'نموذج طلب هجين — اختبر الجملة B2B والمفرد B2C',
    account: { email: 'localfactory@directhub.net', password: 'LocalFactory2026!', role: 'Factory Control Panel' },
    buyerAccount: { email: 'testbuyer@directhub.net', password: 'TestBuyer2026!' },
    searchQuery: 'TEST-LF-HONEY',
  },
  {
    id: 'local-supplier',
    label: 'Local Supplier',
    labelAr: 'المورد المحلي',
    badge: 'Stream 2',
    badgeColor: 'bg-emerald-600',
    gradient: 'from-emerald-700 to-teal-900',
    icon: 'BuildingStorefrontIcon',
    product: '[TEST] Local Supplier — Cooking Oil 5L Bottle',
    productAr: '[اختبار] مورد محلي — زيت طعام 5 لتر',
    sku: 'TEST-LS-OIL-5L',
    price: '$8.50/bottle',
    priceNote: 'B2C only — add to cart and complete checkout',
    priceNoteAr: 'مفرد فقط — أضف إلى السلة وأكمل الدفع',
    account: { email: 'localsupplier@directhub.net', password: 'LocalSupplier2026!', role: 'Supplier Dashboard' },
    buyerAccount: { email: 'testbuyer@directhub.net', password: 'TestBuyer2026!' },
    searchQuery: 'TEST-LS-OIL',
  },
  {
    id: 'intl-factory',
    label: 'International Factory',
    labelAr: 'المصنع الدولي',
    badge: 'Stream 3',
    badgeColor: 'bg-violet-600',
    gradient: 'from-violet-700 to-purple-900',
    icon: 'GlobeAltIcon',
    product: '[TEST] International Factory — Industrial Water Pump 2HP',
    productAr: '[اختبار] مصنع دولي — مضخة مياه صناعية 2 حصان',
    sku: 'TEST-IF-PUMP-2HP',
    price: '$320/unit (pre-set ready price)',
    priceNote: 'No RFQ needed — direct checkout & escrow flow',
    priceNoteAr: 'لا يلزم طلب عرض سعر — دفع مباشر وتدفق الضمان المالي',
    account: { email: 'intlfactory@directhub.net', password: 'IntlFactory2026!', role: 'Manufacturer Dashboard' },
    buyerAccount: { email: 'testbuyer@directhub.net', password: 'TestBuyer2026!' },
    searchQuery: 'TEST-IF-PUMP',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowTime() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Dynamic Log Generator ────────────────────────────────────────────────────

function buildStepLogs(
  module: SimModule,
  stepIndex: number,
  ui: any,
  language: string,
  extra?: string
): LogEntry[] {
  const step = module.steps[stepIndex];
  if (!step) return [];

  const tag = module.titleEn.split(' ')[0].toUpperCase().slice(0, 6);
  const apis = getModuleApis(module.id);
  const routes = getModuleRoutes(module.id);
  const stepTitle = language === 'ar' ? step.titleAr : step.titleEn;

  const stepApi = step.apiRef ? apis.find(a => a.id === step.apiRef) : null;
  const stepRoute = step.routeRef ? routes.find(r => r.id === step.routeRef) : null;

  const logs: LogEntry[] = [];

  logs.push({
    time: nowTime(),
    type: 'info',
    message: `▶ ${step.roleLabel} — ${stepTitle}`,
    detail: stepApi
      ? `${stepApi.method} ${stepApi.path} | ${stepApi.description}`
      : stepRoute
      ? `GET ${stepRoute.path} | ${stepRoute.description}`
      : `action: ${step.action}`,
    module: tag,
  });

  if (step.action === 'create_order' && extra) {
    logs.push({
      time: nowTime(),
      type: 'success',
      message: ui.orderCreated.replace('{extra}', String(extra || '')),
      detail: `escrow_status: pending_verification | release_code: ${extra}`,
      module: tag,
    });
  }

  if (step.action === 'enter_code' && extra) {
    logs.push({
      time: nowTime(),
      type: 'info',
      message: ui.buyerEntersCode.replace('{extra}', String(extra || '')),
      detail: `POST /api/escrow/release-by-code | code_verified: true`,
      module: tag,
    });
  }

  if (step.action === 'translate_msg') {
    logs.push({
      time: nowTime(),
      type: 'success',
      message: ui.translationReady,
      detail: 'translation_latency: ~420ms | confidence: 0.98',
      module: tag,
    });
  }

  if (['notify_both', 'confirm_order', 'admin_confirm', 'factory_ready', 'release_funds'].includes(step.action)) {
    logs.push({
      time: nowTime(),
      type: 'notification',
      message: ui.autoNotify.replace('{title}', step.titleEn || step.titleAr),
      detail: `notification_channel: whatsapp + in-app | status: delivered`,
      module: tag,
    });
  }

  if (stepIndex === module.steps.length - 1) {
    logs.push({
      time: nowTime(),
      type: 'success',
      message: `${ui.unitComplete}: ${module.titleEn}`,
      detail: `total_steps: ${module.steps.length} | routes_exercised: ${module.relatedRoutes.length} | apis_called: ${module.relatedApis.length}`,
      module: tag,
    });
  } else {
    logs.push({
      time: nowTime(),
      type: 'success',
      message: ui.stepComplete.replace('{current}', String(stepIndex + 1)).replace('{total}', String(module.steps.length)),
      module: tag,
    });
  }

  return logs;
}

// ─── Live Test Streams Panel ──────────────────────────────────────────────────

function LiveTestStreamsPanel({ isRTL, language }: { isRTL: boolean; language: string }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedStream, setExpandedStream] = useState<string | null>('local-factory');

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      });
    }
  };

  return (
    <div className="mb-6 bg-slate-900 border border-amber-700/40 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-900/20 border-b border-amber-700/30">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <Icon name="BeakerIcon" className="w-4 h-4 text-amber-400" />
        <span className="text-amber-300 font-bold text-sm">
          {language === 'ar' ? 'تيارات الاختبار الحي — منتجات جاهزة للاختبار الفوري' : 'Live Test Streams — Products Ready for Immediate Testing'}
        </span>
        <span className="ml-auto text-xs text-amber-600 font-mono">3 streams · 4 accounts</span>
      </div>

      <div className="p-4 space-y-3">
        {LIVE_TEST_STREAMS.map((stream) => (
          <div key={stream.id} className="border border-slate-700 rounded-xl overflow-hidden">
            {/* Stream Header */}
            <button
              onClick={() => setExpandedStream(expandedStream === stream.id ? null : stream.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${stream.gradient} text-left`}
            >
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                <Icon name={stream.icon as any} className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stream.badgeColor} text-white`}>
                    {stream.badge}
                  </span>
                  <span className="text-white font-bold text-sm">
                    {language === 'ar' ? stream.labelAr : stream.label}
                  </span>
                </div>
                <p className="text-white/70 text-xs mt-0.5 truncate">
                  {language === 'ar' ? stream.productAr : stream.product}
                </p>
              </div>
              <Icon
                name={expandedStream === stream.id ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                className="w-4 h-4 text-white/60 flex-shrink-0"
              />
            </button>

            {/* Stream Details */}
            {expandedStream === stream.id && (
              <div className="bg-slate-900/80 p-4 space-y-3">
                {/* Product Info */}
                <div className="bg-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon name="CubeIcon" className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-300 text-xs font-medium">
                      {language === 'ar' ? stream.productAr : stream.product}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="TagIcon" className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="text-slate-500 text-xs font-mono">{stream.sku}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="CurrencyDollarIcon" className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-400 text-xs font-semibold">{stream.price}</span>
                  </div>
                  <p className="text-slate-500 text-xs pl-5">
                    {language === 'ar' ? stream.priceNoteAr : stream.priceNote}
                  </p>
                </div>

                {/* Accounts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Seller/Factory Account */}
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
                      {stream.account.role}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 text-xs font-mono truncate">{stream.account.email}</span>
                        <button
                          onClick={() => copyToClipboard(stream.account.email, `${stream.id}-email`)}
                          className="flex-shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
                        >
                          <Icon
                            name={copiedKey === `${stream.id}-email` ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                            className="w-3.5 h-3.5"
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 text-xs font-mono">{stream.account.password}</span>
                        <button
                          onClick={() => copyToClipboard(stream.account.password, `${stream.id}-pass`)}
                          className="flex-shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
                        >
                          <Icon
                            name={copiedKey === `${stream.id}-pass` ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                            className="w-3.5 h-3.5"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Buyer Account */}
                  <div className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
                      Test Buyer Account
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 text-xs font-mono truncate">{stream.buyerAccount.email}</span>
                        <button
                          onClick={() => copyToClipboard(stream.buyerAccount.email, `${stream.id}-buyer-email`)}
                          className="flex-shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
                        >
                          <Icon
                            name={copiedKey === `${stream.id}-buyer-email` ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                            className="w-3.5 h-3.5"
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 text-xs font-mono">{stream.buyerAccount.password}</span>
                        <button
                          onClick={() => copyToClipboard(stream.buyerAccount.password, `${stream.id}-buyer-pass`)}
                          className="flex-shrink-0 text-slate-600 hover:text-slate-300 transition-colors"
                        >
                          <Icon
                            name={copiedKey === `${stream.id}-buyer-pass` ? 'CheckIcon' : 'ClipboardDocumentIcon'}
                            className="w-3.5 h-3.5"
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/search?q=${encodeURIComponent(stream.searchQuery)}`}
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Icon name="MagnifyingGlassIcon" className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'ابحث عن المنتج' : 'Find Product'}
                  </a>
                  <a
                    href="/cart"
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Icon name="ShoppingCartIcon" className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'سلة التسوق' : 'Cart'}
                  </a>
                  <a
                    href="/checkout"
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Icon name="CreditCardIcon" className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'إتمام الشراء' : 'Checkout'}
                  </a>
                  <a
                    href="/orders"
                    className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Icon name="ArchiveBoxIcon" className="w-3.5 h-3.5" />
                    {language === 'ar' ? 'الطلبات' : 'Orders'}
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Note */}
        <p className="text-slate-600 text-xs text-center pt-1">
          {language === 'ar' ?'جميع المنتجات منشورة ومفعّلة في قاعدة البيانات — ابدأ الاختبار الآن' :'All products are published & active in the database — start testing now'}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SimulationPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.simulation;

  const [activeModuleId, setActiveModuleId] = useState<string>(SIMULATION_MODULES[SIMULATION_MODULES.length - 1].id);

  // Dynamic state keyed by module id — works for any number of modules
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus[]>>(
    () => Object.fromEntries(SIMULATION_MODULES.map(m => [m.id, m.steps.map(() => 'pending' as StepStatus)]))
  );
  const [currentSteps, setCurrentSteps] = useState<Record<string, number>>(
    () => Object.fromEntries(SIMULATION_MODULES.map(m => [m.id, 0]))
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [escrowCode, setEscrowCode] = useState<string | null>(null);
  const [escrowInput, setEscrowInput] = useState('');
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const logRef = useRef<HTMLDivElement>(null);

  const module = SIMULATION_MODULES.find(m => m.id === activeModuleId) ?? SIMULATION_MODULES[0];
  const currentStep = currentSteps[module.id] ?? 0;
  const statuses = stepStatuses[module.id] ?? [];

  const totalSteps = getTotalSimSteps();
  const totalCompleted = Object.entries(stepStatuses).reduce(
    (acc, [, arr]) => acc + arr.filter(s => s === 'completed').length, 0
  );

  const addLogs = useCallback((entries: LogEntry[]) => {
    setLogs(prev => [...entries, ...prev]);
    setTimeout(() => logRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  }, []);

  const markStep = useCallback((modId: string, stepIdx: number, status: StepStatus) => {
    setStepStatuses(prev => {
      const next = { ...prev, [modId]: [...(prev[modId] ?? [])] };
      next[modId][stepIdx] = status;
      return next;
    });
  }, []);

  const handleRunStep = useCallback(async () => {
    if (loading) return;
    const mod = module;
    const step = currentStep;
    if (step >= mod.steps.length) return;

    // Escrow code validation
    const isEscrowCodeStep = mod.steps[step]?.action === 'enter_code';
    if (isEscrowCodeStep) {
      if (!/^\d{6}$/.test(escrowInput.trim())) return;
      if (escrowInput.trim() !== escrowCode) {
        addLogs([{
          time: nowTime(), type: 'error',
          message: ui.codeMismatch,
          detail: `Entered: ${escrowInput} | Expected: ${escrowCode}`,
          module: mod.titleEn.split(' ')[0].toUpperCase().slice(0, 6),
        }]);
        return;
      }
    }

    setLoading(true);
    markStep(mod.id, step, 'active');
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));

    // Generate escrow code on first step of escrow module
    let code = escrowCode;
    if (mod.steps[step]?.action === 'create_order') {
      code = genCode();
      setEscrowCode(code);
    }

    const newLogs = buildStepLogs(mod, step, ui, language, code ?? undefined);
    addLogs(newLogs);
    markStep(mod.id, step, 'completed');

    const nextStep = step + 1;
    setCurrentSteps(prev => ({ ...prev, [mod.id]: nextStep }));

    if (nextStep >= mod.steps.length) {
      setCompletedModules(prev => new Set([...prev, mod.id]));
    }

    setLoading(false);
  }, [loading, module, currentStep, escrowCode, escrowInput, markStep, addLogs]);

  const handleReset = useCallback((modId: string) => {
    const mod = SIMULATION_MODULES.find(m => m.id === modId);
    if (!mod) return;
    setStepStatuses(prev => ({ ...prev, [modId]: mod.steps.map(() => 'pending') }));
    setCurrentSteps(prev => ({ ...prev, [modId]: 0 }));
    setCompletedModules(prev => { const s = new Set(prev); s.delete(modId); return s; });
    if (modId === 'escrow') { setEscrowCode(null); setEscrowInput(''); }
  }, []);

  const handleClearLogs = useCallback(() => setLogs([]), []);

  const getLogColor = (type: LogEntry['type']) => ({
    info: 'text-slate-300', success: 'text-emerald-400', warning: 'text-amber-400',
    error: 'text-red-400', notification: 'text-blue-400', system: 'text-violet-400',
  }[type] ?? 'text-slate-400');

  const isEscrowCodeStep = module.steps[currentStep]?.action === 'enter_code';
  const isStepAvailable = currentStep < module.steps.length && !completedModules.has(module.id);

  // Derived API reference for current module
  const moduleApis = getModuleApis(module.id);
  const moduleRoutes = getModuleRoutes(module.id);

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir={dir}>
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6 pb-24">

        {/* ── Hero Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Icon name="BeakerIcon" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{ui.pageTitle}</h1>
              <p className="text-slate-400 text-xs">
                Comprehensive Live Simulation Hub · DirectHub Platform ·{' '}
                <span className="text-emerald-400 font-mono">{SIMULATION_MODULES.length} · {totalSteps} {ui.steps}</span>
              </p>
            </div>
          </div>

          {/* Registry Badge */}
          <div className="mt-2 inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">
              {ui.dynamicLinked} {' '}
              <span className="text-emerald-400 font-mono">{SIMULATION_MODULES.reduce((a, m) => a + m.relatedRoutes.length, 0)} {ui.routes}</span>
              {' '}{ui.and}{' '}
              <span className="text-violet-400 font-mono">{SIMULATION_MODULES.reduce((a, m) => a + m.relatedApis.length, 0)} API</span>
              {' '}{ui.andFromRegistry}
            </span>
          </div>

          {/* Overall Progress */}
          <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs font-medium">{ui.overallProgress}</span>
              <span className="text-slate-300 text-xs font-mono">{totalCompleted} / {totalSteps} {ui.steps}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-2 rounded-full transition-all duration-700"
                style={{ width: `${totalSteps > 0 ? (totalCompleted / totalSteps) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {SIMULATION_MODULES.map(m => (
                <div key={m.id} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${completedModules.has(m.id) ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                  <span className={`text-xs ${completedModules.has(m.id) ? 'text-emerald-400' : 'text-slate-600'}`}>{m.titleEn}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Live Test Streams Panel ── */}
        <LiveTestStreamsPanel isRTL={isRTL} language={language} />

        {/* ── Module Selector — auto-generated from registry ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {SIMULATION_MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveModuleId(m.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                activeModuleId === m.id
                  ? `bg-gradient-to-r ${m.bgGradient} border-transparent text-white shadow-lg`
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <Icon name={m.icon as any} className="w-4 h-4" />
              <span>{m.titleEn}</span>
              {completedModules.has(m.id) && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white">✓</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Left: Steps Panel ── */}
          <div className="lg:col-span-2 space-y-3">

            {/* Module Info Card */}
            <div className={`bg-gradient-to-br ${module.bgGradient} rounded-2xl p-4 text-white`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Icon name={module.icon as any} className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-base">{module.title}</h2>
                  <p className="text-white/70 text-xs">{module.titleEn}</p>
                </div>
              </div>
              <p className="text-white/80 text-xs leading-relaxed">{module.description}</p>
              {/* Dynamic route/api count */}
              <div className="flex gap-3 mt-3">
                <span className="text-[10px] bg-white/10 rounded-full px-2 py-0.5 text-white/70">
                  {module.relatedRoutes.length} {ui.routes}
                </span>
                <span className="text-[10px] bg-white/10 rounded-full px-2 py-0.5 text-white/70">
                  {module.relatedApis.length} API
                </span>
                <span className="text-[10px] bg-white/10 rounded-full px-2 py-0.5 text-white/70">
                  {ui.stepsCount.replace('{count}', String(module.steps.length))}
                </span>
              </div>
            </div>

            {/* Escrow Code Display */}
            {module.steps.some(s => s.action === 'enter_code') && escrowCode && !completedModules.has(module.id) && (
              <div className="bg-slate-900 border border-emerald-700/50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">{ui.releaseCode}</p>
                <p className="font-mono text-2xl font-bold text-emerald-400 tracking-[0.3em] text-center">{escrowCode}</p>
              </div>
            )}

            {/* Steps List — auto-generated from module.steps */}
            <div className="space-y-2">
              {module.steps.map((step, idx) => {
                const status = statuses[idx] ?? 'pending';
                const isCurrentStep = currentStep === idx;
                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-3.5 transition-all duration-300 ${
                      status === 'completed' ? 'bg-slate-900/60 border-emerald-800/40' :
                      status === 'active' ? 'bg-slate-900 border-blue-600/60 shadow-md shadow-blue-900/20' :
                      isCurrentStep ? 'bg-slate-900 border-slate-600' : 'bg-slate-900/30 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        status === 'completed' ? 'bg-emerald-600 text-white' :
                        status === 'active'? 'bg-blue-600 text-white' : isCurrentStep ?'bg-slate-700 text-white' : 'bg-slate-800 text-slate-600'
                      }`}>
                        {status === 'completed' ? '✓' : status === 'active' ? <span className="animate-spin text-xs">⟳</span> : step.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${step.roleColor} text-white`}>
                            {step.roleLabel}
                          </span>
                          {/* Show linked API/route badge */}
                          {(step.apiRef || step.routeRef) && (
                            <span className="text-[9px] text-slate-600 font-mono truncate max-w-[80px]">
                              {step.apiRef
                                ? moduleApis.find(a => a.id === step.apiRef)?.path
                                : moduleRoutes.find(r => r.id === step.routeRef)?.path}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-medium leading-snug ${
                          status === 'completed' ? 'text-emerald-400' :
                          isCurrentStep ? 'text-white' : 'text-slate-500'
                        }`}>
                          {language === 'ar' ? step.titleAr : step.titleEn}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Escrow Code Input */}
            {isEscrowCodeStep && !completedModules.has(module.id) && (
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2">
                <label className="text-slate-400 text-xs block">{ui.enterCode}</label>
                <input
                  type="text"
                  maxLength={6}
                  value={escrowInput}
                  onChange={e => setEscrowInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-xl font-mono tracking-[0.3em] text-center focus:outline-none focus:border-emerald-500"
                  placeholder="000000"
                />
                {escrowCode && (
                  <button
                    onClick={() => setEscrowInput(escrowCode)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                  >
                    {ui.copyDemoCode.replace('{code}', escrowCode)}
                  </button>
                )}
              </div>
            )}

            {/* Action Button */}
            {isStepAvailable ? (
              <button
                onClick={handleRunStep}
                disabled={loading || (isEscrowCodeStep && escrowInput.length !== 6)}
                className={`w-full py-3 px-5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r ${module.bgGradient} text-white shadow-lg`}
              >
                {loading ? (
                  <><span className="animate-spin text-base">⟳</span> {ui.running}</>
                ) : currentStep === 0 ? (
                  <><Icon name="PlayIcon" className="w-4 h-4" /> {ui.startSimulation}</>
                ) : (
                  <><Icon name="ArrowRightIcon" className="w-4 h-4" /> {ui.nextStep.replace("{current}", String(currentStep + 1)).replace("{total}", String(module.steps.length))}</>
                )}
              </button>
            ) : completedModules.has(module.id) ? (
              <div className="space-y-2">
                <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-3 text-center">
                  <p className="text-emerald-400 font-bold">{ui.moduleComplete.replace("{name}", module.titleEn)}</p>
                </div>
                <button
                  onClick={() => handleReset(module.id)}
                  className="w-full py-2.5 px-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Icon name="ArrowPathIcon" className="w-4 h-4" />
                  {ui.resetModule}
                </button>
              </div>
            ) : null}
          </div>

          {/* ── Right: Live Console ── */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Console */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '480px' }}>
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-slate-400 text-xs font-mono mr-2">DirectHub Simulation Console — Live Log</span>
                {logs.length > 0 && (
                  <button onClick={handleClearLogs} className="mr-auto text-slate-600 hover:text-slate-400 text-xs transition-colors">
                    {ui.clearLog}
                  </button>
                )}
              </div>

              <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5" style={{ maxHeight: '500px' }}>
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 py-16">
                    <Icon name="CommandLineIcon" className="w-10 h-10" />
                    <p className="text-sm">{ui.waitingStart}</p>
                    <p className="text-slate-700 text-xs">{ui.chooseModule}</p>
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-slate-600 flex-shrink-0 w-16">[{log.time}]</span>
                      {log.module && (
                        <span className="flex-shrink-0 font-bold text-[10px] w-12 text-violet-400">[{log.module}]</span>
                      )}
                      <div>
                        <span className={`${getLogColor(log.type)} leading-relaxed`}>{log.message}</span>
                        {log.detail && (
                          <p className="text-slate-600 text-[10px] mt-0.5 leading-relaxed">{log.detail}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-800 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-500 text-xs">{ui.moduleProgress} {module.titleEn}</span>
                  <span className="text-slate-400 text-xs font-mono">
                    {statuses.filter(s => s === 'completed').length} / {module.steps.length}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 bg-gradient-to-r ${module.bgGradient}`}
                    style={{ width: `${module.steps.length > 0 ? (statuses.filter(s => s === 'completed').length / module.steps.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Module Overview Cards — auto-generated from registry */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(SIMULATION_MODULES.length, 5)}, 1fr)` }}>
              {SIMULATION_MODULES.map(m => {
                const done = (stepStatuses[m.id] ?? []).filter(s => s === 'completed').length;
                const total = m.steps.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveModuleId(m.id)}
                    className={`bg-slate-900 border rounded-xl p-3 text-center transition-all hover:border-slate-500 ${
                      activeModuleId === m.id ? 'border-slate-500' : 'border-slate-800'
                    }`}
                  >
                    <Icon name={m.icon as any} className={`w-5 h-5 mx-auto mb-1.5 ${m.color}`} />
                    <p className="text-[10px] text-slate-400 font-medium leading-tight mb-1.5">{m.titleEn}</p>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full bg-gradient-to-r ${m.bgGradient} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">{done}/{total}</p>
                  </button>
                );
              })}
            </div>

            {/* Dynamic API Reference — auto-derived from registry */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wider">
                {ui.apisSimulated.replace('{count}', String(moduleApis.length))}
              </p>
              {moduleApis.length > 0 ? (
                <div className="space-y-1.5">
                  {moduleApis.map((api, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0">{api.method}</span>
                      <span className="font-mono text-slate-300 flex-shrink-0">{api.path}</span>
                      <span className="text-slate-600 truncate">{api.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-700 text-xs">{ui.noApis}</p>
              )}

              {/* Related Routes */}
              {moduleRoutes.length > 0 && (
                <>
                  <p className="text-slate-500 text-xs font-medium mt-4 mb-2 uppercase tracking-wider">
                    {ui.linkedRoutes.replace('{count}', String(moduleRoutes.length))}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {moduleRoutes.map(r => (
                      <span key={r.id} className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                        {r.path}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
