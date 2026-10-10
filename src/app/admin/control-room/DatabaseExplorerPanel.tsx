'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${color}`}>
      {label}
    </span>
  );
}

// ─── Table definitions ────────────────────────────────────────────────────────
type TableKey = 'users' | 'factories' | 'products' | 'agents' | 'messages' | 'documents';

interface TableDef {
  key: TableKey;
  label: string;
  labelKey: string;
  descKey: string;
  icon: string;
  color: string;
  bg: string;
  text: string;
}

const TABLES: TableDef[] = [
  { key: 'users', label: 'Users / Profiles', labelKey: 'usersLabel', descKey: 'usersDesc', icon: 'UsersIcon', color: 'bg-sky-500', bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
  { key: 'factories', label: 'Factories & Suppliers', labelKey: 'factoriesLabel', descKey: 'factoriesDesc', icon: 'BuildingOffice2Icon', color: 'bg-orange-500', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
  { key: 'products', label: 'Products & Pricing', labelKey: 'productsLabel', descKey: 'productsDesc', icon: 'CubeIcon', color: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  { key: 'agents', label: 'Field Representatives', labelKey: 'agentsLabel', descKey: 'agentsDesc', icon: 'UserGroupIcon', color: 'bg-teal-500', bg: 'bg-teal-50 border-teal-200', text: 'text-teal-700' },
  { key: 'messages', label: 'Messages & Conversations', labelKey: 'messagesLabel', descKey: 'messagesDesc', icon: 'ChatBubbleLeftRightIcon', color: 'bg-indigo-500', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  { key: 'documents', label: 'Documents & Compliance', labelKey: 'documentsLabel', descKey: 'documentsDesc', icon: 'DocumentTextIcon', color: 'bg-purple-500', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
];

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function UsersTable({ search }: { search: string }) {
  const { t } = useLanguage();
  const ui = t.admin.dbExplorer;
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, country, role, is_verified, created_at, company_name, auth_provider')
        .order('created_at', { ascending: false })
        .limit(300);
      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.company_name || '').toLowerCase().includes(q) ||
      (r.role || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{filtered.length} {ui.records}</p>
      <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              {[ui.colUserId, ui.colFullName, ui.colEmail, ui.colPhone, ui.colRole, ui.colLoginMethod, ui.colCountry, ui.colVerified, ui.colRegisteredAt].map(h => (
                <th key={h} className="text-right px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground max-w-[80px] truncate">{r.id?.slice(0, 8)}…</td>
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{r.full_name || '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-[160px] truncate">{r.email || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.phone || '—'}</td>
                <td className="px-3 py-2.5">
                  <Badge
                    label={r.role === 'manufacturer' ? 'مصنّع' : r.role === 'admin' ? 'مسؤول' : 'مشتري'}
                    color={r.role === 'manufacturer' ? 'bg-purple-50 text-purple-700 border-purple-200' : r.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-sky-50 text-sky-700 border-sky-200'}
                  />
                </td>
                <td className="px-3 py-2.5">
                  {r.auth_provider === 'google'
                    ? <Badge label="Google" color="bg-red-50 text-red-600 border-red-200" />
                    : <Badge label="Email" color="bg-gray-50 text-gray-600 border-gray-200" />}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.country || '—'}</td>
                <td className="px-3 py-2.5">
                  {r.is_verified
                    ? <Badge label={`✓ ${ui.yes}`} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    : <Badge label={ui.no} color="bg-gray-50 text-gray-500 border-gray-200" />}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">{ui.noResults}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <RecordModal title={`{ui.userDetails} — ${selected.full_name || selected.email}`} onClose={() => setSelected(null)}>
          <DetailGrid rows={[
            { label: 'User ID', value: selected.id },
            { label: ui.colFullName, value: selected.full_name },
            { label: ui.colEmail, value: selected.email },
            { label: ui.colPhone, value: selected.phone },
            { label: ui.colCompany, value: selected.company_name },
            { label: ui.colRole, value: selected.role },
            { label: 'طريقة الدخول', value: selected.auth_provider || 'email' },
            { label: ui.colCountry, value: selected.country },
            { label: 'مُفعَّل', value: selected.is_verified ? ui.yes : ui.no },
            { label: 'تاريخ التسجيل', value: formatDate(selected.created_at) },
          ]} />
        </RecordModal>
      )}
    </div>
  );
}

function FactoriesTable({ search }: { search: string }) {
  const { t } = useLanguage();
  const ui = t.admin.dbExplorer;
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('factory_registrations')
        .select('id, company_name, country, contact_phone, contact_email, tax_id, registration_status, kyc_status, seller_category, is_verified, submitted_at, city, industry, contact_name, website, trade_license_url, cr_document_url, tax_certificate_url')
        .order('submitted_at', { ascending: false })
        .limit(300);
      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.company_name || '').toLowerCase().includes(q) ||
      (r.country || '').toLowerCase().includes(q) ||
      (r.contact_phone || '').toLowerCase().includes(q) ||
      (r.contact_email || '').toLowerCase().includes(q) ||
      (r.tax_id || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  const statusColor = (s: string) =>
    s === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    s === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    s === 'under_review'? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-700 border-red-200';

  const statusLabel = (s: string) =>
    s === 'approved' ? 'موافق' : s === 'pending' ? 'معلق' : s === 'under_review' ? 'قيد المراجعة' : 'مرفوض';

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{filtered.length} {ui.records}</p>
      <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              {[ui.colCompany, ui.colCountry, ui.colPhone, 'البريد التجاري', 'الرقم الضريبي', 'النوع', 'حالة التحقق', 'تاريخ التقديم'].map(h => (
                <th key={h} className="text-right px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{r.company_name || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.country || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.contact_phone || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{r.contact_email || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.tax_id || '—'}</td>
                <td className="px-3 py-2.5">
                  <Badge
                    label={r.seller_category === 'local_factory' ? '🏭 مصنع محلي' : r.seller_category === 'international_factory' ? '🌐 مصنع عالمي' : r.seller_category === 'local_supplier' ? '🚚 مورد محلي' : '—'}
                    color="bg-gray-50 text-gray-600 border-gray-200"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <Badge label={statusLabel(r.registration_status)} color={statusColor(r.registration_status)} />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.submitted_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">{ui.noResults}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <RecordModal title={`تفاصيل المصنع / المورد — ${selected.company_name}`} onClose={() => setSelected(null)}>
          <DetailGrid rows={[
            { label: 'ID', value: selected.id },
            { label: ui.colCompany, value: selected.company_name },
            { label: ui.colCountry, value: selected.country },
            { label: 'المدينة', value: selected.city },
            { label: 'القطاع', value: selected.industry },
            { label: 'اسم جهة الاتصال', value: selected.contact_name },
            { label: ui.colPhone, value: selected.contact_phone },
            { label: 'البريد التجاري', value: selected.contact_email },
            { label: 'الموقع الإلكتروني', value: selected.website },
            { label: 'الرقم الضريبي', value: selected.tax_id },
            { label: 'نوع البائع', value: selected.seller_category },
            { label: 'حالة التسجيل', value: selected.registration_status },
            { label: 'حالة KYC', value: selected.kyc_status },
            { label: 'تاريخ التقديم', value: formatDate(selected.submitted_at) },
          ]}
          links={[
            { label: 'السجل التجاري', url: selected.trade_license_url || selected.cr_document_url },
            { label: 'شهادة الضريبة', url: selected.tax_certificate_url },
          ]}
          />
        </RecordModal>
      )}
    </div>
  );
}

function ProductsTable({ search }: { search: string }) {
  const { t } = useLanguage();
  const ui = t.admin.dbExplorer;
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('products')
        .select('id, name, name_ar, category, price, moq, stock_quantity, currency, is_active, created_at, manufacturer_id, tiered_pricing, description')
        .order('created_at', { ascending: false })
        .limit(300);
      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.name_ar || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{filtered.length} {ui.records}</p>
      <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              {['اسم المنتج', 'الفئة', 'السعر الأساسي', 'العملة', 'الحد الأدنى للطلب (MOQ)', 'المخزون', 'تسعير متدرج', 'نشط', 'تاريخ الإضافة'].map(h => (
                <th key={h} className="text-right px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px] truncate">{r.name_ar || r.name || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.category || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-bold text-emerald-700">{r.price != null ? r.price : '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.currency || 'USD'}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.moq != null ? r.moq : '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.stock_quantity != null ? r.stock_quantity : '—'}</td>
                <td className="px-3 py-2.5">
                  {r.tiered_pricing && Array.isArray(r.tiered_pricing) && r.tiered_pricing.length > 0
                    ? <Badge label={`${r.tiered_pricing.length} شريحة`} color="bg-blue-50 text-blue-700 border-blue-200" />
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {r.is_active
                    ? <Badge label="✓ نشط" color="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    : <Badge label="معطل" color="bg-gray-50 text-gray-500 border-gray-200" />}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">{ui.noResults}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <RecordModal title={`تفاصيل المنتج — ${selected.name_ar || selected.name}`} onClose={() => setSelected(null)}>
          <DetailGrid rows={[
            { label: 'ID', value: selected.id },
            { label: 'الاسم (عربي)', value: selected.name_ar },
            { label: 'الاسم (إنجليزي)', value: selected.name },
            { label: 'الفئة', value: selected.category },
            { label: 'السعر الأساسي', value: selected.price != null ? `${selected.price} ${selected.currency || 'USD'}` : '—' },
            { label: 'الحد الأدنى للطلب (MOQ)', value: selected.moq },
            { label: 'المخزون', value: selected.stock_quantity },
            { label: 'الوصف', value: selected.description },
            { label: 'نشط', value: selected.is_active ? ui.yes : ui.no },
            { label: 'تاريخ الإضافة', value: formatDate(selected.created_at) },
          ]}
          tieredPricing={selected.tiered_pricing}
          />
        </RecordModal>
      )}
    </div>
  );
}

function AgentsTable({ search }: { search: string }) {
  const { t } = useLanguage();
  const ui = t.admin.dbExplorer;
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('field_agents')
        .select('id, full_name, email, phone, region, status, created_at, license_url, user_id')
        .order('created_at', { ascending: false })
        .limit(200);

      if (rows && rows.length > 0) {
        const counts: Record<string, number> = {};
        await Promise.all(rows.map(async (agent) => {
          const { count } = await supabase
            .from('agent_factory_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('agent_id', agent.id);
          counts[agent.id] = count || 0;
        }));
        setRegCounts(counts);
      }

      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.region || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{filtered.length} {ui.records}</p>
      <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              {['Agent ID', ui.colFullName, ui.colPhone, ui.colEmail, 'المنطقة', 'التسجيلات المرتبطة', ui.colStatus, 'تاريخ الانضمام'].map(h => (
                <th key={h} className="text-right px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{r.id?.slice(0, 8)}…</td>
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{r.full_name || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.phone || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{r.email || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{r.region || '—'}</td>
                <td className="px-3 py-2.5">
                  <Badge label={`${regCounts[r.id] || 0} تسجيل`} color="bg-teal-50 text-teal-700 border-teal-200" />
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    label={r.status === 'active' ? 'نشط' : r.status === 'pending' ? 'معلق' : r.status || '—'}
                    color={r.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                  />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">{ui.noResults}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <RecordModal title={`تفاصيل المندوب — ${selected.full_name}`} onClose={() => setSelected(null)}>
          <DetailGrid rows={[
            { label: 'Agent ID', value: selected.id },
            { label: ui.colFullName, value: selected.full_name },
            { label: ui.colPhone, value: selected.phone },
            { label: ui.colEmail, value: selected.email },
            { label: 'المنطقة', value: selected.region },
            { label: ui.colStatus, value: selected.status },
            { label: 'التسجيلات المرتبطة', value: regCounts[selected.id] || 0 },
            { label: 'تاريخ الانضمام', value: formatDate(selected.created_at) },
          ]}
          links={[{ label: 'رخصة المندوب', url: selected.license_url }]}
          />
        </RecordModal>
      )}
    </div>
  );
}

function MessagesTable({ search }: { search: string }) {
  const { t } = useLanguage();
  const ui = t.admin.dbExplorer;
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // Try admin_factory_messages first, fallback to chat_messages
      const { data: rows } = await supabase
        .from('admin_factory_messages')
        .select('id, sender_id, recipient_id, content, created_at, conversation_id, is_read, sender_role')
        .order('created_at', { ascending: false })
        .limit(300);
      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.content || '').toLowerCase().includes(q) ||
      (r.sender_id || '').toLowerCase().includes(q) ||
      (r.recipient_id || '').toLowerCase().includes(q) ||
      (r.sender_role || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{filtered.length} رسالة</p>
      <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              {['Conversation ID', 'المرسل (ID)', 'دور المرسل', 'المستلم (ID)', 'محتوى الرسالة', 'مقروءة', 'التاريخ والوقت'].map(h => (
                <th key={h} className="text-right px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{r.conversation_id?.slice(0, 8)}…</td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{r.sender_id?.slice(0, 8)}…</td>
                <td className="px-3 py-2.5">
                  <Badge
                    label={r.sender_role === 'admin' ? 'مسؤول' : r.sender_role === 'factory' ? 'مصنع' : r.sender_role || '—'}
                    color={r.sender_role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}
                  />
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">{r.recipient_id?.slice(0, 8)}…</td>
                <td className="px-3 py-2.5 text-xs text-foreground max-w-[220px] truncate">{r.content || '—'}</td>
                <td className="px-3 py-2.5">
                  {r.is_read
                    ? <Badge label={`✓ ${ui.yes}`} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
                    : <Badge label={ui.no} color="bg-amber-50 text-amber-700 border-amber-200" />}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">{ui.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <RecordModal title="تفاصيل الرسالة" onClose={() => setSelected(null)}>
          <DetailGrid rows={[
            { label: 'Message ID', value: selected.id },
            { label: 'Conversation ID', value: selected.conversation_id },
            { label: 'المرسل (ID)', value: selected.sender_id },
            { label: 'دور المرسل', value: selected.sender_role },
            { label: 'المستلم (ID)', value: selected.recipient_id },
            { label: 'محتوى الرسالة', value: selected.content },
            { label: 'مقروءة', value: selected.is_read ? ui.yes : ui.no },
            { label: ui.colDate, value: formatDate(selected.created_at) },
          ]} />
        </RecordModal>
      )}
    </div>
  );
}

function DocumentsTable({ search }: { search: string }) {
  const { t } = useLanguage();
  const ui = t.admin.dbExplorer;
  const supabase = createClient();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('factory_registrations')
        .select('id, company_name, contact_email, trade_license_url, trade_license_filename, tax_certificate_url, tax_certificate_filename, cr_document_url, factory_license_url, manufacturing_license_url, company_profile_url, tax_id, submitted_at, registration_status')
        .order('submitted_at', { ascending: false })
        .limit(300);
      setData(rows || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.company_name || '').toLowerCase().includes(q) ||
      (r.contact_email || '').toLowerCase().includes(q) ||
      (r.tax_id || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  const hasDoc = (url: string | null) => url && !url.startsWith('pending-upload:');

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{filtered.length} {ui.records}</p>
      <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              {[ui.colCompany, 'البريد التجاري', 'الرقم الضريبي', 'السجل التجاري', 'شهادة الضريبة', 'رخصة المصنع', 'ملف الشركة', 'حالة التسجيل', 'تاريخ التقديم'].map(h => (
                <th key={h} className="text-right px-3 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{r.company_name || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate">{r.contact_email || '—'}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-foreground">{r.tax_id || '—'}</td>
                <td className="px-3 py-2.5">
                  {hasDoc(r.trade_license_url || r.cr_document_url)
                    ? <a href={r.trade_license_url || r.cr_document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Icon name="ArrowTopRightOnSquareIcon" size={11} /> عرض
                      </a>
                    : <span className="text-xs text-red-400">لم يُرفع</span>}
                </td>
                <td className="px-3 py-2.5">
                  {hasDoc(r.tax_certificate_url)
                    ? <a href={r.tax_certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Icon name="ArrowTopRightOnSquareIcon" size={11} /> عرض
                      </a>
                    : <span className="text-xs text-red-400">لم يُرفع</span>}
                </td>
                <td className="px-3 py-2.5">
                  {hasDoc(r.factory_license_url || r.manufacturing_license_url)
                    ? <a href={r.factory_license_url || r.manufacturing_license_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Icon name="ArrowTopRightOnSquareIcon" size={11} /> عرض
                      </a>
                    : <span className="text-xs text-red-400">لم يُرفع</span>}
                </td>
                <td className="px-3 py-2.5">
                  {hasDoc(r.company_profile_url)
                    ? <a href={r.company_profile_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Icon name="ArrowTopRightOnSquareIcon" size={11} /> عرض
                      </a>
                    : <span className="text-xs text-red-400">لم يُرفع</span>}
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    label={r.registration_status === 'approved' ? 'موافق' : r.registration_status === 'pending' ? 'معلق' : r.registration_status === 'under_review' ? 'قيد المراجعة' : 'مرفوض'}
                    color={r.registration_status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.registration_status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}
                  />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.submitted_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">{ui.noResults}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <RecordModal title={`مستندات — ${selected.company_name}`} onClose={() => setSelected(null)}>
          <DetailGrid rows={[
            { label: 'ID', value: selected.id },
            { label: ui.colCompany, value: selected.company_name },
            { label: 'البريد التجاري', value: selected.contact_email },
            { label: 'الرقم الضريبي', value: selected.tax_id },
            { label: 'حالة التسجيل', value: selected.registration_status },
            { label: 'تاريخ التقديم', value: formatDate(selected.submitted_at) },
          ]}
          links={[
            { label: 'السجل التجاري', url: selected.trade_license_url || selected.cr_document_url },
            { label: 'شهادة الضريبة', url: selected.tax_certificate_url },
            { label: 'رخصة المصنع', url: selected.factory_license_url || selected.manufacturing_license_url },
            { label: 'ملف الشركة', url: selected.company_profile_url },
          ]}
          />
        </RecordModal>
      )}
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="mr-3 text-sm text-muted-foreground">جارٍ تحميل البيانات…</span>
    </div>
  );
}

function RecordModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-bold text-foreground text-sm">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function DetailGrid({ rows, links, tieredPricing }: {
  rows: { label: string; value: any }[];
  links?: { label: string; url: string | null | undefined }[];
  tieredPricing?: any[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(r => (
          <div key={r.label} className="bg-muted rounded-xl p-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">{r.label}</p>
            <p className="text-sm font-medium text-foreground break-all">{r.value != null && r.value !== '' ? String(r.value) : '—'}</p>
          </div>
        ))}
      </div>
      {links && links.filter(l => l.url && !l.url.startsWith('pending-upload:')).length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{ui.uploadedDocs}</p>
          <div className="space-y-2">
            {links.filter(l => l.url && !l.url.startsWith('pending-upload:')).map(l => (
              <a
                key={l.label}
                href={l.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Icon name="DocumentTextIcon" size={16} />
                {l.label}
                <Icon name="ArrowTopRightOnSquareIcon" size={13} className="mr-auto" />
              </a>
            ))}
          </div>
        </div>
      )}
      {tieredPricing && Array.isArray(tieredPricing) && tieredPricing.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{ui.tierPricing}</p>
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl border border-border">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground">{ui.qtyFrom}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground">{ui.qtyTo}</th>
                  <th className="text-right px-3 py-2 text-[10px] font-bold text-muted-foreground">{ui.colPrice}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tieredPricing.map((tier: any, i: number) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-sm font-mono">{tier.from_qty ?? tier.from ?? '—'}</td>
                    <td className="px-3 py-2 text-sm font-mono">{tier.to_qty ?? tier.to ?? '—'}</td>
                    <td className="px-3 py-2 text-sm font-bold text-emerald-700">{tier.price ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function DatabaseExplorerPanel() {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.dbExplorer;
  const [activeTable, setActiveTable] = useState<TableKey>('users');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleTableChange = useCallback((key: TableKey) => {
    setActiveTable(key);
    setSearch('');
    setDebouncedSearch('');
  }, []);

  const activeDef = TABLES.find(t => t.key === activeTable)!;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Icon name="CircleStackIcon" size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-white/70 text-sm">{ui.subtitle}</p>
          </div>
          <div className="mr-auto flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white/90">{ui.liveData}</span>
          </div>
        </div>
      </div>

      {/* Table Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {TABLES.map(t => {
          const isActive = activeTable === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTableChange(t.key)}
              className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                isActive
                  ? `${t.bg} ${t.text} border-current shadow-md`
                  : 'bg-card border-border text-muted-foreground hover:border-current hover:shadow-sm'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? t.color + ' text-white' : 'bg-muted'}`}>
                <Icon name={t.icon as any} size={18} className={isActive ? 'text-white' : 'text-muted-foreground'} />
              </div>
              <span className="text-[10px] font-bold leading-tight">{(ui as any)[t.labelKey] || t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Table Header + Search */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className={`px-5 py-4 border-b border-border ${activeDef.bg}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`w-9 h-9 rounded-lg ${activeDef.color} flex items-center justify-center shrink-0`}>
              <Icon name={activeDef.icon as any} size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-sm ${activeDef.text}`}>{(ui as any)[activeDef.labelKey] || activeDef.label}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{(ui as any)[activeDef.descKey]}</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={ui.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <Icon name="XMarkIcon" size={12} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
          {activeTable === 'users' && <UsersTable search={debouncedSearch} />}
          {activeTable === 'factories' && <FactoriesTable search={debouncedSearch} />}
          {activeTable === 'products' && <ProductsTable search={debouncedSearch} />}
          {activeTable === 'agents' && <AgentsTable search={debouncedSearch} />}
          {activeTable === 'messages' && <MessagesTable search={debouncedSearch} />}
          {activeTable === 'documents' && <DocumentsTable search={debouncedSearch} />}
        </div>
      </div>
    </div>
  );
}
