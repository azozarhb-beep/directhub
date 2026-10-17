'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FactoryRegistration {
  id: string;
  company_name: string;
  factory_type: string;
  country: string;
  city: string;
  region?: string;
  contact_person: string;
  contact_phone: string;
  contact_email?: string;
  industry?: string;
  employee_count?: string;
  annual_capacity?: string;
  registration_status: string;
  contact_status: string;
  created_at: string;
  trade_license_url?: string;
  cr_document_url?: string;
  factory_license_url?: string;
  commercial_registry_url?: string;
  industrial_license_url?: string;
}

interface CommissionEntry {
  id: string;
  order_id: string;
  commission_amount: number;
  currency: string;
  status: 'pending' | 'paid';
  created_at: string;
  factory_name: string;
}

interface Props {
  userId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KYC_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'قيد الانتظار', color: '#92400e', bg: '#fef3c7', icon: 'ClockIcon' },
  under_review: { label: 'تحت المراجعة', color: '#1e40af', bg: '#dbeafe', icon: 'MagnifyingGlassIcon' },
  approved: { label: 'معتمد ✓', color: '#065f46', bg: '#d1fae5', icon: 'CheckBadgeIcon' },
  rejected: { label: 'مرفوض', color: '#991b1b', bg: '#fee2e2', icon: 'XCircleIcon' },
  documents_submitted: { label: 'وثائق مقدمة', color: '#5b21b6', bg: '#ede9fe', icon: 'DocumentCheckIcon' },
};

const COMMISSION_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'معلق', color: '#92400e', bg: '#fef3c7' },
  approved: { label: 'معتمد', color: '#1e40af', bg: '#dbeafe' },
  paid: { label: 'مدفوع ✓', color: '#065f46', bg: '#d1fae5' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasValue(v?: string | null): boolean {
  return !!(v && v.trim());
}

/** A facility has all required documents when it has a trade license and any one of the registry / industrial licenses. */
function getMissingDocs(f: FactoryRegistration): string[] {
  const missing: string[] = [];
  if (!hasValue(f.trade_license_url)) missing.push('الرخصة التجارية');
  if (!hasValue(f.cr_document_url) && !hasValue(f.commercial_registry_url)) missing.push('السجل التجاري');
  if (!hasValue(f.factory_license_url) && !hasValue(f.industrial_license_url)) missing.push('رخصة المصنع / الترخيص الصناعي');
  return missing;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.15)' }}>
        <Icon name={icon as any} size={20} style={{ color: '#D4AF37' }} />
      </div>
      <div>
        <h2 className="font-bold text-base" style={{ color: '#D4AF37' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Missing Documents Alerts ─────────────────────────────────────────────────

function MissingDocsAlerts({ factories }: { factories: FactoryRegistration[] }) {
  const alerts = factories
    .map(f => ({ factory: f, missing: getMissingDocs(f) }))
    .filter(a => a.missing.length > 0 && a.factory.registration_status !== 'rejected');

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)' }}>
      <div className="flex items-center gap-2">
        <Icon name="ExclamationTriangleIcon" size={18} style={{ color: '#f59e0b' }} />
        <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>
          تنبيهات الوثائق الناقصة ({alerts.length})
        </p>
      </div>
      <div className="space-y-2">
        {alerts.map(({ factory, missing }) => (
          <div key={factory.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#fff' }}>{factory.company_name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>
                ناقص: {missing.join(' · ')}
              </p>
            </div>
            <Link
              href={`/agent/upload-license?factoryId=${factory.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
              style={{ background: '#D4AF37', color: '#1E1E1E' }}
            >
              <Icon name="ArrowUpTrayIcon" size={13} />
              رفع التراخيص والشهادات
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KYC Status Table ─────────────────────────────────────────────────────────

function KYCStatusTable({ factories }: { factories: FactoryRegistration[] }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'local_factory' | 'international_factory'>('all');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = factories.filter(f => {
    const matchSearch = !search || f.company_name.toLowerCase().includes(search.toLowerCase()) ||
      f.contact_person.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || f.factory_type === filterType;
    const matchStatus = !filterStatus || f.registration_status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const stats = {
    total: factories.length,
    local: factories.filter(f => f.factory_type === 'local_factory').length,
    intl: factories.filter(f => f.factory_type === 'international_factory').length,
    approved: factories.filter(f => f.registration_status === 'approved').length,
    pending: factories.filter(f => f.registration_status === 'pending').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'الإجمالي', value: stats.total, color: '#D4AF37' },
          { label: 'محلية', value: stats.local, color: '#10b981' },
          { label: 'دولية', value: stats.intl, color: '#3b82f6' },
          { label: 'معتمد', value: stats.approved, color: '#10b981' },
          { label: 'قيد الانتظار', value: stats.pending, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <MissingDocsAlerts factories={factories} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8899aa' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث باسم المصنع أو المسؤول..."
            className="w-full pr-9 pl-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#fff' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { val: 'all' as const, label: 'الكل' },
            { val: 'local_factory' as const, label: 'محلية' },
            { val: 'international_factory' as const, label: 'دولية' },
          ].map(b => (
            <button key={b.val} onClick={() => setFilterType(b.val)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{
                background: filterType === b.val ? '#D4AF37' : '#2a2a2a',
                borderColor: filterType === b.val ? '#D4AF37' : '#3a3a3a',
                color: filterType === b.val ? '#1E1E1E' : '#8899aa',
              }}>
              {b.label}
            </button>
          ))}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none"
            style={{ background: '#2a2a2a', borderColor: '#3a3a3a', color: '#8899aa' }}>
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="under_review">تحت المراجعة</option>
            <option value="documents_submitted">وثائق مقدمة</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Icon name="BuildingOffice2Icon" size={32} style={{ color: '#3a3a3a' }} className="mx-auto mb-3" />
          <p className="text-sm" style={{ color: '#8899aa' }}>
            {factories.length === 0 ? 'لا توجد مصانع مسجلة بعد' : 'لا توجد مصانع مطابقة للبحث'}
          </p>
          {factories.length === 0 && (
            <Link
              href="/agent/register-facility"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#D4AF37', color: '#1E1E1E' }}
            >
              <Icon name="PlusIcon" size={14} />
              تسجيل جديد
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl" style={{ border: '1px solid #3a3a3a' }}>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ background: '#2a2a2a', borderBottom: '1px solid #3a3a3a' }}>
                {['المصنع', 'النوع', 'الدولة / المحافظة', 'المسؤول', 'حالة KYC', 'تاريخ التسجيل', 'الوثائق'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-bold" style={{ color: '#D4AF37' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, idx) => {
                const kycMeta = KYC_STATUS_META[f.registration_status] || KYC_STATUS_META.pending;
                const missing = getMissingDocs(f);
                return (
                  <tr key={f.id} style={{ background: idx % 2 === 0 ? '#1E1E1E' : '#222', borderBottom: '1px solid #2a2a2a' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: '#fff' }}>{f.company_name}</p>
                      {f.industry && <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>{f.industry}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{
                        background: f.factory_type === 'international_factory' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                        color: f.factory_type === 'international_factory' ? '#60a5fa' : '#10b981',
                      }}>
                        {f.factory_type === 'international_factory' ? '🌐 دولي' : f.factory_type === 'local_supplier' ? '🏪 مورد محلي' : '🏭 محلي'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#ccc' }}>{f.city}, {f.country}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs" style={{ color: '#ccc' }}>{f.contact_person}</p>
                      <p className="text-xs" style={{ color: '#8899aa' }} dir="ltr">{f.contact_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold w-fit" style={{ background: kycMeta.bg, color: kycMeta.color }}>
                        <Icon name={kycMeta.icon as any} size={12} />
                        {kycMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8899aa' }}>
                      {f.created_at ? f.created_at.slice(0, 10) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {missing.length === 0 ? (
                        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#10b981' }}>
                          <Icon name="DocumentCheckIcon" size={13} />
                          مكتملة
                        </span>
                      ) : (
                        <Link
                          href={`/agent/upload-license?factoryId=${f.id}`}
                          className="flex items-center gap-1 text-xs font-semibold"
                          style={{ color: '#f59e0b' }}
                        >
                          <Icon name="ArrowUpTrayIcon" size={13} />
                          رفع التراخيص والشهادات
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Commissions Panel ────────────────────────────────────────────────────────

function CommissionsPanel({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const supabase = createClient();

  const fetchCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_commissions')
        .select('id, order_id, commission_amount, currency, status, created_at, factory_name')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEntries(data as CommissionEntry[]);
      } else {
        setEntries([]);
      }
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

  const filtered = filterStatus ? entries.filter(e => e.status === filterStatus) : entries;

  const totals = entries.reduce(
    (acc, e) => ({
      yer: acc.yer + (e.currency === 'YER' ? (e.commission_amount || 0) : 0),
      usd: acc.usd + (e.currency === 'USD' ? (e.commission_amount || 0) : 0),
      paid_yer: acc.paid_yer + (e.status === 'paid' && e.currency === 'YER' ? (e.commission_amount || 0) : 0),
      paid_usd: acc.paid_usd + (e.status === 'paid' && e.currency === 'USD' ? (e.commission_amount || 0) : 0),
      pending_yer: acc.pending_yer + (e.status === 'pending' && e.currency === 'YER' ? (e.commission_amount || 0) : 0),
      pending_usd: acc.pending_usd + (e.status === 'pending' && e.currency === 'USD' ? (e.commission_amount || 0) : 0),
    }),
    { yer: 0, usd: 0, paid_yer: 0, paid_usd: 0, pending_yer: 0, pending_usd: 0 }
  );

  const fmtYER = (v: number) => v.toLocaleString('ar-YE') + ' ﷼';
  const fmtUSD = (v: number) => '$' + v.toFixed(2);

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'إجمالي العمولات',
            yer: totals.yer,
            usd: totals.usd,
            icon: 'BanknotesIcon',
            color: '#D4AF37',
            bg: 'rgba(212,175,55,0.1)',
          },
          {
            label: 'عمولات مدفوعة',
            yer: totals.paid_yer,
            usd: totals.paid_usd,
            icon: 'CheckCircleIcon',
            color: '#10b981',
            bg: 'rgba(16,185,129,0.1)',
          },
          {
            label: 'عمولات معلقة',
            yer: totals.pending_yer,
            usd: totals.pending_usd,
            icon: 'ClockIcon',
            color: '#f59e0b',
            bg: 'rgba(245,158,11,0.1)',
          },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4" style={{ background: card.bg, border: `1px solid ${card.color}33` }}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name={card.icon as any} size={18} style={{ color: card.color }} />
              <p className="text-sm font-semibold" style={{ color: card.color }}>{card.label}</p>
            </div>
            <p className="text-xl font-bold" style={{ color: '#fff' }}>{fmtYER(card.yer)}</p>
            <p className="text-sm mt-1" style={{ color: '#8899aa' }}>{fmtUSD(card.usd)}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { val: '', label: 'الكل' },
          { val: 'pending', label: 'معلق' },
          { val: 'approved', label: 'معتمد' },
          { val: 'paid', label: 'مدفوع' },
        ].map(b => (
          <button key={b.val} onClick={() => setFilterStatus(b.val)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
            style={{
              background: filterStatus === b.val ? '#D4AF37' : '#2a2a2a',
              borderColor: filterStatus === b.val ? '#D4AF37' : '#3a3a3a',
              color: filterStatus === b.val ? '#1E1E1E' : '#8899aa',
            }}>
            {b.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 rounded-xl" style={{ background: '#2a2a2a', border: '1px solid #3a3a3a' }}>
          <Icon name="BanknotesIcon" size={36} style={{ color: '#3a3a3a' }} className="mx-auto mb-3" />
          <p className="font-semibold" style={{ color: '#8899aa' }}>لا توجد عمولات مسجلة بعد</p>
          <p className="text-xs mt-1" style={{ color: '#555' }}>ستظهر عمولاتك هنا بعد إتمام أول صفقة</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 rounded-xl" style={{ border: '1px solid #3a3a3a' }}>
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr style={{ background: '#2a2a2a', borderBottom: '1px solid #3a3a3a' }}>
                {['المصنع', 'رقم الطلب', 'قيمة الطلب (YER)', 'قيمة الطلب (USD)', 'نسبة العمولة', 'العمولة (YER)', 'العمولة (USD)', 'الحالة', 'التاريخ'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-xs font-bold" style={{ color: '#D4AF37' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => {
                const meta = COMMISSION_STATUS_META[e.status] || COMMISSION_STATUS_META.pending;
                return (
                  <tr key={e.id} style={{ background: idx % 2 === 0 ? '#1E1E1E' : '#222', borderBottom: '1px solid #2a2a2a' }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-xs" style={{ color: '#fff' }}>{e.factory_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#ccc' }} dir="ltr">{e.order_id?.slice(0, 8).toUpperCase() || '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: '#10b981' }}>{fmtYER(e.currency === 'YER' ? e.commission_amount : 0)}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: '#60a5fa' }}>{fmtUSD(e.currency === 'USD' ? e.commission_amount : 0)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8899aa' }}>
                      {e.created_at ? e.created_at.slice(0, 10) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type MainTab = 'kyc' | 'commissions';

export default function EnhancedAgentDashboard({ userId }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('kyc');
  const [factories, setFactories] = useState<FactoryRegistration[]>([]);
  const [loadingFactories, setLoadingFactories] = useState(true);
  const supabase = createClient();

  const fetchFactories = useCallback(async () => {
    setLoadingFactories(true);
    try {
      const { data } = await supabase
        .from('agent_factory_registrations')
        .select('id, company_name, factory_type, country, city, region, contact_person, contact_phone, contact_email, industry, employee_count, annual_capacity, registration_status, contact_status, created_at, trade_license_url, cr_document_url, factory_license_url, commercial_registry_url, industrial_license_url')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });
      setFactories((data as FactoryRegistration[]) || []);
    } catch {
      setFactories([]);
    } finally {
      setLoadingFactories(false);
    }
  }, [userId, supabase]);

  useEffect(() => { fetchFactories(); }, [fetchFactories]);

  const incompleteDocsCount = factories.filter(f => getMissingDocs(f).length > 0 && f.registration_status !== 'rejected').length;

  const MAIN_TABS: { key: MainTab; icon: string; label: string; badge?: number }[] = [
    { key: 'kyc', icon: 'ClipboardDocumentCheckIcon', label: 'المصانع والتوثيق (KYC)', badge: incompleteDocsCount },
    { key: 'commissions', icon: 'CurrencyDollarIcon', label: 'العمولات والأرباح' },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#1E1E1E', border: '1px solid #D4AF37' }} dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'rgba(212,175,55,0.08)', borderBottom: '1px solid #D4AF37' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.2)' }}>
          <Icon name="BriefcaseIcon" size={22} style={{ color: '#D4AF37' }} />
        </div>
        <div>
          <h1 className="font-bold text-base" style={{ color: '#D4AF37' }}>غرفة تحكم المندوب الميداني</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>متابعة المصانع · توثيق KYC · تتبع العمولات</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid #D4AF37' }}>
            {factories.length} مصنع مسجل
          </span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 p-3" style={{ background: '#161616', borderBottom: '1px solid #2a2a2a' }}>
        {MAIN_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all relative"
            style={{
              background: mainTab === tab.key ? '#D4AF37' : 'transparent',
              color: mainTab === tab.key ? '#1E1E1E' : '#8899aa',
              border: mainTab === tab.key ? 'none' : '1px solid #2a2a2a',
            }}
          >
            <Icon name={tab.icon as any} size={15} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1"
                style={{ background: '#ef4444', color: '#fff' }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* ── KYC Tab ── */}
        {mainTab === 'kyc' && (
          <div>
            <SectionHeader
              icon="ClipboardDocumentCheckIcon"
              title="المصانع والتوثيق (KYC)"
              subtitle="تتبع حالة الاعتماد (معتمد / قيد الانتظار) والوثائق الناقصة لجميع المصانع المسجلة"
            />
            {loadingFactories ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <KYCStatusTable factories={factories} />
            )}
          </div>
        )}

        {/* ── Commissions Tab ── */}
        {mainTab === 'commissions' && (
          <div>
            <SectionHeader
              icon="CurrencyDollarIcon"
              title="لوحة تتبع العمولات والأرباح"
              subtitle="عمولاتك بالريال اليمني (YER) والدولار الأمريكي (USD)"
            />
            <CommissionsPanel userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
