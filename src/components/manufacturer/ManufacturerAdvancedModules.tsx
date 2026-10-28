'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import {
  INVOICE_DRAFT_EVENT,
  clearInvoiceDraft,
  readInvoiceDraft,
  extractInvoiceFromConversation,
  extractInvoiceFromAgreementText,
  type InvoiceDraft,
} from '@/lib/exportInvoiceAI';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductionLine {
  id: string;
  name: string;
  name_ar: string;
  capacity_units_per_day: number;
  capacity_unit: string;
  current_load_percent: number;
  status: 'running' | 'idle' | 'maintenance' | 'stopped';
  assigned_po: string;
}

interface ExportInvoiceLine {
  id: string;
  description: string;
  hsCode: string;
  qty: number;
  unit_price: number;
}

type InvoiceType = 'PI' | 'CI' | 'DI' | 'QT';
type Incoterm = 'EXW' | 'FOB' | 'CIF';
type ContainerCap = '' | '20ft' | '40ft_hq';
type InvoiceScopeUI = 'export' | 'local';
type InvoiceCurrency = 'USD' | 'YER' | 'SAR';
type LocalPaymentMethodUI = 'kuraimi' | 'local_bank' | 'cod' | 'tt';
type LocalDeliveryUI = 'ex_factory' | 'delivered';

const LOCAL_PAYMENT_LABELS: Record<LocalPaymentMethodUI, { ar: string; en: string }> = {
  kuraimi: { ar: 'حساب الكريمي', en: 'Kuraimi Account' },
  local_bank: { ar: 'حساب بنكي محلي', en: 'Local Bank Account' },
  cod: { ar: 'الدفع عند الاستلام', en: 'Cash on Delivery' },
  tt: { ar: 'تحويل بنكي (T/T)', en: 'Telegraphic Transfer (T/T)' },
};

const LOCAL_DELIVERY_LABELS: Record<LocalDeliveryUI, { ar: string; en: string }> = {
  ex_factory: { ar: 'استلام من مستودع المصنع', en: 'Ex-Factory Warehouse Pickup' },
  delivered: { ar: 'توصيل إلى مقر المشتري', en: 'Delivery to Buyer Premises' },
};

const CURRENCY_LABELS: Record<InvoiceCurrency, { ar: string; en: string }> = {
  USD: { ar: 'دولار أمريكي', en: 'US Dollar (USD)' },
  YER: { ar: 'ريال يمني', en: 'Yemeni Rial (YER)' },
  SAR: { ar: 'ريال سعودي', en: 'Saudi Riyal (SAR)' },
};

interface QCLog {
  id: string;
  line_id: string;
  po: string;
  inspector: string;
  notes: string;
  result: 'pass' | 'fail';
  created_at: string;
}

const CAPACITY_UNITS = ['وحدة', 'طن', 'كرتون', 'متر', 'كجم', 'لتر', 'قطعة', 'رول', 'طبلية'];

const PO_OPTIONS = [
  { value: '', label: 'بدون أمر شراء' },
  { value: 'PO-2026-01 - رولات تغليف', label: 'PO-2026-01 - رولات تغليف' },
  { value: 'PO-2026-02 - علب كرتون مموج', label: 'PO-2026-02 - علب كرتون مموج' },
  { value: 'PO-2026-03 - أكياس بلاستيك', label: 'PO-2026-03 - أكياس بلاستيك' },
];

// ─── Default mock production lines (shown when no DB data) ───────────────────

const DEFAULT_LINES: ProductionLine[] = [
  { id: '1', name: 'Line A — Assembly', name_ar: 'خط أ — التجميع', capacity_units_per_day: 500, capacity_unit: 'كرتون', current_load_percent: 78, status: 'running', assigned_po: 'PO-2026-01 - رولات تغليف' },
  { id: '2', name: 'Line B — Packaging', name_ar: 'خط ب — التعبئة', capacity_units_per_day: 300, capacity_unit: 'طن', current_load_percent: 45, status: 'running', assigned_po: 'PO-2026-02 - علب كرتون مموج' },
  { id: '3', name: 'Line C — Quality Finishing', name_ar: 'خط ج — التشطيب', capacity_units_per_day: 200, capacity_unit: 'متر', current_load_percent: 10, status: 'idle', assigned_po: '' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: ProductionLine['status']) {
  switch (status) {
    case 'running': return 'bg-emerald-500';
    case 'idle': return 'bg-amber-400';
    case 'maintenance': return 'bg-blue-400';
    case 'stopped': return 'bg-red-500';
  }
}

function statusLabel(status: ProductionLine['status']) {
  switch (status) {
    case 'running': return 'تشغيل';
    case 'idle': return 'خامل';
    case 'maintenance': return 'صيانة دورية';
    case 'stopped': return 'متوقف';
  }
}

function loadColor(pct: number) {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function formatUSD(amount: number) {
  return formatMoney(amount, 'USD');
}

function formatMoney(amount: number, currency: InvoiceCurrency) {
  const isRial = currency !== 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: isRial ? 0 : 2,
    maximumFractionDigits: isRial ? 0 : 2,
  }).format(amount);
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface InvoicePrintData {
  scope: InvoiceScopeUI;
  currency: InvoiceCurrency;
  titleEn: string;
  titleAr: string;
  invoiceNumber: string;
  invoiceDate: string;
  buyerName: string;
  buyerAddress: string;
  buyerCountry: string;
  incoterm: Incoterm;
  portOfLoading: string;
  portOfDischarge: string;
  governorate: string;
  deliveryTermsLabel: string;
  localPaymentLabel: string;
  localBankDetails: string;
  paymentTerms: string;
  lines: ExportInvoiceLine[];
  subtotal: number;
  freight: number;
  total: number;
  bankName: string;
  beneficiary: string;
  accountNumber: string;
  swiftCode: string;
  notes: string;
  cbm: number;
  containerCapacity: ContainerCap;
}

function buildInvoiceHtml(d: InvoicePrintData): string {
  const isLocal = d.scope === 'local';
  const money = (n: number) => formatMoney(n, d.currency);
  const rows = d.lines
    .map(
      l => `<tr>
        <td>${escapeHtml(l.description) || '—'}</td>
        ${isLocal ? '' : `<td class="c">${escapeHtml(l.hsCode) || '—'}</td>`}
        <td class="c">${l.qty}</td>
        <td class="r">${money(l.unit_price)}</td>
        <td class="r">${money(l.qty * l.unit_price)}</td>
      </tr>`
    )
    .join('');
  const hasBank = d.bankName || d.beneficiary || d.accountNumber || d.swiftCode;
  const tradeGrid = isLocal
    ? `<div class="box"><div class="lbl">Currency / العملة</div><strong>${d.currency}</strong></div>
    <div class="box"><div class="lbl">Governorate / City — المحافظة / المدينة</div><strong>${escapeHtml(d.governorate) || '—'}</strong></div>
    <div class="box" style="grid-column:span 2"><div class="lbl">Delivery Terms — شروط التسليم</div><strong>${escapeHtml(d.deliveryTermsLabel) || '—'}</strong></div>`
    : `<div class="box"><div class="lbl">Incoterms</div><strong>${d.incoterm}</strong></div>
    <div class="box"><div class="lbl">Currency</div><strong>USD</strong></div>
    <div class="box"><div class="lbl">Port of Loading</div><strong>${escapeHtml(d.portOfLoading) || '—'}</strong></div>
    <div class="box"><div class="lbl">Port of Discharge</div><strong>${escapeHtml(d.portOfDischarge) || '—'}</strong></div>
    <div class="box"><div class="lbl">CBM</div><strong>${d.cbm > 0 ? d.cbm : '—'}</strong></div>
    <div class="box"><div class="lbl">Container</div><strong>${d.containerCapacity === '20ft' ? '20ft' : d.containerCapacity === '40ft_hq' ? '40ft HQ' : '—'}</strong></div>`;
  const bankBlock = isLocal
    ? d.localPaymentLabel || d.localBankDetails
      ? `<div class="box" style="margin-top:16px"><div class="lbl">Payment Details — بيانات الدفع</div>
      <div>Method: ${escapeHtml(d.localPaymentLabel) || '—'}</div>
      ${d.localBankDetails ? `<div>Account: ${escapeHtml(d.localBankDetails)}</div>` : ''}</div>`
      : ''
    : hasBank
      ? `<div class="box" style="margin-top:16px"><div class="lbl">Bank Wire Details</div>
      <div>Bank: ${escapeHtml(d.bankName) || '—'}</div>
      <div>Beneficiary: ${escapeHtml(d.beneficiary) || '—'}</div>
      <div>Account / IBAN: ${escapeHtml(d.accountNumber) || '—'}</div>
      <div>SWIFT / BIC: ${escapeHtml(d.swiftCode) || '—'}</div></div>`
      : '';
  return `<!DOCTYPE html>
<html lang="en" dir="ltr"><head><meta charset="utf-8" />
<title>${escapeHtml(d.titleEn)} ${escapeHtml(d.invoiceNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;padding:32px;font-size:12px}
  h1{margin:0;font-size:22px} .sub{color:#64748b;margin-top:2px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0e7490;padding-bottom:12px;margin-bottom:16px}
  .box{background:#f1f5f9;border-radius:6px;padding:10px;margin-bottom:12px}
  .lbl{font-size:10px;color:#64748b;margin-bottom:2px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .grid .box{margin:0}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#0e7490;color:#fff;text-align:left;padding:7px;font-size:11px}
  td{padding:7px;border-bottom:1px solid #e2e8f0}
  .c{text-align:center}.r{text-align:right}
  th.c{text-align:center}th.r{text-align:right}
  .tot{margin-left:auto;width:280px}
  .tot div{display:flex;justify-content:space-between;padding:3px 0}
  .tot .g{border-top:2px solid #0f172a;margin-top:4px;padding-top:6px;font-weight:bold;font-size:14px}
  .foot{text-align:center;color:#64748b;font-size:10px;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:20px}
  @media print{body{padding:16px}}
</style></head><body>
  <div class="head">
    <div><h1>${escapeHtml(d.titleEn)}</h1><div class="sub">${escapeHtml(d.titleAr)}</div></div>
    <div style="text-align:right"><strong>${escapeHtml(d.invoiceNumber)}</strong><div class="sub">${escapeHtml(d.invoiceDate)}</div></div>
  </div>
  ${
    d.buyerName || d.buyerAddress || d.buyerCountry
      ? `<div class="box"><div class="lbl">${isLocal ? 'Buyer / المشتري' : 'Consignee'}</div><strong>${escapeHtml(d.buyerName) || '—'}</strong><div>${escapeHtml(
          [d.buyerAddress, d.buyerCountry].filter(Boolean).join(', ')
        )}</div></div>`
      : ''
  }
  <div class="grid">
    ${tradeGrid}
  </div>
  ${d.paymentTerms ? `<div class="box"><div class="lbl">Payment Terms</div>${escapeHtml(d.paymentTerms)}</div>` : ''}
  <table>
    <thead><tr><th>Description</th>${isLocal ? '' : '<th class="c">HS Code</th>'}<th class="c">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="tot">
    <div><span>Subtotal${isLocal ? '' : ` (${d.incoterm})`}</span><span>${money(d.subtotal)}</span></div>
    ${!isLocal && d.incoterm === 'CIF' ? `<div><span>Freight &amp; Insurance</span><span>${money(d.freight)}</span></div>` : ''}
    <div class="g"><span>Total (${d.currency})</span><span>${money(d.total)}</span></div>
  </div>
  ${bankBlock}
  ${d.notes ? `<div class="box"><div class="lbl">Remarks</div>${escapeHtml(d.notes)}</div>` : ''}
  <div class="foot">Currency: ${CURRENCY_LABELS[d.currency].en} — DirectHub Platform</div>
</body></html>`;
}

function openPrintWindow(html: string): boolean {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  const trigger = () => {
    try {
      w.print();
    } catch {
      // ignore
    }
  };
  if (w.document.readyState === 'complete') setTimeout(trigger, 250);
  else w.onload = () => setTimeout(trigger, 250);
  return true;
}

// ─── Module 1: Production Capacity ───────────────────────────────────────────

function ProductionCapacityModule({ userId }: { userId: string }) {
  const [lines, setLines] = useState<ProductionLine[]>(DEFAULT_LINES);
  const [showAddLine, setShowAddLine] = useState(false);
  const emptyLine = { name: '', name_ar: '', capacity_units_per_day: '', capacity_unit: 'وحدة', current_load_percent: '', status: 'running' as ProductionLine['status'], assigned_po: '' };
  const [newLine, setNewLine] = useState(emptyLine);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'lines' | 'qc'>('lines');
  const [qcLogs, setQcLogs] = useState<QCLog[]>([
    { id: 'qc-1', line_id: '1', po: 'PO-2026-01 - رولات تغليف', inspector: 'م. أحمد', notes: 'فحص أبعاد وسماكة الرولات — مطابق للمواصفات', result: 'pass', created_at: '2026-10-20' },
  ]);
  const [showQcForm, setShowQcForm] = useState(false);
  const [newQc, setNewQc] = useState({ line_id: '', inspector: '', notes: '', result: 'pass' as QCLog['result'] });
  const [poOptions, setPoOptions] = useState(PO_OPTIONS);
  const supabaseClient = useMemo(() => createClient(), []);

  useEffect(() => {
    const open = () => {
      setTab('lines');
      setEditingId(null);
      setNewLine(emptyLine);
      setShowAddLine(true);
    };
    window.addEventListener('factory:add-production-line', open);
    return () => window.removeEventListener('factory:add-production-line', open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabaseClient
          .from('orders')
          .select('id, order_number, product_name, status')
          .eq('manufacturer_id', userId)
          .in('status', ['pending', 'confirmed', 'processing', 'in_production'])
          .order('created_at', { ascending: false })
          .limit(20);
        if (cancelled || !data || data.length === 0) return;
        const dynamic = (data as any[]).map(o => {
          const label = `${o.order_number || `PO-${String(o.id).slice(0, 8)}`}${o.product_name ? ` - ${o.product_name}` : ''}`;
          return { value: label, label };
        });
        setPoOptions([{ value: '', label: 'بدون أمر شراء' }, ...dynamic]);
      } catch {
        // keep defaults
      }
    })();
    return () => { cancelled = true; };
  }, [userId, supabaseClient]);

  const totalCapacity = lines.reduce((s, l) => s + l.capacity_units_per_day, 0);
  const weightedLoad = lines.length
    ? Math.round(lines.reduce((s, l) => s + l.current_load_percent * l.capacity_units_per_day, 0) / Math.max(totalCapacity, 1))
    : 0;
  const uniqueUnits = Array.from(new Set(lines.map(l => l.capacity_unit)));
  const totalCapacityLabel = uniqueUnits.length === 1
    ? `${totalCapacity.toLocaleString('en-US')} ${uniqueUnits[0]}/يوم`
    : `${lines.length} خطوط بوحدات مختلفة`;

  const handleAddLine = () => {
    if (!newLine.name.trim() && !newLine.name_ar.trim()) return;
    setSaving(true);
    const payload = {
      name: newLine.name || newLine.name_ar,
      name_ar: newLine.name_ar,
      capacity_units_per_day: Number(newLine.capacity_units_per_day) || 100,
      capacity_unit: newLine.capacity_unit.trim() || 'وحدة',
      current_load_percent: Math.min(100, Math.max(0, Number(newLine.current_load_percent) || 0)),
      status: newLine.status,
      assigned_po: newLine.assigned_po,
    };
    if (editingId) {
      setLines(prev => prev.map(l => (l.id === editingId ? { ...l, ...payload } : l)));
    } else {
      setLines(prev => [...prev, { id: Date.now().toString(), ...payload }]);
    }
    setNewLine(emptyLine);
    setEditingId(null);
    setShowAddLine(false);
    setSaving(false);
  };

  const startEdit = (line: ProductionLine) => {
    setEditingId(line.id);
    setNewLine({
      name: line.name,
      name_ar: line.name_ar,
      capacity_units_per_day: String(line.capacity_units_per_day),
      capacity_unit: line.capacity_unit,
      current_load_percent: String(line.current_load_percent),
      status: line.status,
      assigned_po: line.assigned_po,
    });
    setShowAddLine(true);
  };

  const updateLoad = (id: string, val: number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, current_load_percent: Math.min(100, Math.max(0, val)) } : l));
  };

  const updateStatus = (id: string, status: ProductionLine['status']) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const handleAddQc = () => {
    if (!newQc.line_id) return;
    const line = lines.find(l => l.id === newQc.line_id);
    setQcLogs(prev => [
      {
        id: `qc-${Date.now()}`,
        line_id: newQc.line_id,
        po: line?.assigned_po || '',
        inspector: newQc.inspector.trim() || '—',
        notes: newQc.notes.trim(),
        result: newQc.result,
        created_at: new Date().toISOString().slice(0, 10),
      },
      ...prev,
    ]);
    setNewQc({ line_id: '', inspector: '', notes: '', result: 'pass' });
    setShowQcForm(false);
  };

  const latestQcByLine = (lineId: string) => qcLogs.find(q => q.line_id === lineId);
  const readyToShip = qcLogs.length > 0 && lines.filter(l => l.assigned_po).every(l => latestQcByLine(l.id)?.result === 'pass');

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="CpuChipIcon" size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">مؤشر الطاقة الإنتاجية</h3>
            <p className="text-white/60 text-xs">Production Capacity & Lines</p>
          </div>
        </div>
      </div>

      {/* Overall capacity bar */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">الحمل الكلي المرجّح</span>
          <span className="text-sm font-bold text-foreground">{weightedLoad}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${loadColor(weightedLoad)}`}
            style={{ width: `${weightedLoad}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">إجمالي الطاقة: {totalCapacityLabel}</span>
          <span className="text-[10px] text-muted-foreground">{lines.length} خطوط إنتاج</span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="px-5 pt-2 pb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('lines')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${tab === 'lines' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
        >
          خطوط الإنتاج
        </button>
        <button
          type="button"
          onClick={() => setTab('qc')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${tab === 'qc' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
        >
          سجلات فحص الجودة والجاهزية QC Logs
        </button>
      </div>

      {/* Add line form */}
      {tab === 'lines' && showAddLine && (
        <div className="mx-5 mb-3 p-3 bg-muted/50 rounded-xl border border-border space-y-2">
          <p className="text-xs font-medium text-foreground mb-1">{editingId ? 'تعديل خط الإنتاج' : 'خط إنتاج جديد'}</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newLine.name}
              onChange={e => setNewLine(p => ({ ...p, name: e.target.value }))}
              placeholder="اسم الخط (EN)"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <input
              value={newLine.name_ar}
              onChange={e => setNewLine(p => ({ ...p, name_ar: e.target.value }))}
              placeholder="اسم الخط (AR)"
              dir="rtl"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              value={newLine.capacity_units_per_day}
              onChange={e => setNewLine(p => ({ ...p, capacity_units_per_day: e.target.value }))}
              placeholder="الطاقة اليومية"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <div className="flex items-center gap-1">
              <input
                list="capacity-unit-options"
                value={newLine.capacity_unit}
                onChange={e => setNewLine(p => ({ ...p, capacity_unit: e.target.value }))}
                placeholder="الوحدة (طن، كرتون، متر...)"
                dir="rtl"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">/يوم</span>
              <datalist id="capacity-unit-options">
                {CAPACITY_UNITS.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
            <input
              type="number"
              value={newLine.current_load_percent}
              onChange={e => setNewLine(p => ({ ...p, current_load_percent: e.target.value }))}
              placeholder="الحمل الحالي %"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <select
              value={newLine.assigned_po}
              onChange={e => setNewLine(p => ({ ...p, assigned_po: e.target.value }))}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            >
              {poOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {(['running', 'idle', 'maintenance', 'stopped'] as const).map(s => (
              <button
                key={s}
                onClick={() => setNewLine(p => ({ ...p, status: s }))}
                className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${newLine.status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAddLine(false); setEditingId(null); setNewLine(emptyLine); }} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">إلغاء</button>
            <button onClick={handleAddLine} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">حفظ</button>
          </div>
        </div>
      )}

      {/* Lines list */}
      {tab === 'lines' && (
      <div className="px-5 pb-5 space-y-3">
        {lines.map(line => (
          <div key={line.id} className="border border-border rounded-xl p-3 bg-background/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{line.name_ar || line.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <select
                    value={line.status}
                    onChange={e => updateStatus(line.id, e.target.value as ProductionLine['status'])}
                    aria-label="حالة الخط"
                    className={`appearance-none cursor-pointer text-[11px] font-semibold text-white rounded-full ps-3 pe-6 py-1 focus:outline-none focus:ring-2 focus:ring-white/40 ${statusColor(line.status)}`}
                  >
                    <option value="running" className="text-foreground bg-background">تشغيل</option>
                    <option value="idle" className="text-foreground bg-background">خامل</option>
                    <option value="maintenance" className="text-foreground bg-background">صيانة دورية</option>
                    <option value="stopped" className="text-foreground bg-background">متوقف</option>
                  </select>
                  <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-white text-[9px]">▾</span>
                </div>
                <button onClick={() => startEdit(line)} aria-label="تعديل الخط" className="text-muted-foreground hover:text-primary transition-colors">
                  <Icon name="PencilIcon" size={13} />
                </button>
                <button onClick={() => removeLine(line.id)} aria-label="حذف الخط" className="text-muted-foreground hover:text-red-500 transition-colors">
                  <Icon name="TrashIcon" size={13} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${loadColor(line.current_load_percent)}`}
                  style={{ width: `${line.current_load_percent}%` }}
                />
              </div>
              <input
                type="number"
                value={line.current_load_percent}
                onChange={e => updateLoad(line.id, Number(e.target.value))}
                className="w-14 text-xs text-center border border-border rounded-lg px-1.5 py-0.5 bg-background text-foreground focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{line.capacity_units_per_day.toLocaleString('en-US')} {line.capacity_unit}/يوم</p>
            {line.assigned_po && line.status === 'running' && (
              <p className="text-[11px] text-cyan-700 dark:text-cyan-300 mt-1 font-medium">يعمل على أمر: {line.assigned_po}</p>
            )}
            {line.assigned_po && line.status !== 'running' && (
              <p className="text-[11px] text-muted-foreground mt-1">أمر مخصص: {line.assigned_po}</p>
            )}
          </div>
        ))}
      </div>
      )}

      {/* QC Logs */}
      {tab === 'qc' && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={`text-[11px] font-semibold px-3 py-1 rounded-full ${readyToShip ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'}`}
            >
              {readyToShip ? '✔ جاهز للشحن' : '⏳ غير جاهز للشحن'}
            </span>
            <button
              type="button"
              onClick={() => setShowQcForm(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              + تسجيل تقرير فحص داخلي / Log QC Inspection
            </button>
          </div>

          {showQcForm && (
            <div className="p-3 bg-muted/50 rounded-xl border border-border space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newQc.line_id}
                  onChange={e => setNewQc(p => ({ ...p, line_id: e.target.value }))}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">اختر خط الإنتاج</option>
                  {lines.map(l => <option key={l.id} value={l.id}>{l.name_ar || l.name}</option>)}
                </select>
                <input
                  value={newQc.inspector}
                  onChange={e => setNewQc(p => ({ ...p, inspector: e.target.value }))}
                  placeholder="اسم المفتش"
                  dir="rtl"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <textarea
                value={newQc.notes}
                onChange={e => setNewQc(p => ({ ...p, notes: e.target.value }))}
                placeholder="ملاحظات الفحص"
                dir="rtl"
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                {(['pass', 'fail'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewQc(p => ({ ...p, result: r }))}
                    className={`text-[11px] px-3 py-1 rounded-md border transition-colors ${newQc.result === r ? (r === 'pass' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-red-600 text-white border-red-600') : 'border-border text-muted-foreground hover:border-primary'}`}
                  >
                    {r === 'pass' ? 'مطابق ✔' : 'غير مطابق ✕'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowQcForm(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">إلغاء</button>
                <button onClick={handleAddQc} disabled={!newQc.line_id} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">حفظ</button>
              </div>
            </div>
          )}

          {qcLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">لا توجد سجلات فحص بعد</p>
          ) : (
            qcLogs.map(q => {
              const line = lines.find(l => l.id === q.line_id);
              return (
                <div key={q.id} className="border border-border rounded-xl p-3 bg-background/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{line?.name_ar || line?.name || 'خط محذوف'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${q.result === 'pass' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {q.result === 'pass' ? 'اجتاز — جاهز للشحن' : 'رسب — غير جاهز للشحن'}
                    </span>
                  </div>
                  {q.po && <p className="text-[11px] text-cyan-700 dark:text-cyan-300 mt-1">{q.po}</p>}
                  {q.notes && <p className="text-[11px] text-foreground mt-1">{q.notes}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">المفتش: {q.inspector} · {q.created_at}</p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Module 2: International Export Invoicing Engine (USD) ──────────────────

const inputCls =
  'w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary';

function ExportInvoicingModule({ userId }: { userId: string }) {
  const [scope, setScope] = useState<InvoiceScopeUI>('export');
  const [currency, setCurrency] = useState<InvoiceCurrency>('USD');
  const [governorate, setGovernorate] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState<LocalDeliveryUI>('delivered');
  const [localPaymentMethod, setLocalPaymentMethod] = useState<LocalPaymentMethodUI>('kuraimi');
  const [localBankDetails, setLocalBankDetails] = useState('');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('PI');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [incoterm, setIncoterm] = useState<Incoterm>('FOB');
  const [cbm, setCbm] = useState(0);
  const [containerCapacity, setContainerCapacity] = useState<ContainerCap>('');
  const [portOfLoading, setPortOfLoading] = useState('');
  const [portOfDischarge, setPortOfDischarge] = useState('');
  const [bankName, setBankName] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  const [freight, setFreight] = useState(0);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ExportInvoiceLine[]>([
    { id: '1', description: '', hsCode: '', qty: 1, unit_price: 0 },
  ]);
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [sourceThreadId, setSourceThreadId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [bankAutoFilled, setBankAutoFilled] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'deal' | 'text'>('deal');
  const [aiThreads, setAiThreads] = useState<{ id: string; counterpart_name: string | null; thread_kind: string; last_message_at: string | null }[]>([]);
  const [aiThreadId, setAiThreadId] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const supabase = useMemo(() => createClient(), []);

  const isLocal = scope === 'local';
  const effectiveCurrency: InvoiceCurrency = isLocal ? currency : 'USD';
  const prefix = invoiceType;

  // ── Auto-fill bank wire section from the active manufacturer bank account ──
  const loadBankAccount = useCallback(
    async (silent = false) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('manufacturer_bank_accounts')
        .select('bank_name, account_holder_name, account_number, iban, swift_bic, currency, status, created_at')
        .or(`user_id.eq.${userId},manufacturer_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (error) {
        if (!silent) setFeedback({ type: 'err', text: `تعذر تحميل الحساب البنكي: ${error.message}` });
        return;
      }
      const rows = (data || []) as any[];
      const active =
        rows.find(r => r.status === 'approved' && String(r.currency || 'USD').toUpperCase() === 'USD') ||
        rows.find(r => r.status === 'approved') ||
        rows.find(r => String(r.currency || 'USD').toUpperCase() === 'USD') ||
        rows[0];
      if (!active) {
        if (!silent) setFeedback({ type: 'err', text: 'لا يوجد حساب بنكي مسجل للمصنع — أضفه من صفحة الحسابات البنكية' });
        return;
      }
      setBankName(active.bank_name || '');
      setBeneficiary(active.account_holder_name || '');
      setAccountNumber(active.iban || active.account_number || '');
      setSwiftCode(String(active.swift_bic || '').toUpperCase());
      setBankAutoFilled(true);
    },
    [supabase, userId]
  );

  useEffect(() => {
    loadBankAccount(true);
  }, [loadBankAccount]);

  // ── AI Auto-Fill modal: load recent deals / chats ──────────────────────────
  const openAiModal = async () => {
    setAiOpen(true);
    setAiError('');
    if (!userId) return;
    const { data } = await supabase
      .from('factory_threads')
      .select('id, counterpart_name, thread_kind, last_message_at')
      .or(`factory_id.eq.${userId},counterpart_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })
      .limit(15);
    setAiThreads((data || []) as any[]);
  };

  // ── Consume AI-extracted draft coming from the Partner Room / Deal Chat ────
  const applyDraft = useCallback(
    (draft: InvoiceDraft) => {
      const d = draft.data;
      if (d.scope === 'local') {
        setScope('local');
        setInvoiceType(t => (t === 'QT' ? 'QT' : 'DI'));
        setCurrency(d.currency || 'YER');
        setGovernorate(d.governorate);
        if (d.delivery_terms) setDeliveryTerms(d.delivery_terms);
        if (d.payment_method) setLocalPaymentMethod(d.payment_method);
        setLocalBankDetails(d.local_bank_details);
      } else {
        setScope('export');
        setInvoiceType(t => (t === 'DI' || t === 'QT' ? 'PI' : t));
        setCurrency('USD');
        setPortOfLoading(d.port_of_loading);
        setPortOfDischarge(d.port_of_discharge);
        setCbm(d.cbm || 0);
        setContainerCapacity(d.container_capacity || '');
      }
      setBuyerName(d.consignee_name);
      setBuyerAddress(d.consignee_address);
      setIncoterm(d.incoterm);
      setPaymentTerms(d.payment_terms);
      if (d.items.length > 0) {
        setLines(
          d.items.map((it, i) => ({
            id: `${Date.now()}-${i}`,
            description: it.description,
            hsCode: it.hs_code,
            qty: it.quantity || 1,
            unit_price: it.unit_price,
          }))
        );
      }
      setSourceThreadId(draft.threadId);
      setSavedInvoiceId(null);
      setShowPreview(false);
      setFeedback({ type: 'ok', text: 'تمت تعبئة الفاتورة تلقائياً من المحادثة — راجع البيانات ثم احفظ' });
      loadBankAccount(true);
      clearInvoiceDraft();
    },
    [loadBankAccount]
  );

  useEffect(() => {
    const existing = readInvoiceDraft();
    if (existing && Date.now() - existing.createdAt < 60 * 60 * 1000) applyDraft(existing);
    const onDraft = (e: Event) => {
      const detail = (e as CustomEvent<InvoiceDraft>).detail;
      if (detail?.data) applyDraft(detail);
    };
    window.addEventListener(INVOICE_DRAFT_EVENT, onDraft);
    return () => window.removeEventListener(INVOICE_DRAFT_EVENT, onDraft);
  }, [applyDraft]);

  const handleAiAutoFill = async () => {
    if (aiLoading) return;
    setAiError('');
    setAiLoading(true);
    try {
      let extracted;
      let threadId: string | null = null;
      if (aiMode === 'deal') {
        if (!aiThreadId) throw new Error('اختر صفقة / محادثة أولاً');
        const { data: msgs, error } = await supabase
          .from('factory_thread_messages')
          .select('message, sender_role, created_at')
          .eq('thread_id', aiThreadId)
          .order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        const textMsgs = ((msgs || []) as any[]).filter(m => m.message && String(m.message).trim());
        if (textMsgs.length === 0) throw new Error('لا توجد رسائل نصية كافية في هذه المحادثة');
        const transcript = textMsgs.map(m => `[${m.sender_role}] ${String(m.message).trim()}`).join('\n');
        extracted = await extractInvoiceFromConversation(transcript);
        threadId = aiThreadId;
      } else {
        if (aiText.trim().length < 5) throw new Error('الصق نص الاتفاق أولاً');
        extracted = await extractInvoiceFromAgreementText(aiText);
      }
      applyDraft({ data: extracted, threadId, createdAt: Date.now() });
      setAiOpen(false);
      setAiText('');
    } catch (e: any) {
      setAiError(e?.message || 'فشل استخراج بيانات الفاتورة');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setInvoiceDate(`${y}-${m}-${d}`);
    setInvoiceNumber(`${prefix}-${y}${m}${d}-${Math.floor(Math.random() * 9000 + 1000)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setInvoiceNumber(prev => (prev ? prev.replace(/^(PI|CI|DI|QT)-/, `${prefix}-`) : prev));
  }, [prefix]);

  const addLine = () => {
    setLines(prev => [...prev, { id: Date.now().toString(), description: '', hsCode: '', qty: 1, unit_price: 0 }]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof ExportInvoiceLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const freightApplied = !isLocal && incoterm === 'CIF' ? freight : 0;
  const total = subtotal + freightApplied;

  const typeTitleAr =
    invoiceType === 'PI' ? 'فاتورة مبدئية'
    : invoiceType === 'CI' ? 'فاتورة تجارية'
    : invoiceType === 'QT'? 'عرض سعر' :'فاتورة مبيعات محلية';
  const typeTitleEn =
    invoiceType === 'PI' ? 'Proforma Invoice'
    : invoiceType === 'CI' ? 'Commercial Invoice'
    : invoiceType === 'QT'? 'Quotation' :'Domestic Invoice';

  const handleSave = async () => {
    if (saving) return;
    setFeedback(null);
    if (!buyerName.trim()) {
      setFeedback({ type: 'err', text: 'أدخل اسم المستورد (Consignee) قبل الحفظ' });
      return;
    }
    setSaving(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error('يجب تسجيل الدخول لحفظ الفاتورة');
      const payload = {
        manufacturer_id: authData.user.id,
        scope,
        invoice_type: invoiceType,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate || null,
        consignee_name: buyerName.trim(),
        consignee_address: buyerAddress.trim() || null,
        consignee_country: buyerCountry.trim() || null,
        incoterm: isLocal ? null : incoterm,
        port_of_loading: isLocal ? null : portOfLoading.trim() || null,
        port_of_discharge: isLocal ? null : portOfDischarge.trim() || null,
        cbm: isLocal || !cbm ? null : Number(cbm),
        container_capacity: isLocal ? null : containerCapacity || null,
        governorate: isLocal ? governorate.trim() || null : null,
        delivery_terms: isLocal ? deliveryTerms : null,
        local_payment_method: isLocal ? localPaymentMethod : null,
        local_bank_details: isLocal ? localBankDetails.trim() || null : null,
        payment_terms: paymentTerms.trim() || null,
        currency: effectiveCurrency,
        items: lines.map(l => ({
          description: l.description,
          hs_code: l.hsCode,
          quantity: l.qty,
          unit_price: l.unit_price,
          line_total: Number((l.qty * l.unit_price).toFixed(2)),
        })),
        freight: !isLocal && incoterm === 'CIF' ? freight : 0,
        subtotal: Number(subtotal.toFixed(2)),
        total: Number(total.toFixed(2)),
        bank_name: isLocal ? null : bankName.trim() || null,
        beneficiary: isLocal ? null : beneficiary.trim() || null,
        iban: isLocal ? null : accountNumber.trim() || null,
        swift_bic: isLocal ? null : swiftCode.trim() || null,
        notes: notes.trim() || null,
        source_thread_id: sourceThreadId,
        status: 'saved',
      };
      if (savedInvoiceId) {
        const { error } = await supabase
          .from('export_invoices')
          .update(payload)
          .eq('id', savedInvoiceId)
          .eq('manufacturer_id', authData.user.id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from('export_invoices').insert(payload).select('id').single();
        if (error) throw new Error(error.message);
        setSavedInvoiceId((data as any)?.id ?? null);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setFeedback({ type: 'err', text: e?.message || 'فشل حفظ الفاتورة' });
    } finally {
      setSaving(false);
    }
  };

  const printData: InvoicePrintData = {
    scope,
    currency: effectiveCurrency,
    titleEn: typeTitleEn,
    titleAr: typeTitleAr,
    invoiceNumber,
    invoiceDate,
    buyerName,
    buyerAddress,
    buyerCountry,
    incoterm,
    portOfLoading,
    portOfDischarge,
    governorate,
    deliveryTermsLabel: `${LOCAL_DELIVERY_LABELS[deliveryTerms].ar} / ${LOCAL_DELIVERY_LABELS[deliveryTerms].en}`,
    localPaymentLabel: `${LOCAL_PAYMENT_LABELS[localPaymentMethod].ar} / ${LOCAL_PAYMENT_LABELS[localPaymentMethod].en}`,
    localBankDetails,
    paymentTerms,
    lines,
    subtotal,
    freight: freightApplied,
    total,
    bankName,
    beneficiary,
    accountNumber,
    swiftCode,
    notes,
    cbm,
    containerCapacity,
  };

  const handleExport = () => {
    const ok = openPrintWindow(buildInvoiceHtml(printData));
    if (!ok) setFeedback({ type: 'err', text: 'المتصفح منع النافذة المنبثقة — اسمح بالنوافذ المنبثقة ثم أعد المحاولة' });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-700 to-indigo-700 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="DocumentTextIcon" size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">{isLocal ? 'محرك الفوترة المحلية' : 'محرك فوترة التصدير الدولية'}</h3>
            <p className="text-white/60 text-xs">
              {isLocal ? `Domestic Invoicing Engine — ${effectiveCurrency}` : 'International Export Invoicing Engine — USD ($)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openAiModal}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-900 px-3 py-1.5 rounded-lg transition-colors shadow"
          >
            <span aria-hidden>✨</span>
            توليد بالذكاء الاصطناعي / Auto-Fill with AI
          </button>
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Icon name="EyeIcon" size={13} />
            {showPreview ? 'تعديل' : 'معاينة'}
          </button>
        </div>
      </div>

      {aiOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => !aiLoading && setAiOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground">✨ تعبئة الفاتورة بالذكاء الاصطناعي / Auto-Fill with AI</h4>
              <button
                type="button"
                onClick={() => !aiLoading && setAiOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'deal', label: 'A: Select Deal / Chat — اختر صفقة' },
                { key: 'text', label: 'B: Paste Agreement Text — الصق الاتفاق' },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAiMode(opt.key)}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition-colors ${
                    aiMode === opt.key ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-background border-border text-foreground hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {aiMode === 'deal' ? (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">أحدث الاستفسارات / المفاوضات مع الشركاء</label>
                <select value={aiThreadId} onChange={e => setAiThreadId(e.target.value)} className={inputCls}>
                  <option value="">— اختر محادثة / Select a chat —</option>
                  {aiThreads.map(t => (
                    <option key={t.id} value={t.id}>
                      {(t.counterpart_name || t.thread_kind) +
                        (t.last_message_at ? ` · ${t.last_message_at.slice(0, 10)}` : '')}
                    </option>
                  ))}
                </select>
                {aiThreads.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">لا توجد محادثات حديثة — استخدم خيار لصق نص الاتفاق.</p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">نص الاتفاق / Agreement text</label>
                <textarea
                  value={aiText}
                  onChange={e => setAiText(e.target.value)}
                  rows={5}
                  placeholder="مثال: اتفقنا على 20 طن BOPP بسعر 1850 والتسليم في عدن"
                  className={inputCls}
                />
              </div>
            )}

            {aiError && (
              <div className="px-3 py-2 rounded-lg text-xs border bg-red-500/10 border-red-500/30 text-red-600">{aiError}</div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                disabled={aiLoading}
                className="text-xs px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAiAutoFill}
                disabled={aiLoading}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-60"
              >
                {aiLoading ? 'جارٍ التحليل...' : '✨ تعبئة تلقائية'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showPreview ? (
        <div className="p-5 space-y-5">
          {feedback && (
            <div
              className={`px-3 py-2 rounded-lg text-xs border ${
                feedback.type === 'ok' ?'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' :'bg-red-500/10 border-red-500/30 text-red-600'
              }`}
            >
              {feedback.text}
            </div>
          )}
          {/* Scope switcher */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'export', label: 'Export / دولي' },
              { key: 'local', label: 'Domestic / محلي' },
            ] as const).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setScope(opt.key)}
                className={`py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                  scope === opt.key ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-background border-border text-foreground hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Invoice type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(isLocal
              ? ([
                  { key: 'DI', ar: 'فاتورة مبيعات محلية', en: 'Domestic Invoice' },
                  { key: 'QT', ar: 'عرض سعر', en: 'Quotation' },
                ] as const)
              : ([
                  { key: 'PI', ar: 'فاتورة مبدئية', en: 'Proforma Invoice (PI)' },
                  { key: 'CI', ar: 'فاتورة تجارية', en: 'Commercial Invoice (CI)' },
                ] as const)
            ).map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setInvoiceType(opt.key)}
                className={`p-3 rounded-xl border text-center transition-colors ${
                  invoiceType === opt.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
                }`}
              >
                <p className="text-xs font-semibold">{opt.ar}</p>
                <p className="text-[10px] opacity-80">{opt.en}</p>
              </button>
            ))}
          </div>

          {/* Invoice meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">رقم الفاتورة</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">تاريخ الفاتورة</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">{isLocal ? 'اسم المشتري / Buyer' : 'اسم المستورد / Consignee'}</label>
              <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder={isLocal ? 'اسم المشتري' : 'Importer company name'} dir={isLocal ? 'rtl' : 'ltr'} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">{isLocal ? 'الدولة / Country' : 'بلد المستورد / Country'}</label>
              <input value={buyerCountry} onChange={e => setBuyerCountry(e.target.value)} placeholder={isLocal ? 'اليمن' : 'e.g. Saudi Arabia'} dir={isLocal ? 'rtl' : 'ltr'} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-muted-foreground block mb-1">{isLocal ? 'عنوان المشتري / Address' : 'عنوان المستورد / Address'}</label>
              <input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} placeholder={isLocal ? 'الشارع، الحي' : 'Street, city, postal code'} dir={isLocal ? 'rtl' : 'ltr'} className={inputCls} />
            </div>
          </div>

          {/* Shipping terms */}
          <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-xs font-semibold text-foreground">{isLocal ? 'شروط التسليم والعملة / Delivery & Currency' : 'شروط الشحن والعملة / Trade Terms'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isLocal ? (
                <>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">العملة / Currency</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['YER', 'SAR', 'USD'] as const).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCurrency(c)}
                          className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                            currency === c ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">المحافظة / المدينة</label>
                    <input value={governorate} onChange={e => setGovernorate(e.target.value)} placeholder="مثال: صنعاء" dir="rtl" className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-muted-foreground block mb-1">شروط التسليم / Delivery Terms</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['ex_factory', 'delivered'] as const).map(k => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setDeliveryTerms(k)}
                          className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors ${
                            deliveryTerms === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
                          }`}
                        >
                          {LOCAL_DELIVERY_LABELS[k].ar}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Incoterms</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['EXW', 'FOB', 'CIF'] as const).map(term => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setIncoterm(term)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        incoterm === term ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">العملة / Currency</label>
                <input value="USD" readOnly dir="ltr" className={`${inputCls} bg-muted/50 cursor-not-allowed`} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">ميناء الشحن / Port of Loading</label>
                <input value={portOfLoading} onChange={e => setPortOfLoading(e.target.value)} placeholder="e.g. Shanghai, CN" dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">ميناء التفريغ / Port of Discharge</label>
                <input value={portOfDischarge} onChange={e => setPortOfDischarge(e.target.value)} placeholder="e.g. Aden, YE" dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">الحجم الإجمالي CBM</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cbm || ''}
                  onChange={e => setCbm(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="e.g. 28.5"
                  dir="ltr"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">سعة الحاوية / Container Capacity</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: '' as ContainerCap, l: '—' },
                    { v: '20ft' as ContainerCap, l: '20ft' },
                    { v: '40ft_hq' as ContainerCap, l: '40ft HQ' },
                  ]).map(opt => (
                    <button
                      key={opt.v || 'none'}
                      type="button"
                      onClick={() => setContainerCapacity(opt.v)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        containerCapacity === opt.v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              {incoterm === 'CIF' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-muted-foreground block mb-1">الشحن والتأمين (CIF) USD / Freight & Insurance</label>
                  <input
                    type="number"
                    min={0}
                    value={freight}
                    onChange={e => setFreight(Math.max(0, Number(e.target.value)))}
                    dir="ltr"
                    className={inputCls}
                  />
                </div>
              )}
                </>
              )}
              <div className="sm:col-span-2">
                <label className="text-[10px] text-muted-foreground block mb-1">شروط الدفع / Payment Terms</label>
                <input
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 30% T/T advance, 70% against B/L copy"
                  dir="ltr"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">بنود الفاتورة / Line Items</span>
              <button onClick={addLine} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                <Icon name="PlusIcon" size={12} /> إضافة بند
              </button>
            </div>
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground px-1">
                <span className={isLocal ? 'col-span-6' : 'col-span-4'}>الوصف</span>
                {!isLocal && <span className="col-span-2 text-center">HS Code</span>}
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-2 text-center">سعر الوحدة ({effectiveCurrency})</span>
                <span className="col-span-1 text-center">المجموع</span>
                <span className="col-span-1" />
              </div>
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Goods description"
                    dir={isLocal ? 'rtl' : 'ltr'}
                    className={`col-span-12 ${isLocal ? 'sm:col-span-6' : 'sm:col-span-4'} px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary`}
                  />
                  {!isLocal && (
                  <input
                    value={line.hsCode}
                    onChange={e => updateLine(line.id, 'hsCode', e.target.value)}
                    placeholder="HS Code"
                    dir="ltr"
                    className="col-span-4 sm:col-span-2 px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  )}
                  <input
                    type="number"
                    value={line.qty}
                    onChange={e => updateLine(line.id, 'qty', Number(e.target.value))}
                    min={1}
                    className="col-span-3 sm:col-span-2 px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    value={line.unit_price}
                    onChange={e => updateLine(line.id, 'unit_price', Number(e.target.value))}
                    min={0}
                    className="col-span-3 sm:col-span-2 px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="hidden sm:block col-span-1 text-[10px] text-muted-foreground text-center" dir="ltr">
                    {(line.qty * line.unit_price).toLocaleString('en-US')}
                  </span>
                  <button onClick={() => removeLine(line.id)} className="col-span-2 sm:col-span-1 flex justify-center text-muted-foreground hover:text-red-500 transition-colors">
                    <Icon name="XMarkIcon" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Bank wire / SWIFT */}
          {isLocal ? (
            <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground">بيانات الدفع المحلية / Local Payment Details</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(LOCAL_PAYMENT_LABELS) as LocalPaymentMethodUI[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setLocalPaymentMethod(k)}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors ${
                      localPaymentMethod === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
                    }`}
                  >
                    {LOCAL_PAYMENT_LABELS[k].ar}
                  </button>
                ))}
              </div>
              {localPaymentMethod !== 'cod' && (
                <div>
                  <label className="text-[10px] text-muted-foreground block mb-1">
                    {localPaymentMethod === 'kuraimi' ? 'رقم حساب الكريمي / اسم صاحب الحساب' : 'تفاصيل الحساب البنكي المحلي'}
                  </label>
                  <textarea
                    value={localBankDetails}
                    onChange={e => setLocalBankDetails(e.target.value)}
                    rows={2}
                    dir="rtl"
                    placeholder="رقم الحساب، اسم المستفيد، اسم البنك"
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              )}
            </div>
          ) : (
          <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">بيانات التحويل البنكي / Bank Wire (SWIFT)</p>
              <button
                type="button"
                onClick={() => loadBankAccount(false)}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                <Icon name="ArrowPathIcon" size={11} />
                {bankAutoFilled ? 'تحديث من الحساب البنكي' : 'تعبئة من الحساب البنكي'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">اسم البنك / Bank Name</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">اسم المستفيد / Beneficiary</label>
                <input value={beneficiary} onChange={e => setBeneficiary(e.target.value)} dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">رقم الحساب / IBAN</label>
                <input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} dir="ltr" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">SWIFT / BIC</label>
                <input value={swiftCode} onChange={e => setSwiftCode(e.target.value.toUpperCase())} maxLength={11} dir="ltr" className={inputCls} />
              </div>
            </div>
          </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">ملاحظات / Remarks</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Payment terms, validity, special instructions..."
              rows={2}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Totals */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-1.5 border border-border">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>المجموع الفرعي{isLocal ? '' : ` (${incoterm})`}</span>
              <span dir="ltr">{formatMoney(subtotal, effectiveCurrency)}</span>
            </div>
            {!isLocal && incoterm === 'CIF' && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>الشحن والتأمين</span>
                <span dir="ltr">{formatMoney(freightApplied, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1.5 mt-1">
              <span>الإجمالي ({effectiveCurrency})</span>
              <span dir="ltr" className="text-cyan-600">{formatMoney(total, effectiveCurrency)}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 text-sm font-semibold bg-cyan-700 text-white rounded-xl hover:bg-cyan-800 transition-colors disabled:opacity-60"
          >
            {saving ? 'جارٍ الحفظ...' : saved ? '✅ تم الحفظ' : `${savedInvoiceId ? 'تحديث' : 'حفظ'} ${typeTitleAr}`}
          </button>
        </div>
      ) : (
        /* Invoice Preview */
        <div className="p-5" dir="ltr">
          {feedback && (
            <div
              className={`mb-3 px-3 py-2 rounded-lg text-xs border ${
                feedback.type === 'ok' ?'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' :'bg-red-500/10 border-red-500/30 text-red-600'
              }`}
              dir="rtl"
            >
              {feedback.text}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-3" dir="rtl">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 transition-colors"
            >
              <Icon name="ArrowDownTrayIcon" size={13} />
              تحميل PDF
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            >
              <Icon name="PrinterIcon" size={13} />
              طباعة
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-60"
            >
              <Icon name="CheckCircleIcon" size={13} />
              {saving ? 'جارٍ الحفظ...' : saved ? 'تم الحفظ' : 'حفظ'}
            </button>
          </div>
          <div className="border border-border rounded-xl p-5 space-y-4 bg-background">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-foreground">{typeTitleEn}</h2>
                <p className="text-xs text-muted-foreground">{typeTitleAr}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-foreground">{invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{invoiceDate}</p>
              </div>
            </div>

            {(buyerName || buyerAddress || buyerCountry) && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">Consignee:</p>
                <p className="text-sm font-semibold text-foreground">{buyerName || '—'}</p>
                <p className="text-xs text-muted-foreground">{[buyerAddress, buyerCountry].filter(Boolean).join(', ')}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {isLocal ? (
                <>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Currency</p>
                    <p className="font-semibold text-foreground">{effectiveCurrency}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">المحافظة / المدينة</p>
                    <p className="font-semibold text-foreground">{governorate || '—'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 col-span-2">
                    <p className="text-[10px] text-muted-foreground">شروط التسليم / Delivery Terms</p>
                    <p className="font-semibold text-foreground">{LOCAL_DELIVERY_LABELS[deliveryTerms].ar}</p>
                  </div>
                </>
              ) : (
                <>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Incoterms</p>
                <p className="font-semibold text-foreground">{incoterm}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Currency</p>
                <p className="font-semibold text-foreground">USD</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Port of Loading</p>
                <p className="font-semibold text-foreground">{portOfLoading || '—'}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Port of Discharge</p>
                <p className="font-semibold text-foreground">{portOfDischarge || '—'}</p>
              </div>
                </>
              )}
            </div>

            {paymentTerms && (
              <div className="bg-muted/30 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">Payment Terms:</p>
                <p className="text-xs text-foreground">{paymentTerms}</p>
              </div>
            )}

            <div>
              <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-muted-foreground border-b border-border pb-1.5 mb-2">
                <span className={isLocal ? 'col-span-6' : 'col-span-4'}>Description</span>
                {!isLocal && <span className="col-span-2 text-center">HS Code</span>}
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-center">Unit Price</span>
                <span className="col-span-2 text-center">Amount</span>
              </div>
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-1 text-xs py-1 border-b border-border/50">
                  <span className={`${isLocal ? 'col-span-6' : 'col-span-4'} text-foreground`}>{line.description || '—'}</span>
                  {!isLocal && <span className="col-span-2 text-center text-muted-foreground">{line.hsCode || '—'}</span>}
                  <span className="col-span-2 text-center text-muted-foreground">{line.qty}</span>
                  <span className="col-span-2 text-center text-muted-foreground">{formatMoney(line.unit_price, effectiveCurrency)}</span>
                  <span className="col-span-2 text-center text-foreground font-medium">{formatMoney(line.qty * line.unit_price, effectiveCurrency)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal{isLocal ? '' : ` (${incoterm})`}</span>
                <span>{formatMoney(subtotal, effectiveCurrency)}</span>
              </div>
              {!isLocal && incoterm === 'CIF' && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Freight & Insurance</span>
                  <span>{formatMoney(freightApplied, effectiveCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2 mt-1">
                <span>Total ({effectiveCurrency})</span>
                <span className="text-cyan-600">{formatMoney(total, effectiveCurrency)}</span>
              </div>
            </div>

            {isLocal ? (
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-0.5">
                <p className="text-[10px] text-muted-foreground mb-1">Payment Details / بيانات الدفع:</p>
                <p className="text-foreground">{LOCAL_PAYMENT_LABELS[localPaymentMethod].ar} / {LOCAL_PAYMENT_LABELS[localPaymentMethod].en}</p>
                {localBankDetails && localPaymentMethod !== 'cod' && <p className="text-foreground">{localBankDetails}</p>}
              </div>
            ) : (bankName || beneficiary || accountNumber || swiftCode) && (
              <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-0.5">
                <p className="text-[10px] text-muted-foreground mb-1">Bank Wire Details:</p>
                <p className="text-foreground">Bank: {bankName || '—'}</p>
                <p className="text-foreground">Beneficiary: {beneficiary || '—'}</p>
                <p className="text-foreground">Account / IBAN: {accountNumber || '—'}</p>
                <p className="text-foreground">SWIFT / BIC: {swiftCode || '—'}</p>
              </div>
            )}

            {notes && (
              <div className="bg-muted/30 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">Remarks:</p>
                <p className="text-xs text-foreground">{notes}</p>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-2">
              Currency: {CURRENCY_LABELS[effectiveCurrency].en} — DirectHub Platform
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface ManufacturerAdvancedModulesProps {
  userId: string;
  mode?: 'production' | 'finance' | 'all';
}

export default function ManufacturerAdvancedModules({ userId, mode = 'all' }: ManufacturerAdvancedModulesProps) {
  const showProduction = mode === 'production' || mode === 'all';
  const showInvoicing = mode === 'finance' || mode === 'all';

  return (
    <div className="space-y-6">
      {mode === 'all' && (
        <div className="flex items-center gap-3 px-1">
          <div className="w-1 h-8 bg-gradient-to-b from-slate-600 to-cyan-500 rounded-full" />
          <div>
            <h2 className="text-base font-bold text-foreground">الوحدات المتقدمة للمصنع</h2>
            <p className="text-xs text-muted-foreground">Advanced Manufacturer Modules</p>
          </div>
        </div>
      )}

      <div className={mode === 'all' ? 'grid grid-cols-1 xl:grid-cols-2 gap-5' : 'space-y-5'}>
        {showProduction && <ProductionCapacityModule userId={userId} />}
        {showInvoicing && <ExportInvoicingModule userId={userId} />}
      </div>
    </div>
  );
}
