'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import { createNotification } from '@/lib/notificationEngine';

import Icon from '@/components/ui/AppIcon';






import SystemHealthPanel from './SystemHealthPanel';
import PlatformDiagnosticsPanel from './PlatformDiagnosticsPanel';
import AmalLogsPanel from './AmalLogsPanel';
import BuyerSellerChatMonitorPanel from './BuyerSellerChatMonitorPanel';
import SmartRFQRoutingPanel from './SmartRFQRoutingPanel';
import AISystemAuditorPanel from './AISystemAuditorPanel';
import ChangelogNotificationPanel from './ChangelogNotificationPanel';
import SupplierAlertEnginePanel from './SupplierAlertEnginePanel';
import ExecutiveNotificationRadar from './ExecutiveNotificationRadar';
import IssueCardsPanel from './IssueCardsPanel';
import WhatsAppAutomationPanel from './WhatsAppAutomationPanel';
import IdeaGeneratorPanel from './IdeaGeneratorPanel';



import DatabaseExplorerPanel from './DatabaseExplorerPanel';
import FieldRepresentativesPanel from './FieldRepresentativesPanel';
import AdminMessagingPanel from './AdminMessagingPanel';
import LogisticsDashboardPanel from './LogisticsDashboardPanel';
import AdminDisputeArbitrationPanel from './AdminDisputeArbitrationPanel';
import ProductApprovalTogglePanel from './ProductApprovalTogglePanel';
import FastTrackApprovalPanel from './FastTrackApprovalPanel';
import FactoryOnboardingModePanel from './FactoryOnboardingModePanel';
import PendingPaymentApprovalPanel from './PendingPaymentApprovalPanel';















import TreasuryPanel from '@/components/admin/TreasuryPanel';
import RoleSimulationPanel from './RoleSimulationPanel';
import BroadcastCenterPanel from './BroadcastCenterPanel';
import SitemapHubPanel from './SitemapHubPanel';
import PushSchedulerPanel from './PushSchedulerPanel';
import AbandonedCartPanel from './AbandonedCartPanel';
import SmartActionBar from './SmartActionBar';
import EscrowHealthMeter from './EscrowHealthMeter';
import SupplierManagementPanel from './SupplierManagementPanel';


import { sendEscrowStatusEmail, generateAndSendEscrowInvoice } from '@/lib/email';

import { useLanguage } from '@/contexts/LanguageContext';
import { OrderWhatsAppActions } from '@/components/OrderWhatsAppButton';
import { buildWelcomeWhatsAppLink, isArabicSpeaking, formatPhoneForWhatsApp, resolveDialCode } from '@/lib/whatsappOrderLinks';
import { ShippingWhatsAppActions } from '@/components/AdminWhatsAppNotify';
import LiveUpdatesInfraPanel from '@/app/admin/control-room/LiveUpdatesInfraPanel';
import PhasedEscrowPanel from '@/app/admin/control-room/PhasedEscrowPanel';
import IBANVerificationPanel from '@/app/admin/control-room/IBANVerificationPanel';
import OCRVerificationPanel from '@/app/admin/control-room/OCRVerificationPanel';
import CustomsValidatorPanel from '@/app/admin/control-room/CustomsValidatorPanel';
import ManualReviewQueuePanel from '@/app/admin/control-room/ManualReviewQueuePanel';







// ─── Stable date/time formatters (SSR-safe, no locale mismatch) ───────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminAIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AmalAlert {
  id: string;
  level: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
  timestamp: string;
  actionLabel?: string;
  actionTab?: ActiveTab;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  country: string;
  role: 'buyer' | 'manufacturer' | 'admin';
  is_verified: boolean;
  created_at: string;
  avatar_url: string;
  auth_provider?: string | null;
}

interface FactoryRegistration {
  id: string;
  user_id: string;
  company_name: string;
  country: string;
  city: string;
  industry: string;
  employee_count: string;
  annual_revenue: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  trade_license_url: string;
  trade_license_filename: string;
  tax_certificate_url: string;
  tax_certificate_filename: string;
  company_profile_url: string;
  company_profile_filename: string;
  manufacturing_license_url: string;
  cr_document_url: string;
  factory_license_url: string;
  tax_id: string;
  documents_submitted_at: string;
  product_listing_unlocked: boolean;
  registration_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  kyc_status: 'pending' | 'under_review' | 'approved' | 'rejected';
  admin_note: string;
  submitted_at: string;
  is_approved: boolean;
  is_active: boolean;
  seller_category?: 'local_factory' | 'international_factory' | 'local_supplier';
  factory_type?: 'local' | 'international';
  user_profiles?: { full_name: string; email: string; registration_source?: string };
  registration_source?: string;
}

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  platformCommission: number;
  activeFactories: number;
  pendingVerifications: number;
  totalUsers: number;
  googleUsers: number;
  facebookUsers: number;
  otherUsers: number;
  deliveredOrders: number;
  disputedOrders: number;
  totalBuyers: number;
  totalManufacturers: number;
  recentSignups: number;
  newUsersYesterday: number;
  newFactoriesYesterday: number;
  revenueGrowth: string;
  agentFactoriesCount: number;
  totalProducts: number;
  logisticsPartnersCount: number;
}

interface BankAccount {
  id: string;
  manufacturer_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  currency: string;
  account_type: string;
  account_type_label: string;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_note: string;
  is_primary: boolean;
  created_at: string;
  user_profiles?: { full_name: string; email: string; company_name: string };
}

type ActiveTab = 'overview' | 'verification' | 'users' | 'factories' | 'amal' | 'escrow' | 'messages' | 'direct_orders' | 'admin_messaging' | 'platform_settings' | 'field_agents' | 'page_directory' | 'payments' | 'pending_payment_approval' | 'accounts' | 'logistics' | 'logistics_dashboard' | 'logistics_disputes' | 'live_infra' | 'phased_escrow' | 'iban_verification' | 'ocr_verification' | 'customs_validator' | 'manual_review_queue' | 'rfq_management' | 'system_health' | 'platform_diagnostics' | 'amal_logs' | 'buyer_seller_chat' | 'smart_rfq_routing' | 'ai_auditor' | 'changelog' | 'supplier_alerts' | 'executive_radar' | 'issue_cards' | 'whatsapp_automation' | 'idea_generator' | 'db_explorer' | 'treasury' | 'role_simulation' | 'broadcast_center' | 'sitemap_hub' | 'international_factories' | 'supplier_dashboard' | 'push_scheduler' | 'abandoned_cart';

// ─── Drill-Down Modal ─────────────────────────────────────────────────────────
function DrillDownModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
        <h3 className="font-bold text-foreground text-base">{title}</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
          <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  buyer: 'bg-sky-50 text-sky-700 border border-sky-200',
  manufacturer: 'bg-purple-50 text-purple-700 border border-purple-200',
  admin: 'bg-red-50 text-red-700 border border-red-200',
};

const ROLE_LABELS_I18N: Record<string, Record<string, string>> = {
  en: { buyer: 'Buyer', manufacturer: 'Manufacturer / Supplier', admin: 'Admin' },
  ar: { buyer: 'مشتري', manufacturer: 'مصنّع / مورد', admin: 'مسؤول' },
  zh: { buyer: '买家', manufacturer: '制造商 / 供应商', admin: '管理员' },
  tr: { buyer: 'Alıcı', manufacturer: 'Üretici / Tedarikçi', admin: 'Yönetici' },
};

// ─── WhatsApp Activation Link Helper (module-level) ──────────────────────────
function generateWhatsAppActivationLink(
  phone: string,
  companyName: string,
  entityType: 'factory' | 'supplier' = 'factory',
  country?: string | null
): string {
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  const dashboardUrl = 'https://direct-hub.net/manufacturer/dashboard';
  const entityLabel = entityType === 'supplier' ? 'مورد معتمد' : 'مصنع معتمد';
  const entityLabelEn = entityType === 'supplier' ? 'Verified Supplier' : 'Verified Manufacturer';
  const arabic = isArabicSpeaking(country, cleanPhone);
  const message = arabic
    ? `مرحباً بكم في منصة DirectHub 🎉\n\n` +
      `يسعدنا إبلاغكم بأن طلب تسجيل شركة *${companyName}* قد تمت الموافقة عليه رسمياً وأصبحتم الآن ${entityLabel} في منصتنا.\n\n` +
      `✅ تم اعتماد حسابكم بنجاح\n` +
      `🔗 رابط الدخول المباشر لغرفتكم التجارية:\n${dashboardUrl}\n\n` +
      `نتطلع إلى شراكة ناجحة ومثمرة معكم.\n` +
      `فريق DirectHub 🏭`
    : `Welcome to DirectHub 🎉\n\n` +
      `We are pleased to inform you that *${companyName}* has been officially approved and you are now a ${entityLabelEn} on our platform.\n\n` +
      `✅ Your account has been successfully verified\n` +
      `🔗 Direct link to your business dashboard:\n${dashboardUrl}\n\n` +
      `We look forward to a successful partnership.\n` +
      `DirectHub Team 🏭`;
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}

// ─── WhatsApp Activation Button Component (module-level) ─────────────────────
function WhatsAppActivationButton({
  phone,
  companyName,
  entityType = 'factory',
  country,
}: {
  phone: string;
  companyName: string;
  entityType?: 'factory' | 'supplier';
  country?: string | null;
}) {
  if (!phone) return null;
  const link = generateWhatsAppActivationLink(phone, companyName, entityType, country);
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
      style={{ backgroundColor: '#1E1E1E', color: '#D4AF37', border: '1px solid #D4AF37' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      إرسال رابط التفعيل عبر واتساب
    </a>
  );
}

// ─── WhatsApp Contact Link (module-level) ─────────────────────────────────────
function cleanPhoneForWhatsApp(phone: string, country?: string | null): string {
  const dialCode = resolveDialCode(country);
  return formatPhoneForWhatsApp(phone, dialCode) || phone.replace(/[\s\-\(\)\+]/g, '');
}

function WhatsAppContactLink({ phone, country }: { phone?: string | null; country?: string | null }) {
  if (!phone) return null;
  const url = buildWelcomeWhatsAppLink(phone, country);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors whitespace-nowrap"
      title={`واتساب: ${phone}`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      واتساب
    </a>
  );
}

// ─── SortIcon Component (module-level) ───────────────────────────────────────
const SortIcon = ({ col, state }: { col: string; state: { col: string; dir: string } }) =>
  state.col === col ? (
    <Icon name={state.dir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} className="text-primary" />
  ) : (
    <Icon name="ChevronUpDownIcon" size={12} className="text-muted-foreground opacity-50" />
  );

// ─── Accreditation Inquiry Banner (Admin Side) ───────────────────────────────
function AccreditationInquiryBanner({ onViewVerification }: { onViewVerification: () => void }) {
  const supabase = createClient();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    const fetchInquiries = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', 'accreditation_inquiry')
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(10);
        setInquiries(data || []);
      } catch {
        setInquiries([]);
      } finally {
        setLoading(false);
      }
    };
    fetchInquiries();

    // Real-time subscription
    const channel = supabase
      .channel('accreditation-inquiries')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'type=eq.accreditation_inquiry' }, () => {
        fetchInquiries();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleMarkAllRead = async () => {
    if (inquiries.length === 0) return;
    setMarkingRead(true);
    try {
      const ids = inquiries.map(i => i.id);
      await supabase.from('notifications').update({ is_read: true }).in('id', ids);
      setInquiries([]);
    } catch {
      // silent
    } finally {
      setMarkingRead(false);
    }
  };

  if (loading || inquiries.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 shadow-lg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #D4AF37, #F59E0B, #D4AF37, transparent)' }} />
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #D4AF37, #B8860B)' }}>
              <Icon name="BellAlertIcon" size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-sm">استفسارات الاعتماد الواردة</p>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {inquiries.length} جديد
                </span>
              </div>
              <p className="text-xs text-white/60">مصانع تستفسر عن حالة مراجعة مستنداتها — يتطلب متابعة فورية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewVerification}
              className="px-3 py-1.5 text-xs font-bold rounded-xl transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#1a1a2e' }}
            >
              مراجعة الطلبات
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={markingRead}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/20 text-white/70 hover:bg-white/10 transition-all"
            >
              {markingRead ? '...' : 'تعليم كمقروء'}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {inquiries.slice(0, 3).map(inq => (
            <div key={inq.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
                <Icon name="BuildingOffice2Icon" size={14} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{inq.title || 'استفسار عن حالة الاعتماد'}</p>
                <p className="text-[10px] text-white/50 truncate">{inq.body || inq.message || ''}</p>
              </div>
              <span className="text-[10px] text-white/40 shrink-0">
                {inq.created_at ? new Date(inq.created_at).toLocaleDateString('ar-SA') : ''}
              </span>
            </div>
          ))}
          {inquiries.length > 3 && (
            <p className="text-center text-[10px] text-white/40 pt-1">+ {inquiries.length - 3} استفسار إضافي</p>
          )}
        </div>
      </div>
      <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, #D4AF3740, transparent)' }} />
    </div>
  );
}

// ─── RFQ Management Panel ─────────────────────────────────────────────────────

function RFQManagementPanel({ rfqs, onRefresh }: { rfqs: any[]; onRefresh: () => void }) {
  const { t, dir, isRTL } = useLanguage();
  const ui = t.admin.rfq;
  const supabase = createClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'responded' | 'accepted' | 'rejected' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailRFQ, setDetailRFQ] = useState<any | null>(null);
  const [detailResponses, setDetailResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [fullRFQs, setFullRFQs] = useState<any[]>([]);
  const [loadingFull, setLoadingFull] = useState(false);

  // Fetch full RFQ data with buyer profiles
  useEffect(() => {
    const fetchFull = async () => {
      setLoadingFull(true);
      try {
        const { data } = await supabase
          .from('rfq_requests')
          .select('*, buyer_profile:user_profiles!rfq_requests_buyer_id_fkey(full_name, company_name, email, country)')
          .order('created_at', { ascending: false })
          .limit(200);

        if (data) {
          // Enrich with response counts
          const enriched = await Promise.all(data.map(async (rfq) => {
            const { count } = await supabase
              .from('rfq_responses')
              .select('*', { count: 'exact', head: true })
              .eq('rfq_id', rfq.id);
            return { ...rfq, response_count: count || 0 };
          }));
          setFullRFQs(enriched);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingFull(false);
      }
    };
    fetchFull();
  }, [rfqs]);

  const fetchResponses = async (rfqId: string) => {
    setLoadingResponses(true);
    try {
      const { data } = await supabase
        .from('rfq_responses')
        .select('*, manufacturer:user_profiles!rfq_responses_manufacturer_id_fkey(full_name, company_name, email, country)')
        .eq('rfq_id', rfqId)
        .order('created_at', { ascending: false });
      setDetailResponses(data || []);
    } catch {
      setDetailResponses([]);
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleViewDetail = (rfq: any) => {
    setDetailRFQ(rfq);
    fetchResponses(rfq.id);
  };

  const handleStatusUpdate = async (rfqId: string, status: string) => {
    await supabase.from('rfq_requests').update({ status }).eq('id', rfqId);
    onRefresh();
    setDetailRFQ((prev: any) => prev ? { ...prev, status } : null);
  };

  const displayRFQs = fullRFQs.length > 0 ? fullRFQs : rfqs;

  const filtered = displayRFQs.filter(r => {
    const matchesFilter = filter === 'all' || r.status === filter;
    const matchesSearch = !searchQuery || 
      (r.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.buyer_profile?.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.buyer_profile?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    responded: 'bg-blue-50 text-blue-700 border border-blue-200',
    accepted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
    expired: 'bg-gray-100 text-gray-500 border border-gray-200',
  };

  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    responded: ui.responded,
    accepted: ui.accepted,
    rejected: ui.rejected,
    expired: ui.expired,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="DocumentTextIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{ui.title}</h2>
            <p className="text-sm text-white/80">{ui.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">{ui.live}</span>
            </div>
            <p className="text-[10px] text-white/60">{displayRFQs.length} {ui.totalRequests}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: ui.all, value: displayRFQs.length, color: 'text-indigo-600 bg-indigo-50', key: 'all' },
          { label: ui.pending, value: displayRFQs.filter(r => r.status === 'pending').length, color: 'text-amber-600 bg-amber-50', key: 'pending' },
          { label: ui.responded, value: displayRFQs.filter(r => r.status === 'responded').length, color: 'text-blue-600 bg-blue-50', key: 'responded' },
          { label: ui.accepted, value: displayRFQs.filter(r => r.status === 'accepted').length, color: 'text-emerald-600 bg-emerald-50', key: 'accepted' },
          { label: ui.rejectedExpired, value: displayRFQs.filter(r => ['rejected', 'expired'].includes(r.status)).length, color: 'text-red-600 bg-red-50', key: 'rejected' },
        ].map(stat => (
          <button
            key={stat.key}
            onClick={() => setFilter(stat.key as any)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
              filter === stat.key ? `${stat.color} border-current` : 'bg-card border-border hover:border-current'
            }`}
          >
            <div className="flex-1 text-start">
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium">{stat.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={ui.searchPlaceholder}
          className="w-full pr-9 pl-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
          dir={dir}
        />
      </div>

      {/* RFQ Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="TableCellsIcon" size={16} className="text-indigo-600" />
            <h3 className="font-semibold text-foreground">{ui.tableTitle}</h3>
            <span className="text-xs text-muted-foreground">({filtered.length} {ui.requests})</span>
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
          >
            <Icon name="ArrowPathIcon" size={13} />
            تحديث
          </button>
        </div>

        {loadingFull ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Icon name="DocumentTextIcon" size={36} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{ui.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[500px]" dir={dir}>
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.product}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.buyer}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.quantity}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.targetPrice}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.quotes}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.status}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.date}</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">{ui.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(rfq => (
                  <tr key={rfq.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground truncate max-w-[160px]">{rfq.product_name || '—'}</p>
                      {rfq.destination_country && (
                        <p className="text-xs text-muted-foreground">→ {rfq.destination_country}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-xs truncate max-w-[120px]">
                        {rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{rfq.buyer_profile?.country || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{(rfq.quantity || 0).toLocaleString('en-US')}</p>
                      <p className="text-xs text-muted-foreground">{rfq.unit || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      {rfq.target_price ? (
                        <p className="font-semibold text-foreground">{rfq.currency} {Number(rfq.target_price).toLocaleString('en-US')}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{ui.open}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center min-w-[28px] h-6 rounded-full text-xs font-bold px-2 ${
                        (rfq.response_count || 0) > 0 ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'
                      }`}>
                        {rfq.response_count || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[rfq.status] || statusColors.pending}`}>
                        {statusLabels[rfq.status] || rfq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        {rfq.created_at ? formatDate(rfq.created_at) : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewDetail(rfq)}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
                      >
                        تفاصيل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailRFQ && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailRFQ(null)}>
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            dir={dir}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-foreground">{detailRFQ.product_name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {detailRFQ.buyer_profile?.company_name || detailRFQ.buyer_profile?.full_name || 'مشتري'} · {detailRFQ.buyer_profile?.country || ''}
                </p>
              </div>
              <button onClick={() => setDetailRFQ(null)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
                <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* RFQ Details */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: ui.quantity, value: `${(detailRFQ.quantity || 0).toLocaleString('en-US')} ${detailRFQ.unit || ''}` },
                  { label: ui.targetPrice, value: detailRFQ.target_price ? `${detailRFQ.currency} ${Number(detailRFQ.target_price).toLocaleString('en-US')}` : ui.open },
                  { label: ui.destination, value: detailRFQ.destination_country || '—' },
                  { label: ui.sentAt, value: detailRFQ.created_at ? formatDate(detailRFQ.created_at) : '—' },
                  { label: ui.expiresAt, value: detailRFQ.expires_at ? formatDate(detailRFQ.expires_at) : '—' },
                  { label: ui.status, value: statusLabels[detailRFQ.status] || detailRFQ.status },
                ].map(item => (
                  <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              {detailRFQ.specifications && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{ui.specs}</p>
                  <p className="text-sm text-foreground">{detailRFQ.specifications}</p>
                </div>
              )}

              {/* Admin Status Control */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <p className="text-xs font-bold text-indigo-800 mb-3">{ui.updateStatus}</p>
                <div className="flex flex-wrap gap-2">
                  {(['pending', 'responded', 'accepted', 'rejected', 'expired'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(detailRFQ.id, s)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        detailRFQ.status === s
                          ? (statusColors[s] || 'bg-primary text-primary-foreground border-primary')
                          : 'bg-card border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {statusLabels[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Responses */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-blue-600" />
                  <h4 className="font-semibold text-foreground text-sm">{ui.incomingQuotes}</h4>
                  <span className="text-xs text-muted-foreground">({detailResponses.length})</span>
                </div>
                {loadingResponses ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : detailResponses.length === 0 ? (
                  <div className="text-center py-6 bg-muted/20 rounded-xl">
                    <Icon name="InboxIcon" size={28} className="text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{ui.noQuotes}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detailResponses.map(resp => (
                      <div key={resp.id} className="bg-muted/20 border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {resp.manufacturer?.company_name || resp.manufacturer?.full_name || 'مورد'}
                            </p>
                            <p className="text-xs text-muted-foreground">{resp.manufacturer?.country || ''}</p>
                          </div>
                          <p className="text-lg font-bold text-primary">{resp.currency} {Number(resp.unit_price).toLocaleString('en-US')}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><span className="text-muted-foreground">{ui.leadTime}</span><span className="font-medium">{resp.lead_time_days} {ui.days}</span></div>
                          <div><span className="text-muted-foreground">{ui.moq}</span><span className="font-medium">{resp.min_order_qty}</span></div>
                          <div><span className="text-muted-foreground">{ui.payment}</span><span className="font-medium">{resp.payment_terms}</span></div>
                        </div>
                        {resp.notes && <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">{resp.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Amal Operations Manager Panel ───────────────────────────────────────────

function AmalPanel({
  analytics,
  verificationQueue,
  orders,
  rfqs,
  onNavigate,
}: {
  analytics: AnalyticsData;
  verificationQueue: FactoryRegistration[];
  orders: any[];
  rfqs: any[];
  onNavigate: (tab: ActiveTab) => void;
}) {
  const { t, dir, language } = useLanguage();
  const ui = t.admin;
  const [messages, setMessages] = useState<AdminAIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<AmalAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastMonitorTime, setLastMonitorTime] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate local alerts from live data
  useEffect(() => {
    const newAlerts: AmalAlert[] = [];
    const now = new Date().toISOString();

    if (analytics.pendingVerifications > 0) {
      newAlerts.push({
        id: 'verif-pending',
        level: analytics.pendingVerifications > 5 ? 'critical' : 'warning',
        title: `${analytics.pendingVerifications} ${ui.alerts.pendingVerification}`,
        body: ui.alerts.pendingVerificationBody,
        timestamp: now,
        actionLabel: ui.alerts.reviewRequests,
        actionTab: 'verification',
      });
    }

    if (analytics.disputedOrders > 0) {
      newAlerts.push({
        id: 'disputes',
        level: 'critical',
        title: `${analytics.disputedOrders} ${ui.alerts.disputedOrder}`,
        body: ui.alerts.disputedOrderBody,
        timestamp: now,
        actionLabel: ui.alerts.viewOrders,
        actionTab: 'overview',
      });
    }

    const urgentRFQs = rfqs.filter((r: any) => r.urgency === 'critical');
    if (urgentRFQs.length > 0) {
      newAlerts.push({
        id: 'urgent-rfqs',
        level: 'critical',
        title: `${urgentRFQs.length} ${ui.alerts.criticalRfq}`,
        body: ui.alerts.criticalRfqBody,
        timestamp: now,
      });
    }

    const deliveredToday = orders.filter((o: any) => {
      if (o.status !== 'delivered') return false;
      const updated = new Date(o.updated_at || o.created_at);
      const today = new Date();
      return updated.toDateString() === today.toDateString();
    });
    if (deliveredToday.length > 0) {
      newAlerts.push({
        id: 'delivered-today',
        level: 'success',
        title: `${deliveredToday.length} ${ui.alerts.deliveredToday}`,
        body: ui.alerts.deliveredTodayBody,
        timestamp: now,
      });
    }

    if (analytics.recentSignups > 10) {
      newAlerts.push({
        id: 'signups',
        level: 'info',
        title: `${analytics.recentSignups} ${ui.alerts.newSignup}`,
        body: ui.alerts.newSignupBody,
        timestamp: now,
      });
    }

    setAlerts(newAlerts);
  }, [analytics, orders, rfqs, ui.alerts]);

  const streamAmal = async (body: object, onChunk: (t: string) => void, onDone: () => void, onError: (e: Error) => void) => {
    try {
      const res = await fetch('/api/ai/admin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Not readable');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === 'chunk') { const c = d.chunk?.choices?.[0]?.delta?.content; if (c) onChunk(c); }
              else if (d.type === 'done') onDone();
              else if (d.type === 'error') onError(new Error(d.error));
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) { onError(err instanceof Error ? err : new Error('Error')); }
  };

  const handleOperationsMonitor = async () => {
    setIsMonitoring(true);
    setIsLoading(true);
    const placeholder: AdminAIMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, { role: 'user', content: '🔍 المرشد التنفيذي، قومي بمراجعة عمليات المنصة الآن وأنشئي تقرير لحظي شامل' }, placeholder]);

    let accumulated = '';
    await streamAmal(
      {
        task: 'amal_operations_monitor',
        liveData: {
          orders,
          rfqs,
          pendingVerifications: analytics.pendingVerifications,
          analytics,
        },
      },
      (chunk) => {
        accumulated += chunk;
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
      },
      () => {
        setIsLoading(false);
        setIsMonitoring(false);
        setLastMonitorTime(formatTime(new Date()));
      },
      (err) => {
        setIsLoading(false);
        setIsMonitoring(false);
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: `❌ ${err.message}` }; return u; });
      }
    );
  };

  const handleAnalytics = async () => {
    setIsLoading(true);
    const placeholder: AdminAIMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, { role: 'user', content: '📊 المرشد التنفيذي، حللي بيانات المنصة وقدمي رؤى استراتيجية' }, placeholder]);

    let accumulated = '';
    await streamAmal(
      { task: 'business_analytics', analyticsData: analytics },
      (chunk) => {
        accumulated += chunk;
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
      },
      () => setIsLoading(false),
      (err) => { setIsLoading(false); setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: `❌ ${err.message}` }; return u; }); }
    );
  };

  const handleDocumentAnalysis = async () => {
    if (!attachedFile) return;
    setIsLoading(true);
    const placeholder: AdminAIMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, { role: 'user', content: `📄 تحليل المستند: ${attachedFile.name}` }, placeholder]);

    let accumulated = '';
    await streamAmal(
      { task: 'document_analysis', documentDescription: attachedFile.name, fileData: { type: attachedFile.type.startsWith('image/') ? 'image' : 'pdf', data: attachedFile.data } },
      (chunk) => {
        accumulated += chunk;
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
      },
      () => { setIsLoading(false); setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; },
      (err) => { setIsLoading(false); setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: `❌ ${err.message}` }; return u; }); }
    );
  };

  const handlePlatformDiagnostic = async () => {
    setIsLoading(true);
    const placeholder: AdminAIMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, {
      role: 'user',
      content: '🔧 ابدأ فحصاً تشخيصياً شاملاً للمنصة — اكتشف الأزرار الميتة، الأنظمة الناقصة، وأخطاء API، وأنشئ prompts إصلاح جاهزة'
    }, placeholder]);

    const diagnosticData = {
      timestamp: new Date().toISOString(),
      platform_stats: analytics,
      orders_summary: {
        total: orders.length,
        disputed: orders.filter((o: any) => o.dispute_status === 'reported').length,
        processing: orders.filter((o: any) => o.status === 'processing').length,
      },
      rfqs_summary: {
        total: rfqs.length,
        pending: rfqs.filter((r: any) => r.status === 'pending').length,
        urgent: rfqs.filter((r: any) => r.urgency === 'critical').length,
      },
      verification_queue: verificationQueue.length,
      env_status: {
        gemini: true,
        supabase: true,
        whatsapp: true,
        openai: false,
        resend: false,
        stripe: false,
      },
      known_issues_to_check: [
        'Admin AI chat Unauthorized error',
        'Missing OPENAI_API_KEY for OpenAI features',
        'Missing RESEND_API_KEY for email notifications',
        'Missing STRIPE_SECRET_KEY for payment processing',
        'Check all navigation links in Header component',
        'Verify all form submission handlers are connected',
        'Check RFQ routing AI endpoint connectivity',
        'Verify escrow workflow state machine completeness',
        'Check WhatsApp notification delivery',
        'Verify multi-language translation coverage',
      ],
    };

    let accumulated = '';
    await streamAmal(
      { task: 'platform_diagnostic', diagnosticData },
      (chunk) => {
        accumulated += chunk;
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
      },
      () => setIsLoading(false),
      (err) => { setIsLoading(false); setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: `❌ ${err.message}` }; return u; }); }
    );
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');

    const newMessages: AdminAIMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setIsLoading(true);

    let accumulated = '';
    await streamAmal(
      {
        task: 'amal_chat',
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        analyticsData: analytics,
      },
      (chunk) => {
        accumulated += chunk;
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: accumulated }; return u; });
      },
      () => setIsLoading(false),
      (err) => { setIsLoading(false); setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: `❌ ${err.message}` }; return u; }); }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => setAttachedFile({ name: file.name, type: file.type, data: reader.result as string });
  };

  const alertColors: Record<string, string> = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  const alertIcons: Record<string, string> = {
    critical: 'ExclamationCircleIcon',
    warning: 'ExclamationTriangleIcon',
    info: 'InformationCircleIcon',
    success: 'CheckCircleIcon',
  };
  const alertIconColors: Record<string, string> = {
    critical: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    success: 'text-emerald-500',
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Amal Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="CpuChipIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold">{ui.amal.title}</h2>
              <span className="px-2 py-0.5 bg-white/20 text-[10px] font-bold rounded-full">Master Platform Engineer</span>
            </div>
            <p className="text-sm text-white/80">{ui.amal.subtitle}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/90">{ui.amal.active}</span>
            </div>
            {lastMonitorTime && (
              <p className="text-[10px] text-white/60">{ui.amal.lastReview} {lastMonitorTime}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Latest Engineer Updates Strip ─────────────────────────────────── */}
      <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 -mt-1">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="WrenchScrewdriverIcon" size={14} className="text-white/70" />
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">{ui.amal.latestUpdates}</span>
          <span className="mr-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30">v3.8</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: 'SpeakerWaveIcon', label: ui.amal.voicePlayer, desc: ui.amal.voiceDesc },
            { icon: 'PhotoIcon', label: ui.amal.attachImages, desc: ui.amal.attachDesc },
            { icon: 'ComputerDesktopIcon', label: ui.amal.uiStabilize, desc: ui.amal.uiStabilizeDesc },
            { icon: 'BoltIcon', label: ui.amal.hydrationFix, desc: ui.amal.hydrationDesc },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              <Icon name={item.icon as any} size={14} className="text-white/60 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-white/90 leading-tight">{item.label}</p>
                <p className="text-[10px] text-white/50 leading-tight">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Alerts Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Live Alerts */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Icon name="BellAlertIcon" size={16} className="text-red-500" />
                <span className="text-sm font-bold text-foreground">{ui.amal.liveAlerts}</span>
                {alerts.filter(a => a.level === 'critical').length > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {alerts.filter(a => a.level === 'critical').length}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">{alerts.length} {ui.amal.alerts}</span>
            </div>
            <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-6">
                  <Icon name="CheckCircleIcon" size={28} className="text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{ui.empty}</p>
                </div>
              ) : alerts.map(alert => (
                <div key={alert.id} className={`flex items-start gap-2.5 p-3 rounded-xl border ${alertColors[alert.level]}`}>
                  <Icon name={alertIcons[alert.level] as any} size={16} className={`${alertIconColors[alert.level]} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold leading-tight">{alert.title}</p>
                    <p className="text-[11px] mt-0.5 opacity-80 leading-tight">{alert.body}</p>
                    {alert.actionLabel && alert.actionTab && (
                      <button
                        onClick={() => onNavigate(alert.actionTab!)}
                        className="text-[10px] font-bold underline mt-1 opacity-90 hover:opacity-100"
                      >
                        {alert.actionLabel} ←
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Stats */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="ChartBarIcon" size={15} className="text-primary" />
              <span className="text-sm font-bold text-foreground">{language === 'ar' ? 'مؤشرات العمليات' : 'Operations KPIs'}</span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: language === 'ar' ? 'طلبات نشطة' : 'Active orders', value: orders.filter((o: any) => ['processing', 'shipped'].includes(o.status)).length, color: 'text-blue-600 bg-blue-50' },
                { label: language === 'ar' ? 'تسليمات ناجحة' : 'Successful deliveries', value: orders.filter((o: any) => o.status === 'delivered').length, color: 'text-emerald-600 bg-emerald-50' },
                { label: language === 'ar' ? 'نزاعات مفتوحة' : 'Open disputes', value: orders.filter((o: any) => o.dispute_status === 'reported').length, color: 'text-red-600 bg-red-50' },
                { label: language === 'ar' ? 'RFQs معلقة' : 'Pending RFQs', value: rfqs.filter((r: any) => r.status === 'pending' || r.status === 'submitted').length, color: 'text-amber-600 bg-amber-50' },
              ].map(stat => (
                <div key={stat.label} className={`${stat.color} rounded-lg p-3 flex items-center justify-between`}>
                  <p className="text-xs font-semibold leading-tight">{stat.label}</p>
                  <p className="text-xl font-bold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions for Amal */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="BoltIcon" size={15} className="text-amber-500" />
              <span className="text-sm font-bold text-foreground">{language === 'ar' ? 'أوامر سريعة للمرشد التنفيذي' : 'Executive Guide Quick Commands'}</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleOperationsMonitor}
                disabled={isLoading}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold rounded-xl hover:bg-violet-100 transition-colors disabled:opacity-50"
              >
                <Icon name="EyeIcon" size={14} />
                مراجعة عمليات المنصة الآن
                {isMonitoring && <Icon name="ArrowPathIcon" size={12} className="animate-spin ml-auto" />}
              </button>
              <button
                onClick={handleAnalytics}
                disabled={isLoading}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                <Icon name="ChartBarIcon" size={14} />
                تحليل بيانات المنصة الاستراتيجي
              </button>
              <button
                onClick={handlePlatformDiagnostic}
                disabled={isLoading}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Icon name="WrenchScrewdriverIcon" size={14} />
                فحص تشخيصي شامل للمنصة 🔧
              </button>
              <label className="w-full flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer">
                <Icon name="DocumentTextIcon" size={14} />
                {attachedFile ? attachedFile.name.slice(0, 22) + '…' : 'رفع مستند للتحليل'}
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileChange} className="hidden" />
              </label>
              {attachedFile && (
                <button
                  onClick={handleDocumentAnalysis}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <Icon name="MagnifyingGlassIcon" size={14} />
                  تحليل المستند الآن
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amal Chat */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl flex flex-col" style={{ minHeight: '520px' }}>
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-violet-600/10 to-purple-600/5 rounded-t-xl shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
              <Icon name="CpuChipIcon" size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{ui.amal.title}</p>
              <p className="text-[10px] text-muted-foreground">{ui.amal.subtitle}</p>
            </div>
            <button
              onClick={() => setMessages([])}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
            >
              مسح
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
                  <Icon name="CpuChipIcon" size={28} className="text-violet-600" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{language === 'ar' ? 'المرشد التنفيذي — مهندس المنصة جاهز' : 'Executive Guide — Platform Engineer Ready'}</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">{language === 'ar' ? 'اطلب مراجعة العمليات، فحصاً تشخيصياً شاملاً، تحليل البيانات، أو اسأل عن أي شيء يخص المنصة' : 'Ask for ops review, full diagnostics, data analysis, or anything about the platform'}</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                    <Icon name="SparklesIcon" size={13} className="text-violet-600" />
                  </div>
                )}
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ?'bg-violet-600 text-white rounded-br-sm' :'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.content ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-3 shrink-0 border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="اسأل المرشد التنفيذي عن العمليات، الطلبات، RFQs، الكودبيس، أو اطلب فحصاً تشخيصياً..."
                rows={1}
                className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 resize-none transition-colors"
                style={{ maxHeight: '100px' }}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 bg-violet-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95 shrink-0"
              >
                {isLoading ? <Icon name="ArrowPathIcon" size={16} className="animate-spin" /> : <Icon name="PaperAirplaneIcon" size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              {ui.amal.footer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Logistics Panel ────────────────────────────────────────────────────
function AdminLogisticsPanel() {
  const { t, dir, isRTL, language } = useLanguage();
  const ui = t.admin.logistics;

  const supabase = createClient();
  const [partners, setPartners] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState('');
  const [adminNote, setAdminNote] = React.useState('');
  const [selectedPartner, setSelectedPartner] = React.useState<any | null>(null);
  const [filterStatus, setFilterStatus] = React.useState('');
  const [filterCategoryGroup, setFilterCategoryGroup] = React.useState('');
  const [filterServiceScope, setFilterServiceScope] = React.useState('');
  const [searchQ, setSearchQ] = React.useState('');
  const [editMode, setEditMode] = React.useState(false);
  const [editForm, setEditForm] = React.useState<any>({});
  const [licenseVerified, setLicenseVerified] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => { fetchPartners(); }, []);

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('logistics_partners')
      .select('*')
      .order('created_at', { ascending: false });
    setPartners(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    setActionLoading(id + status);
    await supabase.from('logistics_partners').update({ status, admin_note: adminNote || null }).eq('id', id);
    await fetchPartners();
    setAdminNote('');
    setSelectedPartner(null);
    setActionLoading('');
  };

  const verifyLicense = async (id: string) => {
    setActionLoading(id + 'verify');
    await supabase.from('logistics_partners').update({
      verified_at: new Date().toISOString(),
      admin_note: (adminNote || '') + (adminNote ? ' | ' : '') + ui.licenseVerifiedNote,
    }).eq('id', id);
    setLicenseVerified(prev => ({ ...prev, [id]: true }));
    await fetchPartners();
    setActionLoading('');
  };

  const deletePartner = async (id: string) => {
    if (!confirm(ui.confirmDelete)) return;
    setActionLoading(id + 'delete');
    await supabase.from('logistics_partners').delete().eq('id', id);
    await fetchPartners();
    setSelectedPartner(null);
    setActionLoading('');
  };

  const saveEdit = async () => {
    if (!selectedPartner) return;
    setActionLoading('edit');
    await supabase.from('logistics_partners').update(editForm).eq('id', selectedPartner.id);
    await fetchPartners();
    setEditMode(false);
    setActionLoading('');
  };

  const filtered = partners.filter(p => {
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchGroup = !filterCategoryGroup || getCategoryGroup(p) === filterCategoryGroup;
    const matchScope = !filterServiceScope || p.service_scope === filterServiceScope;
    const q = searchQ.toLowerCase();
    const matchSearch = !q || p.company_name?.toLowerCase().includes(q) || p.country?.toLowerCase().includes(q);
    return matchStatus && matchGroup && matchScope && matchSearch;
  });

  const statusCounts = {
    pending: partners.filter(p => p.status === 'pending').length,
    approved: partners.filter(p => p.status === 'approved').length,
    rejected: partners.filter(p => p.status === 'rejected').length,
  };

  const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
    approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
    suspended: 'bg-gray-50 text-gray-700 border border-gray-200',
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: 'معلق',
    under_review: 'قيد المراجعة',
    approved: 'معتمد',
    rejected: 'مرفوض',
    suspended: 'موقوف',
  };

  const PARTNER_TYPE_LABELS: Record<string, string> = {
    international_shipping_office: 'مكتب شحن دولي',
    local_shipping_distribution: 'شحن وتوزيع محلي',
    customs_broker: 'مخلص جمركي',
    freight_forwarder: 'وكيل شحن دولي',
    logistics_company: 'شركة لوجستيات',
    shipping_office: 'مكتب شحن',
    sourcing_agent: 'وكيل مصادر',
  };

  const SERVICE_SCOPE_LABELS: Record<string, string> = {
    full_service: 'شامل (من الباب للباب)',
    specialized: 'متخصص / مقسّم',
  };

  const SPECIALIZED_ROLE_LABELS: Record<string, string> = {
    sourcing_pickup_china: 'مكتب المصادر / الاستلام في الصين',
    international_shipping: 'شحن دولي',
    customs_clearance: 'تخليص جمركي',
    local_delivery: 'توصيل محلي',
  };

  const PARTNER_CATEGORY_GROUPS = [
    { key: '', label: ui.allCategories },
    { key: 'international', label: ui.international },
    { key: 'local', label: ui.local },
    { key: 'customs', label: ui.customs },
  ];

  const getCategoryGroup = (p: any): string => {
    if (p.partner_category_group) return p.partner_category_group;
    if (p.partner_type === 'international_shipping_office' || p.partner_type === 'freight_forwarder') return 'international';
    if (p.partner_type === 'local_shipping_distribution' || p.partner_type === 'logistics_company' || p.partner_type === 'shipping_office') return 'local';
    if (p.partner_type === 'customs_broker') return 'customs';
    return 'other';
  };

  const CATEGORY_ICONS: Record<string, string> = {
    international: 'GlobeAltIcon',
    local: 'TruckIcon',
    customs: 'DocumentCheckIcon',
    other: 'BuildingOffice2Icon',
  };

  const CATEGORY_COLORS: Record<string, string> = {
    international: 'text-blue-600',
    local: 'text-emerald-600',
    customs: 'text-violet-600',
    other: 'text-gray-600',
  };

  const CATEGORY_BG: Record<string, string> = {
    international: 'bg-blue-100',
    local: 'bg-emerald-100',
    customs: 'bg-violet-100',
    other: 'bg-gray-100',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Icon name="TruckIcon" size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{t.admin.tabs.logistics}</h2>
            <p className="text-xs text-muted-foreground">{language === "ar" ? "التحقق من الشركاء، الاعتماد، والتحكم الكامل — 3 فئات" : "Partner verification, approval, and full control — 3 categories"}</p>
          </div>
        </div>
        <button onClick={fetchPartners} className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-xl text-sm font-semibold hover:bg-muted/80 transition-colors">
          <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Category Group KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: ui.international, group: 'international', icon: 'GlobeAltIcon', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: ui.local, group: 'local', icon: 'TruckIcon', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: ui.customs, group: 'customs', icon: 'DocumentCheckIcon', color: 'bg-violet-50 border-violet-200 text-violet-700' },
          { label: ui.pendingReview, group: null, icon: 'ClockIcon', color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm ${kpi.color} ${
              kpi.group && filterCategoryGroup === kpi.group ? 'ring-2 ring-offset-1 ring-current' : ''
            }`}
            onClick={() => kpi.group && setFilterCategoryGroup(filterCategoryGroup === kpi.group ? '' : kpi.group)}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon name={kpi.icon as any} size={14} />
              <span className="text-[11px] font-semibold">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold">
              {kpi.group
                ? partners.filter(p => getCategoryGroup(p) === kpi.group).length
                : statusCounts.pending}
            </p>
          </div>
        ))}
      </div>

      {/* Service Scope KPI Row */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: ui.fullService, scope: 'full_service', icon: 'ArrowsRightLeftIcon', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { label: ui.specialized, scope: 'specialized', icon: 'PuzzlePieceIcon', color: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map((kpi, i) => (
          <div
            key={i}
            className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm ${kpi.color} ${
              filterServiceScope === kpi.scope ? 'ring-2 ring-offset-1 ring-current' : ''
            }`}
            onClick={() => setFilterServiceScope(filterServiceScope === kpi.scope ? '' : kpi.scope)}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon name={kpi.icon as any} size={14} />
              <span className="text-[11px] font-semibold">{kpi.label}</span>
            </div>
            <p className="text-xl font-bold">
              {partners.filter(p => p.service_scope === kpi.scope).length}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="MagnifyingGlassIcon" size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="بحث بالاسم أو الدولة..."
            className="w-full h-10 pr-9 pl-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterCategoryGroup}
          onChange={e => setFilterCategoryGroup(e.target.value)}
          className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
        >
          {PARTNER_CATEGORY_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <select
          value={filterServiceScope}
          onChange={e => setFilterServiceScope(e.target.value)}
          className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
        >
          <option value="">كل نطاقات الخدمة</option>
          <option value="full_service">شامل (من الباب للباب)</option>
          <option value="specialized">متخصص / مقسّم</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Partners Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="TruckIcon" size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{t.admin.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(partner => {
            const catGroup = getCategoryGroup(partner);
            const catIcon = CATEGORY_ICONS[catGroup] || 'TruckIcon';
            const catColor = CATEGORY_COLORS[catGroup] || 'text-gray-600';
            const catBg = CATEGORY_BG[catGroup] || 'bg-gray-100';
            return (
            <div key={partner.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${catBg} flex items-center justify-center shrink-0`}>
                  <Icon name={catIcon as any} size={18} className={catColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground">{partner.company_name}</p>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${STATUS_BADGE[partner.status] || ''}`}>
                      {STATUS_LABELS[partner.status] || partner.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                      catGroup === 'international' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      catGroup === 'local' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      catGroup === 'customs' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                      'bg-muted text-muted-foreground border-border'
                    }`}>
                      {PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}
                    </span>
                    {partner.service_scope && (
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                        partner.service_scope === 'full_service' ?'bg-indigo-50 text-indigo-700 border-indigo-200' :'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {SERVICE_SCOPE_LABELS[partner.service_scope] || partner.service_scope}
                      </span>
                    )}
                    {partner.verified_at && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                        <Icon name="ShieldCheckIcon" size={10} />
                        رخصة موثّقة
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{partner.city}، {partner.country} — {partner.contact_email}</p>
                  {partner.specialized_role && (
                    <p className="text-[10px] text-orange-600 mt-0.5">الدور: {SPECIALIZED_ROLE_LABELS[partner.specialized_role] || partner.specialized_role}</p>
                  )}
                  {partner.operating_hub && (
                    <p className="text-[10px] text-blue-600 mt-0.5">يعمل من: {partner.operating_hub}</p>
                  )}
                  {partner.local_coverage_country && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">يغطي: {partner.local_coverage_country}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {partner.origin_countries?.slice(0, 3).map((c: string) => (
                      <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">{c}</span>
                    ))}
                    {(partner.origin_countries?.length || 0) > 3 && <span className="text-[10px] text-muted-foreground">+{partner.origin_countries.length - 3}</span>}
                    {partner.origin_countries?.length > 0 && partner.destination_countries?.length > 0 && (
                      <Icon name="ArrowLeftIcon" size={10} className="text-muted-foreground self-center" />
                    )}
                    {partner.destination_countries?.slice(0, 3).map((c: string) => (
                      <span key={c} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px]">{c}</span>
                    ))}
                    {(partner.destination_countries?.length || 0) > 3 && <span className="text-[10px] text-muted-foreground">+{partner.destination_countries.length - 3}</span>}
                  </div>
                  {partner.sla_agreed && (
                    <div className="flex items-center gap-1 mt-1">
                      <Icon name="CheckCircleIcon" size={12} className="text-emerald-500" />
                      <span className="text-[10px] text-emerald-600">وقّع على اتفاقية SLA</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedPartner(partner); setEditForm({ ...partner }); setEditMode(false); setAdminNote(partner.admin_note || ''); }}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
                >
                  إدارة
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Partner Management Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                <Icon name="TruckIcon" size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-foreground">{selectedPartner.company_name}</p>
                <p className="text-xs text-muted-foreground">{selectedPartner.city}، {selectedPartner.country}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedPartner(null); setEditMode(false); }} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {editMode ? (
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-sm">تعديل بيانات الشريك</h3>
                {[
                  { label: ui.companyName, field: 'company_name' },
                  { label: ui.city, field: 'city' },
                  { label: ui.country, field: 'country' },
                  { label: ui.address, field: 'address' },
                  { label: ui.email, field: 'contact_email' },
                  { label: ui.phone, field: 'contact_phone' },
                  { label: ui.operatingHub, field: 'operating_hub' },
                  { label: ui.localCoverage, field: 'local_coverage_country' },
                  { label: ui.baseRate, field: 'base_rate_usd' },
                  { label: ui.rateDesc, field: 'rate_description' },
                ].map(f => (
                  <div key={f.field}>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                    <input
                      value={editForm[f.field] || ''}
                      onChange={e => setEditForm((prev: any) => ({ ...prev, [f.field]: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
                {/* Service Scope Edit */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">نطاق الخدمة</label>
                  <select
                    value={editForm.service_scope || ''}
                    onChange={e => setEditForm((prev: any) => ({ ...prev, service_scope: e.target.value, specialized_role: e.target.value === 'full_service' ? null : prev.specialized_role }))}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">— اختر نطاق الخدمة —</option>
                    <option value="full_service">شامل (من الباب للباب)</option>
                    <option value="specialized">متخصص / مقسّم</option>
                  </select>
                </div>
                {editForm.service_scope === 'specialized' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">الدور المتخصص</label>
                    <select
                      value={editForm.specialized_role || ''}
                      onChange={e => setEditForm((prev: any) => ({ ...prev, specialized_role: e.target.value }))}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="">— اختر الدور —</option>
                      <option value="sourcing_pickup_china">مكتب المصادر / الاستلام في الصين</option>
                      <option value="international_shipping">شحن دولي</option>
                      <option value="customs_clearance">تخليص جمركي</option>
                      <option value="local_delivery">توصيل محلي</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditMode(false)} className="flex-1 h-10 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
                    إلغاء
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={actionLoading === 'edit'}
                    className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    {actionLoading === 'edit' ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="CheckIcon" size={14} />}
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Partner Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: ui.partnerType, value: PARTNER_TYPE_LABELS[selectedPartner.partner_type] || selectedPartner.partner_type },
                    { label: t.admin.status, value: STATUS_LABELS[selectedPartner.status] || selectedPartner.status },
                    { label: ui.country, value: selectedPartner.country },
                    { label: ui.city, value: selectedPartner.city },
                    { label: ui.email, value: selectedPartner.contact_email },
                    { label: ui.phone, value: selectedPartner.contact_phone },
                    { label: 'المركز الصناعي', value: selectedPartner.operating_hub || '—' },
                    { label: ui.localCoverage, value: selectedPartner.local_coverage_country || '—' },
                    { label: ui.slaAgreed, value: selectedPartner.sla_agreed ? ui.slaSigned : ui.slaNotSigned },
                    { label: ui.baseRate, value: selectedPartner.base_rate_usd ? `$${selectedPartner.base_rate_usd}` : '—' },
                  ].map((item, i) => (
                    <div key={i} className="bg-muted/30 rounded-lg p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">{item.label}</p>
                      <p className="text-xs font-semibold text-foreground">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {/* Service Scope & Specialized Role */}
                <div className="p-3 bg-muted/30 rounded-xl space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">نطاق الخدمة</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                      selectedPartner.service_scope === 'full_service' ?'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : selectedPartner.service_scope === 'specialized' ?'bg-orange-50 text-orange-700 border-orange-200' :'bg-muted text-muted-foreground border-border'
                    }`}>
                      {SERVICE_SCOPE_LABELS[selectedPartner.service_scope] || 'غير محدد'}
                    </span>
                    {selectedPartner.specialized_role && (
                      <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                        {SPECIALIZED_ROLE_LABELS[selectedPartner.specialized_role] || selectedPartner.specialized_role}
                      </span>
                    )}
                  </div>
                  {selectedPartner.verified_at && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Icon name="ShieldCheckIcon" size={13} className="text-teal-600" />
                      <span className="text-xs text-teal-700 font-semibold">
                        تم التحقق من الرخصة — {formatDate(selectedPartner.verified_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Routes */}
                {(selectedPartner.origin_countries?.length > 0 || selectedPartner.destination_countries?.length > 0) && (
                  <div className="p-3 bg-muted/30 rounded-xl">
                    <p className="text-xs font-bold text-muted-foreground mb-2">المسارات</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPartner.origin_countries?.map((c: string) => (
                        <span key={c} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{c}</span>
                      ))}
                      <Icon name="ArrowLeftIcon" size={12} className="text-muted-foreground self-center mx-1" />
                      {selectedPartner.destination_countries?.map((c: string) => (
                        <span key={c} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* License Documents */}
                {(selectedPartner.trade_license_url || selectedPartner.customs_license_url || selectedPartner.insurance_certificate_url) && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground">الوثائق المرفوعة</p>
                    {selectedPartner.trade_license_url && (
                      <a href={selectedPartner.trade_license_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg hover:bg-muted transition-colors">
                        <Icon name="DocumentTextIcon" size={16} className="text-blue-600" />
                        <span className="text-xs text-foreground">{selectedPartner.trade_license_filename || 'رخصة التجارة'}</span>
                        <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground mr-auto" />
                      </a>
                    )}
                    {selectedPartner.customs_license_url && (
                      <a href={selectedPartner.customs_license_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg hover:bg-muted transition-colors">
                        <Icon name="DocumentCheckIcon" size={16} className="text-emerald-600" />
                        <span className="text-xs text-foreground">{selectedPartner.customs_license_filename || 'رخصة التخليص'}</span>
                        <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground mr-auto" />
                      </a>
                    )}
                    {selectedPartner.insurance_certificate_url && (
                      <a href={selectedPartner.insurance_certificate_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg hover:bg-muted transition-colors">
                        <Icon name="ShieldCheckIcon" size={16} className="text-violet-600" />
                        <span className="text-xs text-foreground">{selectedPartner.insurance_certificate_filename || 'شهادة التأمين'}</span>
                        <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground mr-auto" />
                      </a>
                    )}
                  </div>
                )}

                {/* Admin Note */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ملاحظة المدير</label>
                  <textarea
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="أضف ملاحظة للشريك..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateStatus(selectedPartner.id, 'approved')}
                    disabled={!!actionLoading || selectedPartner.status === 'approved'}
                    className="h-10 bg-emerald-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {actionLoading === selectedPartner.id + 'approved' ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="CheckCircleIcon" size={13} />}
                    اعتماد الشريك
                  </button>
                  <button
                    onClick={() => updateStatus(selectedPartner.id, 'under_review')}
                    disabled={!!actionLoading}
                    className="h-10 bg-blue-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="MagnifyingGlassIcon" size={13} />
                    قيد المراجعة
                  </button>
                  <button
                    onClick={() => verifyLicense(selectedPartner.id)}
                    disabled={!!actionLoading || !!selectedPartner.verified_at}
                    className="h-10 bg-teal-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {actionLoading === selectedPartner.id + 'verify' ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="ShieldCheckIcon" size={13} />}
                    {selectedPartner.verified_at ? 'رخصة موثّقة ✓' : 'التحقق من الرخصة'}
                  </button>
                  <button
                    onClick={() => updateStatus(selectedPartner.id, 'rejected')}
                    disabled={!!actionLoading}
                    className="h-10 bg-red-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="XCircleIcon" size={13} />
                    رفض الطلب
                  </button>
                  <button
                    onClick={() => updateStatus(selectedPartner.id, 'suspended')}
                    disabled={!!actionLoading}
                    className="h-10 bg-gray-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-gray-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="PauseCircleIcon" size={13} />
                    تعليق الحساب
                  </button>
                </div>

                <div className="flex gap-2 pt-1 border-t border-border">
                  <button
                    onClick={() => setEditMode(true)}
                    className="flex-1 h-9 border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="PencilSquareIcon" size={13} />
                    تعديل البيانات
                  </button>
                  <button
                    onClick={() => deletePartner(selectedPartner.id)}
                    disabled={!!actionLoading}
                    className="flex-1 h-9 border border-red-200 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Icon name="TrashIcon" size={13} />
                    حذف نهائي
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminControlRoomPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin;
  const ROLE_LABELS = ROLE_LABELS_I18N[language] || ROLE_LABELS_I18N.en;
  const supabase = createClient();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Drill-down modal state
  const [drillDown, setDrillDown] = useState<null | 'revenue' | 'orders' | 'factories' | 'commission' | 'users' | 'disputes' | 'pending'>(null);

  // Bulk selection state
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Sorting state
  const [userSort, setUserSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });
  const [factorySort, setFactorySort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'submitted_at', dir: 'desc' });

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalOrders: 0, totalRevenue: 0, platformCommission: 0,
    activeFactories: 0, pendingVerifications: 0, totalUsers: 0,
    googleUsers: 0, facebookUsers: 0, otherUsers: 0,
    deliveredOrders: 0, disputedOrders: 0,
    totalBuyers: 0, totalManufacturers: 0, recentSignups: 0,
    newUsersYesterday: 0, newFactoriesYesterday: 0,
    revenueGrowth: '0%',
    agentFactoriesCount: 0, totalProducts: 0, logisticsPartnersCount: 0,
  });

  // Visitor Traffic Analytics
  const [visitorStats, setVisitorStats] = useState<{
    today: { views: number; unique: number; registered: number; anonymous: number };
    yesterday: { views: number; unique: number };
    last7: { views: number; unique: number };
    last30: { views: number; unique: number };
    dailyBreakdown: { date: string; views: number; unique: number }[];
  } | null>(null);
  const [visitorLoading, setVisitorLoading] = useState(false);

  const fetchVisitorStats = useCallback(async () => {
    setVisitorLoading(true);
    try {
      const res = await fetch('/api/track-visit');
      if (res.ok) {
        const data = await res.json();
        setVisitorStats(data);
      }
    } catch { /* silent */ } finally {
      setVisitorLoading(false);
    }
  }, []);

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchAll(false), fetchVisitorStats()]);
    } catch (error) {
      console.error('Failed to refresh data', error);
    } finally {
      setLoading(false);
    }
  };

  // Live data for Amal
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [liveRFQs, setLiveRFQs] = useState<any[]>([]);

  // Escrow management state
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [selectedEscrowOrder, setSelectedEscrowOrder] = useState<any | null>(null);
  const [escrowActionLoading, setEscrowActionLoading] = useState(false);
  const [escrowReleaseNote, setEscrowReleaseNote] = useState('');
  const [escrowFactoryId, setEscrowFactoryId] = useState('');
  const [escrowSubTab, setEscrowSubTab] = useState<'orders' | 'payout' | 'analytics' | 'disputes' | 'bank_accounts'>('orders');
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);
  const [invoiceSuccess, setInvoiceSuccess] = useState('');

  // Bank accounts management state
  const [allBankAccounts, setAllBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [bankAccountActionLoading, setBankAccountActionLoading] = useState(false);
  const [bankAccountNote, setBankAccountNote] = useState('');
  const [selectedPayoutBankAccount, setSelectedPayoutBankAccount] = useState<string>('');
  const [factoryBankAccounts, setFactoryBankAccounts] = useState<BankAccount[]>([]);
  const [factoryBankLoading, setFactoryBankLoading] = useState(false);
  const [factoryIntlWallets, setFactoryIntlWallets] = useState<Record<string, string> | null>(null);
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<'bank' | 'intl_wallet'>('bank');

  // Dispute management state
  const [disputeOrders, setDisputeOrders] = useState<any[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [selectedDisputeOrder, setSelectedDisputeOrder] = useState<any | null>(null);
  const [disputeActionLoading, setDisputeActionLoading] = useState(false);
  const [disputeResolutionNote, setDisputeResolutionNote] = useState('');
  const [disputeActionMsg, setDisputeActionMsg] = useState('');

  // Verification Queue
  const [verificationQueue, setVerificationQueue] = useState<FactoryRegistration[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<FactoryRegistration | null>(null);
  const [verifFilter, setVerifFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');
  const [adminNote, setAdminNote] = useState('');

  // Users Management
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'buyer' | 'manufacturer' | 'admin'>('all');
  const [showNewUsersOnly, setShowNewUsersOnly] = useState(false);
  const [editUserForm, setEditUserForm] = useState<Partial<UserProfile>>({});
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Supplier Documents (for edit modal)
  const [supplierDocs, setSupplierDocs] = useState<FactoryRegistration | null>(null);
  const [supplierDocsLoading, setSupplierDocsLoading] = useState(false);

  // Factories Management
  const [factories, setFactories] = useState<FactoryRegistration[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<FactoryRegistration | null>(null);
  const [factorySearch, setFactorySearch] = useState('');
  const [factoryStatusFilter, setFactoryStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  // Messages Monitor state
  const [allConversations, setAllConversations] = useState<any[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<any[]>([]);
  const [convMsgsLoading, setConvMsgsLoading] = useState(false);
  const [convSearch, setConvSearch] = useState('');

  // Direct Orders Messaging state
  const [directConvs, setDirectConvs] = useState<any[]>([]);
  const [directConvsLoading, setDirectConvsLoading] = useState(false);
  const [selectedDirectConvId, setSelectedDirectConvId] = useState<string | null>(null);
  const [directMessages, setDirectMessages] = useState<any[]>([]);
  const [directMsgsLoading, setDirectMsgsLoading] = useState(false);
  const [directInput, setDirectInput] = useState('');
  const [directSending, setDirectSending] = useState(false);
  const [directMsgType, setDirectMsgType] = useState<'text' | 'order' | 'instruction'>('text');
  const [directPriority, setDirectPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [directFactorySearch, setDirectFactorySearch] = useState('');
  const [directAttachment, setDirectAttachment] = useState<{ file: File; name: string } | null>(null);
  const directMsgsEndRef = React.useRef<HTMLDivElement>(null);
  const directFileInputRef = React.useRef<HTMLInputElement>(null);

  // Platform Settings state
  const [platformSettings, setPlatformSettings] = useState<Record<string, string>>({});
  const [platformSettingsLoading, setPlatformSettingsLoading] = useState(false);
  const [platformSettingsSaving, setPlatformSettingsSaving] = useState<string | null>(null);
  const [platformSettingsForm, setPlatformSettingsForm] = useState<Record<string, string>>({});
  const [platformSettingsMsg, setPlatformSettingsMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Pending Products state ──────────────────────────────────────────────────
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [pendingProductsLoading, setPendingProductsLoading] = useState(false);
  const [productActionLoading, setProductActionLoading] = useState<string | null>(null);
  const [productActionMsg, setProductActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Payments & Transactions state ──────────────────────────────────────────
  const [allPayments, setAllPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [paymentNote, setPaymentNote] = useState('');

  // ── Accounts & Balances state ───────────────────────────────────────────────
  const [accountsData, setAccountsData] = useState<{
    users: any[];
    wallets: any[];
    commissions: any[];
    invoices: any[];
  }>({ users: [], wallets: [], commissions: [], invoices: [] });
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountsSubTab, setAccountsSubTab] = useState<'overview' | 'wallets' | 'commissions' | 'invoices'>('overview');

  // Field Agents state
  const [fieldAgents, setFieldAgents] = useState<any[]>([]);
  const [agentFactories, setAgentFactories] = useState<any[]>([]);
  const [agentProducts, setAgentProducts] = useState<any[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [pendingLicenses, setPendingLicenses] = useState<any[]>([]);
  const [licenseActionLoading, setLicenseActionLoading] = useState<string | null>(null);
  const [licenseRejectNote, setLicenseRejectNote] = useState('');
  const [selectedLicenseFactory, setSelectedLicenseFactory] = useState<any | null>(null);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentFactoryFilter, setAgentFactoryFilter] = useState<string>('all');

  // Page Directory state (must be at top level — cannot be inside conditional IIFE)
  const [dirSearch, setDirSearch] = useState('');
  const [dirCategory, setDirCategory] = useState<string>('all');

  // Lazy-load flags — prevent repeated fetches when switching tabs
  const [escrowLoaded, setEscrowLoaded] = useState(false);
  const [disputesLoaded, setDisputesLoaded] = useState(false);
  const [platformSettingsLoaded, setPlatformSettingsLoaded] = useState(false);

  const isAdmin = user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const showError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4000); };

  // ── Test Account Simulation ──────────────────────────────────────────────────
  const [testAccountLoading, setTestAccountLoading] = useState<string | null>(null);

  const handleCreateTestAccount = async (role: 'international_factory' | 'local_factory' | 'logistics') => {
    setTestAccountLoading(role);
    try {
      const res = await fetch('/api/admin/create-test-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`✅ تم إنشاء/فحص حساب الاختبار (${role}) بنجاح!`);
      } else {
        showError(`❌ خطأ: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      showError('حدث خطأ أثناء تنفيذ الطلب');
    } finally {
      setTestAccountLoading(null);
    }
  };

  // ── Audit Log Export ─────────────────────────────────────────────────────────
  const [auditExporting, setAuditExporting] = useState(false);

  const handleExportAuditLog = async () => {
    setAuditExporting(true);
    try {
      const [ordersRes, factoriesRes, kycRes, escrowRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, escrow_status, total, payment_verified, payment_verified_at, funds_released_at, dispute_status, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(500),
        supabase
          .from('factory_registrations')
          .select('id, company_name, registration_status, kyc_status, admin_note, reviewed_at, submitted_at')
          .order('reviewed_at', { ascending: false })
          .limit(500),
        supabase
          .from('manual_review_queue')
          .select('id, company_name, source_type, status, admin_note, reviewed_at, created_at')
          .order('reviewed_at', { ascending: false })
          .limit(200),
        supabase
          .from('escrow_phases')
          .select('id, order_id, phase_name, phase_type, status, amount_usd, released_at, admin_note, created_at')
          .order('released_at', { ascending: false })
          .limit(300),
      ]);

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const rows: string[][] = [
        ['DirectHub — سجل التدقيق الشامل / Comprehensive Audit Log'],
        [`تاريخ التصدير / Export Date: ${dateStr} ${timeStr}`],
        [],
        ['═══════════════════════════════════════════════════════════════'],
        ['SECTION 1: ORDER & ESCROW AUDIT LOG'],
        ['═══════════════════════════════════════════════════════════════'],
        ['Order ID', 'Order Number', 'Status', 'Escrow Status', 'Total ($)', 'Payment Verified', 'Funds Released At', 'Dispute Status', 'Created At', 'Updated At'],
        ...(ordersRes.data || []).map((o: any) => [
          o.id || '',
          o.order_number || '',
          o.status || '',
          o.escrow_status || '',
          String(o.total || 0),
          o.payment_verified ? 'Yes' : 'No',
          o.funds_released_at || '',
          o.dispute_status || 'none',
          o.created_at || '',
          o.updated_at || '',
        ]),
        [],
        ['═══════════════════════════════════════════════════════════════'],
        ['SECTION 2: KYC & FACTORY VERIFICATION AUDIT LOG'],
        ['═══════════════════════════════════════════════════════════════'],
        ['Factory ID', 'Company Name', 'Registration Status', 'KYC Status', 'Admin Note', 'Reviewed At', 'Submitted At'],
        ...(factoriesRes.data || []).map((f: any) => [
          f.id || '',
          f.company_name || '',
          f.registration_status || '',
          f.kyc_status || '',
          (f.admin_note || '').replace(/,/g, ';'),
          f.reviewed_at || '',
          f.submitted_at || '',
        ]),
        [],
        ['═══════════════════════════════════════════════════════════════'],
        ['SECTION 3: MANUAL REVIEW QUEUE AUDIT LOG'],
        ['═══════════════════════════════════════════════════════════════'],
        ['Review ID', 'Company Name', 'Source Type', 'Status', 'Admin Note', 'Reviewed At', 'Created At'],
        ...(kycRes.data || []).map((k: any) => [
          k.id || '',
          k.company_name || '',
          k.source_type || '',
          k.status || '',
          (k.admin_note || '').replace(/,/g, ';'),
          k.reviewed_at || '',
          k.created_at || '',
        ]),
        [],
        ['═══════════════════════════════════════════════════════════════'],
        ['SECTION 4: ESCROW PHASES RELEASE AUDIT LOG'],
        ['═══════════════════════════════════════════════════════════════'],
        ['Phase ID', 'Order ID', 'Phase Name', 'Phase Type', 'Status', 'Amount ($)', 'Released At', 'Admin Note', 'Created At'],
        ...(escrowRes.data || []).map((p: any) => [
          p.id || '',
          p.order_id || '',
          (p.phase_name || '').replace(/,/g, ';'),
          p.phase_type || '',
          p.status || '',
          String(p.amount_usd || 0),
          p.released_at || '',
          (p.admin_note || '').replace(/,/g, ';'),
          p.created_at || '',
        ]),
      ];

      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv, { type: 'text/csv;charset=utf-8;' }] as any, { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `directhub_audit_log_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('✅ تم تصدير سجل التدقيق بنجاح — ' + (
        (ordersRes.data?.length || 0) + (factoriesRes.data?.length || 0) + (kycRes.data?.length || 0) + (escrowRes.data?.length || 0)
      ) + ' سجل');
    } catch (err: any) {
      showError('فشل تصدير سجل التدقيق: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setAuditExporting(false);
    }
  };

  const fetchFieldAgentsData = useCallback(async () => {
    if (!isAdmin) return;
    setAgentLoading(true);
    try {
      const [agentsRes, agentFactoriesRes, agentProductsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('role', 'field_agent').order('created_at', { ascending: false }),
        supabase.from('agent_factory_registrations').select('*, agent:user_profiles!agent_id(full_name, email)').order('created_at', { ascending: false }),
        supabase.from('agent_products').select('*').order('created_at', { ascending: false }),
      ]);
      if (agentsRes.data) setFieldAgents(agentsRes.data);
      if (agentFactoriesRes.data) {
        setAgentFactories(agentFactoriesRes.data);
        const pending = agentFactoriesRes.data.filter((f: any) => f.license_submitted_at && f.registration_status === 'pending');
        setPendingLicenses(pending);
      }
      if (agentProductsRes.data) setAgentProducts(agentProductsRes.data);
    } catch (err) {
      console.error('Error fetching field agents data:', err);
    } finally {
      setAgentLoading(false);
    }
  }, [isAdmin, supabase]);

  const handleLicenseApprove = async (factoryId: string) => {
    setLicenseActionLoading(factoryId);
    try {
      const { error } = await supabase
        .from('agent_factory_registrations')
        .update({
          registration_status: 'approved',
          contact_status: 'approved',
          license_reviewed_at: new Date().toISOString(),
          license_reviewed_by: user?.id,
        })
        .eq('id', factoryId);
      if (error) throw error;
      showSuccess('تم اعتماد الترخيص بنجاح');
      fetchFieldAgentsData();
    } catch (err: any) {
      showError(err.message || 'حدث خطأ أثناء الاعتماد');
    } finally {
      setLicenseActionLoading(null);
    }
  };

  const handleLicenseReject = async (factoryId: string, reason: string) => {
    setLicenseActionLoading(factoryId);
    try {
      const { error } = await supabase
        .from('agent_factory_registrations')
        .update({
          registration_status: 'rejected',
          contact_status: 'rejected',
          license_reviewed_at: new Date().toISOString(),
          license_reviewed_by: user?.id,
          license_rejection_reason: reason,
          admin_note: reason,
        })
        .eq('id', factoryId);
      if (error) throw error;
      showSuccess('تم رفض الترخيص وإشعار المندوب');
      setSelectedLicenseFactory(null);
      setLicenseRejectNote('');
      fetchFieldAgentsData();
    } catch (err: any) {
      showError(err.message || 'حدث خطأ أثناء الرفض');
    } finally {
      setLicenseActionLoading(null);
    }
  };

  // ── Fetch Payments ──────────────────────────────────────────────────────────
  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, status, payment_method, payment_verified, payment_verified_at, escrow_status, created_at, updated_at, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllPayments(data || []);
    } catch (err: any) {
      showError(err.message || 'فشل تحميل المدفوعات');
    } finally {
      setPaymentsLoading(false);
    }
  };

  // ── Fetch Accounts & Balances ───────────────────────────────────────────────
  const fetchAccountsData = async () => {
    setAccountsLoading(true);
    try {
      const [usersRes, commissionsRes, invoicesRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email, company_name, role, is_verified, created_at').order('created_at', { ascending: false }),
        supabase.from('platform_commissions').select('*').order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(200),
      ]);
      setAccountsData({
        users: usersRes.data || [],
        wallets: [],
        commissions: commissionsRes.data || [],
        invoices: invoicesRes.data || [],
      });
    } catch (err: any) {
      showError(err.message || 'فشل تحميل بيانات الحسابات');
    } finally {
      setAccountsLoading(false);
    }
  };

  // ── Auth Guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user && !isAdmin) { router.push('/'); }
  }, [user, authLoading, isAdmin, router]);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (backgroundRefresh = false) => {
    if (!isAdmin) return;
    if (!backgroundRefresh) setLoading(true);
    try {
      const [
        ordersRes, factoriesRes, usersRes, commissionsRes, rfqsRes,
        agentFactoriesRes, productsRes, logisticsRes, activeFactoriesRes,
      ] = await Promise.all([
        supabase.from('orders').select('id, total, status, payment_verified, dispute_status, funds_released_at, updated_at, created_at').order('created_at', { ascending: false }),
        supabase.from('factory_registrations').select('*, user_profiles!factory_registrations_user_id_fkey(full_name, email, company_name, registration_source)').order('submitted_at', { ascending: false }),
        supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('platform_commissions').select('commission_amount'),
        supabase.from('rfq_requests').select('id, status, urgency, product_id, quantity, created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('agent_factory_registrations').select('id, registration_status, created_at', { count: 'exact' }),
        supabase.from('manufacturer_products').select('id', { count: 'exact' }).limit(1),
        supabase.from('logistics_partners').select('id', { count: 'exact' }).limit(1),
        supabase.from('factory_registrations').select('id', { count: 'exact', head: true }).or('registration_status.eq.approved,is_approved.eq.true').eq('is_active', true),
      ]);

      const allOrders = ordersRes.data || [];
      if (ordersRes.error) console.error('[Control Room] orders fetch error:', ordersRes.error.message);

      const allFactories = (factoriesRes.data || []) as FactoryRegistration[];
      if (factoriesRes.error) console.error('[Control Room] factory_registrations fetch error:', factoriesRes.error.message);

      const allUsers = (usersRes.data || []) as UserProfile[];
      const allCommissions = commissionsRes.data || [];
      const allRFQs = rfqsRes.data || [];
      const agentFactoriesData = agentFactoriesRes.data || [];
      const agentFactoriesCount = agentFactoriesRes.count ?? agentFactoriesData.length;
      const totalProducts = productsRes.count ?? 0;
      const logisticsPartnersCount = logisticsRes.count ?? 0;

      // Active factories: prefer dedicated count query, fall back to client-side filter
      const activeFactories = activeFactoriesRes.count !== null && activeFactoriesRes.count !== undefined
        ? activeFactoriesRes.count
        : allFactories.filter(f => (f.registration_status === 'approved' || f.is_approved) && f.is_active !== false).length;

      setLiveOrders(allOrders);
      setLiveRFQs(allRFQs);

      const totalRevenue = allOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
      const totalCommission = allCommissions.reduce((s: number, c: any) => s + (c.commission_amount || 0), 0);
      const deliveredOrders = allOrders.filter((o: any) => o.status === 'delivered').length;
      const disputedOrders = allOrders.filter((o: any) => o.dispute_status === 'reported').length;
      const pendingVerifications = allFactories.filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review').length;
      const activeFactoriesCount = activeFactories;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentSignups = allUsers.filter(u => new Date(u.created_at) > thirtyDaysAgo).length;

      // Since yesterday (last 24 hours)
      const yesterdayStart = new Date();
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);
      const newUsersYesterday = allUsers.filter(u => new Date(u.created_at) >= yesterdayStart).length;
      const newFactoriesYesterday = allFactories.filter(f => new Date(f.submitted_at || f.documents_submitted_at || '') >= yesterdayStart).length;

      // Real month-over-month revenue growth
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonthRevenue = allOrders
        .filter((o: any) => new Date(o.created_at) >= thisMonthStart)
        .reduce((s: number, o: any) => s + (o.total || 0), 0);
      const lastMonthRevenue = allOrders
        .filter((o: any) => new Date(o.created_at) >= lastMonthStart && new Date(o.created_at) < thisMonthStart)
        .reduce((s: number, o: any) => s + (o.total || 0), 0);
      let revenueGrowth = '—';
      if (lastMonthRevenue > 0) {
        const growthPct = Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
        revenueGrowth = (growthPct >= 0 ? '+' : '') + growthPct + '%';
      } else if (thisMonthRevenue > 0) {
        revenueGrowth = '+100%';
      }

      let googleUsers = 0, facebookUsers = 0, otherUsers = 0;
      allUsers.forEach(u => {
        const email = (u.email || '').toLowerCase();
        if (email.includes('@gmail.com')) googleUsers++;
        else if (email.includes('@facebook.com') || email.includes('@fb.com')) facebookUsers++;
        else otherUsers++;
      });

      setAnalytics({
        totalOrders: allOrders.length,
        totalRevenue,
        platformCommission: totalCommission > 0 ? totalCommission : totalRevenue * 0.035,
        activeFactories: activeFactoriesCount,
        pendingVerifications,
        totalUsers: allUsers.length,
        googleUsers,
        facebookUsers,
        otherUsers,
        deliveredOrders,
        disputedOrders,
        totalBuyers: allUsers.filter(u => u.role === 'buyer').length,
        totalManufacturers: allUsers.filter(u => u.role === 'manufacturer').length,
        recentSignups,
        newUsersYesterday,
        newFactoriesYesterday,
        revenueGrowth,
        agentFactoriesCount,
        totalProducts,
        logisticsPartnersCount,
      });

      setVerificationQueue(allFactories);
      setFactories(allFactories);
      setUsers(allUsers);
    } catch (err: any) {
      console.error('fetchAll error:', err);
      showError(err.message || 'فشل تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchAll();
      fetchVisitorStats();
    }
  }, [user, isAdmin]);

  // ── Real-time subscription for Amal alerts ──────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rfq_requests' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'factory_registrations' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_factory_registrations' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'manufacturer_products' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logistics_partners' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_profiles' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_conversations' }, () => {
        fetchAll(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        // Lightweight refresh — only update live order/rfq counts, not full reload
        fetchAll(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  // ── Periodic auto-refresh (5 min) as live-data safety net ──────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      fetchAll(true);
      fetchVisitorStats();
    }, 300000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ── Bulk Verification Actions ───────────────────────────────────────────────
  const handleBulkApprove = async () => {
    if (bulkSelected.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(bulkSelected);
      const { error } = await supabase
        .from('factory_registrations')
        .update({
          registration_status: 'approved',
          kyc_status: 'approved',
          product_listing_unlocked: true,
          is_approved: true,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids);
      if (error) throw error;

      // Send notifications in parallel
      const regs = verificationQueue.filter(r => ids.includes(r.id));
      await Promise.all(
        regs.map(async (reg) => {
          await supabase.from('notifications').insert({
            user_id: reg.user_id,
            type: 'system',
            title: 'تمت الموافقة على التسجيل ✅',
            body: 'مبروك، تم اعتماد مستندات حسابك وحصولك على غرفتك التجارية.',
            link: '/factory/register',
          });
          const notifKyc = await createNotification(supabase, 'kyc_approved', reg.user_id, 'ar', {
            companyName: reg.company_name || '',
          });
          if (!notifKyc.success) console.error('[Notification] Failed:', notifKyc.error);
          const notifFactory = await createNotification(supabase, 'factory_approved', reg.user_id, 'ar', {
            companyName: reg.company_name || '',
          });
          if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);
        })
      );

      await fetchAll();
      setBulkSelected(new Set());
      showSuccess(`✅ تمت الموافقة على ${ids.length} مصنع دفعة واحدة`);
    } catch (err: any) {
      showError(err.message || 'فشلت العملية الجماعية');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (bulkSelected.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(bulkSelected);
      const { error } = await supabase
        .from('factory_registrations')
        .update({
          registration_status: 'rejected',
          kyc_status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in('id', ids);
      if (error) throw error;

      // Send rejection notifications in parallel
      const regs = verificationQueue.filter(r => ids.includes(r.id));
      await Promise.all(
        regs.map(async (reg) => {
          const notifKyc = await createNotification(supabase, 'kyc_rejected', reg.user_id, 'ar', {
            companyName: reg.company_name || '',
          });
          if (!notifKyc.success) console.error('[Notification] Failed:', notifKyc.error);
        })
      );

      await fetchAll();
      setBulkSelected(new Set());
      showSuccess(`تم رفض ${ids.length} طلب`);
    } catch (err: any) {
      showError(err.message || 'فشلت العملية الجماعية');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Verification Actions ────────────────────────────────────────────────────
  const handleVerificationAction = async (
    reg: FactoryRegistration,
    action: 'approve' | 'reject' | 'under_review'
  ) => {
    setActionLoading(true);
    try {
      const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'under_review';
      const { error } = await supabase
        .from('factory_registrations')
        .update({
          registration_status: newStatus,
          kyc_status: newStatus,
          admin_note: adminNote,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          ...(action === 'approve' ? { product_listing_unlocked: true, is_approved: true } : {}),
        })
        .eq('id', reg.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: reg.user_id,
        type: 'system',
        title: action === 'approve' ? 'تمت الموافقة على التسجيل ✅' : action === 'reject' ? 'تم رفض التسجيل' : 'قيد المراجعة',
        body: action === 'approve' ?'مبروك، تم اعتماد مستندات حسابك وحصولك على غرفتك التجارية.'
          : action === 'reject'
          ? `تم رفض طلب التسجيل. السبب: ${adminNote || 'يرجى التواصل مع الدعم.'}`
          : 'طلبك قيد المراجعة. سيتم إشعارك فور اكتمال المراجعة.',
        link: '/factory/register',
      });

      // ── KYC / Factory approval notifications ──────────────────────────────
      if (action === 'approve') {
        const notifKyc = await createNotification(supabase, 'kyc_approved', reg.user_id, 'ar', {
          companyName: reg.company_name || '',
        });
        if (!notifKyc.success) console.error('[Notification] Failed:', notifKyc.error);

        const notifFactory = await createNotification(supabase, 'factory_approved', reg.user_id, 'ar', {
          companyName: reg.company_name || '',
        });
        if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);
      } else if (action === 'reject') {
        const notifKyc = await createNotification(supabase, 'kyc_rejected', reg.user_id, 'ar', {
          companyName: reg.company_name || '',
          reason: adminNote || '',
        });
        if (!notifKyc.success) console.error('[Notification] Failed:', notifKyc.error);
      }

      await fetchAll();
      setSelectedVerification(null);
      setAdminNote('');
      showSuccess(action === 'approve' ? 'تمت الموافقة بنجاح ✅' : action === 'reject' ? 'تم الرفض' : 'تم التحديث');
    } catch (err: any) {
      showError(err.message || 'فشلت العملية');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Fast-Track Approval ─────────────────────────────────────────────────────
  const handleFastTrackApproval = async (reg: FactoryRegistration) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('factory_registrations')
        .update({
          registration_status: 'approved',
          kyc_status: 'approved',
          product_listing_unlocked: true,
          is_approved: true,
          approval_type: 'fast_track_initial',
          fast_track_approved_at: new Date().toISOString(),
          fast_track_approved_by: user?.id,
          admin_note: adminNote || 'قبول سريع — Fast-Track Initial Approval',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reg.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: reg.user_id,
        type: 'system',
        title: '⚡ تم قبولك بالمسار السريع!',
        body: 'تم منحك دخولاً فورياً لرفع منتجاتك وملء الكتالوج. سيتم إجراء المراجعة الكاملة لاحقاً.',
        link: '/factory/products',
      });

      // ── KYC / Factory fast-track notifications ────────────────────────────
      const notifKyc = await createNotification(supabase, 'kyc_approved', reg.user_id, 'ar', {
        companyName: reg.company_name || '',
      });
      if (!notifKyc.success) console.error('[Notification] Failed:', notifKyc.error);

      const notifFactory = await createNotification(supabase, 'factory_approved', reg.user_id, 'ar', {
        companyName: reg.company_name || '',
      });
      if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);

      await fetchAll();
      setSelectedVerification(null);
      setAdminNote('');
      showSuccess('⚡ تم القبول السريع — Fast-Track Approved');
    } catch (err: any) {
      showError(err.message || 'فشلت العملية');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: editUserForm.full_name,
          company_name: editUserForm.company_name,
          phone: editUserForm.phone,
          country: editUserForm.country,
          role: editUserForm.role,
          is_verified: editUserForm.is_verified,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);
      if (error) throw error;
      await fetchAll();
      setShowEditUser(false);
      setSelectedUser(null);
      showSuccess('تم تحديث بيانات المستخدم بنجاح');
    } catch (err: any) {
      showError(err.message || 'فشل التحديث');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserVerification = async (u: UserProfile) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_verified: !u.is_verified, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw error;
      await fetchAll();
      showSuccess(!u.is_verified ? 'تم تفعيل الحساب' : 'تم إلغاء تفعيل الحساب');
    } catch (err: any) {
      showError(err.message || 'فشلت العملية');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async (u: UserProfile, newRole: 'buyer' | 'manufacturer' | 'admin') => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) throw error;
      await fetchAll();
      showSuccess(`تم تغيير الدور إلى: ${ROLE_LABELS[newRole]}`);
    } catch (err: any) {
      showError(err.message || 'فشل تغيير الدور');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      await fetchAll();
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      setSelectedUser(null);
      showSuccess('تم حذف المستخدم بنجاح');
    } catch (err: any) {
      showError(err.message || 'فشل الحذف');
    } finally {
      setActionLoading(false);
    }
  };

  // ── fetchSupplierDocs helper ────────────────────────────────────────────────
  const fetchSupplierDocs = async (userId: string) => {
    setSupplierDocsLoading(true);
    try {
      const { data } = await supabase
        .from('factory_registrations')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setSupplierDocs(data || null);
    } catch {
      setSupplierDocs(null);
    } finally {
      setSupplierDocsLoading(false);
    }
  };

  // ── Escrow Management ───────────────────────────────────────────────────────
  const fetchEscrowOrders = async () => {
    setEscrowLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .not('escrow_status', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEscrowOrders(data || []);
    } catch (err: any) {
      showError(err.message || 'Failed to load escrow orders');
    } finally {
      setEscrowLoading(false);
    }
  };

  const handleVerifyPayment = async (order: any) => {
    setEscrowActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: user?.id,
          escrow_status: 'funds_secured',
          status: 'processing',
          factory_notified_at: new Date().toISOString(),
          ...(escrowFactoryId ? { factory_user_id: escrowFactoryId } : {}),
        })
        .eq('id', order.id);
      if (error) throw error;

      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'processing',
        note: 'Admin verified bank transfer. Funds secured in escrow. Factory notified to initiate shipping.',
      });

      await supabase.from('notifications').insert({
        user_id: order.user_id,
        type: 'escrow_update',
        title: 'Funds Secured in Escrow ✓',
        message: `Your payment for order ${order.order_number} has been verified. Funds are secured in escrow and the factory has been notified to ship your order.`,
        data: { order_id: order.id },
        is_read: false,
      });

      // ── Notify buyer: order confirmed + escrow funded ─────────────────────
      const notifConfirmed = await createNotification(supabase, 'order_confirmed', order.user_id, 'ar', {
        orderId: order.id,
        orderNumber: order.order_number || '',
      });
      if (!notifConfirmed.success) console.error('[Notification] Failed:', notifConfirmed.error);

      const notifEscrow = await createNotification(supabase, 'escrow_funded', order.user_id, 'ar', {
        orderId: order.id,
        orderNumber: order.order_number || '',
        amount: String(order.total || 0),
      });
      if (!notifEscrow.success) console.error('[Notification] Failed:', notifEscrow.error);

      // ── Notify factory: escrow green light ────────────────────────────────
      const factoryId = escrowFactoryId || order.factory_user_id;
      if (factoryId) {
        const notifFactory = await createNotification(supabase, 'escrow_green_light', factoryId, 'ar', {
          orderId: order.id,
          orderNumber: order.order_number || '',
          amount: String(order.total || 0),
        });
        if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);
      }

      // ── Event-driven Billing Engine ──────────────────────────────────────────
      try {
        const billingRes = await fetch('/api/escrow/billing-engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: order.id }),
        });
        const billingResult = await billingRes.json();
        if (!billingResult.success) {
          console.warn('[BillingEngine] Warning:', billingResult.error);
        }
      } catch (billingErr: any) {
        console.error('[BillingEngine] Failed to trigger:', billingErr.message);
      }

      // ── Generate release code if not already set ──────────────────────────
      try {
        await supabase.rpc('generate_order_release_code', { p_order_id: order.id });
      } catch (rcErr: any) {
        console.warn('[ReleaseCode] Could not generate:', rcErr.message);
      }

      setEscrowFactoryId('');
      setSelectedEscrowOrder(null);
      await fetchEscrowOrders();
      showSuccess('Payment verified. Funds secured in escrow. Invoice generated and buyer/factory notified automatically.');
    } catch (err: any) {
      showError(err.message || 'Failed to verify payment');
    } finally {
      setEscrowActionLoading(false);
    }
  };

  const handleMarkShipped = async (order: any) => {
    setEscrowActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          escrow_status: 'shipped',
          status: 'shipped',
          shipped_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      if (error) throw error;

      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'shipped',
        note: 'Admin confirmed goods have been shipped by factory. Buyer can now confirm receipt.',
      });

      await supabase.from('notifications').insert({
        user_id: order.user_id,
        type: 'escrow_update',
        title: 'Your Order Has Been Shipped 🚚',
        message: `Order ${order.order_number} has been shipped. Once you receive and inspect the goods, please confirm receipt in your dashboard to release funds.`,
        data: { order_id: order.id },
        is_read: false,
      });

      // ── Notify buyer: order shipped ───────────────────────────────────────
      const notifShipped = await createNotification(supabase, 'order_shipped', order.user_id, 'ar', {
        orderId: order.id,
        orderNumber: order.order_number || '',
      });
      if (!notifShipped.success) console.error('[Notification] Failed:', notifShipped.error);

      const buyerEmail = order.user_profiles?.email;
      if (buyerEmail) {
        await sendEscrowStatusEmail(buyerEmail, {
          full_name: order.user_profiles?.full_name,
          order_number: order.order_number,
          escrow_status: 'shipped',
          message: `Great news! Your order ${order.order_number} has been shipped by the factory. Once you receive and inspect the goods, please log in to your DirectHub dashboard and click "Confirm Receipt" to trigger the OTP verification.`,
        });
      }

      setSelectedEscrowOrder(null);
      await fetchEscrowOrders();
      showSuccess('Order marked as shipped. Buyer notified via email.');
    } catch (err: any) {
      showError(err.message || 'Failed to mark as shipped');
    } finally {
      setEscrowActionLoading(false);
    }
  };

  // ── Fast-Track Order Approval ───────────────────────────────────────────────
  const handleFastTrackOrderApproval = async (order: any) => {
    setEscrowActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          approval_type: 'fast_track_initial',
          fast_track_approved_at: new Date().toISOString(),
          payment_verified: true,
          payment_verified_at: new Date().toISOString(),
          payment_verified_by: user?.id,
          escrow_status: 'funds_secured',
          status: 'processing',
          factory_notified_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      if (error) throw error;

      // ── Notify buyer: order confirmed ─────────────────────────────────────
      const notifConfirmed = await createNotification(supabase, 'order_confirmed', order.user_id, 'ar', {
        orderId: order.id,
        orderNumber: order.order_number || '',
      });
      if (!notifConfirmed.success) console.error('[Notification] Failed:', notifConfirmed.error);

      // ── Notify factory: escrow green light ────────────────────────────────
      if (order.factory_user_id) {
        const notifFactory = await createNotification(supabase, 'escrow_green_light', order.factory_user_id, 'ar', {
          orderId: order.id,
          orderNumber: order.order_number || '',
          amount: String(order.total || 0),
        });
        if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);
      }

      setSelectedEscrowOrder(null);
      await fetchEscrowOrders();
      showSuccess('⚡ تم القبول السريع للطلب — Fast-Track Order Approved');
    } catch (err: any) {
      showError(err.message || 'فشل القبول السريع للطلب');
    } finally {
      setEscrowActionLoading(false);
    }
  };

  // ── NEW: Manual Admin Payout Approval ──────────────────────────────────────
  const handleAdminPayout = async (order: any) => {
    setEscrowActionLoading(true);
    try {
      const res = await fetch('/api/escrow/admin-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          payout_note: escrowReleaseNote || 'تمت الموافقة على صرف المستحقات من قِبل الإدارة.',
          selected_bank_account_id: selectedPayoutBankAccount || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to release funds');

      setEscrowReleaseNote('');
      setSelectedEscrowOrder(null);
      setSelectedPayoutBankAccount('');
      await fetchEscrowOrders();
      showSuccess(`✅ تم صرف المستحقات للطلب ${order.order_number} بنجاح. حالة الطلب: مكتمل.`);
    } catch (err: any) {
      showError(err.message || 'فشل صرف المستحقات');
    } finally {
      setEscrowActionLoading(false);
    }
  };

  // ── NEW: Green Light — Release Escrow Funds ────────────────────────────────
  const handleGreenLight = async (order: any) => {
    setEscrowActionLoading(true);
    try {
      const res = await fetch('/api/escrow/green-light', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          release_note: escrowReleaseNote || 'تم إعطاء الضوء الأخضر — تحرير الأموال للمصنع بعد التحقق من البضاعة.',
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to release funds');

      setEscrowReleaseNote('');
      setSelectedEscrowOrder(null);
      await fetchEscrowOrders();
      showSuccess(`🟢 تم إعطاء الضوء الأخضر للطلب ${order.order_number}. تم تحرير الأموال للمصنع.`);
    } catch (err: any) {
      showError(err.message || 'فشل تحرير الأموال');
    } finally {
      setEscrowActionLoading(false);
    }
  };

  // ── Bank Accounts Management ───────────────────────────────────────────────
  const fetchAllBankAccounts = async () => {
    setBankAccountsLoading(true);
    try {
      const { data, error } = await supabase
        .from('factory_bank_accounts')
        .select('*, user_profiles!factory_bank_accounts_manufacturer_id_fkey(full_name, email, company_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllBankAccounts(data || []);
    } catch (err: any) {
      showError(err.message || 'Failed to load bank accounts');
    } finally {
      setBankAccountsLoading(false);
    }
  };

  const fetchFactoryBankAccounts = async (manufacturerId: string) => {
    setFactoryBankLoading(true);
    try {
      const { data, error } = await supabase
        .from('factory_bank_accounts')
        .select('*')
        .eq('manufacturer_id', manufacturerId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFactoryBankAccounts(data || []);

      // Also fetch international wallet info from manufacturer_payment_settings
      const { data: paySettings } = await supabase
        .from('manufacturer_payment_settings')
        .select('payoneer_email, payoneer_account_id, payoneer_account_name, wise_email, wise_account_id, wise_account_name, wise_currency, usdt_wallet_address, usdt_network, usdt_account_name, paypal_email, paypal_account_name')
        .eq('manufacturer_id', manufacturerId)
        .maybeSingle();
      setFactoryIntlWallets(paySettings || null);
    } catch (err: any) {
      console.error('Failed to fetch factory bank accounts:', err);
      setFactoryBankAccounts([]);
      setFactoryIntlWallets(null);
    } finally {
      setFactoryBankLoading(false);
    }
  };

  const handleApproveBankAccount = async (accountId: string) => {
    setBankAccountActionLoading(true);
    try {
      const { error } = await supabase
        .from('factory_bank_accounts')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_note: bankAccountNote.trim() || null,
        })
        .eq('id', accountId);
      if (error) throw error;

      // Notify manufacturer
      const account = allBankAccounts.find(a => a.id === accountId);
      if (account) {
        await supabase.from('notifications').insert({
          user_id: account.manufacturer_id,
          type: 'bank_account_approved',
          title: '✅ تم اعتماد حسابك البنكي',
          message: `تمت الموافقة على الحساب البنكي "${account.bank_name}" وتفعيله لاستقبال المستحقات.`,
          data: { bank_account_id: accountId },
          is_read: false,
        });
      }

      setBankAccountNote('');
      await fetchAllBankAccounts();
      showSuccess('✅ تم اعتماد الحساب البنكي وإشعار المصنع.');
    } catch (err: any) {
      showError(err.message || 'فشل اعتماد الحساب البنكي');
    } finally {
      setBankAccountActionLoading(false);
    }
  };

  const handleRejectBankAccount = async (accountId: string) => {
    if (!bankAccountNote.trim()) {
      showError('يرجى إدخال سبب الرفض قبل المتابعة.');
      return;
    }
    setBankAccountActionLoading(true);
    try {
      const { error } = await supabase
        .from('factory_bank_accounts')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          admin_note: bankAccountNote.trim(),
        })
        .eq('id', accountId);
      if (error) throw error;

      // Notify manufacturer
      const account = allBankAccounts.find(a => a.id === accountId);
      if (account) {
        await supabase.from('notifications').insert({
          user_id: account.manufacturer_id,
          type: 'bank_account_rejected',
          title: '⚠️ تم رفض الحساب البنكي',
          message: `تم رفض الحساب البنكي "${account.bank_name}". السبب: ${bankAccountNote.trim()}`,
          data: { bank_account_id: accountId },
          is_read: false,
        });
      }

      setBankAccountNote('');
      await fetchAllBankAccounts();
      showSuccess('تم رفض الحساب البنكي وإشعار المصنع.');
    } catch (err: any) {
      showError(err.message || 'فشل رفض الحساب البنكي');
    } finally {
      setBankAccountActionLoading(false);
    }
  };

  const handleReleaseFunds = async (order: any) => {
    setEscrowActionLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          escrow_status: 'funds_released',
          funds_released_at: new Date().toISOString(),
          funds_released_by: user?.id,
          admin_release_note: escrowReleaseNote || 'Funds released to supplier after buyer confirmation.',
        })
        .eq('id', order.id);
      if (error) throw error;

      await supabase.from('order_status_history').insert({
        order_id: order.id,
        status: 'delivered',
        note: `Admin released funds to supplier. ${escrowReleaseNote || ''}`,
      });

      await supabase.from('notifications').insert({
        user_id: order.user_id,
        type: 'escrow_update',
        title: 'Transaction Complete ✓',
        message: `Funds for order ${order.order_number} have been released to the supplier. Transaction is complete.`,
        data: { order_id: order.id },
        is_read: false,
      });

      const buyerEmail = order.user_profiles?.email;
      if (buyerEmail) {
        await sendEscrowStatusEmail(buyerEmail, {
          full_name: order.user_profiles?.full_name,
          order_number: order.order_number,
          escrow_status: 'funds_released',
          message: `Your order ${order.order_number} is now fully complete. The escrowed funds have been released to the supplier following your confirmed receipt.`,
          note: escrowReleaseNote || undefined,
        });
      }

      setEscrowReleaseNote('');
      setSelectedEscrowOrder(null);
      await fetchEscrowOrders();
      showSuccess('Funds released to supplier. Buyer notified via email.');
    } catch (err: any) {
      showError(err.message || 'Failed to release funds');
    } finally {
      setEscrowActionLoading(false);
    }
  };

  const handleGenerateInvoice = async (order: any) => {
    setInvoiceGenerating(true);
    setInvoiceSuccess('');
    try {
      const buyerEmail = order.user_profiles?.email || '';
      const result = await generateAndSendEscrowInvoice(order.id, buyerEmail);
      if (!result.success) throw new Error(result.error || 'Failed to generate invoice');
      setInvoiceSuccess(`Invoice ${result.invoice?.invoice_number} generated${result.emailSent ? ' & emailed to buyer' : ''}.`);
    } catch (err: any) {
      showError(err.message || 'Failed to generate invoice');
    } finally {
      setInvoiceGenerating(false);
    }
  };

  // ── Dispute Management ──────────────────────────────────────────────────────
  const fetchDisputeOrders = async () => {
    setDisputeLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_disputes')
        .select(`
          *,
          orders!order_disputes_order_id_fkey(
            *,
            user_profiles!orders_user_id_fkey(full_name, email, company_name)
          )
        `)
        .order('opened_at', { ascending: false });
      if (error) throw error;
      setDisputeOrders(data || []);
    } catch (err: any) {
      showError(err.message || 'Failed to load disputes');
    } finally {
      setDisputeLoading(false);
    }
  };

  const handleDisputeRefund = async (order: any) => {
    setDisputeActionLoading(true);
    setDisputeActionMsg('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_refund',
          order_id: order.id,
          resolution_note: disputeResolutionNote || 'تمت الموافقة على الاسترجاع من قبل الإدارة',
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to process refund');

      // Notify factory about dispute resolution
      if (order.factory_user_id) {
        await supabase.from('notifications').insert({
          user_id: order.factory_user_id,
          type: 'system',
          title: '⚠️ تم حل النزاع — استرجاع للمشتري',
          body: `تم حل النزاع على الطلب ${order.order_number} لصالح المشتري. تم إعادة المبلغ من محفظة الضمان.`,
          link: '/manufacturer/dashboard',
        });
      }

      setDisputeActionMsg(result.message || 'تم اعتماد الاسترجاع بنجاح');
      setDisputeResolutionNote('');
      setSelectedDisputeOrder(null);
      await fetchDisputeOrders();
      await fetchEscrowOrders();
      showSuccess('✅ تم اعتماد الاسترجاع وإعادة المبلغ للمشتري');
    } catch (err: any) {
      showError(err.message || 'فشل اعتماد الاسترجاع');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  const handleDisputeClose = async (order: any) => {
    setDisputeActionLoading(true);
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin_close',
          order_id: order.id,
          resolution_note: disputeResolutionNote || 'تم إغلاق النزاع دون استرجاع',
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to close dispute');

      setDisputeResolutionNote('');
      setSelectedDisputeOrder(null);
      await fetchDisputeOrders();
      await fetchEscrowOrders();
      showSuccess('تم إغلاق النزاع. سيُستأنف مسار صرف المستحقات.');
    } catch (err: any) {
      showError(err.message || 'فشل إغلاق النزاع');
    } finally {
      setDisputeActionLoading(false);
    }
  };

  // ── Factory Actions ─────────────────────────────────────────────────────────
  const handleToggleFactory = async (factory: FactoryRegistration) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('factory_registrations')
        .update({ is_active: !factory.is_active })
        .eq('id', factory.id);
      if (error) throw error;
      await fetchAll();
      showSuccess(!factory.is_active ? 'تم تفعيل المصنع' : 'تم إلغاء تفعيل المصنع');
    } catch (err: any) {
      showError(err.message || 'فشلت العملية');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Toggle product_listing_unlocked per factory ──────────────────────────
  const handleToggleProductListing = async (factory: FactoryRegistration) => {
    setActionLoading(true);
    try {
      const newValue = !factory.product_listing_unlocked;
      const { error } = await supabase
        .from('factory_registrations')
        .update({ product_listing_unlocked: newValue })
        .eq('id', factory.id);
      if (error) throw error;
      setFactories(prev =>
        prev.map(f => f.id === factory.id ? { ...f, product_listing_unlocked: newValue } : f)
      );
    } catch (err: any) {
      console.error('Toggle product listing error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtered Lists ──────────────────────────────────────────────────────────
  const filteredVerifications = verificationQueue.filter(r =>
    verifFilter === 'all' ? true : r.registration_status === verifFilter
  );

  const filteredUsers = users.filter(u => {
    const matchSearch = !userSearch ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.company_name?.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    const yesterdayStart = new Date();
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    yesterdayStart.setHours(0, 0, 0, 0);
    const matchNew = !showNewUsersOnly || new Date(u.created_at) >= yesterdayStart;
    return matchSearch && matchRole && matchNew;
  });

  const filteredFactories = factories.filter(f => {
    const matchSearch = !factorySearch ||
      f.company_name?.toLowerCase().includes(factorySearch.toLowerCase()) ||
      f.user_profiles?.email?.toLowerCase().includes(factorySearch.toLowerCase());
    const matchStatus = factoryStatusFilter === 'all' ||
      f.registration_status === factoryStatusFilter ||
      (factoryStatusFilter === 'approved' && f.is_approved);
    return matchSearch && matchStatus;
  });

  // ── Sorted Lists ────────────────────────────────────────────────────────────
  const sortedUsers = [...filteredUsers].sort((a: any, b: any) => {
    const av = a[userSort.col] ?? '';
    const bv = b[userSort.col] ?? '';
    return userSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const sortedFactories = [...filteredFactories].sort((a: any, b: any) => {
    const av = a[factorySort.col] ?? '';
    const bv = b[factorySort.col] ?? '';
    return factorySort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const toggleUserSort = (col: string) =>
    setUserSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const toggleFactorySort = (col: string) =>
    setFactorySort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  // ── Pending Products Approval ──────────────────────────────────────────────
  const fetchPendingProducts = async () => {
    setPendingProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, price, currency, category, created_at, manufacturer_id, user_profiles:manufacturer_id(full_name, company_name, registration_source)')
        .eq('is_published', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setPendingProducts(data || []);
    } catch {
      // silently ignore
    } finally {
      setPendingProductsLoading(false);
    }
  };

  const handleProductApproval = async (productId: string, action: 'approve' | 'reject') => {
    setProductActionLoading(productId);
    setProductActionMsg(null);
    try {
      const { error } = await supabase
        .from('manufacturer_products')
        .update({ is_published: action === 'approve', updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) throw error;
      setPendingProducts(prev => prev.filter(p => p.id !== productId));
      setProductActionMsg({
        text: action === 'approve' ? '✅ تم نشر المنتج بنجاح' : '❌ تم رفض المنتج',
        type: action === 'approve' ? 'success' : 'error',
      });
      setTimeout(() => setProductActionMsg(null), 3000);
    } catch (err: any) {
      setProductActionMsg({ text: err.message || 'فشلت العملية', type: 'error' });
    } finally {
      setProductActionLoading(null);
    }
  };

  // ── Platform Settings ───────────────────────────────────────────────────────
  const fetchPlatformSettings = async () => {
    setPlatformSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('setting_key', { ascending: true });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      setPlatformSettings(map);
      setPlatformSettingsForm(map);
    } catch (err: any) {
      showError(err.message || 'فشل تحميل إعدادات المنصة');
    } finally {
      setPlatformSettingsLoading(false);
    }
  };

  const handleSavePlatformSetting = async (key: string) => {
    const value = platformSettingsForm[key];
    if (value === undefined) return;
    setPlatformSettingsSaving(key);
    setPlatformSettingsMsg(null);
    try {
      const { data: existing, error: selectError } = await supabase
        .from('platform_settings')
        .select('id')
        .eq('setting_key', key)
        .maybeSingle();
      if (selectError) throw selectError;

      const payload = {
        setting_key: key,
        setting_value: value,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      const { error } = existing?.id
        ? await supabase.from('platform_settings').update(payload).eq('setting_key', key)
        : await supabase.from('platform_settings').insert(payload);

      if (error) throw error;
      setPlatformSettings(prev => ({ ...prev, [key]: value }));
      setPlatformSettingsMsg({ text: `✅ تم حفظ الإعداد "${key}" بنجاح`, type: 'success' });
      setTimeout(() => setPlatformSettingsMsg(null), 3000);
    } catch (err: any) {
      setPlatformSettingsMsg({ text: err.message || ui.saveFailed, type: 'error' });
    } finally {
      setPlatformSettingsSaving(null);
    }
  };

  const handleSaveAllPlatformSettings = async () => {
    setPlatformSettingsSaving('all');
    setPlatformSettingsMsg(null);
    try {
      const results = await Promise.all(
        Object.entries(platformSettingsForm).map(async ([key, value]) => {
          const { data: existing, error: selectError } = await supabase
            .from('platform_settings')
            .select('id')
            .eq('setting_key', key)
            .maybeSingle();
          if (selectError) return { key, error: selectError };
          const payload = {
            setting_key: key,
            setting_value: value,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          };
          const { error } = existing?.id
            ? await supabase.from('platform_settings').update(payload).eq('setting_key', key)
            : await supabase.from('platform_settings').insert(payload);
          return { key, error };
        })
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
      setPlatformSettings({ ...platformSettingsForm });
      setPlatformSettingsMsg({ text: ui.savedSuccess, type: 'success' });
      setTimeout(() => setPlatformSettingsMsg(null), 3000);
    } catch (err: any) {
      setPlatformSettingsMsg({ text: err.message || ui.saveFailed, type: 'error' });
    } finally {
      setPlatformSettingsSaving(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!mounted || authLoading) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <div suppressHydrationWarning className="flex flex-col items-center gap-3">
          <div suppressHydrationWarning className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p suppressHydrationWarning className="text-sm text-muted-foreground font-medium">{ui.loading}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const pendingCount = verificationQueue.filter(r => r.registration_status === 'pending').length;
  const criticalAlertCount = (analytics.disputedOrders > 0 ? 1 : 0) + (analytics.pendingVerifications > 5 ? 1 : 0);

  return (
    <div className="min-h-screen bg-background admin-panel" dir={dir}>
      <Header />

      {/* Drill-Down Modals */}
      {drillDown === 'revenue' && (
        <DrillDownModal title={ui.overview.revenueDrill} onClose={() => setDrillDown(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: ui.overview.totalRevenue, value: `$${analytics.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-emerald-600' },
                { label: ui.overview.platformCommission, value: `$${analytics.platformCommission.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-amber-600' },
                { label: ui.overview.deliveredOrders, value: analytics.deliveredOrders.toString(), color: 'text-blue-600' },
                { label: ui.overview.avgOrderValue, value: analytics.totalOrders > 0 ? `$${Math.round(analytics.totalRevenue / analytics.totalOrders).toLocaleString('en-US')}` : '$0', color: 'text-purple-600' },
              ].map(item => (
                <div key={item.label} className="bg-muted rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">{ui.overview.ordersByStatus}</p>
              {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => {
                const count = liveOrders.filter((o: any) => o.status === status).length;
                const pct = analytics.totalOrders > 0 ? Math.round((count / analytics.totalOrders) * 100) : 0;
                const colors: Record<string, string> = { pending: 'bg-amber-400', processing: 'bg-blue-400', shipped: 'bg-purple-400', delivered: 'bg-emerald-400', cancelled: 'bg-red-400' };
                return (
                  <div key={status} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-muted-foreground w-20 capitalize">{status}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${colors[status]} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DrillDownModal>
      )}

      {drillDown === 'orders' && (
        <DrillDownModal title={ui.overview.ordersDrill} onClose={() => setDrillDown(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: ui.overview.totalOrders, value: analytics.totalOrders, color: 'bg-blue-50 text-blue-700' },
                { label: ui.overview.delivered, value: analytics.deliveredOrders, color: 'bg-emerald-50 text-emerald-700' },
                { label: ui.overview.disputed, value: analytics.disputedOrders, color: 'bg-red-50 text-red-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">آخر 10 طلبات</p>
            <div className="space-y-2">
              {liveOrders.slice(0, 10).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono font-bold text-foreground">{o.id?.slice(0, 8)}…</span>
                  <span className="text-xs font-bold text-primary">${(o.total || 0).toLocaleString('en-US')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-semibold capitalize">{o.status}</span>
                </div>
              ))}
            </div>
          </div>
        </DrillDownModal>
      )}

      {drillDown === 'factories' && (
        <DrillDownModal title="تحليل المصانع والموردين" onClose={() => setDrillDown(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: ui.overview.totalFactories, value: factories.length, color: 'bg-blue-50 text-blue-700' },
                { label: ui.overview.activeVerified, value: analytics.activeFactories, color: 'bg-emerald-50 text-emerald-700' },
                { label: ui.overview.pendingVerification, value: analytics.pendingVerifications, color: 'bg-amber-50 text-amber-700' },
                { label: ui.overview.productsEnabled, value: factories.filter(f => f.product_listing_unlocked).length, color: 'bg-purple-50 text-purple-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">توزيع حسب الدولة</p>
            <div className="space-y-1.5">
              {Object.entries(
                factories.reduce((acc: Record<string, number>, f) => {
                  acc[f.country || 'غير محدد'] = (acc[f.country || 'غير محدد'] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => (
                <div key={country} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-xs text-foreground">{country}</span>
                  <span className="text-xs font-bold text-primary">{count} مصنع</span>
                </div>
              ))}
            </div>
          </div>
        </DrillDownModal>
      )}

      {drillDown === 'users' && (
        <DrillDownModal title="تحليل المستخدمين" onClose={() => setDrillDown(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: ui.overview.totalUsers, value: analytics.totalUsers, color: 'bg-blue-50 text-blue-700' },
                { label: ui.overview.buyers, value: analytics.totalBuyers, color: 'bg-sky-50 text-sky-700' },
                { label: ui.overview.manufacturers, value: analytics.totalManufacturers, color: 'bg-purple-50 text-purple-700' },
                { label: ui.overview.newSinceYesterday, value: analytics.newUsersYesterday, color: 'bg-emerald-50 text-emerald-700' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">توزيع حسب الدولة</p>
            <div className="space-y-1.5">
              {Object.entries(
                users.reduce((acc: Record<string, number>, u) => {
                  acc[u.country || 'غير محدد'] = (acc[u.country || 'غير محدد'] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => (
                <div key={country} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                  <span className="text-xs text-foreground">{country}</span>
                  <span className="text-xs font-bold text-primary">{count} مستخدم</span>
                </div>
              ))}
            </div>
          </div>
        </DrillDownModal>
      )}

      {drillDown === 'disputes' && (
        <DrillDownModal title="الطلبات المتنازع عليها" onClose={() => setDrillDown(null)}>
          <div className="space-y-2">
            {liveOrders.filter((o: any) => o.dispute_status === 'reported').length === 0 ? (
              <div className="text-center py-8">
                <Icon name="CheckCircleIcon" size={32} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد نزاعات مفتوحة</p>
              </div>
            ) : liveOrders.filter((o: any) => o.dispute_status === 'reported').map((o: any) => (
              <div key={o.id} className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono font-bold text-red-800">{o.id?.slice(0, 12)}…</span>
                  <span className="text-xs font-bold text-red-700">${(o.total || 0).toLocaleString('en-US')}</span>
                </div>
                <p className="text-xs text-red-600">الحالة: {o.status} · النزاع: {o.dispute_status}</p>
              </div>
            ))}
          </div>
        </DrillDownModal>
      )}

      {drillDown === 'pending' && (
        <DrillDownModal title="طلبات التحقق المعلقة" onClose={() => setDrillDown(null)}>
          <div className="space-y-2">
            {verificationQueue.filter(r => r.registration_status === 'pending').map(reg => (
              <div key={reg.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-amber-900">{reg.company_name}</p>
                  <p className="text-xs text-amber-700">{reg.country} · {reg.industry}</p>
                </div>
                <button
                  onClick={() => { setDrillDown(null); setActiveTab('verification'); setSelectedVerification(reg); setAdminNote(''); }}
                  className="text-xs font-bold text-amber-700 hover:underline"
                >
                  مراجعة ←
                </button>
              </div>
            ))}
          </div>
        </DrillDownModal>
      )}

      {/* Toast Messages */}
      {successMsg && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <Icon name="CheckCircleIcon" size={18} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="fixed top-20 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
          <Icon name="ExclamationCircleIcon" size={18} /> {errorMsg}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Icon name="TrashIcon" size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">تأكيد الحذف</h3>
                <p className="text-xs text-muted-foreground">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <button onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <p className="text-sm text-foreground mb-5">
              هل أنت متأكد من حذف المستخدم <strong>{deleteTarget.name}</strong>؟
            </p>
            <div className="flex gap-3 w-full max-w-sm">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'جارٍ الحذف…' : 'حذف نهائي'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUser && selectedUser && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="PencilSquareIcon" size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">تعديل بيانات المستخدم</h3>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
            <button onClick={() => setShowEditUser(false)} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4 max-w-lg mx-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">الاسم الكامل</label>
                  <input
                    type="text"
                    value={editUserForm.full_name || ''}
                    onChange={e => setEditUserForm({ ...editUserForm, full_name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">اسم الشركة</label>
                  <input
                    type="text"
                    value={editUserForm.company_name || ''}
                    onChange={e => setEditUserForm({ ...editUserForm, company_name: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editUserForm.phone || ''}
                    onChange={e => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">الدولة</label>
                  <input
                    type="text"
                    value={editUserForm.country || ''}
                    onChange={e => setEditUserForm({ ...editUserForm, country: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">الدور</label>
                <select
                  value={editUserForm.role || 'buyer'}
                  onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value as any })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                >
                  <option value="buyer">مشتري / عميل</option>
                  <option value="manufacturer">مصنّع / مورد</option>
                  <option value="admin">مسؤول (Admin)</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2.5 px-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-foreground">حالة التحقق</span>
                <button
                  onClick={() => setEditUserForm({ ...editUserForm, is_verified: !editUserForm.is_verified })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editUserForm.is_verified ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editUserForm.is_verified ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* ── Google Account Info Section ──────────────────────────── */}
              {selectedUser?.auth_provider === 'google' && (
                <div className="border border-blue-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span className="text-sm font-bold text-blue-800">بيانات حساب Google</span>
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">مسجّل عبر Google</span>
                  </div>
                  <div className="p-4 space-y-2.5 bg-white">
                    {/* Email */}
                    <div className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Icon name="EnvelopeIcon" size={14} className="text-blue-500" />
                        <span className="text-xs font-semibold text-muted-foreground">البريد الإلكتروني (Google)</span>
                      </div>
                      <span className="text-xs font-bold text-foreground font-mono">{selectedUser.email}</span>
                    </div>
                    {/* Full Name */}
                    <div className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Icon name="UserIcon" size={14} className="text-blue-500" />
                        <span className="text-xs font-semibold text-muted-foreground">الاسم الكامل (Google)</span>
                      </div>
                      <span className="text-xs font-bold text-foreground">{selectedUser.full_name || <span className="text-muted-foreground italic">غير محدد</span>}</span>
                    </div>
                    {/* Registration Source */}
                    <div className="flex items-center justify-between py-2 px-3 bg-blue-50/60 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2">
                        <Icon name="ArrowRightOnRectangleIcon" size={14} className="text-blue-500" />
                        <span className="text-xs font-semibold text-muted-foreground">مصدر التسجيل</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Documents & Verification Section ─────────────────────── */}
              {(editUserForm.role === 'manufacturer' || selectedUser?.role === 'manufacturer') && (
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
                    <Icon name="DocumentCheckIcon" size={16} className="text-amber-600" />
                    <span className="text-sm font-bold text-amber-800">المستندات والتحقق</span>
                    {supplierDocsLoading && (
                      <Icon name="ArrowPathIcon" size={14} className="text-amber-500 animate-spin ml-auto" />
                    )}
                  </div>
                  <div className="p-4 space-y-3 bg-white">
                    {supplierDocsLoading ? (
                      <p className="text-xs text-muted-foreground text-center py-4">جارٍ تحميل المستندات…</p>
                    ) : !supplierDocs ? (
                      <p className="text-xs text-muted-foreground text-center py-4">لا توجد مستندات مرفوعة لهذا المورد</p>
                    ) : (
                      <>
                        {/* Tax ID */}
                        <div className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Icon name="IdentificationIcon" size={15} className="text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">الرقم الضريبي / Tax ID</span>
                          </div>
                          <span className="text-xs font-bold text-foreground font-mono">
                            {supplierDocs.tax_id || <span className="text-muted-foreground italic">غير محدد</span>}
                          </span>
                        </div>

                        {/* Registration Status */}
                        <div className="flex items-center justify-between py-2 px-3 bg-muted/40 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Icon name="ClipboardDocumentCheckIcon" size={15} className="text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">حالة التسجيل</span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            supplierDocs.registration_status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            supplierDocs.registration_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            supplierDocs.registration_status === 'under_review'? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {supplierDocs.registration_status === 'approved' ? 'معتمد' :
                             supplierDocs.registration_status === 'rejected' ? 'مرفوض' :
                             supplierDocs.registration_status === 'under_review' ? 'قيد المراجعة' : 'معلق'}
                          </span>
                        </div>

                        {/* Document rows */}
                        {[
                          { label: ui.docs.cr, url: supplierDocs.cr_document_url, filename: 'cr_document' },
                          { label: ui.docs.tradeLicense, url: supplierDocs.trade_license_url, filename: supplierDocs.trade_license_filename || 'trade_license' },
                          { label: ui.docs.taxCert, url: supplierDocs.tax_certificate_url, filename: supplierDocs.tax_certificate_filename || 'tax_certificate' },
                          { label: ui.docs.companyProfile, url: supplierDocs.company_profile_url, filename: supplierDocs.company_profile_filename || 'company_profile' },
                          { label: ui.docs.manufacturingLicense, url: supplierDocs.manufacturing_license_url, filename: 'manufacturing_license' },
                          { label: ui.docs.factoryLicense, url: supplierDocs.factory_license_url, filename: 'factory_license' },
                        ].filter(doc => doc.url).map((doc, idx) => {
                          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(doc.url || '');
                          return (
                            <div key={idx} className="border border-border rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                                <div className="flex items-center gap-2">
                                  <Icon name={isImage ? 'PhotoIcon' : 'DocumentTextIcon'} size={14} className="text-muted-foreground" />
                                  <span className="text-xs font-semibold text-foreground">{doc.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-semibold transition-colors"
                                  >
                                    <Icon name="EyeIcon" size={12} />
                                    عرض
                                  </a>
                                  <a
                                    href={doc.url}
                                    download={doc.filename}
                                    className="flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold transition-colors"
                                  >
                                    <Icon name="ArrowDownTrayIcon" size={12} />
                                    تحميل
                                  </a>
                                </div>
                              </div>
                              {isImage && (
                                <div className="p-2 bg-muted/10">
                                  <img
                                    src={doc.url}
                                    alt={doc.label}
                                    className="w-full max-h-32 object-contain rounded border border-border"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* No documents uploaded */}
                        {![
                          supplierDocs.cr_document_url,
                          supplierDocs.trade_license_url,
                          supplierDocs.tax_certificate_url,
                          supplierDocs.company_profile_url,
                          supplierDocs.manufacturing_license_url,
                          supplierDocs.factory_license_url,
                        ].some(Boolean) && (
                          <p className="text-xs text-muted-foreground text-center py-2 italic">{ui.users.noDocs}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEditUser(false)}
                  className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="CheckIcon" size={15} />}
                  حفظ التغييرات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-24">

        {/* ── Page Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shrink-0 shadow-lg">
            <Icon name="ShieldCheckIcon" size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{ui.pageTitle}</h1>
            <p className="text-xs text-muted-foreground">{ui.pageSubtitle}</p>
          </div>
          <div className={`${isRTL ? 'mr-auto' : 'ml-auto'} flex items-center gap-2`}>
            {criticalAlertCount > 0 && (
              <button
                onClick={() => setActiveTab('amal')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-700">{ui.criticalAlerts.replace('{count}', String(criticalAlertCount))}</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('changelog')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-sm"
            >
              <Icon name="MegaphoneIcon" size={14} />
              <span className="text-xs font-bold">{ui.publishUpdates}</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-700">{ui.adminOnly}</span>
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs — Ultra-Luxurious ──────────────────────────────── */}
        <SmartActionBar onNavigateTab={(tab) => setActiveTab(tab as ActiveTab)} />

        <div className="space-y-6 mb-6">

          {/* Section 1: Core Operations */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">العمليات الأساسية</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'overview', label: ui.tabs.overview, icon: 'ChartBarIcon', gradient: 'linear-gradient(135deg,#3B82F6,#2563EB)' },
                { key: 'amal', label: ui.tabs.amal, icon: 'CpuChipIcon', gradient: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', badge: criticalAlertCount },
                { key: 'escrow', label: ui.tabs.escrow, icon: 'ShieldCheckIcon', gradient: 'linear-gradient(135deg,#10B981,#059669)', badge: escrowOrders.filter((o: any) => ['pending_verification', 'funds_secured', 'ready_for_inspection', 'pending_admin_payout'].includes(o.escrow_status)).length },
                { key: 'verification', label: ui.tabs.verification, icon: 'DocumentCheckIcon', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)', badge: pendingCount },
                { key: 'users', label: ui.tabs.users, icon: 'UsersIcon', gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)', badge: analytics.totalUsers },
                { key: 'factories', label: ui.tabs.factories, icon: 'BuildingOffice2Icon', gradient: 'linear-gradient(135deg,#F97316,#EA580C)', badge: analytics.activeFactories },
                { key: 'field_agents', label: ui.tabs.field_agents, icon: 'UserGroupIcon', gradient: 'linear-gradient(135deg,#14B8A6,#0D9488)', badge: pendingLicenses.length },
                { key: 'rfq_management', label: ui.tabs.rfq_management, icon: 'DocumentTextIcon', gradient: 'linear-gradient(135deg,#4F46E5,#4338CA)', badge: liveRFQs.filter((r: any) => r.status === 'pending').length },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as ActiveTab);
                      if (tab.key === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (tab.key === 'payments' && allPayments.length === 0) fetchPayments();
                      if (tab.key === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                      isActive
                        ? 'border-transparent shadow-xl scale-[1.03]'
                        : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5'
                    }`}
                    style={isActive ? { background: tab.gradient, boxShadow: '0 8px 28px -4px rgba(0,0,0,0.35)' } : {}}
                  >
                    {isActive && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: tab.gradient }}>
                      <Icon name={tab.icon as any} size={22} className="text-white" />
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`absolute top-2 right-2 min-w-[20px] h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 ${
                        tab.key === 'verification' || tab.key === 'amal' || tab.key === 'field_agents' ? 'bg-red-500 animate-pulse' : isActive ? 'bg-white/30' : 'bg-red-500'
                      }`}>{tab.badge}</span>
                    )}
                  </button>
                );
              })}

              {/* Master Products & Catalog Management → /admin/products */}
              <Link
                href="/admin/products"
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center overflow-hidden col-span-2 sm:col-span-3 md:col-span-2"
              >
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="min-w-[20px] h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5" title="إجمالي المنتجات">
                    📦 {analytics.totalProducts}
                  </span>
                  <span className="min-w-[20px] h-5 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5" title="طلبات اليوم النشطة">
                    🔥 {liveOrders.filter((o: any) => o.created_at && new Date(o.created_at).toDateString() === new Date().toDateString()).length}
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#2563EB,#7C3AED)' }}>
                  <Icon name="ShoppingBagIcon" size={22} className="text-white" />
                </div>
                <span className="text-sm font-bold leading-tight text-slate-100">إدارة المنتجات والكتالوج</span>
                <span className="text-[11px] leading-snug text-slate-400">مراقبة كافة منتجات المتجر، اعتماد العروض، وتتبع المبيعات والشحنات اليومية مع ربط المصانع والمناديب</span>
              </Link>

              {/* Integrated B2B Freight & B2C Last-Mile Logistics Center → /admin/logistics */}
              <Link
                href="/admin/logistics"
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center overflow-hidden col-span-2 sm:col-span-3 md:col-span-2"
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#0EA5E9,#2563EB)' }}>
                  <Icon name="TruckIcon" size={22} className="text-white" />
                </div>
                <span className="text-sm font-bold leading-tight text-slate-100">بوابة اللوجستيات وسلاسل الإمداد والتوصيل</span>
                <span className="text-[11px] leading-snug text-slate-400">مركز قيادة الشحن التجاري B2B والتوصيل السريع B2C، دليل الشركاء، وتعيين كادر اللوجستيات</span>
              </Link>

              {/* Field Force, Factory KYC & Master Catalog Command Center → /admin/field-ops */}
              <Link
                href="/admin/field-ops"
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center overflow-hidden col-span-2 sm:col-span-3 md:col-span-2"
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#10B981,#0EA5E9)' }}>
                  <Icon name="UserGroupIcon" size={22} className="text-white" />
                </div>
                <span className="text-sm font-bold leading-tight text-slate-100">بوابة الميدان والمصانع والكتالوج الشامل</span>
                <span className="text-[11px] leading-snug text-slate-400">إدارة المناديب، توثيق المصانع، الكتالوج الشامل، ومهام التفتيش الميداني، وتعيين مشرفي الميدان</span>
              </Link>

              {/* Financial Escrow, Treasury & Commission Clearing Engine → /admin/finance */}
              <Link
                href="/admin/finance"
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center overflow-hidden col-span-2 sm:col-span-3 md:col-span-2"
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)' }}>
                  <Icon name="BanknotesIcon" size={22} className="text-white" />
                </div>
                <span className="text-sm font-bold leading-tight text-slate-100">بوابة الضمان المالي والخزينة المركزية</span>
                <span className="text-[11px] leading-snug text-slate-400">دورة الضمان المرحلي، مراجعة سندات الإيداع، عمولات المناديب، وسجل التسويات</span>
              </Link>

              {/* System Engineering & Observability Command Center → /admin/system */}
              <Link
                href="/admin/system"
                className="relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center overflow-hidden col-span-2 sm:col-span-3 md:col-span-2"
              >
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#6366F1,#06B6D4)' }}>
                  <Icon name="CpuChipIcon" size={22} className="text-white" />
                </div>
                <span className="text-sm font-bold leading-tight text-slate-100">بوابة الهندسة والنظام والبنية التحتية</span>
                <span className="text-[11px] leading-snug text-slate-400">صحة الخوادم، بوابات الربط، سجل الأخطاء، التدقيق الأمني، ومفاتيح الصيانة</span>
              </Link>
            </div>
          </div>

          {/* Section 2: Messaging & Communication */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">المراسلة والتواصل</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'messages', label: ui.tabs.messages, icon: 'ChatBubbleLeftRightIcon', gradient: 'linear-gradient(135deg,#6366F1,#4F46E5)' },
                { key: 'direct_orders', label: ui.tabs.direct_orders, icon: 'PaperAirplaneIcon', gradient: 'linear-gradient(135deg,#06B6D4,#0891B2)' },
                { key: 'admin_messaging', label: 'المراسلة المتكاملة', icon: 'ChatBubbleLeftRightIcon', gradient: 'linear-gradient(135deg,#D97706,#B45309)' },
                { key: 'whatsapp_automation', label: ui.tabs.whatsapp_automation, icon: 'ChatBubbleLeftRightIcon', gradient: 'linear-gradient(135deg,#16A34A,#15803D)' },
                { key: 'buyer_seller_chat', label: ui.tabs.buyer_seller_chat, icon: 'ChatBubbleLeftRightIcon', gradient: 'linear-gradient(135deg,#7C3AED,#6D28D9)' },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as ActiveTab);
                      if (tab.key === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (tab.key === 'payments' && allPayments.length === 0) fetchPayments();
                      if (tab.key === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                      isActive
                        ? 'border-transparent shadow-xl scale-[1.03]'
                        : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5'
                    }`}
                    style={isActive ? { background: tab.gradient, boxShadow: '0 8px 28px -4px rgba(0,0,0,0.35)' } : {}}
                  >
                    {isActive && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: tab.gradient }}>
                      <Icon name={tab.icon as any} size={22} className="text-white" />
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Finance & Escrow */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">المالية والضمان</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'payments', label: ui.tabs.payments, icon: 'CreditCardIcon', gradient: 'linear-gradient(135deg,#16A34A,#15803D)' },
                { key: 'pending_payment_approval', label: 'اعتماد المدفوعات', icon: 'ClockIcon', gradient: 'linear-gradient(135deg,#D97706,#B45309)' },
                { key: 'accounts', label: ui.tabs.accounts, icon: 'BanknotesIcon', gradient: 'linear-gradient(135deg,#65A30D,#4D7C0F)' },
                { key: 'phased_escrow', label: ui.tabs.phased_escrow, icon: 'BanknotesIcon', gradient: 'linear-gradient(135deg,#C026D3,#A21CAF)' },
                { key: 'iban_verification', label: ui.tabs.iban_verification, icon: 'ShieldCheckIcon', gradient: 'linear-gradient(135deg,#2563EB,#1D4ED8)' },
                { key: 'treasury', label: 'خزينة المنصة', icon: 'BanknotesIcon', gradient: 'linear-gradient(135deg,#065F46,#047857)' },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as ActiveTab);
                      if (tab.key === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (tab.key === 'payments' && allPayments.length === 0) fetchPayments();
                      if (tab.key === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                      isActive
                        ? 'border-transparent shadow-xl scale-[1.03]'
                        : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5'
                    }`}
                    style={isActive ? { background: tab.gradient, boxShadow: '0 8px 28px -4px rgba(0,0,0,0.35)' } : {}}
                  >
                    {isActive && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: tab.gradient }}>
                      <Icon name={tab.icon as any} size={22} className="text-white" />
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Commerce, Payments & Logistics */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">التجارة والمدفوعات واللوجستيات</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'rfq_management', label: ui.tabs.rfq_management, icon: 'DocumentTextIcon', gradient: 'linear-gradient(135deg,#6366F1,#4F46E5)' },
                { key: 'logistics', label: ui.tabs.logistics, icon: 'TruckIcon', gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)' },
                { key: 'logistics_dashboard', label: 'لوحة اللوجستيات', icon: 'ChartBarSquareIcon', gradient: 'linear-gradient(135deg,#EA580C,#C2410C)' },
                { key: 'logistics_disputes', label: 'نزاعات اللوجستيات', icon: 'ScaleIcon', gradient: 'linear-gradient(135deg,#DC2626,#991B1B)' },
                { key: 'international_factories', label: 'المصانع الدولية', icon: 'GlobeAltIcon', gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)' },
                { key: 'supplier_dashboard', label: 'لوحة المورد التجاري', icon: 'BuildingStorefrontIcon', gradient: 'linear-gradient(135deg,#D4AF37,#B8860B)' },
                { key: 'abandoned_cart', label: 'عربات متروكة', icon: 'ShoppingCartIcon', gradient: 'linear-gradient(135deg,#F97316,#EA580C)' },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as ActiveTab);
                      if (tab.key === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (tab.key === 'payments' && allPayments.length === 0) fetchPayments();
                      if (tab.key === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                      isActive
                        ? 'border-transparent shadow-xl scale-[1.03]'
                        : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5'
                    }`}
                    style={isActive ? { background: tab.gradient, boxShadow: '0 8px 28px -4px rgba(0,0,0,0.35)' } : {}}
                  >
                    {isActive && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: tab.gradient }}>
                      <Icon name={tab.icon as any} size={22} className="text-white" />
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4.5: Notifications & Broadcast — الإشعارات والبث */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">
              الإشعارات والبث
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'broadcast_center', label: 'مركز البث', icon: 'MegaphoneIcon', gradient: 'linear-gradient(135deg,#A855F7,#7C3AED)' },
                { key: 'push_scheduler', label: 'جدولة الإشعارات', icon: 'BellAlertIcon', gradient: 'linear-gradient(135deg,#7C3AED,#5B21B6)' },
                { key: 'changelog', label: ui.tabs.changelog, icon: 'MegaphoneIcon', gradient: 'linear-gradient(135deg,#F97316,#EA580C)' },
                { key: 'supplier_alerts', label: ui.tabs.supplier_alerts, icon: 'BellAlertIcon', gradient: 'linear-gradient(135deg,#DC2626,#B91C1C)' },
                { key: 'executive_radar', label: ui.tabs.executive_radar, icon: 'SignalIcon', gradient: 'linear-gradient(135deg,#1E293B,#0F172A)' },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as ActiveTab)}
                    className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left ${
                      isActive
                        ? 'border-white/20 shadow-lg scale-[1.02]'
                        : 'border-slate-700 hover:border-slate-600 hover:scale-[1.01]'
                    }`}
                    style={isActive ? { background: tab.gradient } : { background: 'rgba(30,41,59,0.8)' }}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                      <Icon name={tab.icon as any} size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                    </div>
                    <span className={`text-xs font-semibold leading-tight ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

{/* Section 5: Compliance & Verification */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">الامتثال والتحقق</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'ocr_verification', label: ui.tabs.ocr_verification, icon: 'DocumentMagnifyingGlassIcon', gradient: 'linear-gradient(135deg,#EA580C,#C2410C)' },
                { key: 'manual_review_queue', label: ui.tabs.manual_review_queue, icon: 'UserGroupIcon', gradient: 'linear-gradient(135deg,#D97706,#B45309)' },
                { key: 'customs_validator', label: ui.tabs.customs_validator, icon: 'DocumentCheckIcon', gradient: 'linear-gradient(135deg,#0D9488,#0F766E)' },
                { key: 'smart_rfq_routing', label: ui.tabs.smart_rfq_routing, icon: 'SparklesIcon', gradient: 'linear-gradient(135deg,#6D28D9,#5B21B6)', badge: liveRFQs.filter((r: any) => !r.ai_routed).length || undefined },
                { key: 'ai_auditor', label: ui.tabs.ai_auditor, icon: 'ShieldCheckIcon', gradient: 'linear-gradient(135deg,#1E293B,#0F172A)' },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as ActiveTab);
                      if (tab.key === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (tab.key === 'payments' && allPayments.length === 0) fetchPayments();
                      if (tab.key === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                      isActive
                        ? 'border-transparent shadow-xl scale-[1.03]'
                        : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5'
                    }`}
                    style={isActive ? { background: tab.gradient, boxShadow: '0 8px 28px -4px rgba(0,0,0,0.35)' } : {}}
                  >
                    {isActive && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: tab.gradient }}>
                      <Icon name={tab.icon as any} size={22} className="text-white" />
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`absolute top-2 right-2 min-w-[20px] h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 ${isActive ? 'bg-white/30' : 'bg-red-500'}`}>{tab.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 6: Platform & System */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">المنصة والنظام</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                { key: 'live_infra', label: ui.tabs.live_infra, icon: 'SignalIcon', gradient: 'linear-gradient(135deg,#10B981,#059669)' },
                { key: 'sitemap_hub', label: ui.tabs.sitemap_hub, icon: 'MapIcon', gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)' },
                { key: 'system_health', label: ui.tabs.system_health, icon: 'ServerStackIcon', gradient: 'linear-gradient(135deg,#475569,#334155)' },
                { key: 'platform_diagnostics', label: ui.tabs.platform_diagnostics, icon: 'BugAntIcon', gradient: 'linear-gradient(135deg,#DC2626,#B91C1C)' },
                { key: 'amal_logs', label: ui.tabs.amal_logs, icon: 'ChatBubbleLeftEllipsisIcon', gradient: 'linear-gradient(135deg,#F97316,#EA580C)' },
                { key: 'issue_cards', label: ui.tabs.issue_cards, icon: 'RectangleStackIcon', gradient: 'linear-gradient(135deg,#7C3AED,#6D28D9)' },
                { key: 'idea_generator', label: ui.tabs.idea_generator, icon: 'LightBulbIcon', gradient: 'linear-gradient(135deg,#7C3AED,#6D28D9)' },
                { key: 'db_explorer', label: ui.tabs.db_explorer, icon: 'CircleStackIcon', gradient: 'linear-gradient(135deg,#334155,#1E293B)' },
                { key: 'role_simulation', label: 'محاكاة الأدوار', icon: 'UserGroupIcon', gradient: 'linear-gradient(135deg,#4F46E5,#6366F1)' },
                { key: 'sitemap_hub', label: 'دليل الصفحات', icon: 'MapIcon', gradient: 'linear-gradient(135deg,#E11D48,#BE123C)' },
              ].map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key as ActiveTab);
                      if (tab.key === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (tab.key === 'payments' && allPayments.length === 0) fetchPayments();
                      if (tab.key === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                      isActive
                        ? 'border-transparent shadow-xl scale-[1.03]'
                        : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:bg-[#1c2330] hover:shadow-md hover:-translate-y-0.5'
                    }`}
                    style={isActive ? { background: tab.gradient, boxShadow: '0 8px 28px -4px rgba(0,0,0,0.35)' } : {}}
                  >
                    {isActive && <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 60%)' }} />}
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all" style={isActive ? { background: 'rgba(255,255,255,0.22)' } : { background: tab.gradient }}>
                      <Icon name={tab.icon as any} size={22} className="text-white" />
                    </div>
                    <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : 'text-[#8b949e]'}`}>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Full-Screen Section View (all tabs except overview) ─────────────── */}
        <div
          className={activeTab === 'overview' ? 'contents' : 'fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden'}
          dir={dir}
        >
          {activeTab !== 'overview' && (
            <div className="sticky top-0 z-10 shrink-0 w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('overview')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-bold transition-colors shrink-0"
              >
                <Icon name={isRTL ? 'ArrowRightIcon' : 'ArrowLeftIcon'} size={16} className="text-slate-100" />
                <span className="hidden sm:inline">العودة للوحة الإدارة</span>
                <span className="sm:hidden">رجوع</span>
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">
                  {(ui.tabs as Record<string, string>)[activeTab] || activeTab}
                </h2>
                {(() => {
                  const counters: Partial<Record<ActiveTab, number>> = {
                    escrow: escrowOrders.filter((o: any) => ['pending_verification', 'funds_secured', 'ready_for_inspection', 'pending_admin_payout'].includes(o.escrow_status)).length,
                    verification: pendingCount,
                    users: analytics.totalUsers,
                    factories: analytics.activeFactories,
                    field_agents: pendingLicenses.length,
                    rfq_management: liveRFQs.filter((r: any) => r.status === 'pending').length,
                    amal: criticalAlertCount,
                  };
                  const count = counters[activeTab];
                  return count ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">{count}</span>
                  ) : null;
                })()}
              </div>
              <button
                onClick={() => setActiveTab('overview')}
                aria-label="إغلاق"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-red-600 text-slate-100 transition-colors shrink-0"
              >
                <Icon name="XMarkIcon" size={18} className="text-slate-100" />
              </button>
            </div>
          )}
          <div className={activeTab === 'overview' ? 'contents' : 'flex-1 overflow-y-auto p-4 pb-28 space-y-4 bg-background'}>

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: AMAL — Operations Manager
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'escrow' && (() => {
          // Lazy-load escrow orders when tab is first opened
          if (!escrowLoaded && !escrowLoading) {
            setEscrowLoaded(true);
            fetchEscrowOrders();
          }

          const ESCROW_STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; actionLabel?: string }> = {
            pending_payment: { label: 'Pending Payment', labelAr: 'في انتظار الدفع', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            pending_verification: { label: 'Verifying Payment', labelAr: 'التحقق من الدفع', color: 'bg-blue-50 text-blue-700 border-blue-200', actionLabel: 'Verify Payment' },
            funds_secured: { label: 'Funds Secured', labelAr: 'الأموال محجوزة', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', actionLabel: 'Mark Shipped' },
            shipped: { label: 'Shipped', labelAr: 'تم الشحن', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            ready_for_inspection: { label: 'Ready for Inspection', labelAr: '🔍 جاهز للفحص', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            pending_otp_confirmation: { label: 'Awaiting OTP', labelAr: 'في انتظار OTP', color: 'bg-orange-50 text-orange-700 border-orange-200' },
            pending_admin_payout: { label: 'Awaiting Payout Approval', labelAr: 'بانتظار صرف المستحقات', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', actionLabel: 'صرف المستحقات' },
            funds_released: { label: '🟢 Funds Released', labelAr: '🟢 مكتمل — تم تحرير الأموال', color: 'bg-green-50 text-green-700 border-green-200' },
          };

          const actionableOrders = escrowOrders.filter((o: any) =>
            ['pending_verification', 'funds_secured', 'ready_for_inspection', 'pending_admin_payout'].includes(o.escrow_status)
          );

          const pendingPayoutOrders = escrowOrders.filter((o: any) => o.escrow_status === 'pending_admin_payout');

          // ── Financial Analytics Calculations ──────────────────────────────────
          const releasedOrders = escrowOrders.filter((o: any) => o.escrow_status === 'funds_released');
          const heldOrders = escrowOrders.filter((o: any) =>
            ['pending_verification', 'funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout'].includes(o.escrow_status)
          );
          const totalHeld = heldOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
          const totalPaidOut = releasedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
          const totalCommissions = escrowOrders.reduce((sum: number, o: any) => sum + (o.platform_commission || 0), 0);
          const totalEscrowVolume = escrowOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
          const avgCommissionRate = totalEscrowVolume > 0 ? ((totalCommissions / totalEscrowVolume) * 100).toFixed(1) : '0';

          return (
            <div className="space-y-5">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Icon name="ShieldCheckIcon" size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{ui.escrowSub.title}</h2>
                    <p className="text-sm text-white/80">{ui.escrowSub.subtitle}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-2xl font-bold">{actionableOrders.length}</p>
                    <p className="text-xs text-white/70">{ui.escrowSub.needsAction}</p>
                  </div>
                </div>
              </div>

              {/* ── Escrow Sub-Navigation ─────────────────────────────────────── */}
              <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-xl">
                {[
                  { key: 'orders', label: ui.escrowSub.orders, icon: 'ShieldCheckIcon' },
                  { key: 'payout', label: ui.escrowSub.payout, icon: 'BanknotesIcon', badge: pendingPayoutOrders.length },
                  { key: 'disputes', label: ui.escrowSub.disputes, icon: 'ShieldExclamationIcon', badge: escrowOrders.filter((o: any) => o.escrow_status === 'escrow_frozen' || (o.dispute_status && !['resolved_refund','resolved_no_refund'].includes(o.dispute_status))).length, badgeColor: 'bg-red-500' },
                  { key: 'bank_accounts', label: ui.escrowSub.bank_accounts, icon: 'BuildingLibraryIcon', badge: allBankAccounts.filter(a => a.status === 'pending_review').length, badgeColor: 'bg-amber-500' },
                  { key: 'analytics', label: ui.escrowSub.analytics, icon: 'ChartBarIcon' },
                ].map((st: any) => (
                  <button
                    key={st.key}
                    onClick={() => {
                      setEscrowSubTab(st.key);
                      if (st.key === 'bank_accounts') fetchAllBankAccounts();
                      if (st.key === 'disputes' && !disputesLoaded) {
                        setDisputesLoaded(true);
                        fetchDisputeOrders();
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors relative ${
                      escrowSubTab === st.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name={st.icon} size={14} />
                    {st.label}
                    {st.badge !== undefined && st.badge > 0 && (
                      <span className={`min-w-[16px] h-4 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 ${st.badgeColor || 'bg-primary/80'}`}>
                        {st.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <EscrowHealthMeter />

              {/* ══════════════════════════════════════════════════════════════
                  SUB-TAB: BANK ACCOUNTS APPROVAL
              ══════════════════════════════════════════════════════════════ */}
              {escrowSubTab === 'bank_accounts' && (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon name="BuildingLibraryIcon" size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold">مركز اعتماد الحسابات البنكية</h2>
                        <p className="text-sm text-white/80">مراجعة واعتماد الحسابات البنكية المقدمة من المصانع</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-bold">{allBankAccounts.filter(a => a.status === 'pending_review').length}</p>
                        <p className="text-xs text-white/70">بانتظار المراجعة</p>
                      </div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <Icon name="ShieldExclamationIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">بروتوكول الأمان المالي</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        لا يمكن للمصنع استخدام أي حساب بنكي جديد إلا بعد موافقتك الصريحة. تحقق من صحة البيانات قبل الاعتماد لضمان منع الاحتيال.
                      </p>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  {(() => {
                    const pendingAccounts = allBankAccounts.filter(a => a.status === 'pending_review');
                    const approvedAccounts = allBankAccounts.filter(a => a.status === 'approved');
                    const rejectedAccounts = allBankAccounts.filter(a => a.status === 'rejected');
                    const ACCOUNT_TYPE_LABELS: Record<string, string> = {
                      local_collection: 'حساب تحصيل محلي',international_supply: 'حساب توريد دولي',local_general: 'حساب محلي عام',international_general: 'حساب دولي عام',
                    };

                    const renderAccountCard = (account: BankAccount, showActions: boolean) => (
                      <div key={account.id} className={`bg-card border rounded-2xl overflow-hidden ${account.status === 'approved' ? 'border-green-200' : account.status === 'rejected' ? 'border-red-200' : 'border-amber-300'}`}>
                        {/* Card Header */}
                        <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${account.status === 'approved' ? 'bg-green-50/50 border-green-100' : account.status === 'rejected' ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-200'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon name="BuildingLibraryIcon" size={15} className="text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{account.bank_name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {account.user_profiles?.company_name || account.user_profiles?.full_name || 'مصنع'} — {account.user_profiles?.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                              account.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                              account.status === 'rejected'? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {account.status === 'approved' ? '✅ معتمد' : account.status === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة'}
                            </span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">اسم صاحب الحساب</p>
                              <p className="font-semibold text-foreground">{account.account_holder_name}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">تصنيف الحساب</p>
                              <p className="font-semibold text-foreground">{account.account_type_label || ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">رقم الحساب</p>
                              <p className="font-mono font-semibold text-foreground">{account.account_number}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">العملة</p>
                              <p className="font-semibold text-foreground">{account.currency}</p>
                            </div>
                            {account.iban && (
                              <div className="col-span-2">
                                <p className="text-muted-foreground mb-0.5">IBAN</p>
                                <p className="font-mono font-semibold text-foreground text-[11px] break-all">{account.iban}</p>
                              </div>
                            )}
                            {account.swift_bic && (
                              <div>
                                <p className="text-muted-foreground mb-0.5">SWIFT / BIC</p>
                                <p className="font-mono font-semibold text-foreground">{account.swift_bic}</p>
                              </div>
                            )}
                          </div>

                          {account.admin_note && (
                            <div className={`rounded-lg px-3 py-2 text-xs ${account.status === 'rejected' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-muted/50 text-muted-foreground'}`}>
                              <span className="font-bold">ملاحظة الإدارة: </span>{account.admin_note}
                            </div>
                          )}

                          {/* Admin Actions */}
                          {showActions && (
                            <div className="space-y-2 pt-1 border-t border-border">
                              <div>
                                <label className="text-xs font-semibold text-foreground mb-1 block">ملاحظة الإدارة (مطلوبة عند الرفض)</label>
                                <input
                                  type="text"
                                  value={bankAccountNote}
                                  onChange={e => setBankAccountNote(e.target.value)}
                                  placeholder="سبب الرفض أو ملاحظة للمصنع..."
                                  className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveBankAccount(account.id)}
                                  disabled={bankAccountActionLoading}
                                  className="flex-1 h-9 bg-green-600 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors"
                                >
                                  {bankAccountActionLoading ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="CheckBadgeIcon" size={14} />}
                                  اعتماد الحساب
                                </button>
                                <button
                                  onClick={() => handleRejectBankAccount(account.id)}
                                  disabled={bankAccountActionLoading}
                                  className="flex-1 h-9 bg-red-50 text-red-700 border border-red-300 text-xs font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors"
                                >
                                  {bankAccountActionLoading ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="XCircleIcon" size={14} />}
                                  رفض
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    return (
                      <>
                        {bankAccountsLoading ? (
                          <div className="flex items-center justify-center py-16">
                            <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Pending Review */}
                            {pendingAccounts.length > 0 && (
                              <div>
                                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                  بانتظار المراجعة ({pendingAccounts.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {pendingAccounts.map(a => renderAccountCard(a, true))}
                                </div>
                              </div>
                            )}

                            {/* Approved */}
                            {approvedAccounts.length > 0 && (
                              <div>
                                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                  <Icon name="CheckBadgeIcon" size={14} className="text-green-600" />
                                  الحسابات المعتمدة ({approvedAccounts.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {approvedAccounts.map(a => renderAccountCard(a, false))}
                                </div>
                              </div>
                            )}

                            {/* Rejected */}
                            {rejectedAccounts.length > 0 && (
                              <div>
                                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                  <Icon name="XCircleIcon" size={14} className="text-red-500" />
                                  الحسابات المرفوضة ({rejectedAccounts.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {rejectedAccounts.map(a => renderAccountCard(a, false))}
                                </div>
                              </div>
                            )}

                            {allBankAccounts.length === 0 && (
                              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                                  <Icon name="BuildingLibraryIcon" size={28} className="text-muted-foreground" />
                                </div>
                                <p className="text-sm font-semibold text-foreground mb-1">لا توجد حسابات بنكية مقدمة</p>
                                <p className="text-xs text-muted-foreground">لم يقم أي مصنع بإضافة حسابات بنكية بعد</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  SUB-TAB: FINANCIAL ANALYTICS
              ══════════════════════════════════════════════════════════════ */}
              {escrowSubTab === 'analytics' && (
                <div className="space-y-5">
                  {/* Primary Financial KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: 'إجمالي الأموال المعلقة',
                        value: `$${totalHeld.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                        sublabel: `${heldOrders.length} طلب نشط`,
                        icon: 'LockClosedIcon',color: 'text-indigo-600 bg-indigo-50',border: 'border-indigo-200',
                      },
                      {
                        label: 'إجمالي المصروف للمصانع',
                        value: `$${totalPaidOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                        sublabel: `${releasedOrders.length} طلب مكتمل`,
                        icon: 'ArrowUpRightIcon',color: 'text-green-600 bg-green-50',border: 'border-green-200',
                      },
                      {
                        label: 'عمولات المنصة',
                        value: `$${totalCommissions.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                        sublabel: `${avgCommissionRate}% متوسط العمولة`,
                        icon: 'CurrencyDollarIcon',color: 'text-amber-600 bg-amber-50',border: 'border-amber-200',
                      },
                      {
                        label: 'إجمالي حجم الضمان',
                        value: `$${totalEscrowVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                        sublabel: `${escrowOrders.length} طلب إجمالي`,
                        icon: 'BanknotesIcon',color: 'text-blue-600 bg-blue-50',border: 'border-blue-200',
                      },
                    ].map((kpi) => (
                      <div key={kpi.label} className={`bg-card border ${kpi.border} rounded-xl p-4`}>
                        <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center mb-3`}>
                          <Icon name={kpi.icon as any} size={20} />
                        </div>
                        <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{kpi.sublabel}</p>
                      </div>
                    ))}
                  </div>

                  {/* Fund Flow Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Status Distribution */}
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Icon name="ChartPieIcon" size={16} className="text-primary" />
                        <h3 className="text-sm font-bold text-foreground">توزيع حالات الضمان</h3>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: 'في انتظار التحقق', count: escrowOrders.filter((o: any) => o.escrow_status === 'pending_verification').length, color: 'bg-blue-500', textColor: 'text-blue-700', bg: 'bg-blue-50' },
                          { label: 'الأموال محجوزة', count: escrowOrders.filter((o: any) => o.escrow_status === 'funds_secured').length, color: 'bg-indigo-500', textColor: 'text-indigo-700', bg: 'bg-indigo-50' },
                          { label: 'تم الشحن', count: escrowOrders.filter((o: any) => o.escrow_status === 'shipped').length, color: 'bg-purple-500', textColor: 'text-purple-700', bg: 'bg-purple-50' },
                          { label: '🔍 جاهز للفحص', count: escrowOrders.filter((o: any) => o.escrow_status === 'ready_for_inspection').length, color: 'bg-amber-500', textColor: 'text-amber-700', bg: 'bg-amber-50' },
                          { label: 'بانتظار التأكيد', count: escrowOrders.filter((o: any) => o.escrow_status === 'pending_otp_confirmation').length, color: 'bg-orange-500', textColor: 'text-orange-700', bg: 'bg-orange-50' },
                          { label: 'بانتظار صرف المستحقات', count: pendingPayoutOrders.length, color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-50' },
                          { label: '🟢 مكتمل — تم تحرير الأموال', count: releasedOrders.length, color: 'bg-green-500', textColor: 'text-green-700', bg: 'bg-green-50' },
                        ].map((item) => {
                          const total = escrowOrders.length || 1;
                          const pct = Math.round((item.count / total) * 100);
                          return (
                            <div key={item.label} className={`${item.bg} rounded-lg px-3 py-2.5`}>
                              <div className="flex items-center justify-between mb-1.5">
                                <p className={`text-xs font-semibold ${item.textColor}`}>{item.label}</p>
                                <span className={`text-sm font-bold ${item.textColor}`}>{item.count}</span>
                              </div>
                              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                                <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% من الإجمالي</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Financial Flow Summary */}
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Icon name="ArrowsRightLeftIcon" size={16} className="text-primary" />
                        <h3 className="text-sm font-bold text-foreground">ملخص التدفق المالي</h3>
                      </div>
                      <div className="space-y-3">
                        {/* Held funds bar */}
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon name="LockClosedIcon" size={15} className="text-indigo-600" />
                              <p className="text-xs font-semibold text-indigo-800">أموال معلقة في الضمان</p>
                            </div>
                            <p className="text-base font-bold text-indigo-700">${totalHeld.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <p className="text-[10px] text-indigo-600">{heldOrders.length} طلب نشط — الأموال محمية حتى تأكيد الاستلام</p>
                        </div>

                        {/* Paid out bar */}
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon name="ArrowUpRightIcon" size={15} className="text-green-600" />
                              <p className="text-xs font-semibold text-green-800">مصروف للمصانع</p>
                            </div>
                            <p className="text-base font-bold text-green-700">${totalPaidOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <p className="text-[10px] text-green-600">{releasedOrders.length} طلب مكتمل — تم صرف المستحقات بنجاح</p>
                        </div>

                        {/* Commission bar */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon name="CurrencyDollarIcon" size={15} className="text-amber-600" />
                              <p className="text-xs font-semibold text-amber-800">عمولات المنصة المحصّلة</p>
                            </div>
                            <p className="text-base font-bold text-amber-700">${totalCommissions.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                          </div>
                          <p className="text-[10px] text-amber-600">متوسط {avgCommissionRate}% من قيمة الطلبات</p>
                        </div>

                        {/* Pending payout alert */}
                        {pendingPayoutOrders.length > 0 && (
                          <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-xs font-bold text-emerald-800">بانتظار صرف المستحقات</p>
                              </div>
                              <p className="text-base font-bold text-emerald-700">
                                ${pendingPayoutOrders.reduce((s: number, o: any) => s + (o.total || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <p className="text-[10px] text-emerald-700">{pendingPayoutOrders.length} طلب جاهز للصرف — يحتاج موافقة الإدارة</p>
                            <button
                              onClick={() => setEscrowSubTab('payout')}
                              className="mt-2 text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                            >
                              الانتقال لمركز الصرف ←
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Completed Transactions */}
                  {releasedOrders.length > 0 && (
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Icon name="CheckBadgeIcon" size={15} className="text-green-600" />
                          <h3 className="text-sm font-bold text-foreground">آخر المعاملات المكتملة</h3>
                        </div>
                        <span className="text-xs text-muted-foreground">{releasedOrders.length} معاملة</span>
                      </div>
                      <div className="divide-y divide-border max-h-64 overflow-y-auto">
                        {releasedOrders.slice(0, 10).map((o: any) => (
                          <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                            <div className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                              <Icon name="CheckBadgeIcon" size={14} className="text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground font-mono">{o.order_number}</p>
                              <p className="text-[10px] text-muted-foreground">{o.user_profiles?.company_name || o.user_profiles?.full_name || 'مشتري'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-green-700">${(o.total || 0).toLocaleString('en-US')}</p>
                              {o.funds_released_at && (
                                <p className="text-[10px] text-muted-foreground">{formatDate(o.funds_released_at)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  SUB-TAB: PAYOUT CENTER (مركز صرف المستحقات)
              ══════════════════════════════════════════════════════════════ */}
              {escrowSubTab === 'payout' && (
                <div className="space-y-5">
                  {/* Payout Center Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-green-700 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon name="BanknotesIcon" size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold">مركز صرف مستحقات المصانع</h2>
                        <p className="text-sm text-white/80">الطلبات التي أكد المشتري استلامها وجاهزة لصرف المستحقات</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-3xl font-bold">{pendingPayoutOrders.length}</p>
                        <p className="text-xs text-white/70">بانتظار الصرف</p>
                      </div>
                    </div>
                  </div>

                  {/* Payout Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="ClockIcon" size={16} className="text-emerald-600" />
                        <p className="text-xs font-semibold text-emerald-800">إجمالي بانتظار الصرف</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-700">
                        ${pendingPayoutOrders.reduce((s: number, o: any) => s + (o.total || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">{pendingPayoutOrders.length} طلب</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="CheckBadgeIcon" size={16} className="text-green-600" />
                        <p className="text-xs font-semibold text-green-800">إجمالي تم صرفه</p>
                      </div>
                      <p className="text-2xl font-bold text-green-700">
                        ${totalPaidOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-green-600 mt-0.5">{releasedOrders.length} طلب مكتمل</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="CurrencyDollarIcon" size={16} className="text-amber-600" />
                        <p className="text-xs font-semibold text-amber-800">عمولات المنصة</p>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">
                        ${totalCommissions.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] text-amber-600 mt-0.5">{avgCommissionRate}% متوسط</p>
                    </div>
                  </div>

                  {pendingPayoutOrders.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-14 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                        <Icon name="CheckBadgeIcon" size={28} className="text-emerald-500" />
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-1">لا توجد مستحقات معلقة</h3>
                      <p className="text-sm text-muted-foreground">جميع المستحقات تم صرفها. ستظهر هنا الطلبات التي يؤكد فيها المشتري الاستلام.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                      {/* Payout Orders List */}
                      <div className="lg:col-span-2 space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">
                          {pendingPayoutOrders.length} طلب جاهز للصرف
                        </p>
                        {pendingPayoutOrders.map((order: any) => {
                          const isSelected = selectedEscrowOrder?.id === order.id;
                          const confirmedAt = order.buyer_confirmed_at || order.delivery_otp_verified_at;
                          return (
                            <button
                              key={order.id}
                              onClick={() => setSelectedEscrowOrder(order)}
                              className={`w-full text-right bg-card rounded-xl border-2 p-4 transition-all ${
                                isSelected
                                  ? 'border-emerald-500 shadow-sm bg-emerald-50/30': 'border-emerald-300 hover:border-emerald-500 bg-emerald-50/10'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                                  <p className="text-xs text-muted-foreground">{order.user_profiles?.company_name || order.user_profiles?.full_name || 'مشتري'}</p>
                                </div>
                                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  جاهز للصرف
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-base font-bold text-emerald-700">${(order.total || 0).toLocaleString('en-US')} USD</p>
                                {confirmedAt && (
                                  <p className="text-[10px] text-muted-foreground">
                                    تأكيد: {formatDate(confirmedAt)}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Payout Detail Panel */}
                      <div className="lg:col-span-3">
                        {!selectedEscrowOrder || selectedEscrowOrder.escrow_status !== 'pending_admin_payout' ? (
                          <div className="bg-card border border-border rounded-2xl p-14 text-center h-full flex flex-col items-center justify-center">
                            <Icon name="CursorArrowRaysIcon" size={36} className="text-muted-foreground mb-3" />
                            <p className="text-sm font-medium text-foreground">اختر طلباً لصرف مستحقاته</p>
                            <p className="text-xs text-muted-foreground mt-1">{ui.verification.selectRequestHint}</p>
                          </div>
                        ) : (
                          <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            {/* Order Header */}
                            <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-emerald-50/50 to-transparent">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-base font-bold text-foreground font-mono">{selectedEscrowOrder.order_number}</p>
                                  <p className="text-xs text-muted-foreground">{selectedEscrowOrder.user_profiles?.email}</p>
                                </div>
                                <p className="text-xl font-bold text-emerald-700">${(selectedEscrowOrder.total || 0).toLocaleString('en-US')} USD</p>
                              </div>
                            </div>

                            <div className="p-5 space-y-4">
                              {/* Buyer Confirmation Info */}
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Icon name="CheckBadgeIcon" size={16} className="text-emerald-600" />
                                  <p className="text-sm font-bold text-emerald-800">✅ المشتري أكد الاستلام والفحص</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-muted-foreground">المشتري</p>
                                    <p className="font-semibold text-foreground">{selectedEscrowOrder.user_profiles?.full_name || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">تاريخ التأكيد</p>
                                    <p className="font-semibold text-foreground">
                                      {selectedEscrowOrder.buyer_confirmed_at || selectedEscrowOrder.delivery_otp_verified_at
                                        ? new Date(selectedEscrowOrder.buyer_confirmed_at || selectedEscrowOrder.delivery_otp_verified_at).toLocaleString('ar-SA'): '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">المبلغ المحجوز</p>
                                    <p className="font-bold text-emerald-700">${(selectedEscrowOrder.total || 0).toLocaleString('en-US')} USD</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">عمولة المنصة</p>
                                    <p className="font-semibold text-foreground">${(selectedEscrowOrder.platform_commission || 0).toLocaleString('en-US')} USD</p>
                                  </div>
                                </div>
                              </div>

                              {/* Transaction Log */}
                              <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                  <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
                                  سجل المعاملة
                                </p>
                                {selectedEscrowOrder.payment_verified_at && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <span className="text-muted-foreground">تم التحقق من الدفع:</span>
                                    <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.payment_verified_at))}</span>
                                  </div>
                                )}
                                {selectedEscrowOrder.shipped_at && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                    <span className="text-muted-foreground">تاريخ الشحن:</span>
                                    <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.shipped_at))}</span>
                                  </div>
                                )}
                                {(selectedEscrowOrder.buyer_confirmed_at || selectedEscrowOrder.delivery_otp_verified_at) && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="text-muted-foreground">تأكيد الاستلام من المشتري:</span>
                                    <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.buyer_confirmed_at || selectedEscrowOrder.delivery_otp_verified_at))}</span>
                                  </div>
                                )}
                              </div>

                              {/* Bank Account Selector */}
                              {(() => {
                                // Load factory bank accounts when order is selected
                                if (selectedEscrowOrder?.manufacturer_id && factoryBankAccounts.length === 0 && !factoryBankLoading) {
                                  fetchFactoryBankAccounts(selectedEscrowOrder.manufacturer_id);
                                }
                                const ACCOUNT_TYPE_LABELS: Record<string, string> = {
                                  local_collection: 'حساب تحصيل محلي',international_supply: 'حساب توريد دولي',local_general: 'حساب محلي عام',international_general: 'حساب دولي عام',
                                };

                                // Build international wallet options from fetched settings
                                const intlWalletOptions: { id: string; label: string; detail: string; icon: string }[] = [];
                                if (factoryIntlWallets) {
                                  if (factoryIntlWallets.payoneer_email) intlWalletOptions.push({ id: 'payoneer', label: 'Payoneer', detail: factoryIntlWallets.payoneer_email + (factoryIntlWallets.payoneer_account_name ? ` — ${factoryIntlWallets.payoneer_account_name}` : ''), icon: '🌐' });
                                  if (factoryIntlWallets.wise_email) intlWalletOptions.push({ id: 'wise', label: 'Wise', detail: factoryIntlWallets.wise_email + (factoryIntlWallets.wise_currency ? ` (${factoryIntlWallets.wise_currency})` : ''), icon: '💱' });
                                  if (factoryIntlWallets.usdt_wallet_address) intlWalletOptions.push({ id: 'usdt', label: `USDT (${factoryIntlWallets.usdt_network || 'TRC20'})`, detail: factoryIntlWallets.usdt_wallet_address.slice(0, 16) + '...', icon: '₮' });
                                  if (factoryIntlWallets.paypal_email) intlWalletOptions.push({ id: 'paypal', label: 'PayPal', detail: factoryIntlWallets.paypal_email + (factoryIntlWallets.paypal_account_name ? ` — ${factoryIntlWallets.paypal_account_name}` : ''), icon: '🅿' });
                                }

                                const hasIntlWallets = intlWalletOptions.length > 0;

                                return (
                                  <div className="space-y-3">
                                    {/* Method Tabs */}
                                    <div className="flex gap-1 bg-muted p-1 rounded-xl">
                                      <button
                                        onClick={() => setSelectedPayoutMethod('bank')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${selectedPayoutMethod === 'bank' ? 'bg-card text-blue-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                      >
                                        <Icon name="BuildingLibraryIcon" size={13} />
                                        الحسابات البنكية
                                      </button>
                                      <button
                                        onClick={() => setSelectedPayoutMethod('intl_wallet')}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${selectedPayoutMethod === 'intl_wallet' ? 'bg-card text-blue-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                      >
                                        <Icon name="GlobeAltIcon" size={13} />
                                        محافظ دولية
                                        {hasIntlWallets && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                      </button>
                                    </div>

                                    {selectedPayoutMethod === 'bank' && (
                                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Icon name="BuildingLibraryIcon" size={16} className="text-blue-600" />
                                          <p className="text-sm font-bold text-blue-900">اختر الحساب البنكي للتحويل</p>
                                        </div>
                                        {factoryBankLoading ? (
                                          <div className="flex items-center gap-2 text-xs text-blue-700">
                                            <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                                            جارٍ تحميل الحسابات المعتمدة...
                                          </div>
                                        ) : factoryBankAccounts.length === 0 ? (
                                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                                            <Icon name="ExclamationTriangleIcon" size={13} className="inline mr-1" />
                                            لا توجد حسابات بنكية معتمدة لهذا المصنع. يمكنك المتابعة بدون تحديد حساب.
                                          </div>
                                        ) : (
                                          <div className="space-y-2">
                                            {factoryBankAccounts.map(account => (
                                              <label key={account.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPayoutBankAccount === account.id ? 'border-blue-500 bg-blue-100' : 'border-blue-200 bg-white hover:border-blue-300'}`}>
                                                <input
                                                  type="radio"
                                                  name="payout_bank_account"
                                                  value={account.id}
                                                  checked={selectedPayoutBankAccount === account.id}
                                                  onChange={() => setSelectedPayoutBankAccount(account.id)}
                                                  className="mt-0.5 shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-xs font-bold text-foreground">{account.bank_name}</p>
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                                      {account.account_type_label || ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{account.currency}</span>
                                                  </div>
                                                  <p className="text-xs text-muted-foreground mt-0.5">{account.account_holder_name}</p>
                                                  <p className="text-xs font-mono text-foreground mt-0.5">{account.account_number}</p>
                                                  {account.iban && <p className="text-[10px] font-mono text-muted-foreground mt-0.5">IBAN: {account.iban}</p>}
                                                  {account.swift_bic && <p className="text-[10px] font-mono text-muted-foreground">SWIFT: {account.swift_bic}</p>}
                                                </div>
                                              </label>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {selectedPayoutMethod === 'intl_wallet' && (
                                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                          <Icon name="GlobeAltIcon" size={16} className="text-indigo-600" />
                                          <p className="text-sm font-bold text-indigo-900">المحافظ الإلكترونية العالمية</p>
                                        </div>
                                        {factoryBankLoading ? (
                                          <div className="flex items-center gap-2 text-xs text-indigo-700">
                                            <Icon name="ArrowPathIcon" size={13} className="animate-spin" />
                                            جارٍ تحميل بيانات المحافظ...
                                          </div>
                                        ) : intlWalletOptions.length === 0 ? (
                                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                                            <Icon name="ExclamationTriangleIcon" size={13} className="inline mr-1" />
                                            لم يُضف هذا المورد أي محفظة إلكترونية دولية بعد (Payoneer / Wise / USDT / PayPal).
                                          </div>
                                        ) : (
                                          <div className="space-y-2">
                                            {intlWalletOptions.map(opt => (
                                              <div key={opt.id} className="flex items-start gap-3 p-3 rounded-xl border border-indigo-200 bg-white">
                                                <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-xs font-bold text-foreground">{opt.label}</p>
                                                  <p className="text-xs font-mono text-muted-foreground mt-0.5 break-all">{opt.detail}</p>
                                                </div>
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">مُعدَّل</span>
                                              </div>
                                            ))}
                                            <div className="flex items-start gap-2 p-2.5 bg-indigo-100 rounded-lg text-xs text-indigo-700">
                                              <Icon name="InformationCircleIcon" size={13} className="shrink-0 mt-0.5" />
                                              <span>أدخل رقم المعاملة أو تفاصيل التحويل في حقل "ملاحظة الصرف" أدناه بعد إتمام التحويل.</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Payout Action */}
                              <div className="border-2 border-emerald-400 rounded-xl p-5 bg-gradient-to-br from-emerald-50 to-green-50 space-y-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                    <Icon name="BanknotesIcon" size={20} className="text-emerald-700" />
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-emerald-900">صرف المستحقات للمصنع</h4>
                                    <p className="text-xs text-emerald-700 mt-0.5">بالضغط على الزر أدناه، ستوافق على إطلاق الأموال للمصنع.</p>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-emerald-800 mb-1.5 block">ملاحظة الصرف (اختياري)</label>
                                  <input
                                    type="text"
                                    value={escrowReleaseNote}
                                    onChange={(e) => setEscrowReleaseNote(e.target.value)}
                                    placeholder="مثال: رقم التحويل TXN-2026-001"
                                    className="w-full h-9 px-3 rounded-lg border border-emerald-300 bg-white text-foreground text-xs focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <button
                                  onClick={() => handleAdminPayout(selectedEscrowOrder)}
                                  disabled={escrowActionLoading}
                                  className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200"
                                >
                                  {escrowActionLoading ? (
                                    <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ صرف المستحقات...</>
                                  ) : (
                                    <><Icon name="BanknotesIcon" size={18} /> صرف المستحقات</>
                                  )}
                                </button>
                                <p className="text-[10px] text-emerald-700 text-center">
                                  بالضغط على هذا الزر، ستتم الموافقة على إطلاق الأموال من المحفظة المعلقة إلى حساب المصنع وتحديث حالة الطلب إلى "مكتمل".
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  SUB-TAB: DISPUTE HANDLER — نظام إدارة النزاعات (المستويين)
              ══════════════════════════════════════════════════════════════ */}
              {escrowSubTab === 'disputes' && (
                <div className="space-y-5">
                  {/* Header Banner */}
                  <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <Icon name="ShieldExclamationIcon" size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold">{ui.escrowSub.level2Title}</h2>
                        <p className="text-sm text-white/80">النزاعات المُصعَّدة للإدارة · صلاحية حصرية · إطلاق الأموال أو الاسترجاع</p>
                      </div>
                      <div className="ml-auto text-right shrink-0">
                        <p className="text-2xl font-bold">{disputeOrders.filter((o: any) => o.dispute_status === 'escalated' || o.escrow_status === 'escrow_frozen_escalated').length}</p>
                        <p className="text-xs text-white/70">نزاع مُصعَّد</p>
                      </div>
                    </div>
                  </div>

                  {/* Master Control Notice */}
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                    <Icon name="ShieldCheckIcon" size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">صلاحية المدير الأصلي — Master Control</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        هذه النزاعات وصلت إليك بعد فشل المستوى الأول. أنت وحدك تملك زر "إطلاق الأموال للمصنع" أو "إرجاع المبلغ للمشتري". يمكنك الاطلاع على كامل تاريخ الشكوى وما دار بين المشتري والمصنع.
                      </p>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: '🚨 مُصعَّد — تدخل مطلوب', count: disputeOrders.filter((o: any) => o.dispute_status === 'escalated' || o.escrow_status === 'escrow_frozen_escalated').length, color: 'bg-red-50 text-red-700 border-red-200' },
                      { label: '🔒 محفظة مجمّدة (L1)', count: disputeOrders.filter((o: any) => o.escrow_status === 'escrow_frozen' && o.dispute_status !== 'escalated').length, color: 'bg-orange-50 text-orange-700 border-orange-200' },
                      { label: 'تأخر في التسليم', count: disputeOrders.filter((o: any) => o.dispute_reason === 'late_delivery').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                      { label: '✅ تم الاسترجاع', count: disputeOrders.filter((o: any) => o.escrow_status === 'refund_processed').length, color: 'bg-green-50 text-green-700 border-green-200' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                        <p className="text-2xl font-bold">{s.count}</p>
                        <p className="text-xs font-medium mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Escalated Disputes Alert */}
                  {disputeOrders.filter((o: any) => o.dispute_status === 'escalated' || o.escrow_status === 'escrow_frozen_escalated').length > 0 && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                        <Icon name="ExclamationCircleIcon" size={20} className="text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <h3 className="text-sm font-bold text-red-900">
                            {disputeOrders.filter((o: any) => o.dispute_status === 'escalated' || o.escrow_status === 'escrow_frozen_escalated').length} نزاع مُصعَّد — تدخل فوري مطلوب
                          </h3>
                        </div>
                        <p className="text-xs text-red-700">
                          هذه النزاعات وصلت للمستوى الثاني. المشترون رفضوا حلول المصانع. الأموال مجمّدة. أنت وحدك تملك صلاحية الفصل.
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-full">
                        <Icon name="ExclamationCircleIcon" size={12} />
                        إجراء مطلوب
                      </span>
                    </div>
                  )}

                  {/* Disputes List + Detail */}
                  {disputeLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                      {/* List */}
                      <div className="lg:col-span-2 space-y-2">
                        {disputeOrders.length === 0 ? (
                          <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <Icon name="CheckCircleIcon" size={28} className="text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">لا توجد نزاعات مفتوحة</p>
                            <button onClick={fetchDisputeOrders} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1 mx-auto">
                              <Icon name="ArrowPathIcon" size={12} /> تحديث
                            </button>
                          </div>
                        ) : disputeOrders.map((order: any) => {
                          const isEscalated = order.dispute_status === 'escalated' || order.escrow_status === 'escrow_frozen_escalated';
                          const isFrozen = order.escrow_status === 'escrow_frozen' && !isEscalated;
                          const isRefunded = order.escrow_status === 'refund_processed';
                          const isSelected = selectedDisputeOrder?.id === order.id;
                          return (
                            <button
                              key={order.id}
                              onClick={() => { setSelectedDisputeOrder(order); setDisputeResolutionNote(''); setDisputeActionMsg(''); }}
                              className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                                isSelected ? 'border-red-500 shadow-sm' :isEscalated ? 'border-red-400 bg-red-50/40': isFrozen ?'border-orange-300 bg-orange-50/20': isRefunded ?'border-green-300 bg-green-50/20' : 'border-border hover:border-red-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div>
                                  <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                                  <p className="text-xs text-muted-foreground">{order.user_profiles?.full_name || order.user_profiles?.company_name || 'المشتري'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {isEscalated && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                      🚨 مُصعَّد L2
                                    </span>
                                  )}
                                  {isFrozen && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                      🔒 L1 مجمّد
                                    </span>
                                  )}
                                  {isRefunded && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                                      ✅ تم الاسترجاع
                                    </span>
                                  )}
                                  {!isEscalated && !isFrozen && !isRefunded && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                      {order.dispute_status}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                  {order.dispute_reason === 'late_delivery' ? '⏰ تأخر تسليم' : '⚠️ عدم مطابقة'}
                                  {(order.dispute_tier === 2 || isEscalated) && <span className="ml-1 text-red-600 font-bold">· مستوى 2</span>}
                                </p>
                                <p className="text-sm font-bold text-red-700">${order.total?.toLocaleString('en-US')} USD</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Detail Panel */}
                      <div className="lg:col-span-3">
                        {!selectedDisputeOrder ? (
                          <div className="bg-card border border-border rounded-xl p-8 text-center">
                            <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">اختر نزاعاً لمراجعة تفاصيله</p>
                          </div>
                        ) : (
                          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-bold text-foreground">طلب {selectedDisputeOrder.order_number}</h3>
                              <div className="flex items-center gap-2">
                                {(selectedDisputeOrder.dispute_tier === 2 || selectedDisputeOrder.dispute_status === 'escalated') && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">🚨 مستوى 2</span>
                                )}
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                  selectedDisputeOrder.escrow_status === 'escrow_frozen_escalated' || selectedDisputeOrder.dispute_status === 'escalated' ? 'bg-red-50 text-red-700 border-red-200' :
                                  selectedDisputeOrder.escrow_status === 'escrow_frozen' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  selectedDisputeOrder.escrow_status === 'refund_processed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {selectedDisputeOrder.escrow_status === 'escrow_frozen_escalated' || selectedDisputeOrder.dispute_status === 'escalated' ? '🚨 مُصعَّد للإدارة' :
                                   selectedDisputeOrder.escrow_status === 'escrow_frozen' ? '🔒 محفظة مجمّدة' :
                                   selectedDisputeOrder.escrow_status === 'refund_processed' ? '✅ تم الاسترجاع' : selectedDisputeOrder.dispute_status}
                                </span>
                              </div>
                            </div>

                            {/* Buyer Info */}
                            <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground uppercase">المشتري</p>
                              <p className="text-sm font-semibold text-foreground">{selectedDisputeOrder.user_profiles?.full_name || 'غير محدد'}</p>
                              <p className="text-xs text-muted-foreground">{selectedDisputeOrder.user_profiles?.email}</p>
                              {selectedDisputeOrder.user_profiles?.company_name && (
                                <p className="text-xs text-muted-foreground">{selectedDisputeOrder.user_profiles.company_name}</p>
                              )}
                            </div>

                            {/* Dispute Details */}
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                              <p className="text-xs font-bold text-red-800 flex items-center gap-2">
                                <Icon name="FlagIcon" size={14} />
                                تفاصيل الشكوى
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">سبب الشكوى</p>
                                  <p className="font-bold text-red-700 mt-0.5">
                                    {selectedDisputeOrder.dispute_reason === 'late_delivery' ? '⏰ تأخر في التسليم' : '⚠️ عدم مطابقة المواصفات'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">تاريخ فتح الشكوى</p>
                                  <p className="font-semibold text-foreground mt-0.5">
                                    {selectedDisputeOrder.dispute_opened_at || selectedDisputeOrder.dispute_reported_at
                                      ? new Date(selectedDisputeOrder.dispute_opened_at || selectedDisputeOrder.dispute_reported_at).toLocaleString('ar-SA'): '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">المبلغ المجمّد</p>
                                  <p className="font-bold text-red-700 mt-0.5">${selectedDisputeOrder.total?.toLocaleString('en-US')} USD</p>
                                </div>
                                {selectedDisputeOrder.expected_delivery_date && (
                                  <div>
                                    <p className="text-muted-foreground">تاريخ التسليم المتوقع</p>
                                    <p className="font-semibold text-foreground mt-0.5">
                                      {formatDate(selectedDisputeOrder.expected_delivery_date)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Additional dispute fields */}
                            <div className="space-y-2">
                              {selectedDisputeOrder?.tier && (
                                <p className="text-sm">المرحلة: <span className="font-medium">Tier {selectedDisputeOrder.tier}</span></p>
                              )}
                              {selectedDisputeOrder?.factory_resolution_note && (
                                <p className="text-sm">ملاحظة المصنع: <span className="font-medium">{selectedDisputeOrder.factory_resolution_note}</span></p>
                              )}
                              {selectedDisputeOrder?.buyer_response && (
                                <p className="text-sm">رد المشتري: <span className="font-medium">{selectedDisputeOrder.buyer_response}</span></p>
                              )}
                              {selectedDisputeOrder?.description && (
                                <p className="text-sm">وصف النزاع: <span className="font-medium">{selectedDisputeOrder.description}</span></p>
                              )}
                            </div>

                            {/* Level 1 History */}
                            {(selectedDisputeOrder.factory_resolution_type || selectedDisputeOrder.escalated_at) && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                                <p className="text-xs font-bold text-blue-800 flex items-center gap-2">
                                  <Icon name="ClockIcon" size={13} />
                                  تاريخ المستوى الأول (المصنع والمشتري)
                                </p>
                                {selectedDisputeOrder.factory_resolution_type && (
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">الحل الذي قدّمه المصنع:</p>
                                    <p className="font-medium text-foreground mt-0.5 bg-white/60 rounded-lg p-2">{selectedDisputeOrder.factory_resolution_type}</p>
                                  </div>
                                )}
                                {selectedDisputeOrder.dispute_buyer_response && (
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">رد المشتري:</p>
                                    <p className={`font-bold mt-0.5 ${selectedDisputeOrder.dispute_buyer_response === 'rejected' ? 'text-red-700' : 'text-green-700'}`}>
                                      {selectedDisputeOrder.dispute_buyer_response === 'rejected' ? '❌ رفض الحل وصعّد للإدارة' : '✅ قبل الحل'}
                                    </p>
                                  </div>
                                )}
                                {selectedDisputeOrder.escalated_at && (
                                  <div className="text-xs">
                                    <p className="text-muted-foreground">تاريخ التصعيد للإدارة:</p>
                                    <p className="font-semibold text-red-700 mt-0.5">{formatTime(new Date(selectedDisputeOrder.escalated_at))}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Transaction Log */}
                            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
                                سجل المعاملة
                              </p>
                              {selectedDisputeOrder.payment_verified_at && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                  <span className="text-muted-foreground">تم التحقق من الدفع:</span>
                                  <span className="font-medium">{formatTime(new Date(selectedDisputeOrder.payment_verified_at))}</span>
                                </div>
                              )}
                              {selectedDisputeOrder.shipped_at && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                  <span className="text-muted-foreground">تاريخ الشحن:</span>
                                  <span className="font-medium">{formatTime(new Date(selectedDisputeOrder.shipped_at))}</span>
                                </div>
                              )}
                              {(selectedDisputeOrder.dispute_opened_at || selectedDisputeOrder.dispute_reported_at) && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                                  <span className="text-muted-foreground">فتح الشكوى (L1):</span>
                                  <span className="font-medium">{formatTime(new Date(selectedDisputeOrder.dispute_opened_at || selectedDisputeOrder.dispute_reported_at))}</span>
                                </div>
                              )}
                              {selectedDisputeOrder.dispute_escalated_at && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                  <span className="text-muted-foreground">تصعيد للإدارة (L2):</span>
                                  <span className="font-medium text-red-700">{formatTime(new Date(selectedDisputeOrder.dispute_escalated_at))}</span>
                                </div>
                              )}
                              {selectedDisputeOrder.refund_processed_at && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                  <span className="text-muted-foreground">تاريخ الاسترجاع:</span>
                                  <span className="font-medium">{formatTime(new Date(selectedDisputeOrder.refund_processed_at))}</span>
                                </div>
                              )}
                            </div>

                            {/* Admin Master Control — Only for escalated/frozen disputes */}
                            {(selectedDisputeOrder.escrow_status === 'escrow_frozen_escalated' || selectedDisputeOrder.escrow_status === 'escrow_frozen' || selectedDisputeOrder.dispute_status === 'escalated') && selectedDisputeOrder.escrow_status !== 'refund_processed' && (
                              <div className="space-y-3">
                                {disputeActionMsg && (
                                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                                    <Icon name="CheckCircleIcon" size={16} className="text-green-600 shrink-0" />
                                    <p className="text-xs text-green-700 font-medium">{disputeActionMsg}</p>
                                  </div>
                                )}

                                {/* Resolution Note */}
                                <div>
                                  <label className="text-xs font-bold text-foreground mb-1.5 block">ملاحظة القرار النهائي (اختياري)</label>
                                  <textarea
                                    value={disputeResolutionNote}
                                    onChange={(e) => setDisputeResolutionNote(e.target.value)}
                                    rows={2}
                                    placeholder="اكتب سبب القرار أو ملاحظة للمشتري والمصنع..."
                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary resize-none"
                                  />
                                </div>

                                {/* إرجاع المبلغ للمشتري */}
                                <div className="border-2 border-red-400 rounded-xl p-4 bg-gradient-to-br from-red-50 to-orange-50 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                                      <Icon name="ArrowUturnLeftIcon" size={20} className="text-red-700" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-bold text-red-900 flex items-center gap-2">
                                        إرجاع المبلغ للمشتري
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-800">إجراء لا رجعة فيه</span>
                                      </h4>
                                      <p className="text-xs text-red-700 mt-0.5">
                                        إذا ثبت إخلال المصنع بشروط البيع، اضغط هذا الزر لإعادة المبلغ الكامل للمشتري وإغلاق الطلب.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="bg-white/70 rounded-lg p-3 border border-red-200 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">المبلغ المسترجع:</span>
                                      <span className="font-bold text-red-700">${selectedDisputeOrder.total?.toLocaleString('en-US')} USD</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">المستفيد:</span>
                                      <span className="font-semibold">{selectedDisputeOrder.user_profiles?.full_name || 'المشتري'}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDisputeRefund(selectedDisputeOrder)}
                                    disabled={disputeActionLoading}
                                    className="w-full h-12 bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-red-200"
                                  >
                                    {disputeActionLoading ? (
                                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ المعالجة...</>
                                    ) : (
                                      <><Icon name="ArrowUturnLeftIcon" size={18} /> إرجاع المبلغ للمشتري</>
                                    )}
                                  </button>
                                </div>

                                {/* إطلاق الأموال للمصنع */}
                                <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                      <Icon name="BanknotesIcon" size={20} className="text-emerald-700" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-semibold text-foreground">إطلاق الأموال للمصنع</h4>
                                      <p className="text-xs text-muted-foreground">
                                        إذا تبيّن أن الشكوى غير مبررة، يمكنك إغلاق النزاع واستئناف صرف المستحقات للمصنع.
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDisputeClose(selectedDisputeOrder)}
                                    disabled={disputeActionLoading}
                                    className="w-full h-10 border-2 border-emerald-400 text-emerald-700 font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors"
                                  >
                                    {disputeActionLoading ? (
                                      <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> جارٍ المعالجة...</>
                                    ) : (
                                      <><Icon name="BanknotesIcon" size={15} /> إطلاق الأموال للمصنع</>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Resolved State */}
                            {selectedDisputeOrder.escrow_status === 'refund_processed' && (
                              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                                <Icon name="CheckBadgeIcon" size={22} className="text-green-600 shrink-0" />
                                <div>
                                  <p className="text-sm font-bold text-green-800">✅ تم الاسترجاع بنجاح</p>
                                  <p className="text-xs text-green-700 mt-0.5">
                                    تم إعادة ${selectedDisputeOrder.total?.toLocaleString('en-US')} USD للمشتري.
                                    {selectedDisputeOrder.refund_processed_at && ` في ${formatTime(new Date(selectedDisputeOrder.refund_processed_at))}`}
                                  </p>
                                  {selectedDisputeOrder.admin_release_note && (
                                    <p className="text-xs text-green-600 mt-1 italic">{selectedDisputeOrder.admin_release_note}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  SUB-TAB: ORDERS MANAGEMENT (original escrow tab content)
              ══════════════════════════════════════════════════════════════ */}
              {escrowSubTab === 'orders' && (
              <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'التحقق من الدفع', count: escrowOrders.filter((o: any) => o.escrow_status === 'pending_verification').length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { label: 'الأموال محجوزة', count: escrowOrders.filter((o: any) => o.escrow_status === 'funds_secured').length, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                  { label: '🔍 جاهز للفحص', count: escrowOrders.filter((o: any) => o.escrow_status === 'ready_for_inspection').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                  { label: '⚡ بانتظار صرف المستحقات', count: pendingPayoutOrders.length, color: pendingPayoutOrders.length > 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400' : 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { label: '🟢 مكتمل', count: escrowOrders.filter((o: any) => o.escrow_status === 'funds_released').length, color: 'bg-green-50 text-green-700 border-green-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                    <p className="text-2xl font-bold">{s.count}</p>
                    <p className="text-xs font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Pending Payout Alert Banner */}
              {pendingPayoutOrders.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-400 rounded-2xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <Icon name="BanknotesIcon" size={24} className="text-emerald-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-base font-bold text-emerald-900">
                          {pendingPayoutOrders.length} طلب بانتظار صرف المستحقات
                        </h3>
                      </div>
                      <p className="text-sm text-emerald-700">
                        المشترون أكدوا الاستلام والفحص. يرجى مراجعة الطلبات والضغط على "صرف المستحقات" لإتمام العملية.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-full">
                        <Icon name="ExclamationCircleIcon" size={12} />
                        إجراء مطلوب
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Orders list */}
              {escrowLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  {/* List */}
                  <div className="lg:col-span-2 space-y-2">
                    {escrowOrders.length === 0 ? (
                      <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <Icon name="ShieldCheckIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No escrow orders yet</p>
                      </div>
                    ) : escrowOrders.map((order: any) => {
                      const cfg = ESCROW_STATUS_CONFIG[order.escrow_status] || ESCROW_STATUS_CONFIG.pending_payment;
                      const isSelected = selectedEscrowOrder?.id === order.id;
                      const needsAction = ['pending_verification', 'funds_secured', 'pending_admin_payout'].includes(order.escrow_status);
                      const isPayoutReady = order.escrow_status === 'pending_admin_payout';
                      return (
                        <button
                          key={order.id}
                          onClick={() => setSelectedEscrowOrder(order)}
                          className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                            isSelected
                              ? 'border-primary shadow-sm': isPayoutReady? 'border-emerald-400 shadow-sm bg-emerald-50/30': 'border-border hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div>
                              <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                              <p className="text-xs text-muted-foreground">{order.user_profiles?.company_name || order.user_profiles?.full_name || 'Unknown Buyer'}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.labelAr || cfg.label}</span>
                              {isPayoutReady && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                                  ⚡ صرف المستحقات
                                </span>
                              )}
                              {needsAction && !isPayoutReady && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Action Needed</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-sm font-bold text-primary">${order.total?.toLocaleString('en-US')} USD</p>
                            <OrderWhatsAppActions
                              buyerPhone={order.user_profiles?.phone}
                              buyerCountry={order.user_profiles?.country}
                              escrowStatus={order.escrow_status}
                              orderStatus={order.status}
                              compact
                            />
                            <ShippingWhatsAppActions
                              phone={order.user_profiles?.phone}
                              country={order.user_profiles?.country}
                              orderNumber={order.order_number || order.id?.slice(0, 8)}
                              orderStatus={order.status}
                              escrowStatus={order.escrow_status}
                              trackingNumber={order.tracking_number}
                              carrier={order.shipping_carrier}
                              compact
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Detail */}
                  <div className="lg:col-span-3">
                    {!selectedEscrowOrder ? (
                      <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Select an order to manage</p>
                      </div>
                    ) : (
                      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-foreground">Order {selectedEscrowOrder.order_number}</h3>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${(ESCROW_STATUS_CONFIG[selectedEscrowOrder.escrow_status] || ESCROW_STATUS_CONFIG.pending_payment).color}`}>
                            {(ESCROW_STATUS_CONFIG[selectedEscrowOrder.escrow_status] || ESCROW_STATUS_CONFIG.pending_payment).labelAr || (ESCROW_STATUS_CONFIG[selectedEscrowOrder.escrow_status] || ESCROW_STATUS_CONFIG.pending_payment).label}
                          </span>
                        </div>

                        {/* Buyer info */}
                        <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Buyer</p>
                          <p className="text-sm font-semibold text-foreground">{selectedEscrowOrder.user_profiles?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{selectedEscrowOrder.user_profiles?.email}</p>
                          {selectedEscrowOrder.user_profiles?.company_name && (
                            <p className="text-xs text-muted-foreground">{selectedEscrowOrder.user_profiles.company_name}</p>
                          )}
                          {/* WhatsApp order notification actions */}
                          <div className="pt-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">إشعارات واتساب</p>
                            <OrderWhatsAppActions
                              buyerPhone={selectedEscrowOrder.user_profiles?.phone}
                              buyerCountry={selectedEscrowOrder.user_profiles?.country}
                              escrowStatus={selectedEscrowOrder.escrow_status}
                              orderStatus={selectedEscrowOrder.status}
                            />
                            <div className="mt-1.5">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">تحديثات الشحن</p>
                              <ShippingWhatsAppActions
                                phone={selectedEscrowOrder.user_profiles?.phone}
                                country={selectedEscrowOrder.user_profiles?.country}
                                orderNumber={selectedEscrowOrder.order_number}
                                orderStatus={selectedEscrowOrder.status}
                                escrowStatus={selectedEscrowOrder.escrow_status}
                                trackingNumber={selectedEscrowOrder.tracking_number}
                                carrier={selectedEscrowOrder.shipping_carrier}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Order summary */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/40 rounded-xl p-3">
                            <p className="text-xs text-muted-foreground">Total Amount</p>
                            <p className="text-lg font-bold text-primary">${selectedEscrowOrder.total?.toLocaleString('en-US')} USD</p>
                          </div>
                          <div className="bg-muted/40 rounded-xl p-3">
                            <p className="text-xs text-muted-foreground">Items</p>
                            <p className="text-lg font-bold text-foreground">{selectedEscrowOrder.items?.length || 0}</p>
                          </div>
                        </div>

                        {/* Receipt */}
                        {selectedEscrowOrder.receipt_url && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                            <Icon name="DocumentIcon" size={18} className="text-blue-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-blue-800">Bank Transfer Receipt</p>
                              <p className="text-xs text-blue-600 truncate">{selectedEscrowOrder.receipt_filename || 'Receipt uploaded'}</p>
                            </div>
                            {selectedEscrowOrder.receipt_url.startsWith('http') && (
                              <a href={selectedEscrowOrder.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 hover:underline shrink-0">View</a>
                            )}
                          </div>
                        )}

                        {/* OTP verified info */}
                        {selectedEscrowOrder.delivery_otp_verified_at && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                            <Icon name="CheckBadgeIcon" size={18} className="text-green-600 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-green-800">✅ المشتري أكد الاستلام والفحص</p>
                              <p className="text-xs text-green-600">
                                تاريخ التأكيد: {formatTime(new Date(selectedEscrowOrder.buyer_confirmed_at || selectedEscrowOrder.delivery_otp_verified_at))}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Transaction Log */}
                        {(selectedEscrowOrder.payment_verified_at || selectedEscrowOrder.delivery_otp_verified_at || selectedEscrowOrder.funds_released_at) && (
                          <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
                              سجل المعاملات
                            </p>
                            {selectedEscrowOrder.payment_verified_at && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                <span className="text-muted-foreground">تم التحقق من الدفع:</span>
                                <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.payment_verified_at))}</span>
                              </div>
                            )}
                            {selectedEscrowOrder.delivery_otp_verified_at && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-muted-foreground">تأكيد الاستلام من المشتري:</span>
                                <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.delivery_otp_verified_at))}</span>
                              </div>
                            )}
                            {selectedEscrowOrder.admin_payout_reviewed_at && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                <span className="text-muted-foreground">مراجعة الإدارة وصرف المستحقات:</span>
                                <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.admin_payout_reviewed_at))}</span>
                              </div>
                            )}
                            {selectedEscrowOrder.funds_released_at && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                <span className="text-muted-foreground">تاريخ إطلاق الأموال:</span>
                                <span className="font-medium text-foreground">{formatTime(new Date(selectedEscrowOrder.funds_released_at))}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Action: Verify Payment ── */}
                        {selectedEscrowOrder.escrow_status === 'pending_verification' && (
                          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
                            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                              <Icon name="BanknotesIcon" size={16} />
                              Verify Bank Transfer
                            </h4>
                            <p className="text-xs text-blue-700">Confirm you have received the bank transfer. This will secure funds in escrow and notify the factory to ship.</p>
                            <div>
                              <label className="text-xs font-medium text-blue-800 mb-1 block">Assign Factory User ID (optional)</label>
                              <input
                                type="text"
                                value={escrowFactoryId}
                                onChange={(e) => setEscrowFactoryId(e.target.value)}
                                placeholder="Factory user UUID (optional)"
                                className="w-full h-9 px-3 rounded-lg border border-blue-200 bg-white text-foreground text-xs focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <button
                              onClick={() => handleVerifyPayment(selectedEscrowOrder)}
                              disabled={escrowActionLoading}
                              className="w-full h-10 bg-blue-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                            >
                              {escrowActionLoading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="LockClosedIcon" size={15} />}
                              Verify & Secure Funds in Escrow
                            </button>
                            <button
                              onClick={() => handleFastTrackOrderApproval(selectedEscrowOrder)}
                              disabled={escrowActionLoading}
                              className="w-full h-10 bg-amber-500 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-600 transition-colors"
                            >
                              {escrowActionLoading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="BoltIcon" size={15} />}
                              ⚡ قبول سريع — Fast-Track (fast_track_initial)
                            </button>
                          </div>
                        )}

                        {/* ── Action: Mark Shipped + Green Light ── */}
                        {selectedEscrowOrder.escrow_status === 'funds_secured' && (
                          <div className="space-y-3">
                            {/* Mark Shipped */}
                            <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50 space-y-3">
                              <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <Icon name="TruckIcon" size={16} />
                                Confirm Goods Shipped
                              </h4>
                              <p className="text-xs text-indigo-700">Once the factory has shipped the goods, mark the order as shipped. The buyer will be notified to confirm receipt.</p>
                              <button
                                onClick={() => handleMarkShipped(selectedEscrowOrder)}
                                disabled={escrowActionLoading}
                                className="w-full h-10 bg-indigo-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
                              >
                                {escrowActionLoading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="TruckIcon" size={15} />}
                                Mark as Shipped
                              </button>
                            </div>

                            {/* Green Light — Release Funds */}
                            <div className="border-2 border-green-400 rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50 space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                                  <span className="text-2xl">🟢</span>
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-green-900">الضوء الأخضر — تحرير الأموال للمصنع</h4>
                                  <p className="text-xs text-green-700 mt-0.5">بعد فحص البضاعة والتأكد منها، اضغط هنا لتحرير الأموال من نظام الضمان وتحويلها للمصنع.</p>
                                </div>
                              </div>
                              <div className="bg-white/70 rounded-lg p-3 border border-green-200">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">المبلغ المحجوز في الضمان:</span>
                                  <span className="font-bold text-green-700">${selectedEscrowOrder.total?.toLocaleString('en-US')} USD</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-green-800 mb-1.5 block">ملاحظة التحرير (اختياري)</label>
                                <input
                                  type="text"
                                  value={escrowReleaseNote}
                                  onChange={(e) => setEscrowReleaseNote(e.target.value)}
                                  placeholder="مثال: تم فحص البضاعة وتأكيد المطابقة"
                                  className="w-full h-9 px-3 rounded-lg border border-green-300 bg-white text-foreground text-xs focus:outline-none focus:border-green-500"
                                />
                              </div>
                              <button
                                onClick={() => handleGreenLight(selectedEscrowOrder)}
                                disabled={escrowActionLoading}
                                className="w-full h-12 bg-green-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-green-700 active:scale-[0.98] transition-all shadow-lg shadow-green-200"
                              >
                                {escrowActionLoading ? (
                                  <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ تحرير الأموال...</>
                                ) : (
                                  <>🟢 إعطاء الضوء الأخضر — تحرير الأموال للمصنع</>
                                )}
                              </button>
                              <p className="text-[10px] text-green-700 text-center">
                                بالضغط، ستُحرَّر الأموال من نظام الضمان وتُرسَل إشعارات فورية للمشتري والمصنع.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* ── Action: صرف المستحقات (Manual Admin Payout) ── */}
                        {selectedEscrowOrder.escrow_status === 'pending_admin_payout' && (
                          <div className="border-2 border-emerald-400 rounded-xl p-5 bg-gradient-to-br from-emerald-50 to-green-50 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                <Icon name="BanknotesIcon" size={20} className="text-emerald-700" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                  صرف المستحقات للمصنع
                                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                    جاهز للصرف
                                  </span>
                                </h4>
                                <p className="text-xs text-emerald-700 mt-0.5">
                                  المشتري أكد استلام وفحص البضاعة. يمكنك الآن الموافقة على صرف المستحقات للمصنع.
                                </p>
                              </div>
                            </div>

                            {/* Confirmation details */}
                            <div className="bg-white/70 rounded-lg p-3 space-y-1.5 border border-emerald-200">
                              <p className="text-xs font-semibold text-emerald-800 mb-2">تفاصيل التأكيد</p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">تأكيد الاستلام:</span>
                                <span className="font-semibold text-foreground">
                                  {selectedEscrowOrder.buyer_confirmed_at
                                    ? new Date(selectedEscrowOrder.buyer_confirmed_at).toLocaleString('ar-SA')
                                    : selectedEscrowOrder.delivery_otp_verified_at
                                    ? new Date(selectedEscrowOrder.delivery_otp_verified_at).toLocaleString('ar-SA'): '—'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">المبلغ المحجوز:</span>
                                <span className="font-bold text-emerald-700">${selectedEscrowOrder.total?.toLocaleString('en-US')} USD</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">المستفيد:</span>
                                <span className="font-semibold text-foreground">{selectedEscrowOrder.user_profiles?.company_name || 'المصنع'}</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-emerald-800 mb-1.5 block">ملاحظة الصرف (اختياري)</label>
                              <input
                                type="text"
                                value={escrowReleaseNote}
                                onChange={(e) => setEscrowReleaseNote(e.target.value)}
                                placeholder="مثال: رقم التحويل TXN-2026-001"
                                className="w-full h-9 px-3 rounded-lg border border-emerald-300 bg-white text-foreground text-xs focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <button
                              onClick={() => handleAdminPayout(selectedEscrowOrder)}
                              disabled={escrowActionLoading}
                              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-200"
                            >
                              {escrowActionLoading ? (
                                <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ صرف المستحقات...</>
                              ) : (
                                <><Icon name="BanknotesIcon" size={18} /> صرف المستحقات</>
                              )}
                            </button>
                            <p className="text-[10px] text-emerald-700 text-center">
                              بالضغط على هذا الزر، ستتم الموافقة على إطلاق الأموال من المحفظة المعلقة إلى حساب المصنع وتحديث حالة الطلب إلى "مكتمل".
                            </p>
                          </div>
                        )}

                        {selectedEscrowOrder.escrow_status === 'funds_released' && (
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0 shadow-lg shadow-green-200">
                                <Icon name="CheckBadgeIcon" size={20} className="text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-green-800">🟢 الضوء الأخضر — تم تحرير الأموال</p>
                                <p className="text-xs text-green-700">الأموال متاحة للمصنع — المعاملة مكتملة بنجاح</p>
                              </div>
                            </div>
                            <p className="text-xs text-green-600">تاريخ التحرير: {formatDate(selectedEscrowOrder.funds_released_at) || 'N/A'}</p>
                            {selectedEscrowOrder.escrow_released_by_code_at && (
                              <p className="text-xs text-green-600 mt-0.5">✅ تم التحرير برمز إتمام العملية من المشتري</p>
                            )}
                            {selectedEscrowOrder.payout_note && <p className="text-xs text-green-600 mt-0.5">{selectedEscrowOrder.payout_note}</p>}
                          </div>
                        )}

                        {/* ── Ready for Inspection indicator (admin view) ── */}
                        {selectedEscrowOrder.escrow_status === 'ready_for_inspection' && (
                          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                            <Icon name="MagnifyingGlassIcon" size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-amber-800">🔍 جاهز للفحص — بانتظار المشتري</p>
                              <p className="text-xs text-amber-700 mt-0.5">أعلن المصنع جاهزية البضاعة. المشتري سيدخل رمز إتمام العملية لتحرير الأموال تلقائياً.</p>
                              {selectedEscrowOrder.ready_for_inspection_at && (
                                <p className="text-xs text-amber-600 mt-1">تاريخ الإعلان: {formatDate(selectedEscrowOrder.ready_for_inspection_at)}</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ── Generate & Email Commercial Invoice ── */}
                        {['funds_secured', 'shipped', 'pending_otp_confirmation', 'funds_released'].includes(selectedEscrowOrder.escrow_status) && (
                          <div className="border border-amber-200 rounded-xl p-4 bg-amber-50 space-y-3">
                            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                              <Icon name="DocumentTextIcon" size={16} />
                              Commercial Invoice
                            </h4>
                            <p className="text-xs text-amber-700">
                              Auto-generate an official commercial invoice with buyer/supplier details and itemized products, then email it to the buyer via Resend.
                            </p>
                            {invoiceSuccess && (
                              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                                <Icon name="CheckCircleIcon" size={14} className="text-green-600 shrink-0" />
                                <p className="text-xs text-green-700 font-medium">{invoiceSuccess}</p>
                              </div>
                            )}
                            <button
                              onClick={() => handleGenerateInvoice(selectedEscrowOrder)}
                              disabled={invoiceGenerating}
                              className="w-full h-10 bg-amber-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors"
                            >
                              {invoiceGenerating ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="EnvelopeIcon" size={15} />}
                              {invoiceGenerating ? 'Generating...' : 'Generate & Email Invoice'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
          );
        })()}

        {activeTab === 'amal' && (
          <AmalPanel
            analytics={analytics}
            verificationQueue={verificationQueue}
            orders={liveOrders}
            rfqs={liveRFQs}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: RFQ MANAGEMENT — Admin Control Room Oversight
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'rfq_management' && (
          <RFQManagementPanel rfqs={liveRFQs} onRefresh={fetchAll} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: SYSTEM HEALTH — Diagnostic Dashboard
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'system_health' && (
          <SystemHealthPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PLATFORM DIAGNOSTICS — Smart Health Check & Diagnostics
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'platform_diagnostics' && (
          <PlatformDiagnosticsPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: AMAL LOGS — Customer Service Conversation History
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'amal_logs' && (
          <AmalLogsPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: BUYER-SELLER CHAT MONITOR — Platform Communication Oversight
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'buyer_seller_chat' && (
          <BuyerSellerChatMonitorPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: SMART RFQ ROUTING — AI-Powered Supplier Matching
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'smart_rfq_routing' && (
          <SmartRFQRoutingPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: AI SYSTEM AUDITOR — Gap & Bug Inspector
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ai_auditor' && (
          <AISystemAuditorPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: CHANGELOG & NOTIFICATIONS — سجل التحديثات ونشر الإشعارات
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'changelog' && (
          <ChangelogNotificationPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: SUPPLIER ALERT ENGINE — محرك التنبيهات والتصعيد التلقائي
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'supplier_alerts' && (
          <SupplierAlertEnginePanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: EXECUTIVE NOTIFICATION RADAR — رادار الإشعارات التنفيذية
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'executive_radar' && (
          <ExecutiveNotificationRadar />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: ISSUE CARDS — بطاقات معالجة الأخطاء والتحسينات
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'issue_cards' && (
          <IssueCardsPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: WHATSAPP AUTOMATION — منظومة أتمتة الواتساب
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'whatsapp_automation' && (
          <WhatsAppAutomationPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: IDEA GENERATOR — موتور توليد الأفكار ورصد النواقص
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'idea_generator' && (
          <IdeaGeneratorPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: DATABASE EXPLORER — Platform Data Schema & Records
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'db_explorer' && (
          <DatabaseExplorerPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: TREASURY — خزينة المنصة
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'treasury' && (
          <TreasuryPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: ROLE SIMULATION — محاكاة الأدوار
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'role_simulation' && (
          <RoleSimulationPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: BROADCAST CENTER — مركز البث والإعلانات
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'broadcast_center' && (
          <BroadcastCenterPanel />
        )}

        {activeTab === 'push_scheduler' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <PushSchedulerPanel />
          </div>
        )}

        {activeTab === 'abandoned_cart' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <AbandonedCartPanel />
          </div>
        )}

        {activeTab === 'sitemap_hub' && (
          <SitemapHubPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: INTERNATIONAL FACTORIES — غرفة تحكم المصانع الدولية
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'international_factories' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-sky-600 to-blue-700 rounded-2xl p-5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">غرفة تحكم المصانع الدولية</h3>
                <p className="text-white/70 text-sm mt-1">إدارة شاملة للمصانع الدولية المسجلة على المنصة</p>
              </div>
              <a
                href="/international-factories"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors"
              >
                <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                فتح الصفحة الكاملة
              </a>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Icon name="GlobeAltIcon" size={48} className="text-sky-400 mx-auto mb-4" />
              <p className="text-foreground font-semibold mb-2">غرفة التحكم الكاملة للمصانع الدولية</p>
              <p className="text-muted-foreground text-sm mb-4">
                تتضمن: إدارة المصانع، التحقق والموافقة، المنتجات الدولية، والتحليلات
              </p>
              <a
                href="/international-factories"
                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <Icon name="GlobeAltIcon" size={16} />
                فتح غرفة تحكم المصانع الدولية
              </a>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TABS: VERIFICATION & ESCROW ENGINES
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'live_infra' && <LiveUpdatesInfraPanel />}
        {activeTab === 'phased_escrow' && <PhasedEscrowPanel />}
        {activeTab === 'iban_verification' && <IBANVerificationPanel />}
        {activeTab === 'ocr_verification' && <OCRVerificationPanel />}
        {activeTab === 'customs_validator' && <CustomsValidatorPanel />}
        {activeTab === 'manual_review_queue' && (
          <ManualReviewQueuePanel onNavigate={(tab) => setActiveTab(tab as ActiveTab)} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: OVERVIEW — Platform Analytics Dashboard
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Accreditation Inquiry Banner */}
            <AccreditationInquiryBanner onViewVerification={() => setActiveTab('verification')} />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: ui.overview.totalRevenue, value: `$${analytics.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: analytics.revenueGrowth, icon: 'CurrencyDollarIcon', color: 'text-emerald-600 bg-emerald-50', drill: 'revenue' as const },
                { label: ui.overview.totalOrders, value: analytics.totalOrders.toString(), sub: `${analytics.deliveredOrders} ${ui.overview.delivered}`, icon: 'ShoppingBagIcon', color: 'text-blue-600 bg-blue-50', drill: 'orders' as const },
                { label: ui.overview.totalFactories, value: analytics.activeFactories.toString(), sub: `${analytics.pendingVerifications} ${ui.overview.pendingVerification}`, icon: 'BuildingOffice2Icon', color: 'text-orange-600 bg-orange-50', drill: 'factories' as const },
                { label: ui.overview.totalUsers, value: analytics.totalUsers.toString(), sub: `+${analytics.newUsersYesterday} ${ui.overview.newSinceYesterday}`, icon: 'UsersIcon', color: 'text-sky-600 bg-sky-50', drill: 'users' as const },
              ].map(card => (
                <button key={card.label} onClick={() => setDrillDown(card.drill)} className="bg-card border border-border rounded-2xl p-5 text-left hover:shadow-md transition-all hover:-translate-y-0.5 group">
                  <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                    <Icon name={card.icon as any} size={20} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 font-medium">{card.sub}</p>
                </button>
              ))}
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: ui.overview.platformCommission, value: `$${analytics.platformCommission.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: 'BanknotesIcon', color: 'text-amber-600' },
                { label: ui.overview.disputedOrders, value: analytics.disputedOrders.toString(), icon: 'ShieldExclamationIcon', color: analytics.disputedOrders > 0 ? 'text-red-600' : 'text-emerald-600', onClick: () => setDrillDown('disputes') },
                { label: ui.overview.totalProducts, value: analytics.totalProducts.toString(), icon: 'ArchiveBoxIcon', color: 'text-purple-600' },
                { label: 'شركاء اللوجستيات', value: analytics.logisticsPartnersCount.toString(), icon: 'TruckIcon', color: 'text-teal-600' },
              ].map(card => (
                <div key={card.label} onClick={card.onClick} className={`bg-card border border-border rounded-xl p-4 ${card.onClick ? 'cursor-pointer hover:shadow-sm' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name={card.icon as any} size={16} className={card.color} />
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Admin Actions Row */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleRefreshData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {loading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="ArrowPathIcon" size={15} />}
                تحديث البيانات
              </button>
              <button
                onClick={handleExportAuditLog}
                disabled={auditExporting}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-800 transition-colors"
              >
                {auditExporting ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="ArrowDownTrayIcon" size={15} />}
                تصدير سجل التدقيق
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="BoltIcon" size={16} className="text-amber-500" />
                إجراءات سريعة
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'مراجعة التحقق', icon: 'DocumentCheckIcon', tab: 'verification' as ActiveTab, badge: analytics.pendingVerifications, color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
                  { label: 'إدارة الضمان', icon: 'ShieldCheckIcon', tab: 'escrow' as ActiveTab, badge: 0, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
                  { label: 'مراقبة المحادثات', icon: 'ChatBubbleLeftRightIcon', tab: 'buyer_seller_chat' as ActiveTab, badge: 0, color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
                  { label: 'إعدادات المنصة', icon: 'Cog6ToothIcon', tab: 'platform_settings' as ActiveTab, badge: 0, color: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' },
                  { label: 'المدفوعات', icon: 'CreditCardIcon', tab: 'payments' as ActiveTab, badge: 0, color: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' },
                  { label: 'الحسابات والأرصدة', icon: 'BanknotesIcon', tab: 'accounts' as ActiveTab, badge: 0, color: 'bg-lime-50 border-lime-200 text-lime-700 hover:bg-lime-100' },
                  { label: 'المندوبون الميدانيون', icon: 'UserGroupIcon', tab: 'field_agents' as ActiveTab, badge: pendingLicenses.length, color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
                  { label: 'دليل الصفحات', icon: 'MapIcon', tab: 'page_directory' as ActiveTab, badge: 0, color: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' },
                ].map(action => (
                  <button
                    key={action.label}
                    onClick={() => {
                      setActiveTab(action.tab);
                      if (action.tab === 'field_agents' && agentFactories.length === 0) fetchFieldAgentsData();
                      if (action.tab === 'payments' && allPayments.length === 0) fetchPayments();
                      if (action.tab === 'accounts' && accountsData.users.length === 0) fetchAccountsData();
                    }}
                    className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${action.color}`}
                  >
                    <Icon name={action.icon as any} size={15} />
                    {action.label}
                    {action.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                        {action.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Icon name="ShoppingBagIcon" size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-foreground">آخر الطلبات</h3>
                </div>
                <button onClick={() => setActiveTab('escrow')} className="text-xs text-primary font-semibold hover:underline">عرض الكل ←</button>
              </div>
              <div className="divide-y divide-border">
                {liveOrders.slice(0, 8).map((o: any) => (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Icon name="ShoppingBagIcon" size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground font-mono truncate">{o.id?.slice(0, 12)}…</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{o.status}</p>
                    </div>
                    <p className="text-sm font-bold text-primary shrink-0">${(o.total || 0).toLocaleString('en-US')}</p>
                  </div>
                ))}
                {liveOrders.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">لا توجد طلبات بعد</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: VERIFICATION — Factory & Supplier KYC Queue
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'verification' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="DocumentCheckIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">طابور التحقق والاعتماد</h2>
                  <p className="text-sm text-white/80">مراجعة واعتماد طلبات تسجيل المصانع والموردين</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold">{analytics.pendingVerifications}</p>
                  <p className="text-xs text-white/70">بانتظار المراجعة</p>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setVerifFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    verifFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f === 'all' ? 'الكل' : f === 'pending' ? 'معلق' : f === 'under_review' ? 'قيد المراجعة' : f === 'approved' ? 'معتمد' : 'مرفوض'}
                  <span className="mr-1.5 text-[10px]">({verificationQueue.filter(r => f === 'all' || r.registration_status === f).length})</span>
                </button>
              ))}
            </div>

            {/* Bulk Actions */}
            {bulkSelected.size > 0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <span className="text-xs font-bold text-blue-800">{bulkSelected.size} محدد</span>
                <button onClick={handleBulkApprove} disabled={bulkActionLoading} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-emerald-700">
                  {bulkActionLoading ? '...' : '✅ موافقة جماعية'}
                </button>
                <button onClick={handleBulkReject} disabled={bulkActionLoading} className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-red-700">
                  {bulkActionLoading ? '...' : '❌ رفض جماعي'}
                </button>
                <button onClick={() => setBulkSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">إلغاء</button>
              </div>
            )}

            {/* Verification List + Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* List */}
              <div className="lg:col-span-2 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                  </div>
                ) : filteredVerifications.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <Icon name="CheckCircleIcon" size={28} className="text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لا توجد طلبات في هذه الفئة</p>
                  </div>
                ) : filteredVerifications.map(reg => {
                  const isSelected = selectedVerification?.id === reg.id;
                  const isChecked = bulkSelected.has(reg.id);
                  return (
                    <div
                      key={reg.id}
                      className={`bg-card rounded-xl border-2 p-4 transition-all cursor-pointer ${
                        isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-primary/40'
                      }`}
                      onClick={() => { setSelectedVerification(reg); setAdminNote(reg.admin_note || ''); }}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            e.stopPropagation();
                            setBulkSelected(prev => {
                              const next = new Set(prev);
                              if (isChecked) next.delete(reg.id); else next.add(reg.id);
                              return next;
                            });
                          }}
                          className="mt-1 shrink-0"
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-bold text-foreground truncate">{reg.company_name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[reg.registration_status] || ''}`}>
                              {reg.registration_status === 'pending' ? 'معلق' : reg.registration_status === 'under_review' ? 'قيد المراجعة' : reg.registration_status === 'approved' ? 'معتمد' : 'مرفوض'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{reg.country} · {reg.industry}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{reg.user_profiles?.email}</p>
                          {reg.submitted_at && <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(reg.submitted_at)}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail Panel */}
              <div className="lg:col-span-3">
                {!selectedVerification ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{ui.verification.selectRequestHint}</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-amber-50/50 to-transparent">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-foreground">{selectedVerification.company_name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{selectedVerification.user_profiles?.email}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_BADGE[selectedVerification.registration_status] || ''}`}>
                          {selectedVerification.registration_status}
                        </span>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* Company Info */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'الدولة', value: selectedVerification.country },
                          { label: 'المدينة', value: selectedVerification.city },
                          { label: 'الصناعة', value: selectedVerification.industry },
                          { label: 'عدد الموظفين', value: selectedVerification.employee_count },
                          { label: 'جهة الاتصال', value: selectedVerification.contact_name },
                          { label: 'الهاتف', value: selectedVerification.contact_phone },
                        ].map(item => (
                          <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                            <p className="text-sm font-semibold text-foreground">{item.value || '—'}</p>
                          </div>
                        ))}
                      </div>

                      {/* WhatsApp */}
                      {selectedVerification.contact_phone && (
                        <WhatsAppActivationButton
                          phone={selectedVerification.contact_phone}
                          companyName={selectedVerification.company_name}
                          entityType={selectedVerification.seller_category === 'local_supplier' ? 'supplier' : 'factory'}
                          country={selectedVerification.country}
                        />
                      )}

                      {/* Documents */}
                      <div className="space-y-2">
                        {[
                          { label: ui.docs.tradeLicense, url: selectedVerification.trade_license_url },
                          { label: ui.docs.taxCert, url: selectedVerification.tax_certificate_url },
                          { label: ui.docs.companyProfile, url: selectedVerification.company_profile_url },
                          { label: ui.docs.cr, url: selectedVerification.cr_document_url },
                          { label: ui.docs.manufacturingLicense, url: selectedVerification.manufacturing_license_url },
                          { label: ui.docs.factoryLicense, url: selectedVerification.factory_license_url },
                        ].filter(d => d.url).map(doc => (
                          <div key={doc.label} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                            <span className="text-xs font-medium text-foreground">{doc.label}</span>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                              <Icon name="EyeIcon" size={12} /> عرض
                            </a>
                          </div>
                        ))}
                      </div>

                      {/* Admin Note */}
                      <div>
                        <label className="text-xs font-semibold text-foreground mb-1.5 block">ملاحظة الإدارة</label>
                        <textarea
                          value={adminNote}
                          onChange={e => setAdminNote(e.target.value)}
                          rows={2}
                          placeholder="أضف ملاحظة للمصنع أو سبب القرار..."
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary resize-none"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleVerificationAction(selectedVerification, 'approve')}
                          disabled={actionLoading}
                          className="h-10 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700"
                        >
                          {actionLoading ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="CheckCircleIcon" size={14} />}
                          موافقة
                        </button>
                        <button
                          onClick={() => handleFastTrackApproval(selectedVerification)}
                          disabled={actionLoading}
                          className="h-10 bg-amber-500 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-600"
                        >
                          <Icon name="BoltIcon" size={14} />
                          ⚡ قبول سريع
                        </button>
                        <button
                          onClick={() => handleVerificationAction(selectedVerification, 'under_review')}
                          disabled={actionLoading}
                          className="h-10 bg-blue-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-700"
                        >
                          <Icon name="ClockIcon" size={14} />
                          قيد المراجعة
                        </button>
                        <button
                          onClick={() => handleVerificationAction(selectedVerification, 'reject')}
                          disabled={actionLoading}
                          className="h-10 bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-700"
                        >
                          <Icon name="XCircleIcon" size={14} />
                          رفض
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fast-Track & Product Approval Panels */}
            <FastTrackApprovalPanel />
            <ProductApprovalTogglePanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: USERS — User Management
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="UsersIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">إدارة المستخدمين</h2>
                  <p className="text-sm text-white/80">عرض وتعديل وإدارة جميع حسابات المستخدمين</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold">{analytics.totalUsers}</p>
                  <p className="text-xs text-white/70">مستخدم مسجّل</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="MagnifyingGlassIcon" size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="بحث بالاسم أو البريد أو الشركة..."
                  className="w-full pr-8 pl-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  dir={dir}
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={e => setUserRoleFilter(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              >
                <option value="all">كل الأدوار</option>
                <option value="buyer">مشتري</option>
                <option value="manufacturer">مصنّع / مورد</option>
                <option value="admin">مسؤول</option>
              </select>
              <button
                onClick={() => setShowNewUsersOnly(!showNewUsersOnly)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${showNewUsersOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
              >
                الجدد فقط
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <span className="text-sm font-bold text-foreground">المستخدمون ({sortedUsers.length})</span>
                <button onClick={() => fetchAll()} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                  <Icon name="ArrowPathIcon" size={12} /> تحديث
                </button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]" dir={dir}>
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground cursor-pointer" onClick={() => toggleUserSort('full_name')}>
                          <div className="flex items-center gap-1">الاسم <SortIcon col="full_name" state={userSort} /></div>
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">البريد</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الدور</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الحالة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground cursor-pointer" onClick={() => toggleUserSort('created_at')}>
                          <div className="flex items-center gap-1">التاريخ <SortIcon col="created_at" state={userSort} /></div>
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedUsers.slice(0, 100).map(u => (
                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground truncate max-w-[140px]">{u.full_name || '—'}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{u.company_name || ''}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[u.role] || 'bg-muted text-muted-foreground'}`}>
                              {ROLE_LABELS_I18N[language]?.[u.role] || u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleToggleUserVerification(u)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${u.is_verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}
                            >
                              {u.is_verified ? '✅ مفعّل' : '❌ غير مفعّل'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted-foreground">{formatDate(u.created_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setEditUserForm({ full_name: u.full_name, company_name: u.company_name, phone: u.phone, country: u.country, role: u.role, is_verified: u.is_verified });
                                  setShowEditUser(true);
                                  if (u.role === 'manufacturer') fetchSupplierDocs(u.id);
                                }}
                                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 border border-blue-200"
                              >
                                تعديل
                              </button>
                              <button
                                onClick={() => { setDeleteTarget({ id: u.id, name: u.full_name || u.email }); setShowDeleteConfirm(true); }}
                                className="px-2 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-100 border border-red-200"
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: FACTORIES — Factory & Supplier Management
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'factories' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="BuildingOffice2Icon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">إدارة المصانع والموردين</h2>
                  <p className="text-sm text-white/80">عرض وإدارة جميع المصانع والموردين المسجّلين</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold">{factories.length}</p>
                  <p className="text-xs text-white/70">مصنع / مورد</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="MagnifyingGlassIcon" size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
                <input
                  type="text"
                  value={factorySearch}
                  onChange={e => setFactorySearch(e.target.value)}
                  placeholder="بحث بالاسم أو البريد..."
                  className="w-full pr-8 pl-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  dir={dir}
                />
              </div>
              <select
                value={factoryStatusFilter}
                onChange={e => setFactoryStatusFilter(e.target.value as any)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">معلق</option>
                <option value="approved">معتمد</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>

            {/* Factories Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <span className="text-sm font-bold text-foreground">المصانع والموردون ({sortedFactories.length})</span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]" dir={dir}>
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground cursor-pointer" onClick={() => toggleFactorySort('company_name')}>
                          <div className="flex items-center gap-1">الشركة <SortIcon col="company_name" state={factorySort} /></div>
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الدولة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الصناعة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الحالة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المنتجات</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sortedFactories.slice(0, 100).map(f => (
                        <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground truncate max-w-[160px]">{f.company_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{f.user_profiles?.email || ''}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-foreground">{f.country || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-foreground truncate max-w-[100px]">{f.industry || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[f.registration_status] || 'bg-muted text-muted-foreground'}`}>
                              {f.registration_status === 'pending' ? 'معلق' : f.registration_status === 'under_review' ? 'قيد المراجعة' : f.registration_status === 'approved' ? 'معتمد' : 'مرفوض'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${f.product_listing_unlocked ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                              {f.product_listing_unlocked ? '✅ مفعّل' : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => { setSelectedVerification(f); setAdminNote(f.admin_note || ''); setActiveTab('verification'); }}
                                className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg hover:bg-amber-100 border border-amber-200"
                              >
                                مراجعة
                              </button>
                              <button
                                onClick={() => handleToggleFactory(f)}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors ${f.is_active ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}
                              >
                                {f.is_active ? 'إيقاف' : 'تفعيل'}
                              </button>
                              <button
                                onClick={() => handleToggleProductListing(f)}
                                title={f.product_listing_unlocked ? 'إيقاف إضافة المنتجات' : 'السماح بإضافة المنتجات'}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors ${f.product_listing_unlocked ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                              >
                                {f.product_listing_unlocked ? '🔓 منتجات' : '🔒 منتجات'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Factory Onboarding Mode */}
            <FactoryOnboardingModePanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: MESSAGES — Chat Monitoring (redirects to BuyerSellerChatMonitorPanel)
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">مراقبة المحادثات</h2>
                  <p className="text-sm text-white/80">مراقبة محادثات المشترين والموردين على المنصة</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setActiveTab('buyer_seller_chat')} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2">
                    <Icon name="ChatBubbleLeftRightIcon" size={14} />
                    مراقبة المحادثات الكاملة
                  </button>
                  <button onClick={() => setActiveTab('admin_messaging')} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2">
                    <Icon name="PaperAirplaneIcon" size={14} />
                    المراسلة المتكاملة
                  </button>
                </div>
              </div>
            </div>
            <BuyerSellerChatMonitorPanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: DIRECT ORDERS — Direct Order Management
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'direct_orders' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="PaperAirplaneIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">الطلبات المباشرة</h2>
                  <p className="text-sm text-white/80">إدارة ومتابعة الطلبات المباشرة على المنصة</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold">{liveOrders.length}</p>
                  <p className="text-xs text-white/70">طلب إجمالي</p>
                </div>
              </div>
            </div>

            {/* Orders Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'معلق', count: liveOrders.filter((o: any) => o.status === 'pending').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
                { label: 'قيد المعالجة', count: liveOrders.filter((o: any) => o.status === 'processing').length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                { label: 'تم الشحن', count: liveOrders.filter((o: any) => o.status === 'shipped').length, color: 'bg-purple-50 text-purple-700 border-purple-200' },
                { label: 'تم التسليم', count: liveOrders.filter((o: any) => o.status === 'delivered').length, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                { label: 'نزاع', count: liveOrders.filter((o: any) => o.dispute_status === 'reported').length, color: 'bg-red-50 text-red-700 border-red-200' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Orders Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <span className="text-sm font-bold text-foreground">الطلبات ({liveOrders.length})</span>
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab('escrow')} className="text-xs text-primary font-semibold hover:underline">إدارة الضمان ←</button>
                  <button onClick={() => fetchAll()} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Icon name="ArrowPathIcon" size={12} /> تحديث
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                <table className="w-full text-sm min-w-[500px]" dir={dir}>
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">رقم الطلب</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المبلغ</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الحالة</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الضمان</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">التاريخ</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {liveOrders.slice(0, 50).map((o: any) => (
                      <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-foreground">{o.id?.slice(0, 12)}…</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-primary">${(o.total || 0).toLocaleString('en-US')}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{o.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-semibold text-muted-foreground">{o.escrow_status || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setActiveTab('escrow')}
                            className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 border border-indigo-200"
                          >
                            إدارة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: ADMIN MESSAGING — Integrated Messaging Panel
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'admin_messaging' && (
          <AdminMessagingPanel userId={user?.id || ''} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PLATFORM SETTINGS — Configuration & Settings
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'platform_settings' && (() => {
          if (!platformSettingsLoaded && !platformSettingsLoading) {
            setPlatformSettingsLoaded(true);
            fetchPlatformSettings();
          }
          return (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-600 to-slate-800 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="Cog6ToothIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">إعدادات المنصة</h2>
                  <p className="text-sm text-white/80">تكوين وضبط إعدادات المنصة العامة</p>
                </div>
                <button
                  onClick={() => { fetchPlatformSettings(); }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                  <Icon name="ArrowPathIcon" size={14} />
                  تحميل الإعدادات
                </button>
              </div>
            </div>

            {platformSettingsMsg && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${platformSettingsMsg.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                <Icon name={platformSettingsMsg.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={16} />
                {platformSettingsMsg.text}
              </div>
            )}

            {platformSettingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            ) : Object.keys(platformSettingsForm).length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Icon name="Cog6ToothIcon" size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">لا توجد إعدادات محملة</p>
                <p className="text-xs text-muted-foreground mb-4">اضغط "تحميل الإعدادات" لعرض وتعديل إعدادات المنصة</p>
                <button onClick={fetchPlatformSettings} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90">
                  تحميل الإعدادات
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAllPlatformSettings}
                    disabled={platformSettingsSaving === 'all'}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 hover:opacity-90"
                  >
                    {platformSettingsSaving === 'all' ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="CheckIcon" size={14} />}
                    حفظ جميع الإعدادات
                  </button>
                </div>
                {Object.entries(platformSettingsForm).map(([key, value]) => (
                  <div key={key} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-foreground mb-1.5 block font-mono">{key}</label>
                        <input
                          type="text"
                          value={value}
                          onChange={e => setPlatformSettingsForm(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        onClick={() => handleSavePlatformSetting(key)}
                        disabled={platformSettingsSaving === key}
                        className="h-9 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 shrink-0"
                      >
                        {platformSettingsSaving === key ? <Icon name="ArrowPathIcon" size={12} className="animate-spin" /> : <Icon name="CheckIcon" size={12} />}
                        حفظ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PAYMENTS — Payment Transactions Management
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payments' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="CreditCardIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">إدارة المدفوعات</h2>
                  <p className="text-sm text-white/80">مراقبة وإدارة جميع معاملات الدفع على المنصة</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-bold">{allPayments.length}</p>
                  <p className="text-xs text-white/70">معاملة</p>
                </div>
              </div>
            </div>

            {/* Payment Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'إجمالي المدفوعات', value: `$${allPayments.reduce((s: number, p: any) => s + (p.total || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                { label: 'تم التحقق', value: allPayments.filter((p: any) => p.payment_verified).length.toString(), color: 'text-blue-600 bg-blue-50 border-blue-200' },
                { label: 'بانتظار التحقق', value: allPayments.filter((p: any) => !p.payment_verified && p.status !== 'cancelled').length.toString(), color: 'text-amber-600 bg-amber-50 border-amber-200' },
                { label: 'ملغي', value: allPayments.filter((p: any) => p.status === 'cancelled').length.toString(), color: 'text-red-600 bg-red-50 border-red-200' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Search & Filter */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="MagnifyingGlassIcon" size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground" />
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={e => setPaymentSearch(e.target.value)}
                  placeholder="بحث برقم الطلب أو اسم المشتري..."
                  className="w-full pr-8 pl-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary"
                  dir={dir}
                />
              </div>
              <select
                value={paymentStatusFilter}
                onChange={e => setPaymentStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-primary"
              >
                <option value="all">كل الحالات</option>
                <option value="pending">معلق</option>
                <option value="processing">قيد المعالجة</option>
                <option value="delivered">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
              <button onClick={fetchPayments} disabled={paymentsLoading} className="h-9 px-3 bg-primary text-primary-foreground rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5">
                {paymentsLoading ? <Icon name="ArrowPathIcon" size={13} className="animate-spin" /> : <Icon name="ArrowPathIcon" size={13} />}
                تحديث
              </button>
            </div>

            {/* Payments Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {paymentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
                </div>
              ) : allPayments.length === 0 ? (
                <div className="py-12 text-center">
                  <Icon name="CreditCardIcon" size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد مدفوعات. اضغط "تحديث" لتحميل البيانات.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]" dir={dir}>
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">رقم الطلب</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المشتري</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">المبلغ</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">طريقة الدفع</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">الحالة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">التحقق</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allPayments
                        .filter((p: any) => {
                          const matchSearch = !paymentSearch ||
                            (p.order_number || '').toLowerCase().includes(paymentSearch.toLowerCase()) ||
                            (p.user_profiles?.full_name || '').toLowerCase().includes(paymentSearch.toLowerCase()) ||
                            (p.user_profiles?.company_name || '').toLowerCase().includes(paymentSearch.toLowerCase());
                          const matchStatus = paymentStatusFilter === 'all' || p.status === paymentStatusFilter;
                          return matchSearch && matchStatus;
                        })
                        .slice(0, 100)
                        .map((p: any) => (
                          <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-mono text-xs font-bold text-foreground">{p.order_number || p.id?.slice(0, 12)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{p.user_profiles?.company_name || p.user_profiles?.full_name || '—'}</p>
                              <p className="text-[10px] text-muted-foreground">{p.user_profiles?.country || ''}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-primary">${(p.total || 0).toLocaleString('en-US')}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">{p.payment_method || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{p.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.payment_verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {p.payment_verified ? '✅ محقق' : '⏳ بانتظار'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PENDING PAYMENT APPROVAL — Manual Payment Verification
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'pending_payment_approval' && (
          <PendingPaymentApprovalPanel adminUserId={user?.id || ''} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: ACCOUNTS — Balances & Financial Accounts
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'accounts' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-lime-600 to-green-700 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="BanknotesIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">الأرصدة والحسابات</h2>
                  <p className="text-sm text-white/80">إدارة أرصدة المستخدمين والعمولات والفواتير</p>
                </div>
                <button onClick={fetchAccountsData} disabled={accountsLoading} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2">
                  {accountsLoading ? <Icon name="ArrowPathIcon" size={14} className="animate-spin" /> : <Icon name="ArrowPathIcon" size={14} />}
                  تحديث
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'إجمالي العمولات', value: `$${accountsData.commissions.reduce((s: number, c: any) => s + (c.commission_amount || 0), 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: 'CurrencyDollarIcon', color: 'text-amber-600 bg-amber-50 border-amber-200' },
                { label: 'عدد الفواتير', value: (accountsData.invoices?.length || 0).toString(), icon: 'DocumentTextIcon', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                { label: 'المستخدمون النشطون', value: accountsData.users.filter((u: any) => u.is_verified).length.toString(), icon: 'UsersIcon', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name={s.icon as any} size={16} />
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Commissions Table */}
            {accountsData.commissions.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Icon name="CurrencyDollarIcon" size={15} className="text-amber-600" />
                  <span className="text-sm font-bold text-foreground">سجل العمولات ({accountsData.commissions.length})</span>
                </div>
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 max-h-64">
                  <table className="w-full text-sm min-w-[500px]" dir={dir}>
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">رقم الطلب</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">العمولة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">النسبة</th>
                        <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {accountsData.commissions.slice(0, 50).map((c: any) => (
                        <tr key={c.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5"><p className="font-mono text-xs">{c.order_id?.slice(0, 12) || '—'}</p></td>
                          <td className="px-4 py-2.5"><p className="font-bold text-amber-600">${(c.commission_amount || 0).toLocaleString('en-US')}</p></td>
                          <td className="px-4 py-2.5"><p className="text-xs text-muted-foreground">{c.commission_rate ? `${(c.commission_rate * 100).toFixed(1)}%` : '—'}</p></td>
                          <td className="px-4 py-2.5"><p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {accountsLoading && (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            )}

            {!accountsLoading && accountsData.commissions.length === 0 && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Icon name="BanknotesIcon" size={36} className="text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">اضغط "تحديث" لتحميل بيانات الحسابات</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: LOGISTICS — Logistics Partners Management
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logistics' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon name="TruckIcon" size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold">إدارة اللوجستيات</h2>
                  <p className="text-sm text-white/80">إدارة شركاء الشحن والتوصيل على المنصة</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setActiveTab('logistics_dashboard')} className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2">
                    <Icon name="ChartBarSquareIcon" size={14} />
                    لوحة اللوجستيات الكاملة
                  </button>
                </div>
              </div>
            </div>
            <AdminLogisticsPanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: LOGISTICS DASHBOARD — Full Logistics Panel
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logistics_dashboard' && (
          <LogisticsDashboardPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: LOGISTICS DISPUTES — Dispute Arbitration Panel
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'logistics_disputes' && (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 p-5" style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #2d0f0f 50%, #1a0a0a 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Icon name="ScaleIcon" size={20} className="text-red-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white">نافذة التحكيم وإغلاق النزاعات اللوجستية</h2>
                  <p className="text-xs text-red-300/70">Logistics Dispute Arbitration — Admin Control</p>
                </div>
              </div>
            </div>
            <AdminDisputeArbitrationPanel adminUserId={user?.id || ''} />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: FIELD AGENTS — Field Representatives Management
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'field_agents' && (
          <FieldRepresentativesPanel
            fieldAgents={fieldAgents}
            agentFactories={agentFactories}
            agentProducts={agentProducts}
            agentLoading={agentLoading}
            onRefresh={fetchFieldAgentsData}
            adminUserId={user?.id || ''}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: PAGE DIRECTORY — Platform Sitemap & Page Directory
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'page_directory' && (
          <SitemapHubPanel />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB: SUPPLIER DASHBOARD — Commercial Supplier Dashboard
        ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'supplier_dashboard' && (
          <SupplierManagementPanel adminUserId={user?.id || ''} />
        )}

          </div>
        </div>

      </div>
    </div>
  );
}