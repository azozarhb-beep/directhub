'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
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

interface QCChecklistItem {
  id: string;
  label: string;
  label_ar: string;
  checked: boolean;
}

interface TaxInvoiceLine {
  id: string;
  description: string;
  qty: number;
  unit_price: number;
}

// ─── Default mock production lines (shown when no DB data) ───────────────────

const DEFAULT_LINES: ProductionLine[] = [
  { id: '1', name: 'Line A — Assembly', name_ar: 'خط أ — التجميع', capacity_units_per_day: 500, current_load_percent: 78, status: 'running' },
  { id: '2', name: 'Line B — Packaging', name_ar: 'خط ب — التعبئة', capacity_units_per_day: 300, current_load_percent: 45, status: 'running' },
  { id: '3', name: 'Line C — Quality Finishing', name_ar: 'خط ج — التشطيب', capacity_units_per_day: 200, current_load_percent: 10, status: 'idle' },
];

const DEFAULT_QC_ITEMS: QCChecklistItem[] = [
  { id: 'q1', label: 'Raw material inspection passed', label_ar: 'اجتاز فحص المواد الخام', checked: false },
  { id: 'q2', label: 'Dimensions within tolerance (±0.5mm)', label_ar: 'الأبعاد ضمن التفاوت المسموح', checked: false },
  { id: 'q3', label: 'Weight verified per spec sheet', label_ar: 'تم التحقق من الوزن وفق المواصفات', checked: false },
  { id: 'q4', label: 'Visual defects check — none found', label_ar: 'فحص العيوب البصرية — لا يوجد', checked: false },
  { id: 'q5', label: 'Packaging integrity confirmed', label_ar: 'تأكيد سلامة التغليف', checked: false },
  { id: 'q6', label: 'Batch labeling complete', label_ar: 'اكتمال وسم الدفعة', checked: false },
  { id: 'q7', label: 'Final sign-off by QC supervisor', label_ar: 'الموافقة النهائية من مشرف الجودة', checked: false },
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

function formatYER(amount: number) {
  return new Intl.NumberFormat('ar-YE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' ر.ي';
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
          <span className="text-[10px] text-muted-foreground">إجمالي الطاقة: {totalCapacity.toLocaleString()} وحدة/يوم</span>
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
            <p className="text-[10px] text-muted-foreground mt-1">{line.capacity_units_per_day.toLocaleString()} وحدة/يوم</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module 2: QC Checklist + Delivery PIN ────────────────────────────────────

function QCChecklistModule({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<QCChecklistItem[]>(DEFAULT_QC_ITEMS);
  const [deliveryPin, setDeliveryPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [qcReleased, setQcReleased] = useState(false);
  const [releaseMsg, setReleaseMsg] = useState('');

  const allChecked = items.every(i => i.checked);
  const checkedCount = items.filter(i => i.checked).length;

  const toggleItem = (id: string) => {
    if (qcReleased) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const verifyPin = async () => {
    if (!pinInput.trim() || !orderId.trim()) {
      setPinError('يرجى إدخال رقم الطلب ورمز التسليم');
      return;
    }
    setPinVerifying(true);
    setPinError('');
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, delivery_pin, status')
        .eq('id', orderId.trim())
        .maybeSingle();

      if (error || !data) {
        setPinError('رقم الطلب غير موجود');
        return;
      }
      if (String(data.delivery_pin) === pinInput.trim()) {
        setPinVerified(true);
        setPinError('');
      } else {
        setPinError('رمز التسليم غير صحيح');
      }
    } catch {
      setPinError('حدث خطأ أثناء التحقق');
    } finally {
      setPinVerifying(false);
    }
  };

  const releaseQC = async () => {
    if (!allChecked || !pinVerified) return;
    setQcReleased(true);
    setReleaseMsg('✅ تم إتمام فحص الجودة وتأكيد التسليم بنجاح');
  };

  const resetChecklist = () => {
    setItems(DEFAULT_QC_ITEMS.map(i => ({ ...i, checked: false })));
    setPinInput('');
    setPinVerified(false);
    setPinError('');
    setOrderId('');
    setQcReleased(false);
    setReleaseMsg('');
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="ClipboardDocumentCheckIcon" size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">قائمة فحص الجودة الرقمية</h3>
            <p className="text-white/60 text-xs">QC Checklist — Linked to Delivery PIN</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-white font-bold text-lg">{checkedCount}/{items.length}</span>
          <p className="text-white/60 text-[10px]">بنود مكتملة</p>
        </div>
      </div>

      {/* Progress */}
      <div className="px-5 pt-4 pb-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(checkedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="px-5 pb-4 space-y-2">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            disabled={qcReleased}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-right ${
              item.checked
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' :'bg-background border-border hover:border-primary/40'
            } ${qcReleased ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
              item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-border'
            }`}>
              {item.checked && <Icon name="CheckIcon" size={12} className="text-white" />}
            </div>
            <span className={`text-xs flex-1 text-right ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {item.label_ar}
            </span>
          </button>
        ))}
      </div>

      {/* Delivery PIN section */}
      <div className="mx-5 mb-5 p-4 bg-muted/40 rounded-xl border border-border space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="KeyIcon" size={15} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">ربط رمز التسليم (Delivery PIN)</span>
        </div>

        {!pinVerified ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={orderId}
                onChange={e => setOrderId(e.target.value)}
                placeholder="رقم الطلب (Order ID)"
                className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
              <input
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="رمز التسليم PIN"
                type="password"
                className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            {pinError && <p className="text-xs text-red-500">{pinError}</p>}
            <button
              onClick={verifyPin}
              disabled={pinVerifying}
              className="w-full py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {pinVerifying ? 'جارٍ التحقق...' : 'التحقق من الرمز'}
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600">
            <Icon name="CheckCircleIcon" size={16} />
            <span className="text-xs font-medium">تم التحقق من رمز التسليم ✓</span>
          </div>
        )}

        {pinVerified && !qcReleased && (
          <button
            onClick={releaseQC}
            disabled={!allChecked}
            className={`w-full py-2.5 text-xs font-semibold rounded-lg transition-all ${
              allChecked
                ? 'bg-emerald-600 text-white hover:bg-emerald-700' :'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {allChecked ? '✅ إتمام فحص الجودة وتأكيد التسليم' : `أكمل جميع البنود أولاً (${checkedCount}/${items.length})`}
          </button>
        )}

        {qcReleased && (
          <div className="space-y-2">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{releaseMsg}</p>
            </div>
            <button onClick={resetChecklist} className="text-xs text-muted-foreground hover:text-foreground underline">
              بدء فحص جديد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Module 3: Local Tax Invoicing Engine (YER) ───────────────────────────────

function TaxInvoicingModule({ userId }: { userId: string }) {
  const [lines, setLines] = useState<TaxInvoiceLine[]>([
    { id: '1', description: '', qty: 1, unit_price: 0 },
  ]);
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [taxRate, setTaxRate] = useState(5);
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setInvoiceDate(`${y}-${m}-${d}`);
    setInvoiceNumber(`INV-${y}${m}${d}-${Math.floor(Math.random() * 9000 + 1000)}`);
  }, []);

  const addLine = () => {
    setLines(prev => [...prev, { id: Date.now().toString(), description: '', qty: 1, unit_price: 0 }]);
  };

  const removeLine = (id: string) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const updateLine = (id: string, field: keyof TaxInvoiceLine, value: string | number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Icon name="DocumentTextIcon" size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">محرك الفوترة الضريبية المحلية</h3>
            <p className="text-white/60 text-xs">Local Tax Invoicing Engine — YER (ر.ي)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Icon name="EyeIcon" size={13} />
            {showPreview ? 'تعديل' : 'معاينة'}
          </button>
        </div>
      </div>

      {!showPreview ? (
        <div className="p-5 space-y-4">
          {/* Invoice meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">رقم الفاتورة</label>
              <input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">تاريخ الفاتورة</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">اسم المشتري / الجهة</label>
              <input
                value={buyerName}
                onChange={e => setBuyerName(e.target.value)}
                placeholder="اسم العميل أو الشركة"
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">عنوان المشتري</label>
              <input
                value={buyerAddress}
                onChange={e => setBuyerAddress(e.target.value)}
                placeholder="المدينة / المنطقة"
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">بنود الفاتورة</span>
              <button onClick={addLine} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                <Icon name="PlusIcon" size={12} /> إضافة بند
              </button>
            </div>
            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground px-1">
                <span className="col-span-5">الوصف</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-3 text-center">سعر الوحدة (ر.ي)</span>
                <span className="col-span-1 text-center">المجموع</span>
                <span className="col-span-1" />
              </div>
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-1.5 items-center">
                  <input
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder="وصف البضاعة"
                    className="col-span-5 px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    value={line.qty}
                    onChange={e => updateLine(line.id, 'qty', Number(e.target.value))}
                    min={1}
                    className="col-span-2 px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  <input
                    type="number"
                    value={line.unit_price}
                    onChange={e => updateLine(line.id, 'unit_price', Number(e.target.value))}
                    min={0}
                    className="col-span-3 px-2 py-1.5 text-xs text-center rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="col-span-1 text-[10px] text-muted-foreground text-center">
                    {(line.qty * line.unit_price).toLocaleString()}
                  </span>
                  <button onClick={() => removeLine(line.id)} className="col-span-1 flex justify-center text-muted-foreground hover:text-red-500 transition-colors">
                    <Icon name="XMarkIcon" size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tax rate */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground shrink-0">نسبة الضريبة %</label>
            <input
              type="number"
              value={taxRate}
              onChange={e => setTaxRate(Math.min(100, Math.max(0, Number(e.target.value))))}
              min={0}
              max={100}
              className="w-20 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">(ضريبة القيمة المضافة المحلية)</span>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">ملاحظات</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="شروط الدفع، تعليمات خاصة..."
              rows={2}
              dir="rtl"
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Totals */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-1.5 border border-border">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span dir="ltr">{formatYER(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>الضريبة ({taxRate}%)</span>
              <span dir="ltr">{formatYER(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-1.5 mt-1">
              <span>الإجمالي الكلي</span>
              <span dir="ltr" className="text-amber-600">{formatYER(total)}</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2.5 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
          >
            {saved ? '✅ تم الحفظ' : 'حفظ الفاتورة'}
          </button>
        </div>
      ) : (
        /* Invoice Preview */
        <div className="p-5" dir="rtl">
          <div className="border border-border rounded-xl p-5 space-y-4 bg-background">
            {/* Invoice header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-foreground">فاتورة ضريبية</h2>
                <p className="text-xs text-muted-foreground">Tax Invoice</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-foreground">{invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{invoiceDate}</p>
              </div>
            </div>

            {/* Buyer info */}
            {(buyerName || buyerAddress) && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground mb-0.5">فاتورة إلى:</p>
                <p className="text-sm font-semibold text-foreground">{buyerName || '—'}</p>
                <p className="text-xs text-muted-foreground">{buyerAddress}</p>
              </div>
            )}

            {/* Line items table */}
            <div>
              <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold text-muted-foreground border-b border-border pb-1.5 mb-2">
                <span className="col-span-5">الوصف</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-3 text-center">سعر الوحدة</span>
                <span className="col-span-2 text-center">المجموع</span>
              </div>
              {lines.map(line => (
                <div key={line.id} className="grid grid-cols-12 gap-1 text-xs py-1 border-b border-border/50">
                  <span className="col-span-5 text-foreground">{line.description || '—'}</span>
                  <span className="col-span-2 text-center text-muted-foreground">{line.qty}</span>
                  <span className="col-span-3 text-center text-muted-foreground">{line.unit_price.toLocaleString()}</span>
                  <span className="col-span-2 text-center text-foreground font-medium">{(line.qty * line.unit_price).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>المجموع الفرعي</span>
                <span>{formatYER(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>ضريبة القيمة المضافة ({taxRate}%)</span>
                <span>{formatYER(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground border-t border-border pt-2 mt-1">
                <span>الإجمالي الكلي</span>
                <span className="text-amber-600">{formatYER(total)}</span>
              </div>
            </div>

            {notes && (
              <div className="bg-muted/30 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">ملاحظات:</p>
                <p className="text-xs text-foreground">{notes}</p>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-2">
              العملة: ريال يمني (YER) — DirectHub Platform
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
}

export default function ManufacturerAdvancedModules({ userId }: ManufacturerAdvancedModulesProps) {
  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-1 h-8 bg-gradient-to-b from-slate-600 to-amber-500 rounded-full" />
        <div>
          <h2 className="text-base font-bold text-foreground">الوحدات المتقدمة للمصنع</h2>
          <p className="text-xs text-muted-foreground">Advanced Manufacturer Modules</p>
        </div>
      </div>

      {/* Three modules in responsive grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <ProductionCapacityModule userId={userId} />
        <QCChecklistModule userId={userId} />
        <TaxInvoicingModule userId={userId} />
      </div>
    </div>
  );
}
