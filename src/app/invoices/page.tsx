'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import InvoiceTemplate from '@/components/InvoiceTemplate';
import { useLanguage } from '@/contexts/LanguageContext';
import { InvoiceWhatsAppButton } from '@/components/AdminWhatsAppNotify';

interface BuyerInvoice {
  id: string;
  invoice_number: string;
  seller_name: string;
  buyer_name: string;
  buyer_company?: string;
  total: number;
  currency: string;
  status: string;
  payment_terms: string;
  issue_date: string;
  due_date?: string;
  created_at: string;
  customs_adjustment_note?: string;
  customs_adjustment_amount?: number;
  customs_adjustment_type?: 'surcharge' | 'refund' | null;
}

interface UserProfile {
  id: string;
  role: string;
  account_type?: string;
  full_name?: string;
  company_name?: string;
  email?: string;
}

type FilterStatus = 'all' | 'paid' | 'pending';

// Same helper as AccountDashboard
function checkIsBuyer(profile: UserProfile | null): boolean {
  if (!profile) return true;
  const role = (profile.role || '').toLowerCase();
  const accountType = (profile.account_type || '').toLowerCase();
  const supplierRoles = ['manufacturer', 'supplier', 'factory', 'seller', 'vendor', 'admin'];
  return !supplierRoles.some(r => role.includes(r) || accountType.includes(r));
}

const STATUS_META: Record<string, { statusKey: 'statusPaid' | 'statusPending' | 'statusOverdue' | 'statusDraft' | 'statusCancelled'; color: string; dot: string }> = {
  paid:      { statusKey: 'statusPaid',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500' },
  issued:    { statusKey: 'statusPending',  color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-500' },
  sent:      { statusKey: 'statusPending',  color: 'bg-amber-50 text-amber-700 border-amber-200',        dot: 'bg-amber-500' },
  overdue:   { statusKey: 'statusOverdue',  color: 'bg-red-50 text-red-700 border-red-200',              dot: 'bg-red-500' },
  draft:     { statusKey: 'statusDraft',    color: 'bg-gray-100 text-gray-500 border-gray-200',          dot: 'bg-gray-400' },
  cancelled: { statusKey: 'statusCancelled',color: 'bg-gray-100 text-gray-400 border-gray-200',          dot: 'bg-gray-300' },
};

const isPending = (status: string) => ['issued', 'sent', 'overdue'].includes(status);

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtAmount(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Manual Invoice Creation Modal (Supplier/Manufacturer only) ───────────────
interface ManualInvoiceForm {
  buyer_name: string;
  buyer_company: string;
  buyer_address: string;
  buyer_country: string;
  currency: string;
  payment_terms: string;
  notes: string;
  items: { description: string; quantity: number; unit_price: number; unit: string; hs_code: string; country_of_origin: string }[];
  // Commercial invoice fields
  invoice_type: 'standard' | 'commercial_enterprise_cash';
  incoterms_code: string;
  port_of_loading: string;
  port_of_discharge: string;
  country_of_origin: string;
  escrow_order_id: string;
  bl_number: string;
  vessel_name: string;
  container_number: string;
  gross_weight_kg: string;
  net_weight_kg: string;
  total_packages: string;
  package_type: string;
  commercial_invoice_ref: string;
  packing_list_ref: string;
  buyer_import_license: string;
  buyer_customs_code: string;
  seller_export_license: string;
  seller_customs_code: string;
  insurance_company: string;
  insurance_policy_number: string;
  insurance_amount: string;
}

const EMPTY_FORM: ManualInvoiceForm = {
  buyer_name: '',
  buyer_company: '',
  buyer_address: '',
  buyer_country: '',
  currency: 'YER',
  payment_terms: 'tt_advance',
  notes: '',
  items: [{ description: '', quantity: 1, unit_price: 0, unit: 'unit', hs_code: '', country_of_origin: '' }],
  invoice_type: 'standard',
  incoterms_code: '',
  port_of_loading: '',
  port_of_discharge: '',
  country_of_origin: '',
  escrow_order_id: '',
  bl_number: '',
  vessel_name: '',
  container_number: '',
  gross_weight_kg: '',
  net_weight_kg: '',
  total_packages: '',
  package_type: 'CTN',
  commercial_invoice_ref: '',
  packing_list_ref: '',
  buyer_import_license: '',
  buyer_customs_code: '',
  seller_export_license: '',
  seller_customs_code: '',
  insurance_company: '',
  insurance_policy_number: '',
  insurance_amount: '',
};

interface CreateInvoiceModalProps {
  profile: UserProfile;
  onClose: () => void;
  onCreated: () => void;
}

function CreateInvoiceModal({ profile, onClose, onCreated }: CreateInvoiceModalProps) {
  const { t, dir, isRTL, language } = useLanguage();
  const i18n = t.invoices;

  const supabase = createClient();
  const [form, setForm] = useState<ManualInvoiceForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingOrders, setPendingOrders] = useState<{ id: string; order_number: string; total: number }[]>([]);

  // Load pending escrow orders for linkage
  useEffect(() => {
    const loadOrders = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, total')
        .eq('factory_user_id', profile.id)
        .in('escrow_status', ['funds_secured', 'pending_admin_payout', 'cash_upfront_escrow'])
        .order('created_at', { ascending: false })
        .limit(20);
      setPendingOrders(data || []);
    };
    loadOrders();
  }, [profile.id]);

  const isCommercial = form.invoice_type === 'commercial_enterprise_cash';

  const updateItem = (idx: number, field: string, value: string | number) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setForm(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: 1, unit_price: 0, unit: 'unit', hs_code: '', country_of_origin: '' }] }));
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const subtotal = form.items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unit_price)), 0);
  const total = subtotal;

  const handleSubmit = async () => {
    if (!form.buyer_name.trim()) { setError(i18n.errBuyerName); return; }
    if (form.items.some(it => !it.description.trim())) { setError(i18n.errItemDesc); return; }
    if (isCommercial && !form.incoterms_code) { setError('Please select Incoterms for commercial invoice.'); return; }
    setSaving(true);
    setError('');
    try {
      const { data: numData } = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = numData || `INV-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const invoiceItems = form.items.map(it => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit,
        unit_price: Number(it.unit_price),
        total: Number(it.quantity) * Number(it.unit_price),
        hs_code: it.hs_code || undefined,
        country_of_origin: it.country_of_origin || undefined,
      }));

      const insertPayload: Record<string, unknown> = {
        invoice_number: invoiceNumber,
        created_by: profile.id,
        status: 'issued',
        invoice_type: form.invoice_type,
        seller_name: profile.company_name || profile.full_name || i18n.defaultSeller,
        seller_address: '',
        buyer_name: form.buyer_name,
        buyer_company: form.buyer_company,
        buyer_address: form.buyer_address,
        buyer_country: form.buyer_country,
        buyer_vat: '',
        items: invoiceItems,
        currency: form.currency,
        subtotal,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        shipping_cost: 0,
        total,
        payment_terms: form.payment_terms,
        incoterms: form.incoterms_code || 'FOB',
        incoterms_code: form.incoterms_code || null,
        port_of_loading: form.port_of_loading || null,
        port_of_discharge: form.port_of_discharge || null,
        country_of_origin: form.country_of_origin || null,
        issue_date: today,
        due_date: dueDate,
        notes: form.notes,
      };

      // Commercial-only fields
      if (isCommercial) {
        Object.assign(insertPayload, {
          commercial_invoice_ref: form.commercial_invoice_ref || null,
          packing_list_ref: form.packing_list_ref || null,
          bl_number: form.bl_number || null,
          vessel_name: form.vessel_name || null,
          container_number: form.container_number || null,
          gross_weight_kg: form.gross_weight_kg ? Number(form.gross_weight_kg) : null,
          net_weight_kg: form.net_weight_kg ? Number(form.net_weight_kg) : null,
          total_packages: form.total_packages ? Number(form.total_packages) : null,
          package_type: form.package_type || null,
          buyer_import_license: form.buyer_import_license || null,
          buyer_customs_code: form.buyer_customs_code || null,
          seller_export_license: form.seller_export_license || null,
          seller_customs_code: form.seller_customs_code || null,
          insurance_company: form.insurance_company || null,
          insurance_policy_number: form.insurance_policy_number || null,
          insurance_amount: form.insurance_amount ? Number(form.insurance_amount) : null,
          escrow_order_id: form.escrow_order_id || null,
        });
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('order_invoices')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // If linked to escrow order and escrow is confirmed, issue green light
      if (isCommercial && form.escrow_order_id && inserted?.id) {
        const { data: order } = await supabase
          .from('orders')
          .select('escrow_status, cfo_approval_status')
          .eq('id', form.escrow_order_id)
          .single();

        const escrowReady = order && (
          order.escrow_status === 'funds_secured' ||
          order.cfo_approval_status === 'cfo_approved'
        );

        if (escrowReady) {
          await supabase.rpc('issue_commercial_invoice_green_light', {
            p_invoice_id: inserted.id,
            p_order_id: form.escrow_order_id,
          });
          // Notify factory
          await supabase.from('notifications').insert({
            user_id: profile.id,
            type: 'escrow_update',
            title: '🟢 الضوء الأخضر — Commercial Invoice Issued',
            message: `الفاتورة التجارية ${invoiceNumber} صدرت مع الضوء الأخضر. يمكن للمصنع البدء في التعبئة والشحن فوراً.`,
            data: { invoice_id: inserted.id, order_id: form.escrow_order_id },
            is_read: false,
          });
        }
      }

      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message || i18n.errCreate);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  const labelCls = "text-xs text-muted-foreground mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="DocumentPlusIcon" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">{i18n.createManual}</h2>
              <p className="text-xs text-muted-foreground">{i18n.createManualSub}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Invoice Type Toggle */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon name="DocumentTextIcon" size={14} className="text-primary" />
              Invoice Type — نوع الفاتورة
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'standard', label: 'Standard Invoice', sub: 'فاتورة عادية' },
                { value: 'commercial_enterprise_cash', label: 'Commercial Enterprise', sub: 'فاتورة تجارية دولية + Escrow' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(p => ({ ...p, invoice_type: opt.value as ManualInvoiceForm['invoice_type'] }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.invoice_type === opt.value
                      ? 'border-primary bg-primary/5' :'border-border hover:border-primary/40'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Commercial Invoice Ref */}
          {isCommercial && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Commercial Invoice Ref</label>
                <input type="text" value={form.commercial_invoice_ref} onChange={e => setForm(p => ({ ...p, commercial_invoice_ref: e.target.value }))} placeholder="CI-2026-001" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Packing List Ref</label>
                <input type="text" value={form.packing_list_ref} onChange={e => setForm(p => ({ ...p, packing_list_ref: e.target.value }))} placeholder="PL-2026-001" className={inputCls} />
              </div>
            </div>
          )}

          {/* Buyer info */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon name="UserIcon" size={14} className="text-primary" />
              {i18n.buyerDetails}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{i18n.buyerName}</label>
                <input type="text" value={form.buyer_name} onChange={e => setForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder={i18n.buyerNamePlaceholder} className={inputCls} dir={dir} />
              </div>
              <div>
                <label className={labelCls}>{i18n.companyName}</label>
                <input type="text" value={form.buyer_company} onChange={e => setForm(p => ({ ...p, buyer_company: e.target.value }))} placeholder={i18n.companyPlaceholder} className={inputCls} dir={dir} />
              </div>
              <div>
                <label className={labelCls}>{i18n.country}</label>
                <input type="text" value={form.buyer_country} onChange={e => setForm(p => ({ ...p, buyer_country: e.target.value }))} placeholder={i18n.countryPlaceholder} className={inputCls} dir={dir} />
              </div>
              <div>
                <label className={labelCls}>{i18n.address}</label>
                <input type="text" value={form.buyer_address} onChange={e => setForm(p => ({ ...p, buyer_address: e.target.value }))} placeholder={i18n.addressPlaceholder} className={inputCls} dir={dir} />
              </div>
              {isCommercial && (
                <>
                  <div>
                    <label className={labelCls}>Import License No.</label>
                    <input type="text" value={form.buyer_import_license} onChange={e => setForm(p => ({ ...p, buyer_import_license: e.target.value }))} placeholder="IMP-XXXXX" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Buyer Customs Code</label>
                    <input type="text" value={form.buyer_customs_code} onChange={e => setForm(p => ({ ...p, buyer_customs_code: e.target.value }))} placeholder="CUS-XXXXX" className={inputCls} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Seller customs (commercial) */}
          {isCommercial && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon name="BuildingOfficeIcon" size={14} className="text-primary" />
                Exporter Details — بيانات المُصدِّر
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Export License No.</label>
                  <input type="text" value={form.seller_export_license} onChange={e => setForm(p => ({ ...p, seller_export_license: e.target.value }))} placeholder="EXP-XXXXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Seller Customs Code</label>
                  <input type="text" value={form.seller_customs_code} onChange={e => setForm(p => ({ ...p, seller_customs_code: e.target.value }))} placeholder="CUS-XXXXX" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Incoterms & Shipping (commercial) */}
          {isCommercial && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon name="TruckIcon" size={14} className="text-primary" />
                Incoterms 2020 &amp; Shipping — شروط التجارة الدولية
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Incoterms 2020 *</label>
                  <select value={form.incoterms_code} onChange={e => setForm(p => ({ ...p, incoterms_code: e.target.value }))} className={inputCls}>
                    <option value="">Select Incoterms</option>
                    <option value="EXW">EXW — Ex Works</option>
                    <option value="FCA">FCA — Free Carrier</option>
                    <option value="FAS">FAS — Free Alongside Ship</option>
                    <option value="FOB">FOB — Free On Board</option>
                    <option value="CFR">CFR — Cost &amp; Freight</option>
                    <option value="CIF">CIF — Cost, Insurance &amp; Freight</option>
                    <option value="CPT">CPT — Carriage Paid To</option>
                    <option value="CIP">CIP — Carriage &amp; Insurance Paid</option>
                    <option value="DAP">DAP — Delivered at Place</option>
                    <option value="DPU">DPU — Delivered at Place Unloaded</option>
                    <option value="DDP">DDP — Delivered Duty Paid</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Port of Loading — ميناء التحميل</label>
                  <input type="text" value={form.port_of_loading} onChange={e => setForm(p => ({ ...p, port_of_loading: e.target.value }))} placeholder="e.g. Shanghai, CN" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Port of Discharge — ميناء التفريغ</label>
                  <input type="text" value={form.port_of_discharge} onChange={e => setForm(p => ({ ...p, port_of_discharge: e.target.value }))} placeholder="e.g. Aden, YE" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Country of Origin — بلد المنشأ</label>
                  <input type="text" value={form.country_of_origin} onChange={e => setForm(p => ({ ...p, country_of_origin: e.target.value }))} placeholder="e.g. CN, TR, DE" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Vessel Name</label>
                  <input type="text" value={form.vessel_name} onChange={e => setForm(p => ({ ...p, vessel_name: e.target.value }))} placeholder="MV Ocean Star" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Container Number</label>
                  <input type="text" value={form.container_number} onChange={e => setForm(p => ({ ...p, container_number: e.target.value }))} placeholder="MSCU1234567" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>B/L Number</label>
                  <input type="text" value={form.bl_number} onChange={e => setForm(p => ({ ...p, bl_number: e.target.value }))} placeholder="BL-2026-XXXXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gross Weight (kg)</label>
                  <input type="number" min="0" step="0.001" value={form.gross_weight_kg} onChange={e => setForm(p => ({ ...p, gross_weight_kg: e.target.value }))} placeholder="0.000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Net Weight (kg)</label>
                  <input type="number" min="0" step="0.001" value={form.net_weight_kg} onChange={e => setForm(p => ({ ...p, net_weight_kg: e.target.value }))} placeholder="0.000" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Total Packages</label>
                  <input type="number" min="1" value={form.total_packages} onChange={e => setForm(p => ({ ...p, total_packages: e.target.value }))} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Package Type</label>
                  <select value={form.package_type} onChange={e => setForm(p => ({ ...p, package_type: e.target.value }))} className={inputCls}>
                    <option value="CTN">CTN — Carton</option>
                    <option value="PLT">PLT — Pallet</option>
                    <option value="BAG">BAG — Bag</option>
                    <option value="BOX">BOX — Box</option>
                    <option value="DRUM">DRUM — Drum</option>
                    <option value="ROLL">ROLL — Roll</option>
                    <option value="BALE">BALE — Bale</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Insurance (commercial) */}
          {isCommercial && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon name="ShieldCheckIcon" size={14} className="text-primary" />
                Insurance — التأمين (Optional)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Insurance Company</label>
                  <input type="text" value={form.insurance_company} onChange={e => setForm(p => ({ ...p, insurance_company: e.target.value }))} placeholder="e.g. Lloyd's" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Policy Number</label>
                  <input type="text" value={form.insurance_policy_number} onChange={e => setForm(p => ({ ...p, insurance_policy_number: e.target.value }))} placeholder="POL-XXXXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Insured Amount ({form.currency})</label>
                  <input type="number" min="0" step="0.01" value={form.insurance_amount} onChange={e => setForm(p => ({ ...p, insurance_amount: e.target.value }))} placeholder="0.00" className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Escrow Linkage (commercial) */}
          {isCommercial && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon name="LockClosedIcon" size={14} className="text-primary" />
                Link to Cash Escrow Order — ربط بأمر الضمان النقدي
              </h3>
              <div>
                <label className={labelCls}>Select Escrow Order (optional — auto green-light if funds secured)</label>
                <select value={form.escrow_order_id} onChange={e => setForm(p => ({ ...p, escrow_order_id: e.target.value }))} className={inputCls}>
                  <option value="">— No escrow linkage —</option>
                  {pendingOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      Order #{o.order_number} — {o.total?.toLocaleString()} USD
                    </option>
                  ))}
                </select>
                {form.escrow_order_id && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <Icon name="CheckCircleIcon" size={14} className="text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-800">
                      Upon saving, if escrow funds are confirmed, the factory will receive an instant 🟢 Green Light to begin packing and shipping.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoice settings */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Icon name="Cog6ToothIcon" size={14} className="text-primary" />
              {i18n.invoiceSettings}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{i18n.currency}</label>
                <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inputCls}>
                  <option value="YER">🇾🇪 YER — ريال يمني</option>
                  <option value="USD">{i18n.currUsd}</option>
                  <option value="SAR">{i18n.currSar}</option>
                  <option value="AED">{i18n.currAed}</option>
                  <option value="EUR">{i18n.currEur}</option>
                  <option value="GBP">{i18n.currGbp}</option>
                  <option value="CNY">{i18n.currCny}</option>
                  <option value="TRY">🇹🇷 TRY — ليرة تركية</option>
                  <option value="OMR">🇴🇲 OMR — ريال عماني</option>
                  <option value="KWD">🇰🇼 KWD — دينار كويتي</option>
                  <option value="QAR">🇶🇦 QAR — ريال قطري</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{i18n.paymentTerms}</label>
                <select value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} className={inputCls}>
                  <option value="tt_advance">{i18n.termTtAdvance}</option>
                  <option value="cash_upfront_escrow">Cash Upfront — Escrow Protected</option>
                  <option value="tt_30">{i18n.termTt30}</option>
                  <option value="lc">{i18n.termLc}</option>
                  <option value="dp">{i18n.termDp}</option>
                  <option value="net_30">{i18n.termNet30}</option>
                  <option value="net_60">{i18n.termNet60}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Icon name="ListBulletIcon" size={14} className="text-primary" />
                {i18n.lineItems}
                {isCommercial && <span className="text-xs text-muted-foreground font-normal">(HS Code required for customs)</span>}
              </h3>
              <button onClick={addItem} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                <Icon name="PlusIcon" size={13} />
                {i18n.addItem}
              </button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="bg-muted/30 rounded-xl p-3 border border-border">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(idx, 'description', e.target.value)}
                        placeholder={i18n.itemDescPlaceholder}
                        className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        dir={dir}
                      />
                    </div>
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="w-9 h-9 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 transition-colors">
                        <Icon name="TrashIcon" size={13} />
                      </button>
                    )}
                  </div>
                  <div className={`grid gap-2 ${isCommercial ? 'grid-cols-4' : 'grid-cols-3'}`}>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">{i18n.quantity}</label>
                      <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">{i18n.unitPrice}</label>
                      <input type="number" min="0" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                    {isCommercial && (
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-0.5 block">HS Code</label>
                        <input type="text" value={item.hs_code} onChange={e => updateItem(idx, 'hs_code', e.target.value)} placeholder="e.g. 8471.30" className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">{i18n.lineTotal}</label>
                      <div className="h-8 px-2 rounded-lg border border-border bg-muted/50 text-xs flex items-center font-mono text-muted-foreground">
                        {(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  {isCommercial && (
                    <div className="mt-2">
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Country of Origin (ISO 2-letter)</label>
                      <input type="text" value={item.country_of_origin} onChange={e => updateItem(idx, 'country_of_origin', e.target.value)} placeholder="e.g. CN, TR, DE" maxLength={2} className="w-24 h-8 px-2 rounded-lg border border-border bg-background text-xs uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-3 flex justify-end">
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 text-right">
                <p className="text-xs text-muted-foreground">{i18n.grandTotal}</p>
                <p className="text-lg font-bold text-primary">{fmtAmount(total, form.currency)}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>{i18n.notes}</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder={i18n.notesPlaceholder}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              dir={dir}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <Icon name="ExclamationCircleIcon" size={15} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 h-11 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {i18n.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
            >
              {saving ? (
                <><Icon name="ArrowPathIcon" size={15} className="animate-spin" />{i18n.creating}</>
              ) : (
                <><Icon name="DocumentPlusIcon" size={15} />{isCommercial ? 'Issue Commercial Invoice' : i18n.createInvoice}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Customs Adjustment Note Modal ────────────────────────────────────────────
interface CustomsAdjustmentModalProps {
  invoice: BuyerInvoice;
  onClose: () => void;
  onSaved: () => void;
}

function CustomsAdjustmentModal({ invoice, onClose, onSaved }: CustomsAdjustmentModalProps) {
  const supabase = createClient();
  const [adjustmentType, setAdjustmentType] = useState<'surcharge' | 'refund'>('surcharge');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError('يرجى إدخال مبلغ صحيح'); return; }
    if (!note.trim()) { setError('يرجى إدخال وصف التسوية'); return; }
    setSaving(true);
    setError('');
    try {
      // Save to customs_adjustment_notes table
      const { error: insertErr } = await supabase.from('customs_adjustment_notes').insert({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        adjustment_type: adjustmentType,
        adjustment_amount: parseFloat(amount),
        currency: invoice.currency,
        note: note.trim(),
        is_binding: false,
        created_at: new Date().toISOString(),
      });
      if (insertErr) throw insertErr;

      // Update the invoice record with the latest adjustment
      await supabase.from('order_invoices').update({
        customs_adjustment_note: note.trim(),
        customs_adjustment_amount: parseFloat(amount),
        customs_adjustment_type: adjustmentType,
        customs_is_binding: false,
      }).eq('id', invoice.id);

      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Icon name="AdjustmentsHorizontalIcon" size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">مذكرة تسوية جمركية</h2>
              <p className="text-xs text-muted-foreground">Customs Adjustment Note — {invoice.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Disclaimer */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-[11px] text-red-700 leading-relaxed">
              <strong>إخلاء المسؤولية:</strong> مذكرات التسوية الجمركية هي تقديرات غير ملزمة (isBinding: false) وتخضع لاعتماد المخلص الجمركي المعتمد. الأرقام الفعلية قد تختلف عند الميناء.
            </p>
          </div>

          {/* Type Toggle */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">نوع التسوية</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'surcharge', label: 'زيادة رسوم', sub: 'Duty Surcharge', icon: '↑', color: 'border-amber-400 bg-amber-50' },
                { value: 'refund', label: 'استرداد رسوم', sub: 'Duty Refund', icon: '↩', color: 'border-emerald-400 bg-emerald-50' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAdjustmentType(opt.value as 'surcharge' | 'refund')}
                  className={`p-3 rounded-xl border-2 text-right transition-all ${
                    adjustmentType === opt.value ? opt.color : 'border-border hover:border-primary/40'
                  }`}
                >
                  <p className="text-base font-bold">{opt.icon} {opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              المبلغ ({invoice.currency})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              وصف التسوية / Adjustment Description
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="مثال: فروق رسوم جمركية عند ميناء عدن بتاريخ ..."
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-10 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جاري الحفظ...</> : <><Icon name="CheckIcon" size={14} /> حفظ المذكرة</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const i18n = t.invoices;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [invoices, setInvoices] = useState<BuyerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Detail view
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Pay modal
  const [payingInvoice, setPayingInvoice] = useState<BuyerInvoice | null>(null);

  // Manual invoice creation (supplier only)
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Customs Adjustment Note modal
  const [adjustmentInvoice, setAdjustmentInvoice] = useState<BuyerInvoice | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, role, account_type, full_name, company_name, email')
        .eq('id', user!.id)
        .single();
      setProfile(data);
      fetchInvoices(data);
    } catch {
      fetchInvoices(null);
    }
  };

  const fetchInvoices = async (userProfile: UserProfile | null) => {
    setLoading(true);
    setError('');
    try {
      const isBuyer = checkIsBuyer(userProfile);

      if (isBuyer) {
        // Buyer: fetch invoices where they are the buyer
        const { data: data1 } = await supabase
          .from('order_invoices')
          .select('id, invoice_number, seller_name, buyer_name, buyer_company, total, currency, status, payment_terms, issue_date, due_date, created_at')
          .eq('buyer_name', user!.email)
          .order('created_at', { ascending: false })
          .limit(50);

        const { data: data2 } = await supabase
          .from('order_invoices')
          .select('id, invoice_number, seller_name, buyer_name, buyer_company, total, currency, status, payment_terms, issue_date, due_date, created_at')
          .neq('created_by', user!.id)
          .order('created_at', { ascending: false })
          .limit(50);

        const combined = [...(data1 || []), ...(data2 || [])];
        const seen = new Set<string>();
        const unique = combined.filter((inv) => {
          if (seen.has(inv.id)) return false;
          seen.add(inv.id);
          return true;
        });
        setInvoices(unique);
      } else {
        // Supplier/Manufacturer: fetch invoices they created
        const { data } = await supabase
          .from('order_invoices')
          .select('id, invoice_number, seller_name, buyer_name, buyer_company, total, currency, status, payment_terms, issue_date, due_date, created_at')
          .eq('created_by', user!.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setInvoices(data || []);
      }
    } catch (e: any) {
      setError(e.message || i18n.errLoad);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (inv: BuyerInvoice) => {
    setLoadingDetail(true);
    setSelectedInvoice(null);
    try {
      const { data } = await supabase.from('order_invoices').select('*').eq('id', inv.id).single();
      setSelectedInvoice(data || inv);
    } catch {
      setSelectedInvoice(inv);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  // YER exchange rate display helper
  function fmtAmountWithYER(amount: number, currency: string): string {
    const formatted = fmtAmount(amount, currency);
    if (currency === 'YER') {
      return `${formatted} (ريال يمني)`;
    }
    return formatted;
  }

  // Filtered list
  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.seller_name?.toLowerCase().includes(q) ||
      inv.buyer_name?.toLowerCase().includes(q) ||
      inv.buyer_company?.toLowerCase().includes(q);

    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'paid' && inv.status === 'paid') ||
      (filterStatus === 'pending' && isPending(inv.status));

    return matchSearch && matchStatus;
  });

  // Stats
  const totalCount = invoices.length;
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const pendingCount = invoices.filter((i) => isPending(i.status)).length;
  const pendingAmount = invoices
    .filter((i) => isPending(i.status))
    .reduce((sum, i) => sum + (i.total || 0), 0);

  const isBuyer = checkIsBuyer(profile);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (selectedInvoice) {
    const meta = STATUS_META[selectedInvoice.status] || STATUS_META.draft;
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon name="ArrowLeftIcon" size={15} />
              <span>{i18n.backToInvoices}</span>
            </button>
            <div className="flex items-center gap-2">
              {/* Pay button — buyers only, for pending invoices */}
              {isBuyer && isPending(selectedInvoice.status) && (
                <button
                  onClick={() => { setPayingInvoice(selectedInvoice); setSelectedInvoice(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold active:opacity-80 transition-opacity"
                >
                  <Icon name="CreditCardIcon" size={15} />
                  {i18n.payInvoice}
                </button>
              )}
              {/* YER currency badge */}
              {selectedInvoice.currency === 'YER' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-bold">
                  🇾🇪 YER
                </span>
              )}
              <button
                onClick={handlePrintPDF}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors print:hidden"
              >
                <Icon name="PrinterIcon" size={15} />
                {i18n.downloadPdf}
              </button>
            </div>
          </div>

          {/* Invoice render */}
          <div ref={printRef} className="rounded-2xl overflow-hidden border border-border shadow-sm print:shadow-none print:border-none">
            <InvoiceTemplate invoice={selectedInvoice} />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── PAY MODAL (buyer only) ────────────────────────────────────────────────────
  if (payingInvoice) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-10 pb-28 md:pb-12">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="CreditCardIcon" size={20} className="text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-foreground text-base">{i18n.payInvoice}</h2>
                <p className="text-xs text-muted-foreground font-mono">{payingInvoice.invoice_number}</p>
              </div>
            </div>

            <div className="bg-muted/40 rounded-xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{i18n.supplier}</span>
                <span className="font-medium text-foreground">{payingInvoice.seller_name || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{i18n.issueDate}</span>
                <span className="font-medium text-foreground">{fmtDate(payingInvoice.issue_date)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold text-foreground">{i18n.totalAmount}</span>
                <span className="font-bold text-lg text-primary">{fmtAmount(payingInvoice.total, payingInvoice.currency)}</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-2">
              <Icon name="InformationCircleIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                {i18n.payRedirect}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPayingInvoice(null)}
                className="flex-1 h-11 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {i18n.cancel}
              </button>
              <button
                onClick={() => router.push(`/checkout?invoice=${payingInvoice.id}`)}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 transition-opacity"
              >
                <Icon name="LockClosedIcon" size={15} />
                {i18n.continuePayment}
              </button>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── MAIN LIST VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {/* Manual invoice creation modal — supplier/manufacturer only */}
      {showCreateModal && profile && (
        <CreateInvoiceModal
          profile={profile}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => fetchInvoices(profile)}
        />
      )}

      {/* Customs Adjustment Note modal */}
      {adjustmentInvoice && (
        <CustomsAdjustmentModal
          invoice={adjustmentInvoice}
          onClose={() => setAdjustmentInvoice(null)}
          onSaved={() => { setAdjustmentInvoice(null); fetchInvoices(profile); }}
        />
      )}

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="DocumentTextIcon" size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {isBuyer ? i18n.myInvoices : i18n.issuedInvoices}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isBuyer
                    ? i18n.buyerSubtitle : i18n.sellerSubtitle}
                </p>
              </div>
            </div>

            {/* Supplier/Manufacturer: manual create button */}
            {!isBuyer && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 active:opacity-80 transition-opacity shadow-sm"
              >
                <Icon name="DocumentPlusIcon" size={16} />
                {i18n.createManual}
              </button>
            )}
          </div>

          {/* Buyer: info banner about automatic invoices */}
          {isBuyer && (
            <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <Icon name="InformationCircleIcon" size={15} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                {i18n.autoNote}
              </p>
            </div>
          )}
        </div>

        {/* Stats strip */}
        {!loading && invoices.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{i18n.statTotal}</p>
                <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{i18n.statPaid}</p>
                <p className="text-2xl font-bold text-emerald-600">{paidCount}</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{i18n.statPending}</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                {pendingAmount > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {fmtAmountWithYER(pendingAmount, invoices.find((i) => isPending(i.status))?.currency || 'USD')}
                  </p>
                )}
              </div>
            </div>
            {/* Multi-currency breakdown */}
            {(() => {
              const currencyGroups = invoices.reduce((acc, inv) => {
                const cur = inv.currency || 'USD';
                if (!acc[cur]) acc[cur] = { total: 0, count: 0 };
                acc[cur].total += inv.total || 0;
                acc[cur].count += 1;
                return acc;
              }, {} as Record<string, { total: number; count: number }>);
              const currencies = Object.entries(currencyGroups);
              if (currencies.length <= 1) return null;
              return (
                <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="CurrencyDollarIcon" size={15} className="text-blue-600" />
                    <p className="text-xs font-bold text-blue-800">Multi-Currency Breakdown — تفصيل العملات المتعددة</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currencies.map(([cur, data]) => (
                      <div key={cur} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${cur === 'YER' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-blue-200 text-blue-800'}`}>
                        {cur === 'YER' && <span>🇾🇪</span>}
                        <span className="font-mono font-bold">{cur}</span>
                        <span className="text-gray-500">·</span>
                        <span>{fmtAmount(data.total, cur)}</span>
                        <span className="text-gray-400 text-[10px]">({data.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Search & filter bar */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-5 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon
              name="MagnifyingGlassIcon"
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isBuyer ? i18n.searchBuyer : i18n.searchSeller}
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              dir={dir}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(['all', 'pending', 'paid'] as FilterStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`h-10 px-4 rounded-xl text-sm font-medium transition-colors border ${
                  filterStatus === f
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {f === 'all' ? i18n.filterAll : f === 'paid' ? i18n.statusPaid : i18n.statusPending}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2 mb-5">
            <Icon name="ExclamationCircleIcon" size={16} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && invoices.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-14 text-center">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="DocumentTextIcon" size={26} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{i18n.noInvoices}</h3>
            <p className="text-sm text-muted-foreground">
              {isBuyer
                ? i18n.emptyBuyer : i18n.emptySeller}
            </p>
            {!isBuyer && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Icon name="DocumentPlusIcon" size={15} />
                {i18n.createManual}
              </button>
            )}
          </div>
        )}

        {/* No results */}
        {!loading && invoices.length > 0 && filtered.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Icon name="MagnifyingGlassIcon" size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{i18n.noResults}</p>
          </div>
        )}

        {/* Invoice cards */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((inv) => {
              const meta = STATUS_META[inv.status] || STATUS_META.draft;
              const pending = isPending(inv.status);

              return (
                <div
                  key={inv.id}
                  className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    {/* Left: invoice info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Icon name="DocumentTextIcon" size={18} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-foreground text-sm">{inv.invoice_number}</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {i18n[meta.statusKey]}
                          </span>
                        </div>
                        {/* Buyer sees seller name; supplier sees buyer name */}
                        <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                          {isBuyer
                            ? (inv.seller_name || i18n.unknownSupplier)
                            : (inv.buyer_company || inv.buyer_name || i18n.unknownClient)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {isBuyer ? inv.buyer_company : inv.buyer_name}
                        </p>
                      </div>
                    </div>

                    {/* Right: amount */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg text-foreground leading-tight">
                        {fmtAmount(inv.total, inv.currency)}
                      </p>
                      {inv.currency === 'YER' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold">
                          🇾🇪 ريال يمني
                        </span>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(inv.issue_date)}</p>
                    </div>
                  </div>

                  {/* Due date warning */}
                  {pending && inv.due_date && (
                    <div className="flex items-center gap-1.5 mb-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl">
                      <Icon name="ClockIcon" size={13} className="text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700">
                        {i18n.dueDate} <span className="font-semibold">{fmtDate(inv.due_date)}</span>
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View details */}
                    <button
                      onClick={() => openDetail(inv)}
                      disabled={loadingDetail}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-60"
                    >
                      {loadingDetail ? (
                        <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                      ) : (
                        <Icon name="EyeIcon" size={13} />
                      )}
                      {i18n.viewDetails}
                    </button>

                    {/* Download PDF */}
                    <button
                      onClick={async () => {
                        const { data } = await supabase.from('order_invoices').select('*').eq('id', inv.id).single();
                        setSelectedInvoice(data || inv);
                        setTimeout(() => window.print(), 400);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon name="ArrowDownTrayIcon" size={13} />
                      {i18n.downloadPdf}
                    </button>

                    {/* WhatsApp invoice notification — suppliers only */}
                    {!isBuyer && (
                      <InvoiceWhatsAppButton
                        invoiceNumber={inv.invoice_number}
                        amount={inv.total}
                        currency={inv.currency}
                        buyerName={inv.buyer_company || inv.buyer_name}
                      />
                    )}

                    {/* Customs Adjustment Note button — suppliers only */}
                    {!isBuyer && (
                      <button
                        onClick={() => setAdjustmentInvoice(inv)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                      >
                        <Icon name="AdjustmentsHorizontalIcon" size={13} />
                        تسوية جمركية
                      </button>
                    )}

                    {/* Pay button — buyers only, for pending invoices */}
                    {isBuyer && pending && (
                      <button
                        onClick={() => setPayingInvoice(inv)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:opacity-80 transition-opacity ml-auto"
                      >
                        <Icon name="CreditCardIcon" size={13} />
                        {i18n.payNow}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
