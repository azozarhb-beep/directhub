'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { formatCoverageLabel } from '@/lib/territoryData';
import AppLogo from '@/components/ui/AppLogo';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import UnifiedMessagingEngine from '@/components/UnifiedMessagingEngine';
import { AgentProductEditDrawer, AgentProductPreviewModal } from './AgentProductEditDrawer';
import { AgentProductShareModal, copyAgentProductLink } from './AgentProductShareModal';
import DocumentUploadPanel from './DocumentUploadPanel';
import InfoExchangePanel from './InfoExchangePanel';
import ReceivingAccountPanel from './ReceivingAccountPanel';
import AgentComplaintsPanel from './AgentComplaintsPanel';
import AgentSalesDashboard from './AgentSalesDashboard';
import AgentDispatchRoomsTab from './AgentDispatchRoomsTab';
import AgentInspectionTasksPanel from './AgentInspectionTasksPanel';

import AgentOperationsHub from './AgentOperationsHub';
import EnhancedAgentDashboard from '@/components/agent/EnhancedAgentDashboard';
import ReferralTrackingPanel from './ReferralTrackingPanel';
import AgentUnifiedEarningsCard from './AgentUnifiedEarningsCard';
import { isApprovedOrActiveFacility } from '@/lib/referralStats';
import { useLanguage } from '@/contexts/LanguageContext';
import { CHAT_LANGUAGES, ChatLanguage } from './AgentLanguageSelector';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
} from '@/lib/roomIsolation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentFactory {
  id: string;
  company_name: string;
  factory_type: string;
  country: string;
  city: string;
  region: string;
  address: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  website: string;
  industry: string;
  employee_count: string;
  annual_capacity: string;
  contact_status: string;
  registration_status: string;
  trade_license_url: string;
  license_submitted_at: string | null;
  license_reviewed_at: string | null;
  license_reviewed_by: string | null;
  license_rejection_reason: string;
  created_at: string;
  updated_at: string;
  agent_notes: string;
  admin_note: string;
}

interface InspectionTask {
  id: string;
  order_id: string;
  order_number: string;
  factory_id: string | null;
  factory_name: string;
  factory_city: string;
  factory_country: string;
  factory_address: string;
  factory_contact_person: string;
  factory_contact_phone: string;
  factory_industry: string;
  escrow_status: string;
  order_total: number;
  currency: string;
  created_at: string;
  delivery_deadline: string | null;
  items_summary: string;
}

interface AgentProduct {
  id: string;
  factory_id: string;
  name_ar: string;
  name_en: string;
  price: number;
  currency: string;
  moq: number;
  unit: string;
  category?: string;
  is_active: boolean;
  created_at: string;
  description_ar?: string | null;
  description_en?: string | null;
  is_b2b_only?: boolean | null;
  retail_price?: number | null;
  wholesale_price?: number | null;
  price_tiers?: { min_qty: number; max_qty: number | null; price: number }[] | null;
  images?: string[] | null;
  video_url?: string | null;
}

const CONTACT_STATUS_COLORS: Record<string, string> = {
  contacting: 'bg-blue-50 text-blue-700 border-blue-200',
  awaiting_license_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  documents_submitted: 'bg-purple-50 text-purple-700 border-purple-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const REG_STATUS_META: Record<string, { color: string; icon: string }> = {
  pending: { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: 'ClockIcon' },
  under_review: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'MagnifyingGlassIcon' },
  approved: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckBadgeIcon' },
  rejected: { color: 'bg-red-50 text-red-700 border-red-200', icon: 'XCircleIcon' },
};

const FACTORY_TYPE_KEYS: Record<string, 'typeLocalFactory' | 'typeIntlFactory' | 'typeLocalSupplier'> = {
  local_factory: 'typeLocalFactory',
  international_factory: 'typeIntlFactory',
  local_supplier: 'typeLocalSupplier',
};

const LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
];

function maskPhone(phone: string | null | undefined): string {
  const raw = (phone || '').trim();
  if (!raw || raw === '—') return '—';
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 6) return '***';
  const hasPlus = raw.startsWith('+');
  const head = digits.slice(0, Math.min(6, digits.length - 2));
  const tail = digits.slice(-2);
  const headFmt = head.length > 3 ? `${head.slice(0, 3)} ${head.slice(3)}` : head;
  return `${hasPlus ? '+' : ''}${headFmt}***${tail}`;
}

function cleanLocationPart(value: string | null | undefined): string {
  return (value || '')
    .replace(/^[\s\d٠-٩]+[,،]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCityAddress(parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  parts.forEach(p => {
    const c = cleanLocationPart(p);
    if (c && c !== '—' && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  });
  return out.join('، ');
}

function buildMapsUrl(parts: Array<string | null | undefined>): string {
  const q = formatCityAddress(parts);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function SecureContactActions({ 
  mapQueryParts, 
  lang 
}: { 
  mapQueryParts: Array<string | null | undefined>; 
  lang: string;
}) {
  const coordText =
    lang === 'zh' ? '💬 内部直接对接协调' :
    lang === 'tr' ? '💬 Doğrudan Dahili Koordinasyon' :
    lang === 'en' ? '💬 Direct Internal Coordination' :
    '💬 محادثة التنسيق الداخلي المباشر';

  const mapText =
    lang === 'zh' ? '📍 在 GPS 地图中查看位置' :
    lang === 'tr' ? '📍 Konumu GPS Haritada Aç' :
    lang === 'en' ? '📍 Open in GPS Maps' :
    '📍 فتح الموقع في الخريطة GPS';

  return (
    <div className="flex flex-col sm:flex-row gap-2 pt-1">
      <Link
        href="/agent/dashboard?tab=admin-msg"
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
      >
        <span>{coordText}</span>
      </Link>
      <a
        href={buildMapsUrl(mapQueryParts)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <span>{mapText}</span>
      </a>
    </div>
  );
}

// ─── Full Review Modal ────────────────────────────────────────────────────────

function ReviewModal({
  factory,
  userId,
  onClose,
  onSave,
}: {
  factory: AgentFactory;
  userId: string;
  onClose: () => void;
  onSave: (
    factoryId: string,
    contactStatus: string,
    registrationStatus: string,
    agentNotes: string,
    adminNote: string
  ) => Promise<void>;
}) {
  const { t, language } = useLanguage();
  const ad = t.agentDashboard;

  const CONTACT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    contacting: { label: ad.contactContacting, color: CONTACT_STATUS_COLORS.contacting },
    awaiting_license_approval: { label: ad.contactAwaitingLicense, color: CONTACT_STATUS_COLORS.awaiting_license_approval },
    documents_submitted: { label: ad.contactDocsSubmitted, color: CONTACT_STATUS_COLORS.documents_submitted },
    approved: { label: ad.contactApproved, color: CONTACT_STATUS_COLORS.approved },
    rejected: { label: ad.contactRejected, color: CONTACT_STATUS_COLORS.rejected },
  };

  const REG_STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: ad.regPending, ...REG_STATUS_META.pending },
    under_review: { label: ad.regUnderReview, ...REG_STATUS_META.under_review },
    approved: { label: ad.regApproved, ...REG_STATUS_META.approved },
    rejected: { label: ad.regRejected, ...REG_STATUS_META.rejected },
  };

  const [contactStatus, setContactStatus] = useState(factory.contact_status || 'contacting');
  const [registrationStatus, setRegistrationStatus] = useState(factory.registration_status || 'pending');
  const [agentNotes, setAgentNotes] = useState(factory.agent_notes || '');
  const [adminNote, setAdminNote] = useState(factory.admin_note || '');
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'details' | 'status' | 'payout'>('details');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(factory.id, contactStatus, registrationStatus, agentNotes, adminNote);
      onClose();
    } catch (err) {
      console.error('Failed to save facility review:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="BuildingOffice2Icon" size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{factory.company_name}</h3>
              <p className="text-xs text-muted-foreground">
                {(FACTORY_TYPE_KEYS[factory.factory_type] ? ad[FACTORY_TYPE_KEYS[factory.factory_type]] : factory.factory_type)} · {formatCityAddress([factory.city, factory.country])}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex gap-1 bg-muted mx-4 mt-4 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveSection('details')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'details' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {ad.detailsTitle}
          </button>
          <button
            onClick={() => setActiveSection('status')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'status' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {ad.updateStatus}
          </button>
          <button
            onClick={() => setActiveSection('payout')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSection === 'payout' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            {language === 'zh' ? '收款账户 / 结算' : language === 'tr' ? 'Banka Hesapları / Tahsilat' : language === 'en' ? 'Payout Accounts' : 'الحسابات البنكية / التحصيل'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {activeSection === 'payout' ? (
            <ReceivingAccountPanel
              userId={userId}
              lockedFactoryId={factory.id}
              embedded
              factories={[{ id: factory.id, company_name: factory.company_name, factory_type: factory.factory_type }]}
            />
          ) : activeSection === 'details' ? (
            <>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{ad.regInfo}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{ad.facilityType}</p>
                    <p className="text-sm font-semibold text-foreground">{(FACTORY_TYPE_KEYS[factory.factory_type] ? ad[FACTORY_TYPE_KEYS[factory.factory_type]] : factory.factory_type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{ad.sector}</p>
                    <p className="text-sm font-semibold text-foreground">{factory.industry || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{ad.cityRegion}</p>
                    <p className="text-sm font-semibold text-foreground">{formatCityAddress([factory.city, factory.region]) || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{ad.country}</p>
                    <p className="text-sm font-semibold text-foreground">{factory.country}</p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{ad.contactData}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon name="UserIcon" size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{factory.contact_person}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="PhoneIcon" size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground font-mono" dir="ltr">{maskPhone(factory.contact_phone)}</span>
                  </div>
                  {factory.address && (
                    <div className="flex items-center gap-2">
                      <Icon name="MapPinIcon" size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground">{formatCityAddress([factory.city, factory.region, factory.address])}</span>
                    </div>
                  )}
                  <SecureContactActions mapQueryParts={[factory.address, factory.city, factory.region, factory.country]} lang={language} />
                </div>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{ad.tabDocuments}</h4>
                {factory.trade_license_url ? (
                  <a
                    href={factory.trade_license_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Icon name="DocumentCheckIcon" size={14} />
                    {ad.viewTradeLicense}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Icon name="DocumentIcon" size={14} />
                    {ad.noLicenseYet}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Quick Status Buttons */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationStatus('approved');
                    setContactStatus('approved');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors shadow-sm"
                >
                  <Icon name="CheckBadgeIcon" size={16} />
                  {language === 'zh' ? '⚡ 快速通过审核' : language === 'tr' ? '⚡ Hızlı Onayla' : language === 'en' ? '⚡ Quick Approve' : '⚡ اعتماد فوري للمصنع'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationStatus('rejected');
                    setContactStatus('rejected');
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <Icon name="XCircleIcon" size={14} />
                  {ad.reject}
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{ad.contactStatusLabel}</label>
                <div className="space-y-2">
                  {Object.entries(CONTACT_STATUS_LABELS).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setContactStatus(key)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        contactStatus === key
                          ? info.color + ' border-2' : 'bg-background border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${contactStatus === key ? 'border-current' : 'border-muted-foreground'}`}>
                        {contactStatus === key && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </div>
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {ad.regApprovalStatus}
                  <span className="text-xs font-normal text-muted-foreground mr-2">{ad.officialDecision}</span>
                </label>
                <div className="space-y-2">
                  {Object.entries(REG_STATUS_LABELS).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setRegistrationStatus(key)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        registrationStatus === key
                          ? info.color + ' border-2' : 'bg-background border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${registrationStatus === key ? 'border-current' : 'border-muted-foreground'}`}>
                        {registrationStatus === key && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </div>
                      <span className="flex-1 text-right">{info.label}</span>
                      {key === 'approved' && <Icon name="CheckBadgeIcon" size={14} className="shrink-0" />}
                      {key === 'rejected' && <Icon name="XCircleIcon" size={14} className="shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{ad.agentNotes}</label>
                <textarea
                  value={agentNotes}
                  onChange={e => setAgentNotes(e.target.value)}
                  rows={3}
                  placeholder={ad.agentNotesPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{ad.reviewNotes}</label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={2}
                  placeholder={ad.reviewNotesPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </>
          )}
        </div>

        {activeSection !== 'payout' && (
          <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              {ad.cancel}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {ad.saving}
                </>
              ) : (
                <>
                  <Icon name="CheckIcon" size={15} />
                  {ad.saveApprove}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentDashboardPage() {
  const { t, dir, language, setLanguage } = useLanguage();
  const ad = t.agentDashboard;

  const CONTACT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    contacting: { label: ad.contactContacting, color: CONTACT_STATUS_COLORS.contacting },
    awaiting_license_approval: { label: ad.contactAwaitingLicense, color: CONTACT_STATUS_COLORS.awaiting_license_approval },
    documents_submitted: { label: ad.contactDocsSubmitted, color: CONTACT_STATUS_COLORS.documents_submitted },
    approved: { label: ad.contactApproved, color: CONTACT_STATUS_COLORS.approved },
    rejected: { label: ad.contactRejected, color: CONTACT_STATUS_COLORS.rejected },
  };

  const REG_STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: ad.regPending, ...REG_STATUS_META.pending },
    under_review: { label: ad.regUnderReview, ...REG_STATUS_META.under_review },
    approved: { label: ad.regApproved, ...REG_STATUS_META.approved },
    rejected: { label: ad.regRejected, ...REG_STATUS_META.rejected },
  };

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langMenuOpen) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [langMenuOpen]);

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [coverageLabel, setCoverageLabel] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_my_territory');
      const row = Array.isArray(data) ? data[0] : data;
      if (!cancelled && row?.territory_city) {
        setCoverageLabel(formatCoverageLabel(row.territory_city, row.territory_district));
      }
    })();
    return () => { cancelled = true; };
  }, [user, supabase]);

  const [factories, setFactories] = useState<AgentFactory[]>([]);
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [referredStats, setReferredStats] = useState<{ total: number; approved: number }>({ total: 0, approved: 0 });
  const [previewProduct, setPreviewProduct] = useState<AgentProduct | null>(null);
  const [editProduct, setEditProduct] = useState<AgentProduct | null>(null);
  const [shareProduct, setShareProduct] = useState<AgentProduct | null>(null);
  const [loading, setLoading] = useState(true);

  type AgentTabId = 'factories' | 'products' | 'messaging' | 'documents' | 'exchange' | 'complaints' | 'sales' | 'admin_msg' | 'commission' | 'enhanced' | 'inspections' | 'earnings' | 'referral' | 'dispatch_rooms' | 'order_tracking';
  const VALID_TABS: AgentTabId[] = ['factories', 'products', 'messaging', 'documents', 'exchange', 'complaints', 'sales', 'admin_msg', 'commission', 'enhanced', 'inspections', 'earnings', 'referral', 'dispatch_rooms', 'order_tracking'];
  const TAB_URL_KEYS: Record<AgentTabId, string> = {
    factories: 'factories', products: 'products', messaging: 'messaging', documents: 'documents',
    exchange: 'exchange', complaints: 'complaints', sales: 'sales',
    admin_msg: 'admin-msg', commission: 'commission', enhanced: 'register', inspections: 'inspections',
    earnings: 'earnings', referral: 'referral', dispatch_rooms: 'dispatch', order_tracking: 'orders',
  };
  const [activeTab, setActiveTabState] = useState<AgentTabId | null>(null);
  const [deepLink, setDeepLink] = useState<{ recipientId: string; name: string } | null>(null);

  const readDeepLinkFromUrl = useCallback((): { recipientId: string; name: string } | null => {
    if (typeof window === 'undefined') return null;
    const sp = new URLSearchParams(window.location.search);
    const recipientId = sp.get('recipientId');
    if (!recipientId) return null;
    return { recipientId, name: sp.get('name') || '' };
  }, []);

  const readTabFromUrl = useCallback((): AgentTabId | null => {
    if (typeof window === 'undefined') return null;
    const key = new URLSearchParams(window.location.search).get('tab');
    if (!key) return null;
    const found = VALID_TABS.find(id => TAB_URL_KEYS[id] === key);
    return found ?? null;
  }, []);

  useEffect(() => {
    setActiveTabState(readTabFromUrl());
    setDeepLink(readDeepLinkFromUrl());
    const onPopState = () => {
      setActiveTabState(readTabFromUrl());
      setDeepLink(readDeepLinkFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [readTabFromUrl, readDeepLinkFromUrl]);

  const openTab = useCallback((id: AgentTabId) => {
    setActiveTabState(id);
    setDeepLink(null);
    router.push(`/agent/dashboard?tab=${TAB_URL_KEYS[id]}`, { scroll: false });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, [router]);

  const closeTab = useCallback(() => {
    setActiveTabState(null);
    router.push('/agent/dashboard', { scroll: false });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, [router]);

  const [reviewModal, setReviewModal] = useState<AgentFactory | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [activeStatCard, setActiveStatCard] = useState<'total' | 'approved' | 'pending' | 'products' | null>(null);
  const factoryListRef = useRef<HTMLDivElement | null>(null);
  const [agentUnreadCount, setAgentUnreadCount] = useState(0);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [dashboardChatLang] = useState<ChatLanguage>(
    () => CHAT_LANGUAGES.find(l => l.code === 'ar') || CHAT_LANGUAGES[0]
  );
  const [inspectionTasks, setInspectionTasks] = useState<InspectionTask[]>([]);
  const hasLoadedOnceRef = React.useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/agent/dashboard');
      return;
    }
    const platformRole = resolvePlatformRole({
      metadataRole:
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null,
    });
    if (platformRole !== 'agent' && platformRole !== 'admin') {
      router.replace(getHomeRoomForRole(platformRole));
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (!hasLoadedOnceRef.current) setLoading(true);
    try {
      const referralCodeForAgent = `AGT-${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const [factoriesRes, productsRes, referredRes] = await Promise.all([
        supabase
          .from('agent_factory_registrations')
          .select('*')
          .eq('agent_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('agent_products')
          .select('*')
          .eq('agent_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('factory_registrations')
          .select('id, registration_status, is_approved, is_active')
          .or(`referred_by_agent_id.eq.${user.id},referred_by_agent_code.eq.${referralCodeForAgent}`),
      ]);
      if (factoriesRes.data) setFactories(factoriesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
      if (referredRes.data) {
        setReferredStats({
          total: referredRes.data.length,
          approved: referredRes.data.filter(isApprovedOrActiveFacility).length,
        });
      }
    } catch (err) {
      console.error('Error fetching agent data:', err);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id, fetchData]);

  const handleReviewSave = async (
    factoryId: string,
    contactStatus: string,
    registrationStatus: string,
    agentNotes: string,
    adminNote: string
  ) => {
    try {
      const updatePayload: Record<string, unknown> = {
        contact_status: contactStatus,
        registration_status: registrationStatus,
        agent_notes: agentNotes,
        admin_note: adminNote,
        updated_at: new Date().toISOString(),
      };

      if (registrationStatus === 'approved' || registrationStatus === 'rejected') {
        updatePayload.license_reviewed_by = user?.id;
        updatePayload.license_reviewed_at = new Date().toISOString();
        if (registrationStatus === 'rejected' && adminNote) {
          updatePayload.license_rejection_reason = adminNote;
        }
      }

      const { error } = await supabase
        .from('agent_factory_registrations')
        .update(updatePayload)
        .eq('id', factoryId)
        .eq('agent_id', user?.id);

      if (error) throw error;

      const statusLabel = REG_STATUS_LABELS[registrationStatus]?.label || registrationStatus;
      setSuccessMsg(ad.saveSuccess.replace('{status}', statusLabel));
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ad.saveError;
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const agentName = user?.user_metadata?.full_name || ad.defaultAgentName;

  useEffect(() => {
    if (!user) return;
    const fetchAgentUnread = async () => {
      try {
        const { data: convData } = await supabase
          .from('agent_conversations')
          .select('id, unread_by_agent')
          .eq('agent_id', user.id);
        const total = (convData || []).reduce((sum: number, c: { unread_by_agent: number }) => sum + (c.unread_by_agent || 0), 0);
        setAgentUnreadCount(total);
      } catch {
        setAgentUnreadCount(0);
      }
    };
    fetchAgentUnread();

    const channel = supabase
      .channel(`agent-dashboard-unread-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_messages',
      }, (payload) => {
        const msg = payload.new as { agent_id: string; sender_role: string };
        if (msg.agent_id !== user.id || msg.sender_role !== 'agent') {
          setAgentUnreadCount(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_conversations',
        filter: `agent_id=eq.${user.id}`,
      }, () => fetchAgentUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    const fetchAdminUnread = async () => {
      try {
        const { count } = await supabase
          .from('agent_admin_messages')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .eq('sender_role', 'admin')
          .eq('is_read_by_agent', false);
        setAdminUnreadCount(count || 0);
      } catch {
        setAdminUnreadCount(0);
      }
    };
    fetchAdminUnread();

    const channel = supabase
      .channel(`agent-dashboard-admin-unread-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_admin_messages',
        filter: `agent_id=eq.${user.id}`,
      }, () => fetchAdminUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase]);

  const totalFactories = factories.length;
  const approvedFactories = factories.filter(f => f.registration_status === 'approved').length;
  const pendingReview = factories.filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review').length;
  const totalProducts = products.length;
  const statTotalFactories = totalFactories + referredStats.total;
  const statApprovedFactories = approvedFactories + referredStats.approved;

  const filteredFactories = filterStatus
    ? factories.filter(f => f.registration_status === filterStatus)
    : factories;

  const scrollToFactoryList = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      factoryListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const handleStatCardClick = useCallback((card: 'total' | 'approved' | 'pending' | 'products') => {
    setActiveStatCard(card);
    if (card === 'products') {
      setFilterStatus('');
      openTab('products');
      return;
    }
    setFilterStatus(card === 'approved' ? 'approved' : card === 'pending' ? 'pending' : '');
    openTab('factories');
    scrollToFactoryList();
  }, [openTab, scrollToFactoryList]);

  const resetStatFilter = useCallback(() => {
    setFilterStatus('');
    setActiveStatCard(null);
  }, []);

  // Multi-language text maps
  const roomTitle =
    language === 'zh' ? '实地代表控制室' :
    language === 'tr' ? 'Saha Temsilcisi Odası' :
    language === 'en' ? 'Field Representative Room' :
    'غرفة تحكم المندوب الميداني';

  const backToStoreText =
    language === 'zh' ? '返回商城' :
    language === 'tr' ? 'Mağazaya Dön' :
    language === 'en' ? 'Back to Store' :
    'العودة للمتجر';

  const bannerDesc =
    language === 'zh' ? '实地代表控制台 · 工厂入驻与现场验货核验' :
    language === 'tr' ? 'Saha Temsilcisi Paneli · Fabrika Kaydı ve Saha Doğrulaması' :
    language === 'en' ? 'Field Agent Dashboard · Factory Onboarding & Field Verification' :
    'Field Agent Dashboard · تسجيل المصانع والتحقق الميداني';

  const agentRoleBadge =
    language === 'zh' ? '🕵️ 实地代表' :
    language === 'tr' ? '🕵️ Saha Temsilcisi' :
    language === 'en' ? '🕵️ Field Agent' :
    '🕵️ مندوب ميداني';

  const coverageBadgeText =
    language === 'zh' ? `📍 覆盖区域: ${coverageLabel}` :
    language === 'tr' ? `📍 Kapsama Alanı: ${coverageLabel}` :
    language === 'en' ? `📍 Field Territory: ${coverageLabel}` :
    `📍 نطاق التغطية الميداني: ${coverageLabel}`;

  if ((authLoading || loading) && !hasLoadedOnceRef.current) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{ad.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b shadow-sm bg-slate-900/95 border-slate-800">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-3 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm tracking-tight text-white" translate="no">Direct Hub</span>
              <span className="text-[9px] font-medium hidden sm:block text-cyan-300">{roomTitle}</span>
            </div>
          </Link>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              title={backToStoreText}
            >
              <Icon name="BuildingStorefrontIcon" size={16} />
              <span className="hidden sm:inline">{backToStoreText}</span>
            </Link>

            <Link
              href="/chat"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="الدردشة والمحادثات"
            >
              <Icon name="ChatBubbleLeftRightIcon" size={18} />
            </Link>

            <Link
              href="/notifications"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
              title="الإشعارات"
            >
              <Icon name="BellIcon" size={18} />
            </Link>

            <div className="relative" ref={langMenuRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ${langMenuOpen ? 'ring-2 ring-primary/40' : ''}`}
                title="تغيير اللغة"
                aria-label="Language Selector"
              >
                <Icon name="GlobeAltIcon" size={19} />
              </button>

              {langMenuOpen && (
                <div className="absolute end-0 top-full mt-2 w-36 bg-card border border-border rounded-xl shadow-xl py-1.5 z-50">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setLanguage(lang.code as any);
                        setLangMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                        language === lang.code
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <Icon name="CheckIcon" size={14} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-r from-violet-700 to-violet-900 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <Icon name="UserCheckIcon" size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{roomTitle}</h2>
              <p className="text-violet-200 text-xs">{bannerDesc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              {agentRoleBadge}
            </span>
            <span className="bg-white/10 text-violet-200 text-xs px-3 py-1 rounded-full border border-white/20">
              ID: field-agent-dashboard
            </span>
            {coverageLabel && (
              <span className="bg-emerald-500/30 text-white text-xs px-3 py-1 rounded-full border border-emerald-300/50 font-bold">
                {coverageBadgeText}
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 mobile-safe-bottom">
        {activeTab === null && (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{ad.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">{ad.welcomeLine.replace('{name}', agentName)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/agent/register-facility"
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Icon name="PlusIcon" size={16} />
                  {ad.newRegistration}
                </Link>
              </div>
            </div>

            {successMsg && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
                <Icon name="CheckCircleIcon" size={16} />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                <Icon name="ExclamationCircleIcon" size={16} />
                {errorMsg}
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {([
                { id: 'total', label: ad.statTotal, value: statTotalFactories, icon: 'BuildingOffice2Icon', color: 'text-blue-600', bg: 'bg-blue-50', activeBorder: 'border-blue-400 ring-2 ring-blue-400/25' },
                { id: 'approved', label: ad.statApproved, value: statApprovedFactories, icon: 'CheckBadgeIcon', color: 'text-emerald-600', bg: 'bg-emerald-50', activeBorder: 'border-emerald-400 ring-2 ring-emerald-400/25' },
                { id: 'pending', label: ad.statPendingReview, value: pendingReview, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50', activeBorder: 'border-amber-400 ring-2 ring-amber-400/25' },
                { id: 'products', label: ad.statProducts, value: totalProducts, icon: 'CubeIcon', color: 'text-indigo-600', bg: 'bg-indigo-50', activeBorder: 'border-indigo-400 ring-2 ring-indigo-400/25' },
              ] as const).map(stat => {
                const isStatActive = activeStatCard === stat.id;
                return (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => handleStatCardClick(stat.id)}
                    aria-pressed={isStatActive}
                    className={`text-start cursor-pointer bg-white border rounded-2xl p-4 min-h-[88px] shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] ${
                      isStatActive ? `${stat.activeBorder} border-2` : 'border-slate-200'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                      <Icon name={stat.icon as any} size={18} className={stat.color} />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                  </button>
                );
              })}
            </div>

            {activeStatCard !== null && (
              <div className="-mt-3 mb-5 flex justify-end">
                <button
                  type="button"
                  onClick={resetStatFilter}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted active:scale-[0.98] transition-all"
                >
                  <Icon name="ArrowPathIcon" size={14} />
                  {language === 'zh' ? '重置筛选' : language === 'tr' ? 'Filtreyi Sıfırla' : language === 'en' ? 'Reset Filter' : 'عرض الكل / إعادة ضبط'}
                </button>
              </div>
            )}

            {/* Grouped Tabs */}
            <div className="space-y-5 mb-5">
              {([
                {
                  key: 'overview',
                  title: language === 'zh' ? '业绩看板' : language === 'tr' ? 'Performans Paneli' : language === 'en' ? 'Performance Board' : 'لوحة الأداء',
                  items: [
                    { id: 'sales', icon: 'ChartBarIcon', label: ad.tabSales, badge: 0, badgeColor: '', iconColor: 'bg-emerald-50 text-emerald-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'referral', icon: 'LinkIcon', label: language === 'zh' ? '推荐与跟踪' : language === 'tr' ? 'Yönlendirmeler' : language === 'en' ? 'Referrals & Tracking' : 'الإحالات والتتبع', badge: 0, badgeColor: '', iconColor: 'bg-indigo-50 text-indigo-600', cardTint: 'bg-white border-slate-200' },
                  ],
                },
                {
                  key: 'factories',
                  title: language === 'zh' ? '工厂与运营' : language === 'tr' ? 'Fabrikalar ve Operasyonlar' : language === 'en' ? 'Factories & Operations' : 'المصانع والعمليات',
                  items: [
                    { id: 'factories', icon: 'BuildingOffice2Icon', label: language === 'zh' ? '🏭 工厂网络与 KYC 实名' : language === 'tr' ? '🏭 Fabrika Ağı ve KYC' : language === 'en' ? '🏭 Factory Network & KYC' : '🏭 شبكة المصانع والتوثيق (KYC)', sub: language === 'zh' ? '管理工厂、新增工厂与实地审核' : language === 'tr' ? 'Fabrika yönetimi, yeni ekleme ve doğrulama' : language === 'en' ? 'Manage factories, add new, and field verification' : 'إدارة المصانع، إضافة مصنع جديد، وتوثيق السجلات الجغرافية', pills: `${statApprovedFactories} | ${pendingReview}`, badge: 0, badgeColor: '', iconColor: 'bg-blue-50 text-blue-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'order_tracking', icon: 'TruckIcon', label: language === 'zh' ? '📦 运营与实地验货' : language === 'tr' ? '📦 Operasyonlar ve Muayene' : language === 'en' ? '📦 Operations & Field Inspection' : '📦 العمليات والتفتيش الميداني', sub: language === 'zh' ? '跟踪生产线、运输与托盘检验' : language === 'tr' ? 'Üretim hatları, sevkiyat ve denetim' : language === 'en' ? 'Production lines, shipping, and pallet checks' : 'متابعة خطوط الإنتاج، طلبات الشحن، ومعاينة البليتات', pills: '', badge: inspectionTasks.length, badgeColor: 'bg-amber-500', iconColor: 'bg-amber-50 text-amber-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'products', icon: 'CubeIcon', label: language === 'zh' ? '🏷️ 产品目录' : language === 'tr' ? '🏷️ Ürün Kataloğu' : language === 'en' ? '🏷️ Products Catalog' : '🏷️ كتالوج المنتجات', sub: ad.tabProducts.replace('{count}', String(totalProducts)), pills: '', badge: 0, badgeColor: '', iconColor: 'bg-indigo-50 text-indigo-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'dispatch_rooms', icon: 'TruckIcon', label: language === 'zh' ? '🚚 现场调度室' : language === 'tr' ? '🚚 Saha Koordinasyonu' : language === 'en' ? '🚚 Field Dispatch Rooms' : '🚚 غرف التنسيق الميداني', badge: 0, badgeColor: '', iconColor: 'bg-blue-50 text-blue-600', cardTint: 'bg-white border-slate-200' },
                  ],
                },
                {
                  key: 'messaging',
                  title: language === 'zh' ? '消息沟通' : language === 'tr' ? 'Mesajlaşma' : language === 'en' ? 'Messaging' : 'المراسلات',
                  items: [
                    { id: 'messaging', icon: 'ChatBubbleLeftRightIcon', label: ad.tabMessaging, badge: agentUnreadCount, badgeColor: 'bg-red-500', iconColor: 'bg-emerald-50 text-emerald-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'admin_msg', icon: 'ShieldCheckIcon', label: ad.tabAdminMsg, badge: adminUnreadCount, badgeColor: 'bg-red-500', iconColor: 'bg-indigo-50 text-indigo-600', cardTint: 'bg-white border-slate-200' },
                  ],
                },
                {
                  key: 'accounts',
                  title: language === 'zh' ? '账户与佣金' : language === 'tr' ? 'Hesaplar ve Komisyonlar' : language === 'en' ? 'Accounts & Commissions' : 'الحسابات والعمولات',
                  items: [
                    { id: 'earnings', icon: 'BanknotesIcon', label: language === 'zh' ? '收益与佣金' : language === 'tr' ? 'Kazançlar ve Komisyon' : language === 'en' ? 'Earnings & Commissions' : 'الأرباح والعمولات', badge: 0, badgeColor: '', iconColor: 'bg-amber-50 text-amber-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'exchange', icon: 'ArrowsRightLeftIcon', label: ad.tabInfoExchange, badge: 0, badgeColor: '', iconColor: 'bg-blue-50 text-blue-600', cardTint: 'bg-white border-slate-200' },
                  ],
                },
                {
                  key: 'tools',
                  title: language === 'zh' ? '工具与申诉' : language === 'tr' ? 'Araçlar ve Şikayetler' : language === 'en' ? 'Tools & Complaints' : 'الأدوات والشكاوى',
                  items: [
                    { id: 'documents', icon: 'FolderOpenIcon', label: ad.tabDocuments, badge: 0, badgeColor: '', iconColor: 'bg-emerald-50 text-emerald-600', cardTint: 'bg-white border-slate-200' },
                    { id: 'complaints', icon: 'ExclamationTriangleIcon', label: ad.tabComplaints, badge: 0, badgeColor: '', iconColor: 'bg-amber-50 text-amber-600', cardTint: 'bg-white border-slate-200' },
                  ],
                },
              ]).map(section => (
                <div key={section.key}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">{section.title}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {section.items.map((item: any) => {
                      const isActive = activeTab === item.id || (item.id === 'factories' && activeTab === 'enhanced') || (item.id === 'order_tracking' && activeTab === 'inspections');
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openTab(item.id as AgentTabId)}
                          aria-pressed={isActive}
                          className={`relative flex flex-col items-center justify-center p-3 min-h-[96px] rounded-2xl border text-center shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] ${
                            isActive
                              ? 'bg-white border-[#D4AF37] border-2 ring-2 ring-[#D4AF37]/25'
                              : `${item.cardTint || 'bg-white border-slate-200'}`
                          }`}
                        >
                          <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 ${item.iconColor}`}>
                            <Icon name={item.icon as any} size={22} />
                          </span>
                          <span className="leading-tight text-sm text-slate-900 font-semibold">{item.label}</span>
                          {item.sub && (
                            <span className="mt-1 text-xs leading-snug text-slate-500">{item.sub}</span>
                          )}
                          {item.pills && (
                            <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-xs font-medium">
                              {item.pills}
                            </span>
                          )}
                          {item.badge > 0 && (
                            <span className={`absolute top-2 end-2 min-w-[18px] h-[18px] ${item.badgeColor} text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1`}>
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab !== null && (() => {
          const TAB_META: Record<AgentTabId, { icon: string; title: string; iconColor: string }> = {
            sales: { icon: 'ChartBarIcon', title: ad.tabSales, iconColor: 'bg-emerald-50 text-emerald-600' },
            earnings: { icon: 'BanknotesIcon', title: language === 'zh' ? '收益与佣金' : language === 'tr' ? 'Kazançlar ve Komisyon' : language === 'en' ? 'Earnings & Commissions' : 'الأرباح والعمولات', iconColor: 'bg-amber-50 text-amber-600' },
            factories: { icon: 'BuildingOffice2Icon', title: language === 'zh' ? '🏭 工厂网络与 KYC' : language === 'tr' ? '🏭 Fabrika Ağı ve KYC' : language === 'en' ? '🏭 Factory Network & KYC' : '🏭 شبكة المصانع والتوثيق (KYC)', iconColor: 'bg-blue-50 text-blue-600' },
            products: { icon: 'CubeIcon', title: language === 'zh' ? '🏷️ 产品目录' : language === 'tr' ? '🏷️ Ürün Kataloğu' : language === 'en' ? '🏷️ Products Catalog' : '🏷️ كتالوج المنتجات', iconColor: 'bg-purple-50 text-purple-600' },
            inspections: { icon: 'ClipboardDocumentListIcon', title: language === 'zh' ? '📦 运营与实地验货' : language === 'tr' ? '📦 Operasyonlar ve Muayene' : language === 'en' ? '📦 Operations & Field Inspection' : '📦 العمليات والتفتيش الميداني', iconColor: 'bg-orange-50 text-orange-600' },
            enhanced: { icon: 'BriefcaseIcon', title: language === 'zh' ? '🏭 工厂网络与 KYC' : language === 'tr' ? '🏭 Fabrika Ağı ve KYC' : language === 'en' ? '🏭 Factory Network & KYC' : '🏭 شبكة المصانع والتوثيق (KYC)', iconColor: 'bg-indigo-50 text-indigo-600' },
            messaging: { icon: 'ChatBubbleLeftRightIcon', title: ad.tabMessaging, iconColor: 'bg-teal-50 text-teal-600' },
            admin_msg: { icon: 'ShieldCheckIcon', title: ad.tabAdminMsg, iconColor: 'bg-rose-50 text-rose-600' },
            complaints: { icon: 'ExclamationTriangleIcon', title: ad.tabComplaints, iconColor: 'bg-red-50 text-red-600' },
            dispatch_rooms: { icon: 'TruckIcon', title: language === 'zh' ? '现场调度室' : language === 'tr' ? 'Saha Koordinasyonu' : language === 'en' ? 'Field Dispatch Rooms' : 'غرف التنسيق الميداني', iconColor: 'bg-sky-50 text-sky-600' },
            order_tracking: { icon: 'TruckIcon', title: language === 'zh' ? '📦 运营与实地验货' : language === 'tr' ? '📦 Operasyonlar ve Muayene' : language === 'en' ? '📦 Operations & Field Inspection' : '📦 العمليات والتفتيش الميداني', iconColor: 'bg-purple-50 text-purple-600' },
            commission: { icon: 'BanknotesIcon', title: language === 'zh' ? '收益与佣金' : language === 'tr' ? 'Kazançlar ve Komisyon' : language === 'en' ? 'Earnings & Commissions' : 'الأرباح والعمولات', iconColor: 'bg-amber-50 text-amber-600' },
            exchange: { icon: 'ArrowsRightLeftIcon', title: ad.tabInfoExchange, iconColor: 'bg-fuchsia-50 text-fuchsia-600' },
            documents: { icon: 'FolderOpenIcon', title: ad.tabDocuments, iconColor: 'bg-cyan-50 text-cyan-600' },
            referral: { icon: 'LinkIcon', title: language === 'zh' ? '推荐与跟踪' : language === 'tr' ? 'Yönlendirmeler' : language === 'en' ? 'Referrals & Tracking' : 'الإحالات والتتبع', iconColor: 'bg-violet-50 text-violet-600' },
          };
          const meta = TAB_META[activeTab];
          return (
            <div className="sticky top-14 z-30 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur border-b border-border flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={closeTab}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs sm:text-sm font-semibold hover:shadow-sm active:scale-[0.98] transition-all shrink-0"
              >
                <Icon name={dir === 'rtl' ? 'ArrowRightIcon' : 'ArrowLeftIcon'} size={16} />
                <span className="hidden sm:inline">{language === 'zh' ? '返回控制面板' : language === 'tr' ? 'Panele Dön' : language === 'en' ? 'Back to Dashboard' : 'العودة للوحة التحكم'}</span>
                <span className="sm:hidden">{language === 'zh' ? '返回' : language === 'tr' ? 'Geri' : language === 'en' ? 'Back' : 'رجوع'}</span>
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconColor}`}>
                  <Icon name={meta.icon as any} size={18} />
                </span>
                <h2 className="text-sm font-bold text-slate-800 leading-snug break-words min-w-0">{meta.title}</h2>
              </div>
            </div>
          );
        })()}

        {activeTab === 'referral' && user && (
          <ReferralTrackingPanel userId={user.id} />
        )}

        {activeTab === 'messaging' && user && (
          <UnifiedMessagingEngine
            userId={user.id}
            mode="agent_factory"
            title="صندوق رسائل المصانع والموردين"
            subtitle="تواصل مع المصانع والموردين المسجلين"
            showFilters={true}
            height={640}
            chatLanguage={dashboardChatLang}
            openContactId={deepLink?.recipientId}
            openContactName={deepLink?.name}
            contacts={factories.map(f => ({
              id: f.id,
              name: f.company_name,
              type: (f.factory_type === 'local_supplier' ? 'supplier' : 'factory') as any,
              subtype: f.factory_type,
              country: f.country,
              city: f.city,
            }))}
          />
        )}

        {activeTab === 'documents' && user && (
          <DocumentUploadPanel
            userId={user.id}
            factories={factories.map(f => ({
              id: f.id,
              company_name: f.company_name,
              factory_type: f.factory_type,
              city: f.city,
              contact_person: f.contact_person,
              contact_phone: f.contact_phone,
              registration_status: f.registration_status,
            }))}
          />
        )}

        {activeTab === 'exchange' && user && (
          <InfoExchangePanel
            userId={user.id}
            factories={factories.map(f => ({
              id: f.id,
              company_name: f.company_name,
              factory_type: f.factory_type,
            }))}
          />
        )}

        {activeTab === 'complaints' && user && (
          <AgentComplaintsPanel
            userId={user.id}
            factories={factories.map(f => ({
              id: f.id,
              company_name: f.company_name,
              factory_type: f.factory_type,
            }))}
          />
        )}

        {activeTab === 'sales' && user && (
          <AgentSalesDashboard
            userId={user.id}
            factories={factories.map(f => ({
              id: f.id,
              company_name: f.company_name,
              registration_status: f.registration_status,
            }))}
          />
        )}

        {activeTab === 'admin_msg' && user && (
          <UnifiedMessagingEngine
            userId={user.id}
            mode="agent_admin"
            title="المراسلة مع الإدارة"
            subtitle="قناة التواصل الرسمية مع إدارة المنصة"
            showFilters={false}
            height={640}
            chatLanguage={dashboardChatLang}
          />
        )}

        {(activeTab === 'earnings' || activeTab === 'commission') && user && (
          <AgentUnifiedEarningsCard userId={user.id} />
        )}

        {(activeTab === 'order_tracking' || activeTab === 'inspections') && user && (
          <AgentOperationsHub
            userId={user.id}
            initialTab={activeTab === 'inspections' ? 'inspection' : 'preparation'}
          />
        )}

        {(activeTab === 'factories' || activeTab === 'enhanced') && (
          <div
            className="flex gap-1.5 p-1 mb-4 bg-muted rounded-xl"
            role="tablist"
            aria-label="المصانع والتوثيق"
          >
            {([
              { id: 'factories', label: language === 'zh' ? '🏭 工厂与供应商' : language === 'tr' ? '🏭 Fabrikalar ve Tedarikçiler' : language === 'en' ? '🏭 Factories & Suppliers' : '🏭 المصانع والموردون' },
              { id: 'enhanced', label: language === 'zh' ? '🛡️ KYC 实名认证' : language === 'tr' ? '🛡️ KYC Doğrulama' : language === 'en' ? '🛡️ KYC Verification' : '🛡️ التوثيق (KYC)' },
            ] as const).map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => { if (activeTab !== t.id) openTab(t.id); }}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === t.id
                    ? 'bg-card text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'enhanced' && user && (
          <EnhancedAgentDashboard userId={user.id} />
        )}

        {activeTab === 'dispatch_rooms' && user && (
          <AgentDispatchRoomsTab userId={user.id} />
        )}

        {activeTab === 'factories' && (
          <>
            <div ref={factoryListRef} className="scroll-mt-20" />
            {factories.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1 items-center">
                {[
                  { value: '', label: ad.filterAll },
                  { value: 'pending', label: ad.filterPending },
                  { value: 'under_review', label: ad.filterUnderReview },
                  { value: 'approved', label: ad.filterApproved },
                  { value: 'rejected', label: ad.filterRejected },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => {
                      setFilterStatus(f.value);
                      setActiveStatCard(f.value === 'approved' ? 'approved' : f.value === 'pending' ? 'pending' : null);
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      filterStatus === f.value
                        ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f.label}
                    {f.value && (
                      <span className="mr-1">
                        ({factories.filter(fac => fac.registration_status === f.value).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {filteredFactories.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-10 text-center">
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Icon name="BuildingOffice2Icon" size={26} className="text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground mb-1">
                    {filterStatus ? ad.emptyFiltered : ad.emptyNone}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {filterStatus ? ad.emptyFilteredHint : ad.emptyNoneHint}
                  </p>
                  {!filterStatus && (
                    <Link
                      href="/agent/register-facility"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Icon name="PlusIcon" size={15} />
                      {ad.newRegistration}
                    </Link>
                  )}
                </div>
              ) : (
                filteredFactories.map(factory => {
                  const contactStatus = CONTACT_STATUS_LABELS[factory.contact_status] || { label: factory.contact_status, color: 'bg-gray-50 text-gray-700 border-gray-200' };
                  const regStatus = REG_STATUS_LABELS[factory.registration_status] || { label: factory.registration_status, color: 'bg-gray-50 text-gray-700 border-gray-200' };
                  const factoryProducts = products.filter(p => p.factory_id === factory.id);
                  return (
                    <div key={factory.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-foreground text-base">{factory.company_name}</h3>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              {(FACTORY_TYPE_KEYS[factory.factory_type] ? ad[FACTORY_TYPE_KEYS[factory.factory_type]] : factory.factory_type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${contactStatus.color}`}>
                              {contactStatus.label}
                            </span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${regStatus.color}`}>
                              {regStatus.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{formatCityAddress([factory.city, factory.country])} · {factory.industry || ad.unspecified}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {factory.contact_person} · <span dir="ltr" className="font-mono">{maskPhone(factory.contact_phone)}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Icon name="CubeIcon" size={12} />
                              {ad.productCount.replace('{count}', String(factoryProducts.length))}
                            </span>
                          </div>
                        </div>

                        {/* Quick Action Buttons for Growth Hacking */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            onClick={() => setReviewModal(factory)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                          >
                            <Icon name="ClipboardDocumentCheckIcon" size={13} />
                            {ad.reviewApprove}
                          </button>
                          
                          {factory.registration_status === 'approved' && (
                            <Link
                              href={`/agent/messages?recipientId=${encodeURIComponent(factory.id)}&name=${encodeURIComponent(factory.company_name || '')}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                              style={{ backgroundColor: '#1E1E1E', color: '#D4AF37', border: '1px solid #D4AF37' }}
                            >
                              <span aria-hidden="true">💬</span>
                              {language === 'zh' ? '直接沟通协调' : language === 'tr' ? 'Koordinasyon' : language === 'en' ? 'Direct Chat' : 'التنسيق المباشر'}
                            </Link>
                          )}

                          {/* رفع المنتجات المباشر بواسطة المندوب */}
                          <Link
                            href={`/agent/add-product?factoryId=${factory.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors"
                          >
                            <Icon name="PlusIcon" size={13} />
                            {ad.addProduct}
                          </Link>

                          {/* رفع التراخيص المتاح لاحقاً */}
                          <Link
                            href={`/agent/upload-license?factoryId=${factory.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
                          >
                            <Icon name="ArrowUpTrayIcon" size={13} />
                            {ad.uploadLicense}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === 'products' && (
          <div className="space-y-3">
            {products.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Icon name="CubeIcon" size={26} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground mb-1">{ad.noProductsYet}</p>
                <p className="text-sm text-muted-foreground mb-4">{ad.emptyNoneHint}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {products.map(product => {
                  const factory = factories.find(f => f.id === product.factory_id);
                  return (
                    <div key={product.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center relative">
                          {product.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.images[0]} alt={product.name_ar} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="PhotoIcon" size={22} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm">{product.name_ar}</p>
                          {product.name_en && <p className="text-xs text-muted-foreground">{product.name_en}</p>}
                          {factory && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Icon name="BuildingOffice2Icon" size={11} />
                              {factory.company_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t.agentAddProduct.price}</p>
                          <p className="text-sm font-bold text-foreground">{product.price} {product.currency}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t.agentAddProduct.moq}</p>
                          <p className="text-sm font-bold text-foreground">{product.moq} {product.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <button
                          type="button"
                          onClick={() => setPreviewProduct(product)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                        >
                          <Icon name="EyeIcon" size={14} />
                          {t.agentProductActions.previewInStore}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditProduct(product)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          <Icon name="PencilSquareIcon" size={14} />
                          {t.agentProductActions.edit}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {previewProduct && (
        <AgentProductPreviewModal
          product={previewProduct}
          factoryName={factories.find(f => f.id === previewProduct.factory_id)?.company_name}
          onClose={() => setPreviewProduct(null)}
          onEdit={() => { setEditProduct(previewProduct); setPreviewProduct(null); }}
          onShare={() => setShareProduct(previewProduct)}
        />
      )}

      {shareProduct && (
        <AgentProductShareModal
          product={shareProduct}
          factoryName={factories.find(f => f.id === shareProduct.factory_id)?.company_name}
          onClose={() => setShareProduct(null)}
        />
      )}

      {editProduct && (
        <AgentProductEditDrawer
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onSaved={(updated) => {
            setProducts(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)));
            setEditProduct(null);
          }}
        />
      )}

      {reviewModal && user && (
        <ReviewModal
          factory={reviewModal}
          userId={user.id}
          onClose={() => setReviewModal(null)}
          onSave={handleReviewSave}
        />
      )}

      <BottomNav />
    </div>
  );
}
