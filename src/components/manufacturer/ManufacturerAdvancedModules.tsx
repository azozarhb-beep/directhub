'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductionLine {
  id: string;
  name: string;
  name_ar: string;
  capacity_units_per_day: number;
  current_load_percent: number;
  status: 'running' | 'idle' | 'maintenance' | 'stopped';
}

interface ExportInvoiceLine {
  id: string;
  description: string;
  hsCode: string;
  qty: number;
  unit_price: number;
}

type InvoiceType = 'PI' | 'CI';
type Incoterm = 'FOB' | 'CIF';

// ─── Default mock production lines (shown when no DB data) ───────────────────

const DEFAULT_LINES: ProductionLine[] = [
  { id: '1', name: 'Line A — Assembly', name_ar: 'خط أ — التجميع', capacity_units_per_day: 500, current_load_percent: 78, status: 'running' },
  { id: '2', name: 'Line B — Packaging', name_ar: 'خط ب — التعبئة', capacity_units_per_day: 300, current_load_percent: 45, status: 'running' },
  { id: '3', name: 'Line C — Quality Finishing', name_ar: 'خط ج — التشطيب', capacity_units_per_day: 200, current_load_percent: 10, status: 'idle' },
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
    case 'maintenance': return 'صيانة';
    case 'stopped': return 'متوقف';
  }
}

function loadColor(pct: number) {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// ─── Module 1: Production Capacity ───────────────────────────────────────────

function ProductionCapacityModule({ userId }: { userId: string }) {
  const [lines, setLines] = useState<ProductionLine[]>(DEFAULT_LINES);
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState({ name: '', name_ar: '', capacity_units_per_day: '', current_load_percent: '', status: 'running' as ProductionLine['status'] });
  const [saving, setSaving] = useState(false);

  const totalCapacity = lines.reduce((s, l) => s + l.capacity_units_per_day, 0);
  const weightedLoad = lines.length
    ? Math.round(lines.reduce((s, l) => s + l.current_load_percent * l.capacity_units_per_day, 0) / Math.max(totalCapacity, 1))
    : 0;

  const handleAddLine = () => {
    if (!newLine.name.trim()) return;
    setSaving(true);
    const line: ProductionLine = {
      id: Date.now().toString(),
      name: newLine.name,
      name_ar: newLine.name_ar,
      capacity_units_per_day: Number(newLine.capacity_units_per_day) || 100,
      current_load_percent: Math.min(100, Math.max(0, Number(newLine.current_load_percent) || 0)),
      status: newLine.status,
    };
    setLines(prev => [...prev, line]);
    setNewLine({ name: '', name_ar: '', capacity_units_per_day: '', current_load_percent: '', status: 'running' });
    setShowAddLine(false);
    setSaving(false);
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
        <button
          onClick={() => setShowAddLine(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Icon name="PlusIcon" size={14} />
          إضافة خط
        </button>
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
          <span className="text-[10px] text-muted-foreground">إجمالي الطاقة: {totalCapacity.toLocaleString('en-US')} وحدة/يوم</span>
          <span className="text-[10px] text-muted-foreground">{lines.length} خطوط إنتاج</span>
        </div>
      </div>

      {/* Add line form */}
      {showAddLine && (
        <div className="mx-5 mb-3 p-3 bg-muted/50 rounded-xl border border-border space-y-2">
          <p className="text-xs font-medium text-foreground mb-1">خط إنتاج جديد</p>
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
              placeholder="الطاقة (وحدة/يوم)"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              value={newLine.current_load_percent}
              onChange={e => setNewLine(p => ({ ...p, current_load_percent: e.target.value }))}
              placeholder="الحمل الحالي %"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
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
            <button onClick={() => setShowAddLine(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">إلغاء</button>
            <button onClick={handleAddLine} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">حفظ</button>
          </div>
        </div>
      )}

      {/* Lines list */}
      <div className="px-5 pb-5 space-y-3">
        {lines.map(line => (
          <div key={line.id} className="border border-border rounded-xl p-3 bg-background/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusColor(line.status)}`} />
                <span className="text-sm font-medium text-foreground">{line.name_ar || line.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${statusColor(line.status)}`}>{statusLabel(line.status)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={line.status}
                  onChange={e => updateStatus(line.id, e.target.value as ProductionLine['status'])}
                  className="text-[10px] border border-border rounded-md px-1.5 py-0.5 bg-background text-foreground focus:outline-none"
                >
                  <option value="running">تشغيل</option>
                  <option value="idle">خامل</option>
                  <option value="maintenance">صيانة</option>
                  <option value="stopped">متوقف</option>
                </select>
                <button onClick={() => removeLine(line.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
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
            <p className="text-[10px] text-muted-foreground mt-1">{line.capacity_units_per_day.toLocaleString('en-US')} وحدة/يوم</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module 2: International Export Invoicing Engine (USD) ──────────────────

const inputCls =
  'w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary';

function ExportInvoicingModule({ userId }: { userId: string }) {
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('PI');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerCountry, setBuyerCountry] = useState('');
  const [incoterm, setIncoterm] = useState<Incoterm>('FOB');
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

  const prefix = invoiceType === 'PI' ? 'PI' : 'CI';

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
    setInvoiceNumber(prev => (prev ? prev.replace(/^(PI|CI)-/, `${prefix}-`) : prev));
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
  const freightApplied = incoterm === 'CIF' ? freight : 0;
  const total = subtotal + freightApplied;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const typeTitleAr = invoiceType === 'PI' ? 'فاتورة مبدئية' : 'فاتورة تجارية';
  const typeTitleEn = invoiceType === 'PI' ? 'Proforma Invoice' : 'Commercial Invoice';

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-700 to-indigo-700 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="DocumentTextIcon" size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">محرك فوترة التصدير الدولية</h3>
            <p className="text-white/60 text-xs">International Export Invoicing Engine — USD ($)</p>
          </div>
        </div>
        <button
          onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Icon name="EyeIcon" size={13} />
          {showPreview ? 'تعديل' : 'معاينة'}
        </button>
      </div>

      {!showPreview ? (
        <div className="p-5 space-y-5">
          {/* Invoice type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'PI', ar: 'فاتورة مبدئية', en: 'Proforma Invoice (PI)' },
              { key: 'CI', ar: 'فاتورة تجارية', en: 'Commercial Invoice (CI)' },
            ] as const).map(opt => (
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
              <label className="text-[10px] text-muted-foreground block mb-1">اسم المستورد / Consignee</label>
              <input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Importer company name" dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">بلد المستورد / Country</label>
              <input value={buyerCountry} onChange={e => setBuyerCountry(e.target.value)} placeholder="e.g. Saudi Arabia" dir="ltr" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-muted-foreground block mb-1">عنوان المستورد / Address</label>
              <input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} placeholder="Street, city, postal code" dir="ltr" className={inputCls} />
            </div>
          </div>

          {/* Shipping terms */}
          <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-xs font-semibold text-foreground">شروط الشحن والعملة / Trade Terms</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Incoterms</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['FOB', 'CIF'] as const).map(term => (
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
                <span className="col-span-4">الوصف</span>
                <span className="col-span-2 text-center">HS Code</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-2 text-center">سعر الوحدة ($)</span>
                <span className="col-span-1 text-center">المجموع</span>
                <span className="col-span-1" />
              </div>
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Goods description"
                    dir="ltr"
                    className="col-span-12 sm:col-span-4 px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    value={line.hsCode}
                    onChange={e => updateLine(line.id, 'hsCode', e.target.value)}
                    placeholder="HS Code"
                    dir="ltr"
                    className="col-span-4 sm:col-span-2 px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
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
          <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
            <p className="text-xs font-semibold text-foreground">بيانات التحويل البنكي / Bank Wire (SWIFT)</p>
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
              <span>المجموع الفرعي ({incoterm})</span>
              <span dir="ltr">{formatUSD(subtotal)}</span>
            </div>
            {incoterm === 'CIF' && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>الشحن والتأمين</span>
                <span dir="ltr">{formatUSD(freightApplied)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1.5 mt-1">
              <span>الإجمالي (USD)</span>
              <span dir="ltr" className="text-cyan-600">{formatUSD(total)}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2.5 text-sm font-semibold bg-cyan-700 text-white rounded-xl hover:bg-cyan-800 transition-colors"
          >
            {saved ? '✅ تم الحفظ' : `حفظ ${typeTitleAr}`}
          </button>
        </div>
      ) : (
        /* Invoice Preview */
        <div className="p-5" dir="ltr">
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
            </div>

            <div>
              <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-muted-foreground border-b border-border pb-1.5 mb-2">
                <span className="col-span-4">Description</span>
                <span className="col-span-2 text-center">HS Code</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-center">Unit Price</span>
                <span className="col-span-2 text-center">Amount</span>
              </div>
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-1 text-xs py-1 border-b border-border/50">
                  <span className="col-span-4 text-foreground">{line.description || '—'}</span>
                  <span className="col-span-2 text-center text-muted-foreground">{line.hsCode || '—'}</span>
                  <span className="col-span-2 text-center text-muted-foreground">{line.qty}</span>
                  <span className="col-span-2 text-center text-muted-foreground">{formatUSD(line.unit_price)}</span>
                  <span className="col-span-2 text-center text-foreground font-medium">{formatUSD(line.qty * line.unit_price)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal ({incoterm})</span>
                <span>{formatUSD(subtotal)}</span>
              </div>
              {incoterm === 'CIF' && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Freight & Insurance</span>
                  <span>{formatUSD(freightApplied)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2 mt-1">
                <span>Total (USD)</span>
                <span className="text-cyan-600">{formatUSD(total)}</span>
              </div>
            </div>

            {(bankName || beneficiary || accountNumber || swiftCode) && (
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
              Currency: US Dollar (USD) — DirectHub Platform
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
