'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import UnifiedMessagingEngine from '@/components/UnifiedMessagingEngine';
import DocumentUploadPanel from './DocumentUploadPanel';
import InfoExchangePanel from './InfoExchangePanel';
import ReceivingAccountPanel from './ReceivingAccountPanel';
import AgentComplaintsPanel from './AgentComplaintsPanel';
import AgentSalesDashboard from './AgentSalesDashboard';
import AgentCommissionAccountPanel from './AgentCommissionAccountPanel';
import AgentEarningsPanel from './AgentEarningsPanel';
import AgentDispatchRoomsTab from './AgentDispatchRoomsTab';
import EnhancedAgentDashboard from '@/components/agent/EnhancedAgentDashboard';
import ReferralTrackingPanel from './ReferralTrackingPanel';
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

// ─── Inspection Task Types ────────────────────────────────────────────────────

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

// ─── Full Review Modal ────────────────────────────────────────────────────────

function ReviewModal({
  factory,
  onClose,
  onSave,
}: {
  factory: AgentFactory;
  onClose: () => void;
  onSave: (
    factoryId: string,
    contactStatus: string,
    registrationStatus: string,
    agentNotes: string,
    adminNote: string
  ) => Promise<void>;
}) {
  const { t } = useLanguage();
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
  const [activeSection, setActiveSection] = useState<'details' | 'status'>('details');

  const handleSave = async () => {
    setSaving(true);
    await onSave(factory.id, contactStatus, registrationStatus, agentNotes, adminNote);
    setSaving(false);
    onClose();
  };

  const regInfo = REG_STATUS_LABELS[registrationStatus] || REG_STATUS_LABELS.pending;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="BuildingOffice2Icon" size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{factory.company_name}</h3>
              <p className="text-xs text-muted-foreground">
                {(FACTORY_TYPE_KEYS[factory.factory_type] ? ad[FACTORY_TYPE_KEYS[factory.factory_type]] : factory.factory_type)} · {factory.city}, {factory.country}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
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
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {activeSection === 'details' ? (
            <>
              {/* Registration Info */}
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
                    <p className="text-sm font-semibold text-foreground">{factory.city}{factory.region ? `${factory.region ? ', ' + factory.region : ''}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{ad.country}</p>
                    <p className="text-sm font-semibold text-foreground">{factory.country}</p>
                  </div>
                  {factory.employee_count && (
                    <div>
                      <p className="text-xs text-muted-foreground">{ad.employees}</p>
                      <p className="text-sm font-semibold text-foreground">{factory.employee_count}</p>
                    </div>
                  )}
                  {factory.annual_capacity && (
                    <div>
                      <p className="text-xs text-muted-foreground">{ad.capacity}</p>
                      <p className="text-sm font-semibold text-foreground">{factory.annual_capacity}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{ad.contactData}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon name="UserIcon" size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{factory.contact_person}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="PhoneIcon" size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground" dir="ltr">{factory.contact_phone}</span>
                  </div>
                  {factory.contact_email && (
                    <div className="flex items-center gap-2">
                      <Icon name="EnvelopeIcon" size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground">{factory.contact_email}</span>
                    </div>
                  )}
                  {factory.website && (
                    <div className="flex items-center gap-2">
                      <Icon name="GlobeAltIcon" size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground">{factory.website}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
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
                {factory.license_submitted_at && (
                  <p className="text-xs text-muted-foreground">
                    {ad.uploadDate.replace('{date}', new Date(factory.license_submitted_at).toLocaleDateString(language === 'ar' ? 'ar' : language))}
                  </p>
                )}
                {factory.license_reviewed_at && (
                  <p className="text-xs text-muted-foreground">
                    {ad.reviewDate.replace('{date}', new Date(factory.license_reviewed_at).toLocaleDateString(language === 'ar' ? 'ar' : language))}
                  </p>
                )}
                {factory.license_rejection_reason && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    {ad.rejectReason.replace('{reason}', factory.license_rejection_reason)}
                  </p>
                )}
              </div>

              {/* Existing Notes */}
              {factory.agent_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">{ad.prevAgentNotes}</p>
                  <p className="text-sm text-blue-800 italic">"{factory.agent_notes}"</p>
                </div>
              )}
              {factory.admin_note && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-purple-700 mb-1">{ad.prevReviewNotes}</p>
                  <p className="text-sm text-purple-800 italic">"{factory.admin_note}"</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Current Status Summary */}
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${CONTACT_STATUS_LABELS[factory.contact_status]?.color || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {ad.contactStatus.replace('{status}', CONTACT_STATUS_LABELS[factory.contact_status]?.label || factory.contact_status)}
                </span>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${REG_STATUS_LABELS[factory.registration_status]?.color || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {ad.regStatus.replace('{status}', REG_STATUS_LABELS[factory.registration_status]?.label || factory.registration_status)}
                </span>
              </div>

              {/* Contact Status */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">{ad.contactStatusLabel}</label>
                <div className="space-y-2">
                  {Object.entries(CONTACT_STATUS_LABELS).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setContactStatus(key)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        contactStatus === key
                          ? info.color + 'border-2' :'bg-background border-border text-muted-foreground hover:bg-muted'
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

              {/* Registration Status (Approval) */}
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
                          ? info.color + 'border-2' :'bg-background border-border text-muted-foreground hover:bg-muted'
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

              {/* Agent Notes */}
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

              {/* Review / Admin Note */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  {ad.reviewNotes}
                  <span className="text-xs font-normal text-muted-foreground mr-2">{ad.reviewNotesHint}</span>
                </label>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder={ad.reviewNotesPlaceholder}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Quick Approve / Reject Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setRegistrationStatus('approved');
                    setContactStatus('approved');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Icon name="CheckBadgeIcon" size={15} />
                  {ad.quickApprove}
                </button>
                <button
                  onClick={() => {
                    setRegistrationStatus('rejected');
                    setContactStatus('rejected');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  <Icon name="XCircleIcon" size={15} />
                  {ad.reject}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
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
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentDashboardPage() {
  const { t, dir, language } = useLanguage();
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

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [factories, setFactories] = useState<AgentFactory[]>([]);
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'factories' | 'products' | 'messaging' | 'documents' | 'exchange' | 'accounts' | 'complaints' | 'sales' | 'admin_msg' | 'commission' | 'enhanced' | 'inspections' | 'earnings' | 'referral' | 'dispatch_rooms'>('factories');
  const [reviewModal, setReviewModal] = useState<AgentFactory | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [agentUnreadCount, setAgentUnreadCount] = useState(0);
  const [dashboardChatLang] = useState<ChatLanguage>(
    () => CHAT_LANGUAGES.find(l => l.code === 'ar') || CHAT_LANGUAGES[0]
  );
  const [inspectionTasks, setInspectionTasks] = useState<InspectionTask[]>([]);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [greenLightLoading, setGreenLightLoading] = useState<string | null>(null);
  const [greenLightNote, setGreenLightNote] = useState<Record<string, string>>({});
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<{ taskId: string; currentStage: number } | null>(null);
  const [milestoneNote, setMilestoneNote] = useState('');
  const [milestoneUpdating, setMilestoneUpdating] = useState(false);
  const hasLoadedOnceRef = React.useRef(false);

  // Auth guard — wrong roles redirect to their room (never 403)
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
      const [factoriesRes, productsRes] = await Promise.all([
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
      ]);
      if (factoriesRes.data) setFactories(factoriesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (err) {
      console.error('Error fetching agent data:', err);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id, fetchData]);

  // Full review save: updates contact_status, registration_status, agent_notes, admin_note
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

      // If approving, record reviewer info and timestamp
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

  // Fetch agent unread message count and subscribe to realtime updates
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

  const fetchInspectionTasks = useCallback(async () => {
    if (!user) return;
    setInspectionLoading(true);
    try {
      // Fetch orders that are in inspection-relevant escrow statuses
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, escrow_status, total, currency, items,
          created_at, delivery_deadline, factory_user_id,
          agent_factory_registrations!orders_factory_id_fkey (
            id, company_name, city, country, address, contact_person, contact_phone, industry
          )
        `)
        .in('escrow_status', ['funds_secured', 'ready_for_inspection', 'shipped', 'pending_admin_payout'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (ordersData && ordersData.length > 0) {
        const tasks: InspectionTask[] = ordersData.map((order: any) => {
          const factory = order.agent_factory_registrations;
          // Try to match factory from agent's registered factories
          const agentFactory = factories.find(f => f.id === factory?.id);
          const factoryName = agentFactory?.company_name || factory?.company_name || 'مصنع غير محدد';
          const itemsArr = Array.isArray(order.items) ? order.items : [];
          const itemsSummary = itemsArr.slice(0, 2).map((it: any) => it.name_ar || it.name_en || it.product_name || '').filter(Boolean).join('، ') || 'منتجات متعددة';
          return {
            id: order.id,
            order_id: order.id,
            order_number: order.order_number || order.id.slice(0, 8).toUpperCase(),
            factory_id: factory?.id || null,
            factory_name: factoryName,
            factory_city: agentFactory?.city || factory?.city || '—',
            factory_country: agentFactory?.country || factory?.country || '—',
            factory_address: agentFactory?.address || factory?.address || '—',
            factory_contact_person: agentFactory?.contact_person || factory?.contact_person || '—',
            factory_contact_phone: agentFactory?.contact_phone || factory?.contact_phone || '—',
            factory_industry: agentFactory?.industry || factory?.industry || '—',
            escrow_status: order.escrow_status,
            order_total: order.total || 0,
            currency: order.currency || 'USD',
            created_at: order.created_at,
            delivery_deadline: order.delivery_deadline || null,
            items_summary: itemsSummary,
          };
        });
        setInspectionTasks(tasks);
      } else {
        // Fallback: build mock inspection tasks from agent's approved factories
        const approvedFactoriesForInspection = factories.filter(f => f.registration_status === 'approved');
        const mockTasks: InspectionTask[] = approvedFactoriesForInspection.slice(0, 5).map((f, idx) => ({
          id: `mock-${f.id}`,
          order_id: `mock-${f.id}`,
          order_number: `ORD-${f.id.slice(0, 6).toUpperCase()}`,
          factory_id: f.id,
          factory_name: f.company_name,
          factory_city: f.city,
          factory_country: f.country,
          factory_address: f.address || '—',
          factory_contact_person: f.contact_person,
          factory_contact_phone: f.contact_phone,
          factory_industry: f.industry || '—',
          escrow_status: idx % 2 === 0 ? 'ready_for_inspection' : 'funds_secured',
          order_total: 0,
          currency: 'USD',
          created_at: f.created_at,
          delivery_deadline: null,
          items_summary: 'في انتظار التفتيش الميداني',
        }));
        setInspectionTasks(mockTasks);
      }
    } catch (err) {
      console.error('Error fetching inspection tasks:', err);
      setInspectionTasks([]);
    } finally {
      setInspectionLoading(false);
    }
  }, [user, supabase, factories]);

  useEffect(() => {
    if (activeTab === 'inspections' && user) {
      fetchInspectionTasks();
    }
  }, [activeTab, user, fetchInspectionTasks]);

  const handleGreenLight = async (task: InspectionTask) => {
    if (task.id.startsWith('mock-')) {
      setSuccessMsg('✅ تم إرسال الإشارة الخضراء (وضع المحاكاة) — سيتم تفعيل الإجراء الفعلي عند ربط الطلب بنظام الضمان.');
      setTimeout(() => setSuccessMsg(''), 5000);
      return;
    }
    setGreenLightLoading(task.id);
    try {
      const res = await fetch('/api/escrow/green-light', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: task.order_id,
          release_note: greenLightNote[task.id] || `تم التحقق الميداني من قِبل المندوب — الضوء الأخضر للطلب ${task.order_number}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إرسال الإشارة الخضراء');
      setSuccessMsg(`🟢 ${data.message || 'تم إعطاء الضوء الأخضر بنجاح'}`);
      setTimeout(() => setSuccessMsg(''), 5000);
      fetchInspectionTasks();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إرسال الإشارة الخضراء');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setGreenLightLoading(null);
    }
  };

  const ESCROW_STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
    funds_secured: { label: 'الأموال محجوزة', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'LockClosedIcon' },
    ready_for_inspection: { label: 'جاهز للتفتيش', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'MagnifyingGlassIcon' },
    shipped: { label: 'تم الشحن', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'TruckIcon' },
    pending_admin_payout: { label: 'في انتظار الصرف', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'ClockIcon' },
  };

  // Stats
  const totalFactories = factories.length;
  const approvedFactories = factories.filter(f => f.registration_status === 'approved').length;
  const pendingReview = factories.filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review').length;
  const totalProducts = products.length;

  // Filtered factories
  const filteredFactories = filterStatus
    ? factories.filter(f => f.registration_status === filterStatus)
    : factories;

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
      <Header />
      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-r from-violet-700 to-violet-900 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <Icon name="UserCheckIcon" size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">لوحة تحكم المندوب الميداني</h2>
              <p className="text-violet-200 text-xs">Field Agent Dashboard · تسجيل المصانع والتحقق الميداني</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              🕵️ مندوب ميداني
            </span>
            <span className="bg-white/10 text-violet-200 text-xs px-3 py-1 rounded-full border border-white/20">
              ID: field-agent-dashboard
            </span>
          </div>
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-4 py-6 mobile-safe-bottom">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{ad.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{ad.welcomeLine.replace('{name}', agentName)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/agent/register-factory"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="PlusIcon" size={16} />
              {ad.newRegistration}
            </Link>
          </div>
        </div>

        {/* Alerts */}
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
          {[
            { label: ad.statTotal, value: totalFactories, icon: 'BuildingOffice2Icon', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: ad.statApproved, value: approvedFactories, icon: 'CheckBadgeIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: ad.statPendingReview, value: pendingReview, icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: ad.statProducts, value: totalProducts, icon: 'CubeIcon', color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <Icon name={stat.icon as any} size={18} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs — 5 Grouped Sections as Grid Cards */}
        <div className="space-y-5 mb-5">
          {([
            {
              key: 'overview',
              title: 'نظرة عامة',
              items: [
                { id: 'sales', icon: 'ChartBarIcon', label: ad.tabSales, badge: 0, badgeColor: '', iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
                { id: 'earnings', icon: 'BanknotesIcon', label: 'الأرباح والعمولات', badge: 0, badgeColor: '', iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
              ],
            },
            {
              key: 'factories',
              title: 'المصانع والتحقق',
              items: [
                { id: 'factories', icon: 'BuildingOffice2Icon', label: ad.tabFactories.replace('{count}', String(totalFactories)), badge: 0, badgeColor: '', iconColor: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
                { id: 'products', icon: 'CubeIcon', label: ad.tabProducts.replace('{count}', String(totalProducts)), badge: 0, badgeColor: '', iconColor: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' },
                { id: 'inspections', icon: 'ClipboardDocumentListIcon', label: 'مهام التفتيش', badge: inspectionTasks.length, badgeColor: 'bg-amber-500', iconColor: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400' },
                { id: 'enhanced', icon: 'BriefcaseIcon', label: 'التسجيل والتحقق', badge: 0, badgeColor: '', iconColor: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' },
              ],
            },
            {
              key: 'messaging',
              title: 'المراسلات',
              items: [
                { id: 'messaging', icon: 'ChatBubbleLeftRightIcon', label: ad.tabMessaging, badge: agentUnreadCount, badgeColor: 'bg-red-500', iconColor: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400' },
                { id: 'admin_msg', icon: 'ShieldCheckIcon', label: ad.tabAdminMsg, badge: 0, badgeColor: '', iconColor: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
                { id: 'complaints', icon: 'ExclamationTriangleIcon', label: ad.tabComplaints, badge: 0, badgeColor: '', iconColor: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' },
                { id: 'dispatch_rooms', icon: 'TruckIcon', label: 'غرف التنسيق الميداني', badge: 0, badgeColor: '', iconColor: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' },
              ],
            },
            {
              key: 'accounts',
              title: 'الحسابات والعمولات',
              items: [
                { id: 'commission', icon: 'CurrencyDollarIcon', label: 'حساب العمولة', badge: 0, badgeColor: '', iconColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
                { id: 'accounts', icon: 'BanknotesIcon', label: ad.tabReceivingAccounts, badge: 0, badgeColor: '', iconColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
                { id: 'exchange', icon: 'ArrowsRightLeftIcon', label: ad.tabInfoExchange, badge: 0, badgeColor: '', iconColor: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-400' },
              ],
            },
            {
              key: 'tools',
              title: 'الأدوات',
              items: [
                { id: 'documents', icon: 'FolderOpenIcon', label: ad.tabDocuments, badge: 0, badgeColor: '', iconColor: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400' },
                { id: 'referral', icon: 'LinkIcon', label: 'الإحالات والتتبع', badge: 0, badgeColor: '', iconColor: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
              ],
            },
          ]).map(section => (
            <div key={section.key}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">{section.title}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {section.items.map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id as typeof activeTab)}
                      aria-pressed={isActive}
                      className={`relative flex flex-col items-center justify-center p-3 min-h-[96px] rounded-xl border text-center transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-[#D4AF37]/10 border-[#D4AF37] border-2 ring-2 ring-[#D4AF37]/25 shadow-md'
                          : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-[#D4AF37]/50'
                      }`}
                    >
                      <span className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 ${item.iconColor}`}>
                        <Icon name={item.icon as any} size={22} />
                      </span>
                      <span className="leading-tight text-slate-800 dark:text-zinc-100 font-semibold text-sm">{item.label}</span>
                      {item.badge > 0 && (
                        <span className={`absolute top-2 end-2 min-w-[18px] h-[18px] ${item.badgeColor} text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1`}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute top-2 start-2 w-2 h-2 rounded-full bg-[#D4AF37]" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Inspection Tasks Tab — Milestone Tracking */}
        {activeTab === 'inspections' && (
          <div className="space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Icon name="ClipboardDocumentListIcon" size={18} className="text-amber-600" />
                  تتبع مراحل التنفيذ والتفتيش
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  الطلبات التي تتطلب زيارة ميدانية وإعطاء الضوء الأخضر لتحرير الأموال
                </p>
              </div>
              <button
                onClick={fetchInspectionTasks}
                disabled={inspectionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                <Icon name="ArrowPathIcon" size={13} className={inspectionLoading ? 'animate-spin' : ''} />
                تحديث
              </button>
            </div>

            {/* Summary Row */}
            {!inspectionLoading && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'إجمالي المهام النشطة', value: inspectionTasks.filter(t => !t.id.startsWith('mock-')).length, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'في انتظار التفتيش', value: inspectionTasks.filter(t => t.escrow_status === 'ready_for_inspection').length, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'مكتملة هذا الشهر', value: 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {inspectionLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">جارٍ تحميل مهام التفتيش...</p>
                </div>
              </div>
            ) : inspectionTasks.filter(t => !t.id.startsWith('mock-')).length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Icon name="CheckCircleIcon" size={28} className="text-emerald-500" />
                </div>
                <p className="font-semibold text-foreground mb-1">لا توجد مهام تفتيش نشطة حالياً</p>
                <p className="text-sm text-muted-foreground">ستظهر هنا الطلبات التي تحتاج إلى تفتيش ميداني</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inspectionTasks.filter(t => !t.id.startsWith('mock-')).map(task => {
                  const MILESTONE_STAGES = [
                    { key: 'confirmed', label: 'طلب مؤكد' },
                    { key: 'funds_secured', label: 'تمويل محجوز' },
                    { key: 'ready_for_inspection', label: 'جاهز للتفتيش' },
                    { key: 'shipped', label: 'تفتيش مكتمل' },
                    { key: 'pending_admin_payout', label: 'تسليم نهائي' },
                  ];
                  const currentStageIdx = MILESTONE_STAGES.findIndex(s => s.key === task.escrow_status);
                  const activeStageIdx = currentStageIdx >= 0 ? currentStageIdx : 1;

                  const statusMeta = ESCROW_STATUS_META[task.escrow_status] || {
                    label: task.escrow_status,
                    color: 'bg-gray-50 text-gray-600 border-gray-200',
                    icon: 'ClockIcon',
                  };
                  const isExpanded = expandedTask === task.id;
                  const isGreenLighting = greenLightLoading === task.id;

                  return (
                    <div key={task.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="p-4">
                        {/* Order & Status Row */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                                #{task.order_number}
                              </span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusMeta.color}`}>
                                <span className="flex items-center gap-1">
                                  <Icon name={statusMeta.icon as any} size={10} />
                                  {statusMeta.label}
                                </span>
                              </span>
                            </div>
                            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                              <Icon name="BuildingOffice2Icon" size={14} className="text-muted-foreground shrink-0" />
                              {task.factory_name}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{task.factory_city}{task.factory_country && task.factory_country !== '—' ? `, ${task.factory_country}` : ''}</p>
                          </div>
                          {task.order_total > 0 && (
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">قيمة الطلب</p>
                              <p className="text-sm font-bold text-foreground">{task.order_total.toLocaleString()} {task.currency}</p>
                            </div>
                          )}
                        </div>

                        {/* Milestone Timeline */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between relative">
                            {/* Connecting line */}
                            <div className="absolute top-4 left-4 right-4 h-0.5 bg-border z-0" />
                            {MILESTONE_STAGES.map((stage, idx) => {
                              const isCompleted = idx < activeStageIdx;
                              const isCurrent = idx === activeStageIdx;
                              const isFuture = idx > activeStageIdx;
                              return (
                                <div key={stage.key} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
                                    isCompleted
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : isCurrent
                                      ? 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100' :'bg-background border-border text-muted-foreground'
                                  }`}>
                                    {isCompleted ? '✓' : idx + 1}
                                  </div>
                                  <p className={`text-[9px] font-semibold text-center leading-tight max-w-[60px] ${
                                    isCompleted ? 'text-emerald-600' : isCurrent ? 'text-blue-600' : 'text-muted-foreground'
                                  }`}>
                                    {stage.label}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Icon name="MapPinIcon" size={12} />
                                تفاصيل موقع المصنع
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[10px] text-amber-700 font-medium">المدينة / المنطقة</p>
                                  <p className="text-xs font-semibold text-amber-900">{task.factory_city}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-amber-700 font-medium">الدولة</p>
                                  <p className="text-xs font-semibold text-amber-900">{task.factory_country}</p>
                                </div>
                                {task.factory_address !== '—' && (
                                  <div className="col-span-2">
                                    <p className="text-[10px] text-amber-700 font-medium">العنوان التفصيلي</p>
                                    <p className="text-xs font-semibold text-amber-900">{task.factory_address}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-[10px] text-amber-700 font-medium">جهة الاتصال</p>
                                  <p className="text-xs font-semibold text-amber-900">{task.factory_contact_person}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-amber-700 font-medium">رقم الهاتف</p>
                                  <p className="text-xs font-semibold text-amber-900 font-mono" dir="ltr">{task.factory_contact_phone}</p>
                                </div>
                              </div>
                              {task.factory_contact_phone && task.factory_contact_phone !== '—' && (
                                <a
                                  href={`https://api.whatsapp.com/send?phone=${task.factory_contact_phone.replace(/[\s\-\(\)\+]/g, '')}&text=${encodeURIComponent(`مرحباً، أنا المندوب الميداني من DirectHub. أتواصل معكم بخصوص الطلب رقم ${task.order_number} لتنسيق موعد التفتيش.`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold mt-1"
                                  style={{ backgroundColor: '#1E1E1E', color: '#25D366', border: '1px solid #25D366' }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                  تواصل واتساب
                                </a>
                              )}
                            </div>

                            {task.delivery_deadline && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                                <Icon name="CalendarDaysIcon" size={13} className="text-primary shrink-0" />
                                <span>الموعد النهائي للتسليم:</span>
                                <span className="font-semibold text-foreground">
                                  {new Date(task.delivery_deadline).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}
                                </span>
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-semibold text-foreground mb-1.5">
                                ملاحظة التفتيش الميداني (اختياري)
                              </label>
                              <textarea
                                value={greenLightNote[task.id] || ''}
                                onChange={e => setGreenLightNote(prev => ({ ...prev, [task.id]: e.target.value }))}
                                rows={2}
                                placeholder="أدخل ملاحظات التفتيش الميداني قبل إعطاء الضوء الأخضر..."
                                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                              />
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                          {/* Update Milestone Button */}
                          <button
                            onClick={() => setMilestoneModal({ taskId: task.id, currentStage: activeStageIdx })}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors"
                          >
                            <Icon name="PencilSquareIcon" size={13} />
                            تحديث الحالة
                          </button>

                          {/* Green Light Button */}
                          <button
                            onClick={() => handleGreenLight(task)}
                            disabled={isGreenLighting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                              background: isGreenLighting ? '#6b7280' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                              color: '#ffffff',
                              boxShadow: isGreenLighting ? 'none' : '0 2px 8px rgba(22,163,74,0.35)',
                            }}
                          >
                            {isGreenLighting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                جارٍ الإرسال...
                              </>
                            ) : (
                              <>
                                <span className="text-base">🟢</span>
                                إعطاء الضوء الأخضر
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                            className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-semibold hover:bg-amber-100 transition-colors"
                          >
                            <Icon name="MapPinIcon" size={13} />
                            {isExpanded ? 'إخفاء' : 'الموقع'}
                          </button>

                          {!task.id.startsWith('mock-') && (
                            <a
                              href={`/order-tracking?order=${task.order_id}`}
                              className="flex items-center gap-1.5 px-3 py-2.5 bg-muted border border-border text-muted-foreground rounded-xl text-xs font-semibold hover:bg-muted/80 transition-colors"
                            >
                              <Icon name="EyeIcon" size={13} />
                              الطلب
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Milestone Update Modal */}
        {milestoneModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setMilestoneModal(null)}>
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">تحديث حالة المرحلة</h3>
                <button onClick={() => setMilestoneModal(null)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                  <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                المرحلة الحالية: <span className="font-semibold text-foreground">
                  {['طلب مؤكد', 'تمويل محجوز', 'جاهز للتفتيش', 'تفتيش مكتمل', 'تسليم نهائي'][milestoneModal.currentStage] || '—'}
                </span>
              </p>
              <textarea
                value={milestoneNote}
                onChange={e => setMilestoneNote(e.target.value)}
                rows={3}
                placeholder="أضف ملاحظة حول إتمام هذه المرحلة..."
                className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setMilestoneModal(null)}
                  className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    setSuccessMsg('✅ تم تحديث حالة المرحلة بنجاح');
                    setTimeout(() => setSuccessMsg(''), 4000);
                    setMilestoneModal(null);
                    setMilestoneNote('');
                  }}
                  disabled={milestoneUpdating}
                  className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  تأكيد التحديث
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Referral & Tracking Tab */}
        {activeTab === 'referral' && user && (
          <ReferralTrackingPanel userId={user.id} />
        )}

        {/* Messaging Tab */}
        {activeTab === 'messaging' && user && (
          <UnifiedMessagingEngine
            userId={user.id}
            mode="agent_factory"
            title="صندوق رسائل المصانع والموردين"
            subtitle="تواصل مع المصانع والموردين المسجلين"
            showFilters={true}
            height={640}
            chatLanguage={dashboardChatLang}
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

        {/* Documents Tab */}
        {activeTab === 'documents' && user && (
          <DocumentUploadPanel
            userId={user.id}
            factories={factories.map(f => ({
              id: f.id,
              company_name: f.company_name,
              factory_type: f.factory_type,
            }))}
          />
        )}

        {/* Info Exchange Tab */}
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

        {/* Receiving Accounts Tab */}
        {activeTab === 'accounts' && user && (
          <ReceivingAccountPanel
            userId={user.id}
            factories={factories.map(f => ({
              id: f.id,
              company_name: f.company_name,
              factory_type: f.factory_type,
            }))}
          />
        )}

        {/* Complaints Tab */}
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

        {/* Sales Dashboard Tab */}
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

        {/* Admin Messaging Tab */}
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

        {/* Commission Account Tab */}
        {activeTab === 'commission' && user && (
          <AgentCommissionAccountPanel userId={user.id} />
        )}

        {/* Earnings & Commissions Tab */}
        {activeTab === 'earnings' && user && (
          <AgentEarningsPanel userId={user.id} />
        )}

        {/* Enhanced Agent Dashboard Tab */}
        {activeTab === 'enhanced' && user && (
          <EnhancedAgentDashboard userId={user.id} />
        )}

        {/* Dispatch Rooms Tab */}
        {activeTab === 'dispatch_rooms' && user && (
          <AgentDispatchRoomsTab userId={user.id} />
        )}

        {/* Factories Tab */}
        {activeTab === 'factories' && (
          <>
            {/* Filter Bar */}
            {factories.length > 0 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {[
                  { value: '', label: ad.filterAll },
                  { value: 'pending', label: ad.filterPending },
                  { value: 'under_review', label: ad.filterUnderReview },
                  { value: 'approved', label: ad.filterApproved },
                  { value: 'rejected', label: ad.filterRejected },
                ].map(f => (
                  <button
                    key={f.value}
                    onClick={() => setFilterStatus(f.value)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      filterStatus === f.value
                        ? 'bg-primary text-white border-primary' :'bg-card border-border text-muted-foreground hover:bg-muted'
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
                      href="/agent/register-factory"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Icon name="PlusIcon" size={15} />
                      {ad.newRegistration}
                    </Link>
                  )}
                </div>
              ) : (
                filteredFactories.map(factory => {
                  const contactStatus = CONTACT_STATUS_LABELS[factory.contact_status] || CONTACT_STATUS_LABELS.contacting;
                  const regStatus = REG_STATUS_LABELS[factory.registration_status] || REG_STATUS_LABELS.pending;
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
                          <p className="text-sm text-muted-foreground">{factory.city}, {factory.country} · {factory.industry || ad.unspecified}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {factory.contact_person} · {factory.contact_phone}
                          </p>
                          {factory.agent_notes && (
                            <p className="text-xs text-blue-600 mt-1 italic">📝 {factory.agent_notes}</p>
                          )}
                          {factory.admin_note && (
                            <p className="text-xs text-purple-600 mt-0.5 italic">🔍 {factory.admin_note}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Icon name="CubeIcon" size={12} />
                              {ad.productCount.replace('{count}', String(factoryProducts.length))}
                            </span>
                            {factory.trade_license_url && (
                              <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <Icon name="DocumentCheckIcon" size={12} />
                                {ad.licenseUploaded}
                              </span>
                            )}
                            {factory.license_reviewed_at && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Icon name="ClockIcon" size={12} />
                                {ad.reviewedAt.replace('{date}', new Date(factory.license_reviewed_at).toLocaleDateString(language === 'ar' ? 'ar' : language))}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {/* Primary: Review & Approve */}
                          <button
                            onClick={() => setReviewModal(factory)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
                          >
                            <Icon name="ClipboardDocumentCheckIcon" size={13} />
                            {ad.reviewApprove}
                          </button>
                          {/* WhatsApp Activation — shown only for approved factories/suppliers */}
                          {factory.registration_status === 'approved' && factory.contact_phone && (
                            <a
                              href={(() => {
                                const cleanPhone = factory.contact_phone.replace(/[\s\-\(\)\+]/g, '');
                                const dashboardUrl = 'https://direct-hub.net/manufacturer/dashboard';
                                const entityLabel = factory.factory_type === 'local_supplier' ? 'مورد معتمد' : 'مصنع معتمد';
                                const message =
                                  `مرحباً بكم في منصة DirectHub 🎉\n\n` +
                                  `يسعدنا إبلاغكم بأن طلب تسجيل شركة *${factory.company_name}* قد تمت الموافقة عليه رسمياً وأصبحتم الآن ${entityLabel} في منصتنا.\n\n` +
                                  `✅ تم اعتماد حسابكم بنجاح\n` +
                                  `🔗 رابط الدخول المباشر لغرفتكم التجارية:\n${dashboardUrl}\n\n` +
                                  `نتطلع إلى شراكة ناجحة ومثمرة معكم.\n` +
                                  `فريق DirectHub 🏭`;
                                return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                              style={{ backgroundColor: '#1E1E1E', color: '#D4AF37', border: '1px solid #D4AF37' }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              إرسال رابط التفعيل
                            </a>
                          )}
                          <Link
                            href={`/agent/add-product?factoryId=${factory.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors"
                          >
                            <Icon name="PlusIcon" size={13} />
                            {ad.addProduct}
                          </Link>
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

        {/* Products Tab */}
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
                          {product.video_url && (
                            <span
                              title={t.agentAddProduct.badgeVideo}
                              className="absolute bottom-0.5 end-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                            >
                              <Icon name="VideoCameraIcon" size={11} />
                            </span>
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
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          product.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          {product.is_active ? ad.regApproved : ad.regPending}
                        </span>
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
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">{t.agentAddProduct.category}</p>
                          <p className="text-sm font-bold text-foreground">{product.category || '—'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {reviewModal && (
        <ReviewModal
          factory={reviewModal}
          onClose={() => setReviewModal(null)}
          onSave={handleReviewSave}
        />
      )}

      <BottomNav />
    </div>
  );
}
